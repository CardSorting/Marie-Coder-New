import * as vscode from 'vscode';

export class ConfigService {
    /** Cached excluded files list — invalidated on config change */
    private static _excludedFilesCache: string[] | null = null;

    private static _configChangeListener: vscode.Disposable | null = null;

    private static getConfig() {
        return vscode.workspace.getConfiguration("marie");
    }

    private static ensureConfigListener(): void {
        if (!this._configChangeListener) {
            this._configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration("files.exclude") || e.affectsConfiguration("marie")) {
                    this._excludedFilesCache = null;
                }
            });
        }
    }

    static getApiKey(): string | undefined {
        return this.getConfig().get<string>("apiKey");
    }

    static getOpenRouterApiKey(): string | undefined {
        return this.getConfig().get<string>("openrouterApiKey");
    }

    static getCerebrasApiKey(): string | undefined {
        return this.getConfig().get<string>("cerebrasApiKey");
    }

    static getAiProvider(): 'anthropic' | 'openrouter' | 'cerebras' {
        return this.getConfig().get<'anthropic' | 'openrouter' | 'cerebras'>("aiProvider", "anthropic");
    }

    static getModel(): string {
        return this.getConfig().get<string>("model", "claude-3-5-sonnet-20241022");
    }

    static getRequireApproval(): boolean {
        return this.getConfig().get<boolean>("requireApproval", true);
    }

    static getMaxContextTokens(): number {
        return this.getConfig().get<number>("maxContextTokens", 100000);
    }

    static getExcludedFiles(): string[] {
        this.ensureConfigListener();

        if (this._excludedFilesCache) {
            return this._excludedFilesCache;
        }

        const filesExclude = vscode.workspace.getConfiguration("files").get<Record<string, boolean>>("exclude", {});
        const userExclusions = Object.keys(filesExclude).filter(key => filesExclude[key]);

        const defaultExclusions = [
            'node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.vscode', '.idea', '.DS_Store'
        ];

        this._excludedFilesCache = Array.from(new Set([...defaultExclusions, ...userExclusions]));
        return this._excludedFilesCache;
    }

    static getKeepRecentMessages(): number {
        return this.getConfig().get<number>("keepRecentMessages", 30);
    }

    static getTokensPerChar(): number {
        // Default to ~4 chars per token (0.25)
        return this.getConfig().get<number>("tokensPerChar", 0.25);
    }

    static isYoloEnabled(): boolean {
        return this.getConfig().get<boolean>("yoloEnabled", true);
    }

    static getYoloProfile(): 'demo_day' | 'balanced' | 'recovery' {
        return this.getConfig().get<'demo_day' | 'balanced' | 'recovery'>("yoloProfile", "balanced");
    }

    static getYoloAggression(): number {
        const value = this.getConfig().get<number>("yoloAggression", 1.0);
        return Math.max(0.5, Math.min(1.5, value));
    }

    static getYoloMaxRequiredActions(): number {
        const value = this.getConfig().get<number>("yoloMaxRequiredActions", 2);
        return Math.max(0, Math.min(5, value));
    }
}
