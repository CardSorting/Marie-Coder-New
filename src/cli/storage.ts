import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export { fs, path };

const MARIE_DIR = path.join(os.homedir(), '.marie');
const SESSIONS_FILE = path.join(MARIE_DIR, 'sessions.json');
const METADATA_FILE = path.join(MARIE_DIR, 'sessionMetadata.json');
const CONFIG_FILE = path.join(MARIE_DIR, 'config.json');
const CURRENT_SESSION_FILE = path.join(MARIE_DIR, 'currentSession.json');

export interface SessionMetadata {
    id: string;
    title: string;
    lastModified: number;
    isPinned: boolean;
}

export interface MarieConfig {
    apiKey?: string;
    openrouterApiKey?: string;
    cerebrasApiKey?: string;
    aiProvider: 'anthropic' | 'openrouter' | 'cerebras';
    model: string;
    requireApproval: boolean;
    maxContextTokens: number;
    yoloEnabled: boolean;
    yoloProfile: 'demo_day' | 'balanced' | 'recovery';
    yoloAggression: number;
    yoloMaxRequiredActions: number;
}

const defaultConfig: MarieConfig = {
    aiProvider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    requireApproval: true,
    maxContextTokens: 100000,
    yoloEnabled: true,
    yoloProfile: 'balanced',
    yoloAggression: 1,
    yoloMaxRequiredActions: 2
};

export class Storage {
    static ensureDir(): void {
        if (!fs.existsSync(MARIE_DIR)) {
            fs.mkdirSync(MARIE_DIR, { recursive: true });
        }
    }

    static getConfig(): MarieConfig {
        this.ensureDir();
        if (!fs.existsSync(CONFIG_FILE)) {
            return { ...defaultConfig };
        }
        try {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return { ...defaultConfig, ...JSON.parse(data) };
        } catch {
            return { ...defaultConfig };
        }
    }

    static saveConfig(config: Partial<MarieConfig>): void {
        this.ensureDir();
        const current = this.getConfig();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...config }, null, 2));
    }

    static getSessions(): Record<string, any[]> {
        this.ensureDir();
        if (!fs.existsSync(SESSIONS_FILE)) {
            return {};
        }
        try {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            return {};
        }
    }

    static saveSessions(sessions: Record<string, any[]>): void {
        this.ensureDir();
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    }

    static getSessionMetadata(): SessionMetadata[] {
        this.ensureDir();
        if (!fs.existsSync(METADATA_FILE)) {
            return [];
        }
        try {
            const data = fs.readFileSync(METADATA_FILE, 'utf-8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    static saveSessionMetadata(metadata: SessionMetadata[]): void {
        this.ensureDir();
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
    }

    static getCurrentSessionId(): string {
        this.ensureDir();
        if (!fs.existsSync(CURRENT_SESSION_FILE)) {
            return 'default';
        }
        try {
            const data = fs.readFileSync(CURRENT_SESSION_FILE, 'utf-8');
            return JSON.parse(data).id || 'default';
        } catch {
            return 'default';
        }
    }

    static setCurrentSessionId(id: string): void {
        this.ensureDir();
        fs.writeFileSync(CURRENT_SESSION_FILE, JSON.stringify({ id }));
    }

    static getLastTelemetry(): any {
        this.ensureDir();
        const file = path.join(MARIE_DIR, 'lastTelemetry.json');
        if (!fs.existsSync(file)) return undefined;
        try {
            return JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch {
            return undefined;
        }
    }

    static setLastTelemetry(telemetry: any): void {
        this.ensureDir();
        const file = path.join(MARIE_DIR, 'lastTelemetry.json');
        fs.writeFileSync(file, JSON.stringify(telemetry, null, 2));
    }
}