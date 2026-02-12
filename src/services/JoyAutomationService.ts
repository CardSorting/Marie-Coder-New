import * as vscode from 'vscode';
import * as path from 'path';
import { proposeReorganization, executeRestoration, synthesizeZoneManuals, scaffoldZoneAbstractions, sowFeature, proposeClustering, executeGenesisRitual, isProjectJoyful } from '../domain/joy/JoyTools';
import { JoyService } from './JoyService';
import { RunTelemetry } from '../domain/marie/MarieTypes';

export class JoyAutomationService {
    private currentRun: RunTelemetry | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly joyService: JoyService
    ) { }

    public setCurrentRun(run: RunTelemetry | undefined) {
        this.currentRun = run;
    }

    public getCurrentRun(): RunTelemetry | undefined {
        return this.currentRun;
    }

    public async triggerGenesis(): Promise<string> {
        const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!root) return "No workspace detected.";

        const result = await executeGenesisRitual(root);
        await this.joyService.addAchievement(`Performed the Genesis Ritual. Project reborn in JOY. ✨`, 100);
        return result;
    }

    public async sowJoyFeature(name: string, intent: string): Promise<string> {
        const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!root) return "No workspace detected.";

        const result = await sowFeature(root, name, intent);
        await this.joyService.addAchievement(`Sowed the seeds of '${name}' across the garden. 🌱`, 25);
        return result;
    }

    public async performGardenPulse(): Promise<string> {
        const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!root) return "No workspace detected.";

        let finalReport = "";
        try {
            // 0. Check project JOY status
            const isJoyful = await isProjectJoyful(root);

            // 1. Ensure folders and scaffold if empty
            const scaffoldResult = await scaffoldZoneAbstractions(root);
            finalReport += scaffoldResult;

            // 2. Propose re-org
            const proposals = await proposeReorganization(root);

            // 3. Check for clustering needs
            const clustering = await proposeClustering(root);

            // 4. Synthesize manuals
            await synthesizeZoneManuals(root);

            if (!isJoyful) {
                finalReport += `\n- ⚠️ **Architectural Void**: This project has not yet embraced the JOY structure. Use the Genesis Ritual to begin your journey.`;
            }
            if (proposals.length > 0) finalReport += `\n- ${proposals.length} structural drifts detected.`;
            if (clustering.length > 0) finalReport += `\n- ${clustering.length} zones ripe for clustering.`;

        } catch (e: any) {
            finalReport += `\n- ❌ **Pulse Interrupted**: A structural error occurred during synthesis: ${e.message}`;
        }

        return `${finalReport}\n\nThe garden continues to evolve in harmony. ✨`;
    }

    public async autoScaffold() {
        const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (root) {
            await scaffoldZoneAbstractions(root);
        }
    }

    public dispose() {
        // No current timers or subscriptions to clear here yet, but prevents leaks in Marie.ts
    }
}
