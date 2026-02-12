import * as vscode from "vscode"
import * as path from "path"
import { Marie } from "../Marie.js"
import { getErrorMessage } from "../plumbing/utils/ErrorUtils.js"
import { ConfigService } from "../infrastructure/config/ConfigService.js"
import { MarieSanitizer } from "../infrastructure/ai/core/MarieSanitizer.js"

export interface WebviewMessage {
    type: string;
    value?: unknown;
}

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private _view?: vscode.WebviewView
    private _statusBar?: vscode.StatusBarItem
    private _editorListener?: vscode.Disposable
    private _messageListener?: vscode.Disposable
    private _disposeListener?: vscode.Disposable
    private _disposed: boolean = false

    /** Refresh the session list in the webview — extracted to avoid 6× duplication */
    private async refreshSessionList(): Promise<void> {
        const sessions = await this._marie.listSessions();
        this._view?.webview.postMessage({
            type: 'onSessionsList',
            value: {
                sessions,
                currentSessionId: this._marie.getCurrentSessionId()
            }
        });
    }

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _marie: Marie,
        private readonly context: vscode.ExtensionContext
    ) { }

    public setStatusBar(item: vscode.StatusBarItem) {
        this._statusBar = item;
    }

    public postMessage(message: WebviewMessage) {
        if (this._view) {
            const sanitized = MarieSanitizer.sanitize(message);
            this._view.webview.postMessage(sanitized);
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        // STABILITY: Retain context to prevent UI reset when hidden
        (webviewView as any).retainContextWhenHidden = true;

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

        // Send initial settings
        const config = vscode.workspace.getConfiguration('marie');
        webviewView.webview.postMessage({
            type: 'onSettings',
            value: {
                apiKey: this.context.globalState.get<string>("marie.apiKey"),
                openrouterApiKey: this.context.globalState.get<string>("marie.openrouterApiKey"),
                cerebrasApiKey: this.context.globalState.get<string>("marie.cerebrasApiKey"),
                aiProvider: ConfigService.getAiProvider(),
                model: ConfigService.getModel(),
                sessions: []
            }
        });
        this.refreshSessionList();

        this._messageListener?.dispose();
        this._messageListener = webviewView.webview.onDidReceiveMessage(async (data) => {
            if (!data || typeof data.type !== 'string') {
                console.error("[SidebarProvider] Received malformed message from webview:", data);
                return;
            }

            console.log(`[SidebarProvider] Message received: ${data.type}`);
            try {
                switch (data.type) {
                    case "stop": {
                        this._marie.stopGeneration();
                        break;
                    }
                    case "confirmDelete": {
                        try {
                            if (typeof data.value !== 'string') throw new Error("Delete path must be a string");
                            const fileUriToDelete = vscode.Uri.file(data.value);
                            await vscode.workspace.fs.delete(fileUriToDelete);
                            vscode.window.showInformationMessage(`Let go of ${path.basename(data.value)} with gratitude. 🍂`);
                        } catch (e: unknown) {
                            console.error("[SidebarProvider] confirmDelete error:", e);
                            vscode.window.showErrorMessage(`Could not delete: ${getErrorMessage(e)}`);
                        }
                        break;
                    }
                    case "showDiff": {
                        try {
                            if (!data.value) throw new Error("Missing diff data");
                            const { modified } = data.value as any;
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                const original = editor.document.getText();
                                const fileName = vscode.workspace.asRelativePath(editor.document.fileName);

                                const doc = await vscode.workspace.openTextDocument({
                                    content: original,
                                    language: editor.document.languageId
                                });
                                const newDoc = await vscode.workspace.openTextDocument({
                                    content: modified,
                                    language: editor.document.languageId
                                });

                                vscode.commands.executeCommand('vscode.diff', doc.uri, newDoc.uri, `${fileName} (Suggested Changes)`);
                            } else {
                                vscode.window.showWarningMessage("Please open a file to preview changes against.");
                            }
                        } catch (e) {
                            console.error("[SidebarProvider] showDiff error:", e);
                        }
                        break;
                    }
                    case "insertAtCursor": {
                        try {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                editor.edit(editBuilder => {
                                    editBuilder.insert(editor.selection.active, String(data.value));
                                });
                                vscode.window.showInformationMessage("Code inserted at cursor. ✨");
                            }
                        } catch (e) {
                            console.error("[SidebarProvider] insertAtCursor error:", e);
                        }
                        break;
                    }
                    case "onStatusChange": {
                        if (this._statusBar) {
                            const status = data.value as 'idle' | 'thinking' | 'responding';
                            if (status === 'thinking') {
                                this._statusBar.text = "$(loading~spin) Marie is thinking...";
                                this._statusBar.color = new vscode.ThemeColor('progressBar.background');
                            } else if (status === 'responding') {
                                this._statusBar.text = "$(pencil) Marie is responding...";
                                this._statusBar.color = new vscode.ThemeColor('textLink.foreground');
                            } else {
                                this._statusBar.text = "$(sparkle) Marie";
                                this._statusBar.color = undefined;
                            }
                        }
                        break;
                    }
                    case "onMessage": {
                        if (!data.value) return
                        // STABILITY GUARD: Prevent overlapping turns from same webview
                        if (this._marie.getCurrentRun()) {
                            vscode.window.showWarningMessage("Marie is already reasoning about a request. Please wait... ✨");
                            return;
                        }

                        try {
                            // PHASE 6: Deep Session Fencing - Capture session context for all callbacks
                            const activeSessionIdAtStart = this._marie.getCurrentSessionId();
                            const currentRunRef = { runId: '' };

                            const response = await this._marie.handleMessage(String(data.value), {
                                onStream: (chunk, runId, originatingSessionId) => {
                                    webviewView.webview.postMessage({
                                        type: 'onStreamUpdate',
                                        value: chunk,
                                        sessionId: originatingSessionId || activeSessionIdAtStart,
                                        runId: runId
                                    });
                                },
                                onTool: (tool, runId, originatingSessionId) => {
                                    webviewView.webview.postMessage({
                                        type: 'onToolCall',
                                        value: MarieSanitizer.sanitize(tool),
                                        sessionId: originatingSessionId || activeSessionIdAtStart,
                                        runId: runId
                                    });
                                },
                                onEvent: (event) => {
                                    // Forward structured runtime events to the webview
                                    try {
                                        const sanitizedEvent = MarieSanitizer.sanitize(event);
                                        // PHASE 6: Deep Session Fencing - Attach session context to all events
                                        const sessionId = (event as any).originatingSessionId || activeSessionIdAtStart;

                                        if (event.type === 'run_started') {
                                            currentRunRef.runId = event.runId;
                                            webviewView.webview.postMessage({
                                                type: 'onRunStart',
                                                value: { runId: event.runId, timestamp: event.startedAt },
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'run_completed') {
                                            webviewView.webview.postMessage({
                                                type: 'onRunComplete',
                                                value: {
                                                    runId: event.runId,
                                                    elapsedMs: event.elapsedMs,
                                                    steps: event.steps,
                                                    tools: event.tools,
                                                    usage: event.usage,
                                                },
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'stage') {
                                            webviewView.webview.postMessage({
                                                type: 'onStageChange',
                                                value: { stage: event.stage, label: event.label },
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'step') {
                                            webviewView.webview.postMessage({
                                                type: 'onStepUpdate',
                                                value: { step: event.step, label: event.label },
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'reasoning') {
                                            webviewView.webview.postMessage({
                                                type: 'onReasoningUpdate',
                                                value: event.text,
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'usage') {
                                            webviewView.webview.postMessage({
                                                type: 'onUsageUpdate',
                                                value: event.usage,
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'progress_update') {
                                            webviewView.webview.postMessage({
                                                type: 'onProgressUpdate',
                                                value: sanitizedEvent,
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'checkpoint') {
                                            webviewView.webview.postMessage({
                                                type: 'onCheckpointState',
                                                value: sanitizedEvent,
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'tool_delta') {
                                            webviewView.webview.postMessage({
                                                type: 'onToolDelta',
                                                value: { name: event.name, inputDelta: event.inputDelta },
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'run_error') {
                                            webviewView.webview.postMessage({
                                                type: 'onRunError',
                                                value: sanitizedEvent,
                                                sessionId: sessionId,
                                                runId: event.runId
                                            });
                                        } else if (event.type === 'approval_request') {
                                            webviewView.webview.postMessage({
                                                type: 'onApprovalRequest',
                                                value: sanitizedEvent,
                                                sessionId: sessionId,
                                                runId: currentRunRef.runId
                                            });
                                        }
                                    } catch (eventErr) {
                                        console.error("[SidebarProvider] Error in onEvent callback:", eventErr);
                                    }
                                }
                            })
                            webviewView.webview.postMessage({
                                type: 'onResponse',
                                value: typeof response === 'string' ? response : MarieSanitizer.sanitize(response),
                                sessionId: activeSessionIdAtStart
                            })
                        } catch (msgErr) {
                            console.error("[SidebarProvider] Error in handleMessage:", msgErr);
                            vscode.window.showErrorMessage(`Marie failed to process message: ${getErrorMessage(msgErr)}`);
                        }
                        break;
                    }
                    case "updateSettings": {
                        try {
                            const settings = data.value as any;
                            await Promise.all([
                                this.context.globalState.update("marie.apiKey", settings.apiKey),
                                this.context.globalState.update("marie.openrouterApiKey", settings.openrouterApiKey),
                                this.context.globalState.update("marie.cerebrasApiKey", settings.cerebrasApiKey),
                                vscode.workspace.getConfiguration("marie").update("aiProvider", settings?.aiProvider, vscode.ConfigurationTarget.Global),
                                vscode.workspace.getConfiguration("marie").update("model", settings?.model, vscode.ConfigurationTarget.Global)
                            ]);
                            // Re-initialize Marie with new settings
                            this._marie.updateSettings();
                        } catch (e) {
                            console.error("[SidebarProvider] updateSettings error:", e);
                        }
                        break;
                    }
                    case "openFile": {
                        try {
                            const fileName = data.value as string;
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (workspaceFolders) {
                                const uri = vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);
                                vscode.commands.executeCommand('vscode.open', uri);
                            }
                        } catch (e) {
                            console.error("[SidebarProvider] openFile error:", e);
                        }
                        break;
                    }
                    case "getProjectHealth": {
                        try {
                            const health = await this._marie.joyService.getProjectHealth();
                            webviewView.webview.postMessage({
                                type: 'onProjectHealth',
                                value: MarieSanitizer.sanitize(health)
                            });
                        } catch (e) {
                            console.error("[SidebarProvider] getProjectHealth error:", e);
                        }
                        break;
                    }
                    case "foldCode": {
                        vscode.commands.executeCommand('editor.foldAll');
                        vscode.window.showInformationMessage("Code folded to reveal the spark of joy. ✨");
                        break;
                    }
                    case "requestTidy": {
                        vscode.commands.executeCommand('editor.action.formatDocument');
                        vscode.commands.executeCommand('editor.action.organizeImports');
                        vscode.window.showInformationMessage("Tidied up! ✨");
                        break;
                    }
                    case "plantIntent": {
                        try {
                            const { fileName, intent, finalPath } = data.value as any;
                            const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

                            if (root && finalPath && finalPath !== fileName) {
                                try {
                                    const oldPath = path.join(root, fileName);
                                    const newPath = path.join(root, finalPath);

                                    // Atomically relocate the file to its proper JOY zone
                                    await vscode.workspace.fs.rename(
                                        vscode.Uri.file(oldPath),
                                        vscode.Uri.file(newPath),
                                        { overwrite: true }
                                    );
                                    vscode.window.showInformationMessage(`Planted ${path.basename(finalPath)} in the ${finalPath.split('/')[1] || 'proper'} zone. 🌱`);
                                } catch (e: unknown) {
                                    console.error("Failed to relocate file:", e);
                                }
                            }

                            await this._marie.joyService.addAchievement(`Planted intent for ${path.basename(finalPath || fileName)}: "${intent}" ✨`, 15);
                        } catch (e) {
                            console.error("[SidebarProvider] plantIntent error:", e);
                        }
                        break;
                    }
                    case "insertCode": {
                        try {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                editor.edit(editBuilder => {
                                    editBuilder.insert(editor.selection.active, String(data.value));
                                });
                            }
                        } catch (e) {
                            console.error("[SidebarProvider] insertCode error:", e);
                        }
                        break;
                    }
                    case "toolApprovalResponse": {
                        try {
                            const { requestId, approved } = (data.value || {}) as any;
                            if (!requestId) throw new Error("Missing requestId for tool approval");
                            this._marie.handleToolApproval(requestId, approved);
                        } catch (e) {
                            console.error("[SidebarProvider] toolApprovalResponse error:", e);
                        }
                        break;
                    }
                    case "listSessions": {
                        await this.refreshSessionList();
                        break;
                    }
                    case "loadSession": {
                        try {
                            const newSessionId = String(data.value);
                            await this._marie.loadSession(newSessionId);
                            await this.refreshSessionList();
                            this._view?.webview.postMessage({
                                type: 'onSessionLoaded',
                                value: this._marie.getMessages(),
                                sessionId: newSessionId
                            });
                        } catch (e) {
                            console.error("[SidebarProvider] loadSession error:", e);
                        }
                        break;
                    }
                    case "newSession": {
                        try {
                            const newSessionId = await this._marie.createSession();
                            await this.refreshSessionList();
                            this._view?.webview.postMessage({
                                type: 'onSessionLoaded',
                                value: [],
                                sessionId: newSessionId
                            });
                        } catch (e) {
                            console.error("[SidebarProvider] newSession error:", e);
                        }
                        break;
                    }
                    case "deleteSession": {
                        try {
                            await this._marie.deleteSession(String(data.value));
                            await this.refreshSessionList();
                            this._view?.webview.postMessage({
                                type: 'onSessionLoaded',
                                value: this._marie.getMessages(),
                                sessionId: this._marie.getCurrentSessionId()
                            });
                        } catch (e) {
                            console.error("[SidebarProvider] deleteSession error:", e);
                        }
                        break;
                    }
                    case "renameSession": {
                        try {
                            const { id, title } = (data.value || {}) as any;
                            if (id && title) {
                                await this._marie.renameSession(id, title);
                                await this.refreshSessionList();
                            }
                        } catch (e) {
                            console.error("[SidebarProvider] renameSession error:", e);
                        }
                        break;
                    }
                    case "togglePinSession": {
                        try {
                            await this._marie.togglePinSession(String(data.value));
                            await this.refreshSessionList();
                        } catch (e) {
                            console.error("[SidebarProvider] togglePinSession error:", e);
                        }
                        break;
                    }
                    case "requestRunState": {
                        try {
                            const run = this._marie.getCurrentRun();
                            if (run) {
                                this._view?.webview.postMessage({
                                    type: 'onRunState',
                                    value: MarieSanitizer.sanitize(run)
                                });
                            }
                        } catch (e) {
                            console.error("[SidebarProvider] requestRunState error:", e);
                        }
                        break;
                    }
                }
            } catch (e: unknown) {
                console.error("[SidebarProvider] Error handling webview message:", e);
                vscode.window.showErrorMessage(`Marie: Failed to handle webview activity. checking logs... 🥀`);
            }
        });

        // Initial file sync
        this._sendActiveFileData(vscode.window.activeTextEditor?.document);

        // Listen for active editor changes (Cleanup old listener first)
        this._editorListener?.dispose();
        this._editorListener = vscode.window.onDidChangeActiveTextEditor(e => {
            this._sendActiveFileData(e?.document);
        });

        this._disposeListener?.dispose();
        this._disposeListener = webviewView.onDidDispose(() => {
            this.dispose();
        });
    }

    public dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        this._messageListener?.dispose();
        this._editorListener?.dispose();
        this._disposeListener?.dispose();
        this._messageListener = undefined;
        this._editorListener = undefined;
        this._disposeListener = undefined;
    }

    public clearChat() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'triggerClear' });
        }
    }

    private _sendActiveFileData(document: vscode.TextDocument | undefined) {
        if (this._view) {
            const fileName = document ? vscode.workspace.asRelativePath(document.fileName) : 'No active file';
            this._view.webview.postMessage({
                type: 'onActiveFile',
                value: fileName
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "webview-ui", "build", "assets", "index.js"));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "webview-ui", "build", "assets", "index.css"));

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource} https:;">
                <base href="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'build', '/'))}">
                <link href="${styleUri}" rel="stylesheet">
                <title>Marie Chat</title>
            </head>
             <body>
                <div id="root">
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 24px; margin-bottom: 10px;">✨ Marie is tidying the interface...</div>
                        <div style="opacity: 0.7;">If this persists, there might be a script resolution issue.</div>
                    </div>
                </div>
                <script nonce="${nonce}">
                    console.log("[Marie] Webview carrier HTML loaded.");
                    window.addEventListener('error', (e) => {
                        console.error("[Marie] Webview Error:", e.message, "at", e.filename, ":", e.lineno);
                    });
                </script>
                <script nonce="${nonce}" type="module" crossorigin src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
