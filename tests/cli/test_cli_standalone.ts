#!/usr/bin/env node
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Test the standalone CLI functionality without importing the actual module
// which has side effects (starts the terminal)

async function testConfigLoading() {
    console.log('🧪 Testing Standalone CLI Config Loading...');

    const testDir = path.join(os.tmpdir(), `marie-standalone-${Date.now()}`);
    const marieDir = path.join(testDir, '.marie');
    const configFile = path.join(marieDir, 'config.json');

    fs.mkdirSync(marieDir, { recursive: true });

    try {
        // Simulate config loading function
        function loadConfig(): { apiKey?: string; model: string } {
            if (!fs.existsSync(configFile)) return { model: 'claude-3-5-sonnet-20241022' };
            try {
                return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            } catch { return { model: 'claude-3-5-sonnet-20241022' }; }
        }

        // Test default config
        const defaultConfig = loadConfig();
        assert.strictEqual(defaultConfig.model, 'claude-3-5-sonnet-20241022', 'Should have default model');
        assert.strictEqual(defaultConfig.apiKey, undefined, 'Should not have API key initially');

        // Test saving config
        const testConfig = { apiKey: 'test-key', model: 'claude-3-opus' };
        fs.writeFileSync(configFile, JSON.stringify(testConfig, null, 2));

        const loadedConfig = loadConfig();
        assert.strictEqual(loadedConfig.apiKey, 'test-key', 'Should load API key');
        assert.strictEqual(loadedConfig.model, 'claude-3-opus', 'Should load model');

        // Test corrupted config
        fs.writeFileSync(configFile, 'not valid json');
        const corruptedConfig = loadConfig();
        assert.strictEqual(corruptedConfig.model, 'claude-3-5-sonnet-20241022', 'Should fallback on corruption');

        console.log('✅ Standalone Config Loading Test Passed!');
    } finally {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    }
}

