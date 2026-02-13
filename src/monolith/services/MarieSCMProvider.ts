import * as vscode from 'vscode';

/**
 * A minimal SCM-based provider to enable native gutter diff markers and scrollbar highlights.
 * This is the "Deep Native" way to show changes without a dedicated diff editor.
 */
export class MarieSCMProvider {
    private static instance: MarieSCMProvider;
    private scm: vscode.SourceControl;
    private static readonly MAX_DIFF_URIS = 200;
    private diffUris = new Map<string, vscode.Uri>();

    constructor(context: vscode.ExtensionContext) {
        this.scm = vscode.scm.createSourceControl('marie', 'Marie Proposed Edits');

        // Define the QuickDiffProvider implementation
        this.scm.quickDiffProvider = {
            provideOriginalResource: (uri: vscode.Uri) => {
                return this.diffUris.get(uri.toString());
            }
        };

        context.subscriptions.push(this.scm);
        MarieSCMProvider.instance = this;
    }

    public static getInstance(): MarieSCMProvider {
        return this.instance;
    }

    public registerDiff(activeUri: vscode.Uri, originalBaseUri: vscode.Uri) {
        // Prevent unbounded memory growth
        if (this.diffUris.size >= MarieSCMProvider.MAX_DIFF_URIS) {
            const firstKey = this.diffUris.keys().next().value;
            if (firstKey) this.diffUris.delete(firstKey);
        }

        this.diffUris.set(activeUri.toString(), originalBaseUri);
    }

    public clear(activeUri: vscode.Uri) {
        this.diffUris.delete(activeUri.toString());
    }

    public clearAll() {
        this.diffUris.clear();
    }
}
