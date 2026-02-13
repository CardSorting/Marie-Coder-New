import { EventEmitter } from 'events';

export class JoyServiceCLI {
    private readonly _onRunProgress = new EventEmitter();
    public readonly onRunProgress = this._onRunProgress;

    constructor() { }

    public emitRunProgress(progress: {
        runId?: string;
        activeToolName?: string;
        lastToolName?: string;
        activeObjectiveId?: string;
        context?: string;
    }): void {
        this._onRunProgress.emit('progress', progress);
    }

    public dispose(): void {
        this._onRunProgress.removeAllListeners();
    }
}