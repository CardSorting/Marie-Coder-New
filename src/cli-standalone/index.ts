#!/usr/bin/env node
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Anthropic } from '@anthropic-ai/sdk';

// Use global process
const nodeProcess = globalThis.process;

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

interface Config {
    apiKey?: string;
    model: string;
}

const MARIE_DIR = path.join(os.homedir(), '.marie');
const CONFIG_FILE = path.join(MARIE_DIR, 'config.json');

function loadConfig(): Config {
    if (!fs.existsSync(MARIE_DIR)) fs.mkdirSync(MARIE_DIR, { recursive: true });
    if (!fs.existsSync(CONFIG_FILE)) return { model: 'claude-3-5-sonnet-20241022' };
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch { return { model: 'claude-3-5-sonnet-20241022' }; }
}

function saveConfig(config: Partial<Config>): void {
    const current = loadConfig();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...config }, null, 2));
}

class MarieStandalone {
    private client: Anthropic | null = null;
    private messages: { role: 'user' | 'assistant'; content: string }[] = [];
    private config: Config;

    constructor() {
        this.config = loadConfig();
        if (nodeProcess.env.ANTHROPIC_API_KEY) {
            this.config.apiKey = nodeProcess.env.ANTHROPIC_API_KEY;
            saveConfig(this.config);
        }
        if (this.config.apiKey) {
            this.client = new Anthropic({ apiKey: this.config.apiKey });
        }
    }

    async sendMessage(content: string, onStream?: (chunk: string) => void): Promise<string> {
        if (!this.client) {
            throw new Error('No API key configured. Set ANTHROPIC_API_KEY env var.');
        }

        this.messages.push({ role: 'user', content });

        const tools = this.getTools();

        const response = await this.client.messages.create({
            model: this.config.model,
            max_tokens: 4096,
            messages: this.messages,
            tools,
            stream: true,
        });

        let fullResponse = '';
        let currentToolUse: { name: string; input: string } | null = null;

        for await (const chunk of response) {
            if (chunk.type === 'content_block_delta') {
                if (chunk.delta.type === 'text_delta') {
                    const text = chunk.delta.text;
                    fullResponse += text;
                    onStream?.(text);
                } else if (chunk.delta.type === 'input_json_delta') {
                    if (currentToolUse) {
                        currentToolUse.input += chunk.delta.partial_json;
                    }
                }
            } else if (chunk.type === 'content_block_start') {
                if (chunk.content_block.type === 'tool_use') {
                    currentToolUse = { name: chunk.content_block.name, input: '' };
                    onStream?.(`\n${ANSI.gray}[Tool: ${chunk.content_block.name}]${ANSI.reset}\n`);
                }
            }
        }

        // If there was a tool use, execute it and continue
        if (currentToolUse) {
            const toolResult = await this.executeTool(currentToolUse.name, JSON.parse(currentToolUse.input || '{}'));
            this.messages.push({ role: 'assistant', content: fullResponse });
            this.messages.push({
                role: 'user',
                content: `Tool result: ${toolResult}`
            });

            // Get final response after tool execution
            const finalResponse = await this.client.messages.create({
                model: this.config.model,
                max_tokens: 4096,
                messages: this.messages,
                stream: true,
            });

            for await (const chunk of finalResponse) {
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    onStream?.(chunk.delta.text);
                }
            }
        } else {
            this.messages.push({ role: 'assistant', content: fullResponse });
        }

