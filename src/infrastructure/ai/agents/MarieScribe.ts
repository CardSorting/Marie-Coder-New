import { AIProvider } from "../providers/AIProvider.js";
import { MarieProgressTracker } from "../core/MarieProgressTracker.js";
import { ConfigService } from "../../config/ConfigService.js";
import { RunTelemetry } from "../../../domain/marie/MarieTypes.js";
import { MarieCouncil } from "../council/MarieCouncil.js";
import { MarieMemoryStore } from "../../services/MarieMemoryStore.js";
import { MarieResponse } from "../core/MarieResponse.js";
import * as fs from 'fs';
import * as path from 'path';

export class MarieScribe {
    constructor(
        private provider: AIProvider,
        private council?: MarieCouncil
    ) { }

    public async generateReport(tracker: MarieProgressTracker): Promise<void> {
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: "Scribe: Documenting task evidence & metrics...",
            elapsedMs: tracker.elapsedMs()
        });

        const run = tracker.getRun();
        const duration = ((Date.now() - run.startedAt) / 1000).toFixed(1);
        const achievements = run.achieved.join('\n- ');

        // Metrics & Tool Usage
        let toolStats = "No tools recorded.";
        if (run.toolUsage) {
            const totalCalls = Object.values(run.toolUsage).reduce((a: any, b: any) => a + b, 0);
            toolStats = Object.entries(run.toolUsage)
                .map(([k, v]) => `- \`${k}\`: ${v} (${Math.round((v / totalCalls) * 100)}%)`)
                .join('\n');
        }

        // Code Impact Analysis
        let codeImpact = "No file changes recorded.";
        if (run.codeStats?.modifiedFiles) {
            const files = Object.entries(run.codeStats.modifiedFiles);
            if (files.length > 0) {
                const totalAdded = files.reduce((sum, [_, stats]: [string, any]) => sum + stats.added, 0);
                const totalRemoved = files.reduce((sum, [_, stats]: [string, any]) => sum + stats.removed, 0);
                codeImpact = `**Total Impact:** ${files.length} files modified (+${totalAdded}, -${totalRemoved} lines).\n\n**Detailed Breakdown**:\n${files.map(([file, stats]: [string, any]) => `- \`${path.basename(file)}\`: +${stats.added}, -${stats.removed}`).join('\n')}`;
            }
        }

        const metricsTable = `| Metric | Value |\n| :--- | :--- |\n| Duration | ${duration}s |\n| Steps | ${run.steps} |\n| Tool Calls | ${run.tools} |`;
        const objectives = run.objectives.map((o: any) => {
            const statusIcon = o.status === 'verified' ? '✅' : (o.status === 'completed' ? '☑️' : '⬜');
            return `- ${statusIcon} **${o.label}**${o.verificationEvidence ? `\n  - **Evidence**: ${o.verificationEvidence}` : ''}`;
        }).join('\n');

        const councilSection = this.formatCouncilSection(run);
        const sessionAnalytics = this.formatSessionAnalytics();

        // Phase 6: Lifetime Wisdom Section
        const mem = MarieMemoryStore.load();
        const lifetimeWisdom = `### Swarm Persistence\n- **Lifetime Recoveries**: ${mem.recoveryPatterns.length} patterns learned.\n- **Top Tool Accuracy**: ${Object.entries(mem.lifetimeToolStats).sort((a: any, b: any) => (b[1].successes / b[1].total) - (a[1].successes / a[1].total)).slice(0, 3).map(([n]: [string, any]) => n).join(', ')}`;

        const prompt = `You are Marie's "Scribe". Write a concise Markdown report summarizing:\n1. **Executive Summary**: Achievements: ${achievements}.\n2. **Objectives**: ${objectives}.\n3. **Metrics**: ${metricsTable}.\n4. **Tool Usage**: ${toolStats}.\n5. **Impact**: ${codeImpact}.\n6. **Council**: ${councilSection}.\n7. **Analytics**: ${sessionAnalytics}.\n8. **Lifetime Wisdom**: ${lifetimeWisdom}.\n\nInstructions: Write a report summarizing executive goals, impact, proof, and council behavior. Include "Next Steps".`;

        try {
            const providerResponse = await this.provider.createMessage({
                model: ConfigService.getModel(),
                system: "You are an expert technical historian. Be precise and intimate.",
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1500,
            });

            const reportResponse = MarieResponse.wrap(providerResponse.content);
            const reportContent = reportResponse.getText() || "Error: No content generated.";
            const reportPath = path.join(process.cwd(), '.marie', 'reports', `task_${run.runId}.md`);
            const reportDir = path.dirname(reportPath);
            await fs.promises.mkdir(reportDir, { recursive: true });
            await fs.promises.writeFile(reportPath, reportContent);

            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `Scribe: Report saved to ${reportPath} 📜`,
                elapsedMs: tracker.elapsedMs()
            });

            // Phase 6: Sync to long-term memory
            if (this.council) {
                const score = this.council.getSessionScore();
                await MarieMemoryStore.syncRun(
                    this.council.getRecoveryPatterns(),
                    this.council.getToolExecutions(),
                    { score: score.score, grade: score.grade },
                    this.council.getAllIntuition()
                );
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `Scribe: Swarm memory synchronized. 🧠✨`,
                    elapsedMs: tracker.elapsedMs()
                });
            }
        } catch (error) {
            console.error("Scribe error:", error);
        }
    }

    private formatCouncilSection(run: RunTelemetry): string {
        const cs = run.councilSnapshot;
        if (!cs) return 'No Council data.';
        return `- **Strategy**: ${cs.strategy}\n- **Mood**: ${cs.mood}\n- **Flow**: ${cs.flowState}/100\n- **Streak**: ${cs.successStreak}`;
    }

    private formatSessionAnalytics(): string {
        if (!this.council) return 'No analytics.';
        const score = this.council.getSessionScore();
        const recoveries = this.council.getRecoveryPatterns();
        const heatmap = this.formatToolEfficiency(this.council.getToolExecutions());

        let lines = [`- **Score**: ${score.grade} (${score.score}/100)`];
        if (recoveries.length > 0) {
            lines.push(`- **Recoveries**:`);
            recoveries.forEach(r => lines.push(`  - ${r.failedTool} → ${r.recoveryTool} (${r.count}x)`));
        }
        if (heatmap) lines.push(`- **Tool Efficiency**:\n${heatmap}`);
        return lines.join('\n');
    }

    private formatToolEfficiency(executions: any[]): string | null {
        if (executions.length === 0) return null;
        const toolMap = new Map<string, { total: number; successes: number; totalDuration: number }>();
        executions.forEach(exec => {
            const entry = toolMap.get(exec.name) || { total: 0, successes: 0, totalDuration: 0 };
            entry.total++;
            if (exec.success) entry.successes++;
            entry.totalDuration += exec.durationMs;
            toolMap.set(exec.name, entry);
        });
        return Array.from(toolMap.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 5).map(([name, stats]) => {
            const avgMs = Math.round(stats.totalDuration / stats.total);
            const rate = Math.round((stats.successes / stats.total) * 100);
            return `  - \`${name}\`: ${stats.total} calls, ${avgMs}ms avg, ${rate}% success`;
        }).join('\n');
    }
}
