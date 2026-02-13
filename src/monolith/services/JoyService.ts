import * as vscode from 'vscode';
import { checkCodeHealth, HealthReport } from '../plumbing/analysis/CodeHealthService.js';

import { JoyLogService } from './JoyLogService.js';
import { proposeClustering, isProjectJoyful } from '../domain/joy/JoyTools.js';

export class JoyService implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private readonly _onJoyScoreChange = new vscode.EventEmitter<{ score: number, status: string, tips: string[] }>();
    public readonly onJoyScoreChange = this._onJoyScoreChange.event;
    private readonly _onRunProgress = new vscode.EventEmitter<{
        runId?: string;
        activeToolName?: string;
        lastToolName?: string;
        activeObjectiveId?: string;
        context?: string;
    }>();
    public readonly onRunProgress = this._onRunProgress.event;
    private intention: string | null = null;
    private _lastProjectScore: number | null = null;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly joyLog: JoyLogService
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        context.subscriptions.push(this.statusBarItem);

        this.intention = context.workspaceState.get<string>('marie.intention') || null;

        // Update when active editor changes
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.updateJoyStatus())
        );

        // Update when document is saved
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(async (doc) => {
                await this.updateJoyStatus();

                const config = vscode.workspace.getConfiguration('marie');
                if (config.get('strictMode')) {
                    const health = await checkCodeHealth(doc.fileName);
                    if (health.zoningHealth?.isBackflowPresent) {
                        vscode.window.showWarningMessage(`⚠️ Strict Mode: Zoning Violation detected in ${vscode.workspace.asRelativePath(doc.fileName)}. Please respect the Downward Flow Law.`);
                    }
                }
            })
        );

        this.updateJoyStatus();
    }



    public async addAchievement(description: string, points: number = 10) {
        return await this.joyLog.addAchievement(description, points);
    }

    public async setIntention(intention: string) {
        this.intention = intention;
        await this.context.workspaceState.update('marie.intention', intention);
        this.updateJoyStatus();
    }

    public async getProjectHealth() {
        const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!rootPath) return null;

        const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx}', '**/node_modules/**', 100);
        let totalScore = 0;
        let fileCount = 0;
        let zoningViolations = 0;
        let joyfulFiles = 0;
        let plumbingFiles = 0;
        const migrationAlerts: { file: string, reason: string }[] = [];

        for (const file of files.slice(0, 30)) {
            try {
                const health = await checkCodeHealth(file.fsPath);
                totalScore += health.joyScore;
                fileCount++;

                if (health.zoningHealth?.isBackflowPresent) {
                    zoningViolations++;
                }

                if (health.zoningHealth?.migrationNeed?.shouldMigrate) {
                    migrationAlerts.push({
                        file: vscode.workspace.asRelativePath(file),
                        reason: health.zoningHealth.migrationNeed.reason || "Conceptual drift detected."
                    });
                }

                if (file.fsPath.includes('/domain/')) joyfulFiles++;
                else if (file.fsPath.includes('/plumbing/')) plumbingFiles++;

            } catch { /* Ignore individual file health check failures */ }
        }

        const average = fileCount > 0 ? Math.round(totalScore / fileCount) : 100;

        // Scale check: Clustering suggestions
        const clusteringAlerts = await proposeClustering(rootPath);
        const isJoyful = await isProjectJoyful(rootPath);

        // Detect project-wide improvement
        if (this._lastProjectScore !== null && average > this._lastProjectScore) {
            await this.joyLog.addAchievement(`Project health improved to ${average}! ✨`, 50);
        }
        this._lastProjectScore = average;

        return {
            average,
            fileCount,
            log: this.joyLog.getLog(),
            zoningViolations,
            joyfulFiles,
            plumbingFiles,
            migrationAlerts,
            clusteringAlerts,
            isJoyful
        };
    }

    private _onLettingGoRequest = new vscode.EventEmitter<{ path: string, lines: number }>();
    public readonly onLettingGoRequest = this._onLettingGoRequest.event;

    public async requestLettingGo(path: string) {
        // Calculate lines for the modal
        let lines = 0;
        try {
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
            lines = content.toString().split('\n').length;
        } catch (error: unknown) {
            /* File may not exist or be unreadable, default to 0 lines */
        }

        this._onLettingGoRequest.fire({ path, lines });
    }

    private async updateJoyStatus() {
        const editor = vscode.window.activeTextEditor;

        // Base text
        let text = "";
        let tooltip = "";

        // If we have an intention, it takes precedence or shares space
        if (this.intention) {
            text = `$(heart) Intention: ${this.intention} `;
            tooltip += `Current Intention: ${this.intention}\n\n`;
        }

        if (!editor) {
            if (this.intention) {
                this.statusBarItem.text = text;
                this.statusBarItem.tooltip = tooltip;
                this.statusBarItem.show();
            } else {
                this.statusBarItem.hide();
            }
            return;
        }

        const doc = editor.document;
        // Only check supported files for Joy Score
        if (doc.uri.scheme === 'file' && this.isSupportedFile(doc.fileName)) {
            try {
                const health = await checkCodeHealth(doc.fileName);

                const score = health.joyScore;

                // Track small improvements as achievements
                if (score === 100) {
                    await this.joyLog.addAchievement(`Reached 100% Joy in ${vscode.workspace.asRelativePath(doc.fileName)}! ❤️`, 20);
                }

                let icon = "$(sparkle)";

                if (score === 100) icon = "$(heart)";
                else if (score >= 80) icon = "$(sparkle)";
                else if (score >= 50) icon = "$(warning)";
                else icon = "$(trash)";

                text += `${icon} Joy: ${score}`;
                tooltip += `Joy Status: ${health.joyStatus}\n\n${health.tips.join('\n')}`;

                this._onJoyScoreChange.fire({ score, status: health.joyStatus, tips: health.tips });
            } catch (error: unknown) {
                // Ignore health check errors for UI purposes
            }
        }

        if (text) {
            this.statusBarItem.text = text;
            this.statusBarItem.tooltip = tooltip;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private isSupportedFile(fileName: string): boolean {
        return fileName.endsWith('.ts') ||
            fileName.endsWith('.js') ||
            fileName.endsWith('.tsx') ||
            fileName.endsWith('.jsx');
    }
    public dispose() {
        this.statusBarItem.dispose();
        this._onJoyScoreChange.dispose();
        this._onLettingGoRequest.dispose();
        this._onRunProgress.dispose();
    }
}
