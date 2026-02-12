import * as vscode from 'vscode';
import { PureStreamParser, PartialToolInput } from '../infrastructure/tools/PureStreamParser.js';
import { MarieSCMProvider } from './MarieSCMProvider.js';
import { StringUtils } from '../plumbing/utils/StringUtils.js';

/**
 * Provides inline 'Ghost Text' previews of AI edits and coordinates with SCM for gutter markers.
 */
export class MarieGhostService {
    private static parser = new PureStreamParser();
    private static lastUpdate = 0;
    private static activeGhosts = new Map<string, { uri: string, range: vscode.Range, text: string }>();

    private static ghostDecoration = vscode.window.createTextEditorDecorationType({
        before: {
            color: new vscode.ThemeColor('editorGhostText.foreground'),
            fontStyle: 'italic',
            margin: '0 0.5em 0 0'
        },
        opacity: '0.4',
        backgroundColor: new vscode.ThemeColor('editorGhostText.background'),
        isWholeLine: true
    });

    public static init(context: vscode.ExtensionContext) {
        // Ensure ghosts persist across tab switches
        context.subscriptions.push(
            vscode.window.onDidChangeVisibleTextEditors(() => {
                const uris = new Set(Array.from(this.activeGhosts.values()).map(g => g.uri));
                uris.forEach(u => this.refreshDecorations(vscode.Uri.parse(u)));
            })
        );
    }

    private static thoughtDecoration = vscode.window.createTextEditorDecorationType({
        after: {
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
            fontStyle: 'italic',
            margin: '0 0 0 2em'
        },
        isWholeLine: true
    });

    /**
     * projects a "Thought" from the swarm into the editor as a ghost comment.
     * These are ephemeral and clear on next run.
     */
    public static showThought(agent: string, text: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        const line = activeEditor.selection.active.line;
        const decoration = {
            range: new vscode.Range(line, 0, line, 0),
            renderOptions: {
                after: { contentText: ` // 🧠 ${agent}: ${text}` }
            }
        };

        activeEditor.setDecorations(this.thoughtDecoration, [decoration]);

        const timeoutKey = `${activeEditor.document.uri.toString()}:${line}`;
        if (this.thoughtTimeouts.has(timeoutKey)) clearTimeout(this.thoughtTimeouts.get(timeoutKey)!);

        const timeout = setTimeout(() => {
            activeEditor.setDecorations(this.thoughtDecoration, []);
            this.thoughtTimeouts.delete(timeoutKey);
        }, 4000);

        this.thoughtTimeouts.set(timeoutKey, timeout);
    }

    private static pendingDeltas = new Map<string, string>();
    private static updateTimer: NodeJS.Timeout | null = null;

    public static handleDelta(toolCallId: string, name: string, delta: string) {
        if (!['write_file', 'replace_in_file', 'write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(name)) return;

        // Buffer the delta
        const current = this.pendingDeltas.get(toolCallId) || "";
        this.pendingDeltas.set(toolCallId, current + delta);

        // Schedule flush if not already pending
        if (!this.updateTimer) {
            this.updateTimer = setTimeout(() => this.flushUpdates(), 50);
        }
    }

    private static flushUpdates() {
        this.updateTimer = null;

        for (const [toolCallId, delta] of Array.from(this.pendingDeltas.entries())) {
            const input = this.parser.append(toolCallId, delta);
            const hasContent = input.content !== undefined || input.replace !== undefined;

            if (input.path && hasContent) {
                const uri = vscode.Uri.file(input.path);
                this.updateGhost(toolCallId, uri, input);
            }
        }

        this.pendingDeltas.clear();
    }

    private static updateGhost(toolCallId: string, uri: vscode.Uri, input: PartialToolInput) {
        const editors = vscode.window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString());
        if (editors.length === 0) return;

        const editor = editors[0];
        let targetLine = 0;

        if (input.line_start !== undefined) {
            targetLine = Math.max(0, input.line_start - 1);
        } else if (input.old_content || input.search) {
            const searchString = input.search || input.old_content || '';
            const snapshot = searchString.substring(0, 30);
            if (snapshot) {
                for (let i = 0; i < editor.document.lineCount; i++) {
                    if (editor.document.lineAt(i).text.includes(snapshot)) {
                        targetLine = i;
                        break;
                    }
                }
            }
        }

        const range = new vscode.Range(targetLine, 0, targetLine, 0);
        const previewText = input.replace || StringUtils.extractText(input.content) || '';
        const textPreview = ` $(sync~spin) Proposed: ${previewText.substring(0, 80).replace(/\n/g, ' ')}...`;

        this.activeGhosts.set(toolCallId, { uri: uri.toString(), range, text: textPreview });
        this.refreshDecorations(uri);
        MarieSCMProvider.getInstance()?.registerDiff(uri, uri);
    }

    private static refreshDecorations(uri: vscode.Uri) {
        const uriStr = uri.toString();
        const relevantGhosts = Array.from(this.activeGhosts.values()).filter(g => g.uri === uriStr);
        const decorations = relevantGhosts.map(g => ({
            range: g.range,
            renderOptions: {
                before: { contentText: g.text }
            }
        }));

        vscode.window.visibleTextEditors
            .filter(e => e.document.uri.toString() === uriStr)
            .forEach(e => e.setDecorations(this.ghostDecoration, decorations));
    }

    public static clear(toolCallId: string) {
        const ghost = this.activeGhosts.get(toolCallId);
        if (ghost) {
            this.activeGhosts.delete(toolCallId);
            this.refreshDecorations(vscode.Uri.parse(ghost.uri));
            // Only clear SCM if no more ghosts for this URI
            const remaining = Array.from(this.activeGhosts.values()).some(g => g.uri === ghost.uri);
            if (!remaining) {
                MarieSCMProvider.getInstance()?.clear(vscode.Uri.parse(ghost.uri));
            }
        }
        this.parser.clear(toolCallId);
    }

    public static clearAll() {
        const uris = new Set(Array.from(this.activeGhosts.values()).map(g => g.uri));
        this.activeGhosts.clear();
        this.parser.clearAll();
        uris.forEach(u => this.refreshDecorations(vscode.Uri.parse(u)));
        MarieSCMProvider.getInstance()?.clearAll();
    }

    private static thoughtTimeouts = new Map<string, NodeJS.Timeout>();

    public static dispose() {
        this.ghostDecoration.dispose();
        this.thoughtDecoration.dispose();
        this.thoughtTimeouts.forEach(t => clearTimeout(t));
        this.thoughtTimeouts.clear();
        if (this.updateTimer) clearTimeout(this.updateTimer);
    }
}