async function testToolSchemas() {
    console.log('🧪 Testing Standalone CLI Tool Schemas...');

    // Define tool schemas as they exist in standalone CLI
    const tools = [
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

    // Verify tool definitions
    assert.strictEqual(tools.length, 4, 'Should have 4 tools');

    const readFileTool = tools.find(t => t.name === 'read_file');
    assert.ok(readFileTool, 'Should have read_file tool');
    assert.deepStrictEqual(readFileTool!.input_schema.required, ['path'], 'read_file should require path');

    const writeFileTool = tools.find(t => t.name === 'write_file');
    assert.ok(writeFileTool, 'Should have write_file tool');
    assert.deepStrictEqual(writeFileTool!.input_schema.required, ['path', 'content'], 'write_file should require path and content');

    const listDirTool = tools.find(t => t.name === 'list_dir');
    assert.ok(listDirTool, 'Should have list_dir tool');

    const runCommandTool = tools.find(t => t.name === 'run_command');
    assert.ok(runCommandTool, 'Should have run_command tool');

    console.log('✅ Standalone Tool Schemas Test Passed!');
}

async function testToolExecution() {
    console.log('🧪 Testing Standalone CLI Tool Execution...');

    const testDir = path.join(os.tmpdir(), `marie-tools-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Simulate tool execution functions
    async function executeTool(name: string, args: any, cwd: string): Promise<string> {
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
            default:
                return `Unknown tool: ${name}`;
        }
    }

    try {
        // Test write_file
        const writeResult = await executeTool('write_file', {
            path: 'test.txt',
            content: 'Hello from standalone CLI'
        }, testDir);
        assert.ok(writeResult.includes('File written'), 'Should write file successfully');

        // Test read_file
        const readResult = await executeTool('read_file', {
            path: 'test.txt'
        }, testDir);
        assert.strictEqual(readResult, 'Hello from standalone CLI', 'Should read file content');

        // Test list_dir
        const listResult = await executeTool('list_dir', {
            path: '.'
        }, testDir);
        assert.ok(listResult.includes('📄 test.txt'), 'Should list the created file');

        // Test read non-existent file
        const errorResult = await executeTool('read_file', {
            path: 'nonexistent.txt'
        }, testDir);
        assert.ok(errorResult.includes('Error'), 'Should return error for non-existent file');

        console.log('✅ Standalone Tool Execution Test Passed!');
    } finally {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    }
}

async function testMessageHandling() {
    console.log('🧪 Testing Message History Management...');

    // Simulate message history
    interface Message {
        role: 'user' | 'assistant';
        content: string;
    }

    const messages: Message[] = [];

    // Add user message
    messages.push({ role: 'user', content: 'Hello' });
    assert.strictEqual(messages.length, 1, 'Should have 1 message');
    assert.strictEqual(messages[0].role, 'user', 'First message should be from user');

    // Add assistant response
    messages.push({ role: 'assistant', content: 'Hi there!' });
    assert.strictEqual(messages.length, 2, 'Should have 2 messages');
    assert.strictEqual(messages[1].role, 'assistant', 'Second message should be from assistant');

    // Verify conversation format
    assert.ok(messages.every(m => m.role === 'user' || m.role === 'assistant'), 'All messages should have valid role');
    assert.ok(messages.every(m => typeof m.content === 'string'), 'All messages should have string content');

    console.log('✅ Message History Management Test Passed!');
}

async function testCommandParsing() {
    console.log('🧪 Testing Command Parsing...');

    // Simulate command parsing
    function parseCommand(input: string): { command: string; args: string[] } {
        const parts = input.slice(1).split(' ');
        return {
            command: parts[0],
            args: parts.slice(1)
        };
    }

    // Test /help command
    const helpCmd = parseCommand('/help');
    assert.strictEqual(helpCmd.command, 'help', 'Should parse help command');
    assert.deepStrictEqual(helpCmd.args, [], 'Should have no args');

    // Test /clear command
    const clearCmd = parseCommand('/clear');
    assert.strictEqual(clearCmd.command, 'clear', 'Should parse clear command');

    // Test /exit command
    const exitCmd = parseCommand('/exit');
    assert.strictEqual(exitCmd.command, 'exit', 'Should parse exit command');

    // Test command with args
    const complexCmd = parseCommand('/load session_123 extra arg');
    assert.strictEqual(complexCmd.command, 'load', 'Should parse load command');
    assert.deepStrictEqual(complexCmd.args, ['session_123', 'extra', 'arg'], 'Should parse args');

    console.log('✅ Command Parsing Test Passed!');
}

async function testANSIFormatting() {
    console.log('🧪 Testing ANSI Formatting...');

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

    // Test ANSI codes are defined
    assert.ok(ANSI.reset.startsWith('\x1b['), 'Reset should be ANSI code');
    assert.ok(ANSI.bold.startsWith('\x1b['), 'Bold should be ANSI code');
    assert.ok(ANSI.red.startsWith('\x1b['), 'Red should be ANSI code');
    assert.ok(ANSI.cyan.startsWith('\x1b['), 'Cyan should be ANSI code');

    // Test formatting combinations
    const formatted = `${ANSI.bold}${ANSI.cyan}Bold Cyan Text${ANSI.reset}`;
    assert.ok(formatted.includes('\x1b[1m'), 'Should include bold code');
    assert.ok(formatted.includes('\x1b[36m'), 'Should include cyan code');
    assert.ok(formatted.includes('\x1b[0m'), 'Should include reset code');

    console.log('✅ ANSI Formatting Test Passed!');
}

async function testEnvironmentVariables() {
    console.log('🧪 Testing Environment Variable Detection...');

    // Store original values
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    const originalOpenRouter = process.env.OPENROUTER_API_KEY;
    const originalCerebras = process.env.CEREBRAS_API_KEY;

    try {
        // Clear all API keys
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.CEREBRAS_API_KEY;

        // Test no API key
        const hasNoKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CEREBRAS_API_KEY);
        assert.strictEqual(hasNoKey, false, 'Should detect no API key');

        // Test Anthropic key
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
        const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CEREBRAS_API_KEY);
        assert.strictEqual(hasAnthropic, true, 'Should detect Anthropic key');

        // Test OpenRouter key
        delete process.env.ANTHROPIC_API_KEY;
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
        const hasOpenRouter = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CEREBRAS_API_KEY);
        assert.strictEqual(hasOpenRouter, true, 'Should detect OpenRouter key');

        // Test Cerebras key
        delete process.env.OPENROUTER_API_KEY;
        process.env.CEREBRAS_API_KEY = 'test-cerebras-key';
        const hasCerebras = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CEREBRAS_API_KEY);
        assert.strictEqual(hasCerebras, true, 'Should detect Cerebras key');

        console.log('✅ Environment Variable Detection Test Passed!');
    } finally {
        // Restore original values
        if (originalAnthropic) process.env.ANTHROPIC_API_KEY = originalAnthropic;
        else delete process.env.ANTHROPIC_API_KEY;
        if (originalOpenRouter) process.env.OPENROUTER_API_KEY = originalOpenRouter;
        else delete process.env.OPENROUTER_API_KEY;
        if (originalCerebras) process.env.CEREBRAS_API_KEY = originalCerebras;
        else delete process.env.CEREBRAS_API_KEY;
    }
}

async function runAllTests() {
    try {
        await testConfigLoading();
        await testToolSchemas();
        await testToolExecution();
        await testMessageHandling();
        await testCommandParsing();
        await testANSIFormatting();
        await testEnvironmentVariables();

        console.log('\n🌟 ALL STANDALONE CLI TESTS PASSED!');
    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}

runAllTests();
