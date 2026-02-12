#!/usr/bin/env node
import * as readline from 'readline';
import * as process from 'process';
import { MarieCLI } from './MarieCLI.js';
import { Storage } from './storage.js';

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    clearLine: '\x1b[2K\r',
    moveUp: '\x1b[1A',
};

class MarieTerminal {
    private marie: MarieCLI;
    private rl: readline.Interface;
    private isRunning = false;
    private currentStream = '';
    private isStreaming = false;
    private pendingApproval: { requestId: string; toolName: string; input: any } | null = null;

    constructor() {
        this.marie = new MarieCLI(process.cwd());
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
            prompt: `${ANSI.cyan}›${ANSI.reset} `,
        });
    }

    async start() {
        this.printHeader();
        this.loadEnvConfig();

        const config = Storage.getConfig();
        if (!config.apiKey && !config.openrouterApiKey && !config.cerebrasApiKey) {
            if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.CEREBRAS_API_KEY) {
                console.log(`${ANSI.yellow}⚠ No API key configured${ANSI.reset}`);
                console.log(`Set one of these environment variables:`);
                console.log(`  - ANTHROPIC_API_KEY`);
                console.log(`  - OPENROUTER_API_KEY`);
                console.log(`  - CEREBRAS_API_KEY`);
                console.log();
            }
        }

        this.isRunning = true;
        this.showPrompt();

        this.rl.on('line', async (input) => {
            await this.handleInput(input.trim());
        });

        this.rl.on('close', () => {
            this.shutdown();
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            if (this.pendingApproval) {
                this.handleApproval(false);
            } else if (this.isStreaming) {
                this.marie.stopGeneration();
                console.log('\n\nStopped.');
                this.showPrompt();
            } else {
                this.shutdown();
            }
        });
    }

    private loadEnvConfig() {
        const config = Storage.getConfig();

        // Override with environment variables
        if (process.env.ANTHROPIC_API_KEY) {
            config.apiKey = process.env.ANTHROPIC_API_KEY;
            config.aiProvider = 'anthropic';
        }
        if (process.env.OPENROUTER_API_KEY) {
            config.openrouterApiKey = process.env.OPENROUTER_API_KEY;
            if (!config.apiKey) config.aiProvider = 'openrouter';
        }
        if (process.env.CEREBRAS_API_KEY) {
            config.cerebrasApiKey = process.env.CEREBRAS_API_KEY;
            if (!config.apiKey && !config.openrouterApiKey) config.aiProvider = 'cerebras';
        }
        if (process.env.MARIE_MODEL) {
            config.model = process.env.MARIE_MODEL;
        }

        Storage.saveConfig(config);
    }

    private printHeader() {
        console.log();
        console.log(`${ANSI.cyan}${ANSI.bold}    __  ___      __        __${ANSI.reset}`);
        console.log(`${ANSI.cyan}${ANSI.bold}   /  |/  /___ _/ /_____ _/ /_  ____ _________${ANSI.reset}`);
        console.log(`${ANSI.cyan}${ANSI.bold}  / /|_/ / __ '/ //_/ _ '/ __ \\/ __ '/ ___/ _ \\${ANSI.reset}`);
        console.log(`${ANSI.cyan}${ANSI.bold} / /  / / /_/ / ,< / /_/ / /_/ / /_/ (__  )  __/${ANSI.reset}`);
        console.log(`${ANSI.cyan}${ANSI.bold}/_/  /_/\\__,_/_/|_|\\__,_/_.___/\\__,_/____/\\___/${ANSI.reset}`);
        console.log(`${ANSI.gray}                                    CLI Agent v0.1${ANSI.reset}`);
        console.log();
        console.log(`${ANSI.dim}Type /help for commands, Ctrl+C to exit${ANSI.reset}`);
        console.log();
    }

    private showPrompt() {
        process.stdout.write(this.rl.getPrompt());
    }

    private async handleInput(input: string) {
        if (!input) {
            this.showPrompt();
            return;
        }

        // Handle commands
        if (input.startsWith('/')) {
            await this.handleCommand(input);
            return;
        }

        // Handle approval responses
        if (this.pendingApproval) {
            const response = input.toLowerCase();
            if (response === 'y' || response === 'yes') {
                this.handleApproval(true);
            } else if (response === 'n' || response === 'no') {
                this.handleApproval(false);
            } else {
                console.log(`${ANSI.yellow}Please respond with 'y' or 'n'${ANSI.reset}`);
            }
            return;
        }

        // Send message to Marie
        await this.sendMessage(input);
    }

    private async handleCommand(command: string) {
        const parts = command.slice(1).split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
            case 'clear':
                console.clear();
                this.printHeader();
                break;
            case 'new':
                await this.marie.createSession();
                console.log(`${ANSI.green}✓ Started new session${ANSI.reset}`);
                break;
            case 'sessions':
                this.listSessions();
                break;
            case 'load':
                if (args[0]) {
                    await this.marie.loadSession(args[0]);
                    console.log(`${ANSI.green}✓ Loaded session${ANSI.reset}`);
                } else {
                    console.log(`${ANSI.yellow}Usage: /load <session-id>${ANSI.reset}`);
                }
                break;
            case 'config':
                this.showConfig();
                break;
            case 'models':
                await this.listModels();
                break;
            case 'exit':
            case 'quit':
                this.shutdown();
                return;
            default:
                console.log(`${ANSI.yellow}Unknown command: ${cmd}${ANSI.reset}`);
        }
        this.showPrompt();
    }

    private showHelp() {
        console.log();
        console.log(`${ANSI.bold}Commands:${ANSI.reset}`);
        console.log(`  ${ANSI.cyan}/help${ANSI.reset}      Show this help message`);
        console.log(`  ${ANSI.cyan}/clear${ANSI.reset}     Clear the screen`);
        console.log(`  ${ANSI.cyan}/new${ANSI.reset}       Start a new session`);
        console.log(`  ${ANSI.cyan}/sessions${ANSI.reset}  List all sessions`);
        console.log(`  ${ANSI.cyan}/load${ANSI.reset}      Load a session by ID`);
        console.log(`  ${ANSI.cyan}/config${ANSI.reset}    Show current configuration`);
        console.log(`  ${ANSI.cyan}/models${ANSI.reset}    List available models`);
        console.log(`  ${ANSI.cyan}/exit${ANSI.reset}      Exit the CLI`);
        console.log();
        console.log(`${ANSI.bold}Keyboard shortcuts:${ANSI.reset}`);
        console.log(`  ${ANSI.cyan}Ctrl+C${ANSI.reset}    Stop generation / Exit`);
        console.log();
    }

    private listSessions() {
        const sessions = this.marie.listSessions();
        console.log();
        if (sessions.length === 0) {
            console.log(`${ANSI.gray}No saved sessions${ANSI.reset}`);
        } else {
            console.log(`${ANSI.bold}Sessions:${ANSI.reset}`);
            sessions.forEach(s => {
                const current = s.id === this.marie.getCurrentSessionId();
                const pin = s.isPinned ? '📌 ' : '';
                const date = new Date(s.lastModified).toLocaleDateString();
                console.log(`  ${current ? '›' : ' '} ${pin}${s.title} ${ANSI.gray}(${date})${ANSI.reset}`);
            });
        }
        console.log();
    }

    private showConfig() {
        const config = Storage.getConfig();
        console.log();
        console.log(`${ANSI.bold}Configuration:${ANSI.reset}`);
        console.log(`  Provider: ${config.aiProvider}`);
        console.log(`  Model: ${config.model}`);
        console.log(`  API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}`);
        console.log(`  Require Approval: ${config.requireApproval}`);
        console.log();
    }

    private async listModels() {
        console.log(`${ANSI.gray}Fetching models...${ANSI.reset}`);
        try {
            const models = await this.marie.getModels();
            console.log();
            console.log(`${ANSI.bold}Available Models:${ANSI.reset}`);
            models.forEach(m => {
                console.log(`  ${m.id || m.name || m}`);
            });
            console.log();
        } catch (e) {
            console.log(`${ANSI.red}Failed to fetch models: ${e}${ANSI.reset}`);
        }
    }

    private async sendMessage(message: string) {
        this.isStreaming = true;
        this.currentStream = '';

        // Print user message
        console.log(`${ANSI.bold}You:${ANSI.reset} ${message}`);
        console.log();
        process.stdout.write(`${ANSI.cyan}Marie:${ANSI.reset} `);

        try {
            const response = await this.marie.handleMessage(message, {
                onStream: (chunk) => {
                    this.currentStream += chunk;
                    process.stdout.write(chunk);
                },
                onTool: (tool) => {
                    console.log();
                    console.log(`${ANSI.gray}▸ ${tool.name}${ANSI.reset}`);
                    process.stdout.write(`${ANSI.cyan}Marie:${ANSI.reset} `);
                },
                onEvent: (event) => {
                    if (event.type === 'approval_request') {
                        this.pendingApproval = {
                            requestId: (event as any).requestId,
                            toolName: (event as any).toolName,
                            input: (event as any).toolInput,
                        };
                        console.log();
                        console.log();
                        console.log(`${ANSI.yellow}⚠ Approval Required${ANSI.reset}`);
                        console.log(`${ANSI.bold}Tool:${ANSI.reset} ${(event as any).toolName}`);
                        const input = (event as any).toolInput;
                        if (input) {
                            const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
                            console.log(`${ANSI.bold}Input:${ANSI.reset} ${inputStr.slice(0, 200)}${inputStr.length > 200 ? '...' : ''}`);
                        }
                        console.log();
                        process.stdout.write(`${ANSI.yellow}Approve? (y/n):${ANSI.reset} `);
                    }
                }
            });

            if (!this.currentStream && response) {
                process.stdout.write(response);
            }

            this.isStreaming = false;
            console.log();
            console.log();
            this.showPrompt();
        } catch (error) {
            this.isStreaming = false;
            console.log();
            console.log(`${ANSI.red}Error: ${error}${ANSI.reset}`);
            console.log();
            this.showPrompt();
        }
    }

    private handleApproval(approved: boolean) {
        if (this.pendingApproval) {
            this.marie.handleToolApproval(this.pendingApproval.requestId, approved);
            console.log(approved ? `${ANSI.green}✓ Approved${ANSI.reset}` : `${ANSI.red}✗ Denied${ANSI.reset}`);
            this.pendingApproval = null;
            // Don't show prompt - wait for stream to continue
        }
    }

    private shutdown() {
        console.log('\nGoodbye! 👋');
        this.marie.dispose();
        this.rl.close();
        process.exit(0);
    }
}

// Start the CLI
const terminal = new MarieTerminal();
terminal.start().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});
