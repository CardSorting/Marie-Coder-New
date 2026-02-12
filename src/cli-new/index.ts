#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Ensure config directory exists
const MARIE_DIR = path.join(os.homedir(), '.marie');
if (!fs.existsSync(MARIE_DIR)) {
    fs.mkdirSync(MARIE_DIR, { recursive: true });
}

// Get working directory
const workingDir = process.cwd();

// Check for API key
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CEREBRAS_API_KEY;

if (!apiKey) {
    console.error(`
╔═══════════════════════════════════════════════════════════╗
║  🌸 Marie CLI - API Key Required                          ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Please set one of the following environment variables:   ║
║                                                           ║
║    • ANTHROPIC_API_KEY    (for Claude models)             ║
║    • OPENROUTER_API_KEY   (for OpenRouter access)         ║
║    • CEREBRAS_API_KEY     (for Cerebras models)           ║
║                                                           ║
║  Or configure via: ~/.marie/config.json                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
    process.exit(1);
}

// Render the app
const { waitUntilExit } = render(React.createElement(App, { workingDir }));

// Handle graceful shutdown
process.on('SIGINT', () => {
    process.exit(0);
});

process.on('SIGTERM', () => {
    process.exit(0);
});

// Wait for app to exit
waitUntilExit().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
