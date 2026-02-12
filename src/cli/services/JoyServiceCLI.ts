import { EventEmitter } from 'events';

export interface JoyScoreEvent {
    score: number;
    status: string;
    tips: string[];
}

export interface RunProgressEvent {
    runId?: string;
    activeToolName?: string;
    lastToolName?: string;
    activeObjectiveId?: string;
    context?: string;
}

export interface LettingGoRequest {
    path: string;
    lines: number;
}

export class JoyServiceCLI {
    private readonly _onJoyScoreChange = new EventEmitter();
    private readonly _onRunProgress = new EventEmitter();
    private readonly _onLettingGoRequest = new EventEmitter();
    private intention: string | null = null;
    private _lastProjectScore: number | null = null;

    public readonly onJoyScoreChange = this._onJoyScoreChange;
    public readonly onRunProgress = this._onRunProgress;
    public readonly onLettingGoRequest = this._onLettingGoRequest;

    constructor() { }

    public async addAchievement(description: string, points: number = 10): Promise<void> {
        // CLI version - could log to file or display inline
        if (process.env.MARIE_DEBUG) {
            console.log(`[Achievement] ${description} (+${points})`);
        }
    }

    public async setIntention(intention: string): Promise<void> {
        this.intention = intention;
    }

    public async getProjectHealth(): Promise<any> {
        // Simplified for CLI - no VS Code workspace
        return {
            average: 100,
            fileCount: 0,
            log: [],
            zoningViolations: 0,
            joyfulFiles: 0,
            plumbingFiles: 0,
            migrationAlerts: [],
            clusteringAlerts: [],
            isJoyful: true
        };
    }

    public async requestLettingGo(path: string): Promise<void> {
        let lines = 0;
        try {
            const fs = await import('fs');
            const content = fs.readFileSync(path, 'utf-8');
            lines = content.split('\n').length;
        } catch {
            // File may not exist
        }
        this._onLettingGoRequest.emit('request', { path, lines });
    }

    public emitRunProgress(progress: RunProgressEvent): void {
        this._onRunProgress.emit('progress', progress);
    }

    public dispose(): void {
        this._onJoyScoreChange.removeAllListeners();
        this._onRunProgress.removeAllListeners();
        this._onLettingGoRequest.removeAllListeners();
    }
}