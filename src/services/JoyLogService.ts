import * as vscode from 'vscode';

export interface TidyAchievement {
    id: string;
    description: string;
    timestamp: number;
    points: number;
}

export class JoyLogService {
    private static readonly STORAGE_KEY = 'marie.joyLog';
    private _log: TidyAchievement[] = [];

    private readonly _onAchievementAdded = new vscode.EventEmitter<TidyAchievement>();
    public readonly onAchievementAdded = this._onAchievementAdded.event;

    constructor(private readonly context: vscode.ExtensionContext) {
        this._loadLog();
    }

    private _loadLog() {
        const saved = this.context.globalState.get<TidyAchievement[]>(JoyLogService.STORAGE_KEY);
        this._log = saved || [];
    }

    public async addAchievement(description: string, points: number = 10) {
        const achievement: TidyAchievement = {
            id: Math.random().toString(36).substring(7),
            description,
            timestamp: Date.now(),
            points
        };

        this._log.unshift(achievement);
        // Keep last 100 achievements
        if (this._log.length > 100) {
            this._log = this._log.slice(0, 100);
        }

        await this.context.globalState.update(JoyLogService.STORAGE_KEY, this._log);
        this._onAchievementAdded.fire(achievement);
        return achievement;
    }

    public getLog(): TidyAchievement[] {
        return this._log;
    }

    public getStats() {
        const totalPoints = this._log.reduce((acc, curr) => acc + curr.points, 0);
        return {
            totalPoints,
            count: this._log.length,
            recent: this._log.slice(0, 5)
        };
    }

    public async clearLog() {
        this._log = [];
        await this.context.globalState.update(JoyLogService.STORAGE_KEY, []);
    }
}
