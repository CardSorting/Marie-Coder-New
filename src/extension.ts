import * as vscode from "vscode";
import { Marie } from "./monolith/adapters/VscodeMarieAdapter.js";
import { JoyService } from "./monolith/services/JoyService.js";
import { JoyLogService } from "./monolith/services/JoyLogService.js";

let marie: Marie | undefined;
let joyService: JoyService | undefined;
let mariePanel: vscode.WebviewPanel | undefined;

class MarieSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "marieView";

    resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
        webviewView.webview.options = {
            enableScripts: false,
        };
        webviewView.webview.html = getMinimalWebviewHtml();
    }
}

function getMinimalWebviewHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Marie</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        body {
            margin: 0;
            padding: 20px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }

        .container {
            max-width: 420px;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .status {
            margin: 0 0 8px;
            color: var(--vscode-descriptionForeground);
        }

        .hint {
            margin: 0;
            color: var(--vscode-descriptionForeground);
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <main class="container">
        <h1>Marie</h1>
        <p class="status">Ready</p>
        <p class="hint">Open the Command Palette and run <strong>Marie: Start</strong>.</p>
    </main>
</body>
</html>`;
}

function showMarieWebview(context: vscode.ExtensionContext): void {
    if (mariePanel) {
        mariePanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    mariePanel = vscode.window.createWebviewPanel(
        "marieMinimalUi",
        "Marie",
        vscode.ViewColumn.Beside,
        {
            enableScripts: false,
            retainContextWhenHidden: false,
        }
    );

    mariePanel.webview.html = getMinimalWebviewHtml();

    mariePanel.onDidDispose(
        () => {
            mariePanel = undefined;
        },
        null,
        context.subscriptions
    );
}

export function activate(context: vscode.ExtensionContext) {
    // Initialize JoyLog service
    const joyLog = new JoyLogService(context);

    // Initialize Joy service
    joyService = new JoyService(context, joyLog);

    // Initialize Marie
    marie = new Marie(context, joyService);

    // Register commands
    const disposable = vscode.commands.registerCommand("marie.start", () => {
        showMarieWebview(context);
    });

    const sidebarProvider = vscode.window.registerWebviewViewProvider(
        MarieSidebarProvider.viewType,
        new MarieSidebarProvider()
    );

    context.subscriptions.push(disposable);
    context.subscriptions.push(sidebarProvider);
    context.subscriptions.push(marie);
}

export function deactivate() {
    if (mariePanel) {
        mariePanel.dispose();
        mariePanel = undefined;
    }

    if (marie) {
        marie.dispose();
        marie = undefined;
    }
    joyService = undefined;
}
