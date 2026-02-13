import * as vscode from "vscode";
import { Marie } from "./monolith/adapters/VscodeMarieAdapter.js";
import { JoyService } from "./monolith/services/JoyService.js";
import { JoyLogService } from "./monolith/services/JoyLogService.js";
import { ConfigService } from "./monolith/infrastructure/config/ConfigService.js";

let marie: Marie | undefined;
let joyService: JoyService | undefined;
let mariePanel: vscode.WebviewPanel | undefined;
let webviewHost: MarieWebviewHost | undefined;

type UiMessage = { id: string; role: "user" | "assistant" | "system"; content: string; timestamp: number };

class MarieWebviewHost {
    private webviews = new Set<vscode.Webview>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly marieInstance: Marie
    ) { }

    public attach(webview: vscode.Webview): void {
        this.webviews.add(webview);

        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview-ui"),
                vscode.Uri.joinPath(this.context.extensionUri, "assets"),
            ],
        };

        const scriptDiskPath = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview-ui", "main.js");
        vscode.workspace.fs.stat(scriptDiskPath).then(
            () => undefined,
            () => {
                void vscode.window.showErrorMessage(
                    "Marie webview bundle missing (dist/webview-ui/main.js). Run `npm run build` and reinstall the extension."
                );
            }
        );

        webview.html = this.getHtml(webview);
        webview.onDidReceiveMessage((message) => this.onMessage(message));

        this.pushInitState().catch(() => undefined);
    }

    public detach(webview: vscode.Webview): void {
        this.webviews.delete(webview);
    }

    private post(message: any): void {
        for (const webview of this.webviews) {
            void webview.postMessage(message);
        }
    }

    private async onMessage(message: any): Promise<void> {
        switch (message?.type) {
            case "ready":
                await this.pushInitState();
                return;
            case "send_message":
                await this.handleSendMessage(String(message.text || ""));
                return;
            case "stop_generation":
                this.marieInstance.stopGeneration();
                this.post({ type: "status", isLoading: false });
                return;
            case "create_session":
                await this.marieInstance.createSession();
                await this.pushInitState();
                return;
            case "clear_session":
                await this.marieInstance.clearCurrentSession();
                await this.pushInitState();
                return;
            case "list_sessions":
                await this.pushSessions();
                return;
            case "load_session":
                if (message.id) {
                    await this.marieInstance.loadSession(String(message.id));
                    await this.pushInitState();
                }
                return;
            case "delete_session":
                if (message.id) {
                    await this.marieInstance.deleteSession(String(message.id));
                    await this.pushInitState();
                }
                return;
            case "rename_session":
                if (message.id && message.title) {
                    await this.marieInstance.renameSession(String(message.id), String(message.title));
                    await this.pushSessions();
                }
                return;
            case "toggle_pin_session":
                if (message.id) {
                    await this.marieInstance.togglePinSession(String(message.id));
                    await this.pushSessions();
                }
                return;
            case "approve_tool":
                if (message.requestId) {
                    this.marieInstance.handleToolApproval(String(message.requestId), Boolean(message.approved));
                }
                return;
            case "get_models":
                this.post({ type: "models", models: await this.marieInstance.getModels() });
                return;
            case "set_autonomy_mode":
                await this.setAutonomyMode(String(message.mode || "balanced"));
                return;
            case "open_settings":
                await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:cardsorting.marie");
                return;
            default:
                return;
        }
    }

    private async handleSendMessage(text: string): Promise<void> {
        const trimmed = text.trim();
        if (!trimmed) return;

        this.post({ type: "status", isLoading: true });
        this.post({ type: "user_echo", text: trimmed });

        try {
            const response = await this.marieInstance.handleMessage(trimmed, {
                onStream: (chunk) => {
                    this.post({ type: "message_stream", chunk });
                },
                onTool: (tool) => {
                    this.post({ type: "tool_event", tool });
                },
                onEvent: (event) => {
                    this.post({ type: "runtime_event", event });
                },
            });

            this.post({ type: "assistant_response", text: response });
        } catch (error) {
            this.post({ type: "error", message: String(error) });
        } finally {
            this.post({ type: "status", isLoading: false });
            await this.pushSessions();
        }
    }

    private async setAutonomyMode(rawMode: string): Promise<void> {
        const mode = rawMode === "yolo" || rawMode === "high" ? rawMode : "balanced";
        const cfg = vscode.workspace.getConfiguration("marie");
        await cfg.update("autonomyMode", mode, vscode.ConfigurationTarget.Global);
        await cfg.update("requireApproval", mode === "balanced", vscode.ConfigurationTarget.Global);
        this.marieInstance.updateSettings();
        this.post({ type: "config", config: this.getConfigSnapshot() });
    }

    private async pushInitState(): Promise<void> {
        this.post({
            type: "init_state",
            state: {
                messages: this.getUiMessages(),
                config: this.getConfigSnapshot(),
                currentSessionId: this.marieInstance.getCurrentSessionId(),
            },
        });
        await this.pushSessions();
    }

    private async pushSessions(): Promise<void> {
        const sessions = await this.marieInstance.listSessions();
        this.post({
            type: "sessions",
            sessions,
            currentSessionId: this.marieInstance.getCurrentSessionId(),
        });
    }

    private getConfigSnapshot() {
        return {
            provider: ConfigService.getAiProvider(),
            model: ConfigService.getModel(),
            autonomyMode: ConfigService.getAutonomyMode(),
            hasAnyApiKey: Boolean(
                ConfigService.getApiKey() ||
                ConfigService.getOpenRouterApiKey() ||
                ConfigService.getCerebrasApiKey()
            ),
        };
    }

    private getUiMessages(): UiMessage[] {
        return this.marieInstance.getMessages().map((message: any, index: number) => ({
            id: `hist_${index}`,
            role: (message.role || "assistant") as UiMessage["role"],
            content: this.extractMessageText(message),
            timestamp: Date.now(),
        }));
    }

    private extractMessageText(message: any): string {
        if (typeof message?.content === "string") {
            return message.content;
        }

        if (!Array.isArray(message?.content)) {
            return String(message?.content ?? "");
        }

        const textParts: string[] = [];
        for (const block of message.content) {
            if (block?.type === "text" && typeof block.text === "string") {
                textParts.push(block.text);
            }
        }

        return textParts.join("\n").trim() || "(structured response)";
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview-ui", "main.js")
        );
        const nonce = `${Date.now()}${Math.random().toString(36).slice(2)}`;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
    <title>Marie</title>
</head>
<body>
    <div id="app" style="padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);">Loading Marie UI…</div>
    <script nonce="${nonce}">
      try {
        const el = document.getElementById('app');
        if (el) el.textContent = 'Marie script bootstrapping…';
      } catch {}
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

class MarieSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "marieView";

    resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
        webviewHost?.attach(webviewView.webview);
        webviewView.onDidDispose(() => {
            webviewHost?.detach(webviewView.webview);
        });
    }
}

function showMarieWebview(context: vscode.ExtensionContext): void {
    if (mariePanel) {
        mariePanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    mariePanel = vscode.window.createWebviewPanel(
        "marieUi",
        "Marie",
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: false,
        }
    );
    webviewHost?.attach(mariePanel.webview);

    mariePanel.onDidDispose(
        () => {
            if (mariePanel) {
                webviewHost?.detach(mariePanel.webview);
            }
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
    webviewHost = new MarieWebviewHost(context, marie);

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
    webviewHost = undefined;
    joyService = undefined;
}
