import * as vscode from "vscode";
import { Marie } from "./Marie.js";
import { JoyService } from "./services/JoyService.js";
import { JoyLogService } from "./services/JoyLogService.js";

let marie: Marie | undefined;
let joyService: JoyService | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Initialize JoyLog service
    const joyLog = new JoyLogService(context);

    // Initialize Joy service
    joyService = new JoyService(context, joyLog);

    // Initialize Marie
    marie = new Marie(context, joyService);

    // Register commands
    const disposable = vscode.commands.registerCommand("marie.start", () => {
        // Start Marie command implementation
        vscode.window.showInformationMessage("Marie is ready to help! ✨");
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(marie);
}

export function deactivate() {
    if (marie) {
        marie.dispose();
        marie = undefined;
    }
    joyService = undefined;
}