        return fullResponse;
    }

    private getTools() {
        return [
            {
                name: 'read_file',
                description: 'Read the content of a file',
                input_schema: {
                    type: 'object' as const,
                    properties: {
                        path: { type: 'string', description: 'File path' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'write_file',
                description: 'Write content to a file',
                input_schema: {
                    type: 'object' as const,
                    properties: {
                        path: { type: 'string', description: 'File path' },
                        content: { type: 'string', description: 'Content to write' }
                    },
                    required: ['path', 'content']
                }
            },
            {
                name: 'list_dir',
                description: 'List files in a directory',
                input_schema: {
                    type: 'object' as const,
                    properties: {
                        path: { type: 'string', description: 'Directory path' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'run_command',
                description: 'Run a shell command',
                input_schema: {
                    type: 'object' as const,
                    properties: {
                        command: { type: 'string', description: 'Shell command' }
                    },
                    required: ['command']
                }
            }
        ];
    }

    private async executeTool(name: string, args: any): Promise<string> {
        const cwd = nodeProcess.cwd();

        switch (name) {
            case 'read_file': {
                const fullPath = path.isAbsolute(args.path) ? args.path : path.join(cwd, args.path);
                try {
                    return fs.readFileSync(fullPath, 'utf-8');
                } catch (e: any) {
                    return `Error: ${e.message}`;
                }
            }
            case 'write_file': {
                const fullPath = path.isAbsolute(args.path) ? args.path : path.join(cwd, args.path);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, args.content, 'utf-8');
                return `File written: ${fullPath}`;
            }
            case 'list_dir': {
                const fullPath = path.isAbsolute(args.path) ? args.path : path.join(cwd, args.path);
                try {
                    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
                    return entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
                } catch (e: any) {
                    return `Error: ${e.message}`;
                }
            }
            case 'run_command': {
                const { execSync } = await import('child_process');
                try {
                    const result = execSync(args.command, { cwd, encoding: 'utf-8', timeout: 30000 });
                    return result;
                } catch (e: any) {
                    return `Error: ${e.message}\n${e.stderr || ''}`;
                }
            }
            default:
                return `Unknown tool: ${name}`;
        }
    }
}

class MarieTerminal {
    private marie = new MarieStandalone();
    private rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${ANSI.cyan}›${ANSI.reset} `,
    });

    start() {
        this.printHeader();
        this.showPrompt();

        this.rl.on('line', async (input) => {
            const trimmed = input.trim();
            if (!trimmed) {
                this.showPrompt();
                return;
            }

            if (trimmed.startsWith('/')) {
                await this.handleCommand(trimmed);
                return;
            }

            await this.sendMessage(trimmed);
        });

        nodeProcess.on('SIGINT', () => {
            console.log('\n\nGoodbye! 👋');
            nodeProcess.exit(0);
        });
    }

    private printHeader() {
        console.log(`
${ANSI.cyan}${ANSI.bold}    __  ___      __        __${ANSI.reset}
${ANSI.cyan}${ANSI.bold}   /  |/  /___ _/ /_____ _/ /_${ANSI.reset}
${ANSI.cyan}${ANSI.bold}  / /|_/ / __ '/ //_/ _ '/ __/${ANSI.reset}
${ANSI.cyan}${ANSI.bold} / /  / / /_/ / ,< / /_/ / /_/${ANSI.reset}
${ANSI.cyan}${ANSI.bold}/_/  /_/\\__,_/_/|_|\\__,_/_.__/${ANSI.reset}
${ANSI.gray}                       CLI v0.1${ANSI.reset}
`);
    }

    private showPrompt() {
        process.stdout.write(this.rl.getPrompt());
    }

    private async handleCommand(cmd: string) {
        const parts = cmd.slice(1).split(' ');
        switch (parts[0]) {
            case 'help':
                console.log(`${ANSI.bold}Commands:${ANSI.reset} /help, /clear, /exit`);
                break;
            case 'clear':
                console.clear();
                this.printHeader();
                break;
            case 'exit':
                console.log('Goodbye! 👋');
                nodeProcess.exit(0);
            default:
                console.log(`${ANSI.yellow}Unknown command: ${parts[0]}${ANSI.reset}`);
        }
        this.showPrompt();
    }

    private async sendMessage(message: string) {
        console.log(`${ANSI.bold}You:${ANSI.reset} ${message}\n`);
        process.stdout.write(`${ANSI.cyan}Marie:${ANSI.reset} `);

        try {
            await this.marie.sendMessage(message, (chunk) => {
                process.stdout.write(chunk);
            });
            console.log('\n');
        } catch (e: any) {
            console.log(`\n${ANSI.red}Error: ${e.message}${ANSI.reset}\n`);
        }
        this.showPrompt();
    }
}

new MarieTerminal().start();
