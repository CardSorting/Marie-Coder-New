import { RunTelemetry } from '../../domain/marie/MarieTypes.js';
import { JoyServiceCLI } from './JoyServiceCLI.js';

export class JoyAutomationServiceCLI {
    private currentRun: RunTelemetry | undefined;
    private workingDir: string;

    constructor(joyService: JoyServiceCLI, workingDir: string) {
        this.workingDir = workingDir;
    }

    public setCurrentRun(run: RunTelemetry | undefined) {
        this.currentRun = run;
    }

    public getCurrentRun(): RunTelemetry | undefined {
        return this.currentRun;
    }

    public async triggerGenesis(): Promise<string> {
        return "Genesis ritual not available in CLI mode.";
    }

    public async sowJoyFeature(name: string, intent: string): Promise<string> {
        return `Sowing feature '${name}' not available in CLI mode.`;
    }

    public async performGardenPulse(): Promise<string> {
        return "Garden pulse not available in CLI mode.";
    }

    public async autoScaffold(): Promise<void> {
        // No-op in CLI
    }

    public dispose(): void {
        // No-op
    }
}