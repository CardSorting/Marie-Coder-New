// ConfigService - Environment-aware configuration
// Works in both VSCode extension and CLI environments

import type * as vscodeTypes from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let vscodeModule: typeof vscodeTypes | null = null;
let hasAttemptedVscodeLoad = false;

function getVscode(): typeof vscodeTypes | null {
    if (!hasAttemptedVscodeLoad) {
        hasAttemptedVscodeLoad = true;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            vscodeModule = require('vscode') as typeof vscodeTypes;
        } catch {
            // VSCode not available - we're in CLI mode
            vscodeModule = null;
        }
    }
    return vscodeModule;
}

// CLI config cache (loaded from Storage)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cliConfig: any = null;

function getCliConfig(): Record<string, unknown> {
    if (!cliConfig) {
        try {
            // Dynamic require to avoid issues in VSCode environment
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { Storage } = require('../../cli/storage.js');
            cliConfig = Storage.getConfig();
        } catch {
            cliConfig = {};
        }
    }
    return cliConfig || {};
}

interface ConfigProvider {
    get<T>(key: string, defaultValue?: T): T | undefined;
}

export class ConfigService {
    /** Cached excluded files list — invalidated on config change */
    private static _excludedFilesCache: string[] | null = null;

    private static getVscodeConfig(): ConfigProvider | null {
        const vscode = getVscode();
        if (!vscode) return null;
        return vscode.workspace.getConfiguration("marie") as ConfigProvider;
    }

    private static isVscode(): boolean {
        return getVscode() !== null;
    }

    static getApiKey(): string | undefined {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<string>("apiKey");
        }
        return process.env.ANTHROPIC_API_KEY;
    }

    static getOpenRouterApiKey(): string | undefined {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<string>("openrouterApiKey");
        }
        return process.env.OPENROUTER_API_KEY;
    }

    static getCerebrasApiKey(): string | undefined {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<string>("cerebrasApiKey");
        }
        return process.env.CEREBRAS_API_KEY;
    }

    static getAiProvider(): 'anthropic' | 'openrouter' | 'cerebras' {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<'anthropic' | 'openrouter' | 'cerebras'>("aiProvider", "anthropic");
        }
        const config = getCliConfig();
        return (config.aiProvider as 'anthropic' | 'openrouter' | 'cerebras') || "anthropic";
    }

    static getModel(): string {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<string>("model", "claude-3-5-sonnet-20241022");
        }
        const config = getCliConfig();
        return (config.model as string) || "claude-3-5-sonnet-20241022";
    }

    static getRequireApproval(): boolean {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<boolean>("requireApproval", true);
        }
        const config = getCliConfig();
        return config.requireApproval !== false;
    }

    static getMaxContextTokens(): number {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<number>("maxContextTokens", 100000);
        }
        return 100000;
    }

    static getExcludedFiles(): string[] {
        const vscode = getVscode();
        if (vscode) {
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
        // CLI default exclusions
        return ['node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.vscode', '.idea', '.DS_Store'];
    }

    static getKeepRecentMessages(): number {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<number>("keepRecentMessages", 30);
        }
        return 30;
    }

    static getTokensPerChar(): number {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<number>("tokensPerChar", 0.25);
        }
        return 0.25;
    }

    static isYoloEnabled(): boolean {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<boolean>("yoloEnabled", true);
        }
        return true;
    }

    static getYoloProfile(): 'demo_day' | 'balanced' | 'recovery' {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<'demo_day' | 'balanced' | 'recovery'>("yoloProfile", "balanced");
        }
        return "balanced";
    }

    static getYoloAggression(): number {
        const vscode = getVscode();
        let value = 1.0;
        if (vscode) {
            value = vscode.workspace.getConfiguration("marie").get<number>("yoloAggression", 1.0);
        }
        return Math.max(0.5, Math.min(1.5, value));
    }

    static getYoloMaxRequiredActions(): number {
        const vscode = getVscode();
        let value = 2;
        if (vscode) {
            value = vscode.workspace.getConfiguration("marie").get<number>("yoloMaxRequiredActions", 2);
        }
        return Math.max(0, Math.min(5, value));
    }
}
