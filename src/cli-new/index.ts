#!/usr/bin/env node
import React, { useState } from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { SetupWizard } from './components/SetupWizard.js';
import { Storage } from '../cli/storage.js';
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

// Check for API key in environment or config
const envApiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CEREBRAS_API_KEY;
const config = Storage.getConfig();
const hasConfigKey = config.apiKey || config.openrouterApiKey || config.cerebrasApiKey;
const needsSetup = !envApiKey && !hasConfigKey;

// Main app component that handles setup
const MainApp: React.FC = () => {
    const [setupComplete, setSetupComplete] = useState(!needsSetup);

    if (!setupComplete) {
        return React.createElement(SetupWizard, { onComplete: () => setSetupComplete(true) });
    }

    return React.createElement(App, { workingDir });
};

// Render the app
const { waitUntilExit } = render(React.createElement(MainApp));

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
