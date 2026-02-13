// ConfigService - Environment-aware configuration
// Works in both VSCode extension and CLI environments

import type * as vscodeTypes from 'vscode';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let vscodeModule: typeof vscodeTypes | null = null;
let hasAttemptedVscodeLoad = false;

function isLikelyVscodeExtensionHost(): boolean {
    return Boolean(
        process.env.VSCODE_IPC_HOOK ||
        process.env.VSCODE_PID ||
        process.env.VSCODE_CWD
    );
}

function getVscode(): typeof vscodeTypes | null {
    // In CLI runtime, a local vscode shim may be resolvable as "vscode".
    // Only treat vscode as available when running inside VS Code extension host.
    if (!isLikelyVscodeExtensionHost()) {
        return null;
    }

    if (!hasAttemptedVscodeLoad) {
        hasAttemptedVscodeLoad = true;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            vscodeModule = nodeRequire('vscode') as typeof vscodeTypes;
        } catch {
            // VSCode not available - we're in CLI mode
            vscodeModule = null;
        }
    }
    return vscodeModule;
}

function getCliConfig(): Record<string, unknown> {
    try {
        // Dynamic require to avoid issues in VSCode environment.
        // Intentionally re-read config on each call so runtime updates
        // (e.g. setup wizard /config changes) are picked up immediately.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Storage } = nodeRequire('../../cli/storage.js');
        return Storage.getConfig() || {};
    } catch {
        return {};
    }
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

    static isAgentStreamsEnabled(): boolean {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<boolean>("agentStreamsEnabled", false);
        }

        const config = getCliConfig();
        const fromConfig = config.agentStreamsEnabled;
        if (typeof fromConfig === 'boolean') return fromConfig;

        return process.env.MARIE_AGENT_STREAMS_ENABLED === '1';
    }

    static getAgentStreamMaxConcurrent(): number {
        const vscode = getVscode();
        let value = 2;

        if (vscode) {
            value = vscode.workspace.getConfiguration("marie").get<number>("agentStreamMaxConcurrent", 2);
        } else {
            const config = getCliConfig();
            if (typeof config.agentStreamMaxConcurrent === 'number') {
                value = config.agentStreamMaxConcurrent;
            }
        }

        return Math.max(1, Math.min(8, value));
    }

    static getAgentStreamSpawnThreshold(): number {
        const vscode = getVscode();
        let value = 1.25;

        if (vscode) {
            value = vscode.workspace.getConfiguration("marie").get<number>("agentStreamSpawnThreshold", 1.25);
        } else {
            const config = getCliConfig();
            if (typeof config.agentStreamSpawnThreshold === 'number') {
                value = config.agentStreamSpawnThreshold;
            }
        }

        return Math.max(0.25, Math.min(5, value));
    }

    static getAgentStreamTimeoutMs(): number {
        const vscode = getVscode();
        let value = 20000;

        if (vscode) {
            value = vscode.workspace.getConfiguration("marie").get<number>("agentStreamTimeoutMs", 20000);
        } else {
            const config = getCliConfig();
            if (typeof config.agentStreamTimeoutMs === 'number') {
                value = config.agentStreamTimeoutMs;
            }
        }

        return Math.max(3000, Math.min(120000, value));
    }

    static getAgentStreamPilotAgents(): string[] {
        const normalize = (value: unknown): string[] => {
            if (Array.isArray(value)) {
                return value
                    .filter((v): v is string => typeof v === 'string')
                    .map(v => v.trim())
                    .filter(Boolean);
            }

            if (typeof value === 'string') {
                return value
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean);
            }

            return [];
        };

        const vscode = getVscode();
        if (vscode) {
            const configured = vscode.workspace.getConfiguration("marie").get<string[] | string>("agentStreamPilotAgents", ['QASRE']);
            return normalize(configured).length > 0 ? normalize(configured) : ['QASRE'];
        }

        const config = getCliConfig();
        const fromConfig = normalize(config.agentStreamPilotAgents);
        if (fromConfig.length > 0) return fromConfig;

        const fromEnv = normalize(process.env.MARIE_AGENT_STREAM_PILOT_AGENTS);
        if (fromEnv.length > 0) return fromEnv;

        return ['QASRE'];
    }

    static getAgentStreamMaxSpawnsPerTurn(): number {
        const vscode = getVscode();
        let value = 3;

        if (vscode) {
            value = vscode.workspace.getConfiguration("marie").get<number>("agentStreamMaxSpawnsPerTurn", 3);
        } else {
            const config = getCliConfig();
            if (typeof config.agentStreamMaxSpawnsPerTurn === 'number') {
                value = config.agentStreamMaxSpawnsPerTurn;
            }
        }

        return Math.max(1, Math.min(16, value));
    }

    static isAgentStreamPressureSheddingEnabled(): boolean {
        const vscode = getVscode();
        if (vscode) {
            return vscode.workspace.getConfiguration("marie").get<boolean>("agentStreamPressureSheddingEnabled", true);
        }

        const config = getCliConfig();
        if (typeof config.agentStreamPressureSheddingEnabled === 'boolean') {
            return config.agentStreamPressureSheddingEnabled;
        }

        if (process.env.MARIE_AGENT_STREAM_PRESSURE_SHEDDING_ENABLED === '0') {
            return false;
        }

        return true;
    }
}
