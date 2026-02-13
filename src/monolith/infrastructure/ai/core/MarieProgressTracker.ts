import { MarieCallbacks, MarieStreamEvent, RunTelemetry, ObjectiveStatus, ProgressObjective } from "../../../domain/marie/MarieTypes.js";
import { MarieSanitizer } from "./MarieSanitizer.js";

export class MarieProgressTracker {
    // REASONING BUDGET: Prevent infinite reasoning growth
    private reasoningEventCount: number = 0;
    private reasoningCharCount: number = 0;
    private static readonly MAX_REASONING_EVENTS_PER_TURN = 10;
    private static readonly MAX_REASONING_CHARS_PER_TURN = 5000;

    constructor(
        private callbacks: MarieCallbacks | undefined,
        private run: RunTelemetry
    ) { }

    /**
     * Resets reasoning budget for new engine turn.
     * Call this at the start of each chatLoop iteration.
     */
    public resetReasoningBudget(): void {
        this.reasoningEventCount = 0;
        this.reasoningCharCount = 0;
    }

    /**
     * Checks if reasoning budget is exhausted.
     */
    public isReasoningBudgetExhausted(): boolean {
        return this.reasoningEventCount >= MarieProgressTracker.MAX_REASONING_EVENTS_PER_TURN ||
            this.reasoningCharCount >= MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN;
    }

    public getRun(): RunTelemetry {
        return this.run;
    }

    public emitEvent(event: MarieStreamEvent) {
        if (this.shouldDropEvent(event)) return;

        // REASONING BUDGET ENFORCEMENT
        if (event.type === 'reasoning') {
            // Check if budget is exhausted
            if (this.isReasoningBudgetExhausted()) {
                // Silently drop excess reasoning events
                return;
            }

            // Track reasoning consumption
            this.reasoningEventCount++;
            const textLength = (event as any).text?.length || 0;
            this.reasoningCharCount += textLength;

            // If this event would exceed char limit, truncate it
            const remainingChars = MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN - this.reasoningCharCount;
            if (remainingChars < 0 && (event as any).text) {
                (event as any).text = (event as any).text.substring(0, Math.max(0, (event as any).text.length + remainingChars)) + '... [truncated]';
                this.reasoningCharCount = MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN;
            }
        }

        const sanitizedEvent = MarieSanitizer.sanitize(event);
        this.callbacks?.onEvent?.(sanitizedEvent);
    }

    private eventCountInLastSecond: number = 0;
    private lastSecondTimestamp: number = Date.now();

    private shouldDropEvent(event: MarieStreamEvent): boolean {
        const now = Date.now();
        if (now - this.lastSecondTimestamp > 1000) {
            this.eventCountInLastSecond = 0;
            this.lastSecondTimestamp = now;
        }

        this.eventCountInLastSecond++;

        // Backpressure: If more than 30 events/sec, start dropping reasoning/stream deltas
        if (this.eventCountInLastSecond > 30) {
            if (event.type === 'reasoning' || event.type === 'content_delta' || event.type === 'tool_delta') {
                return true;
            }
        }
        return false;
    }

    public setObjectiveStatus(objectiveId: string, status: ObjectiveStatus, context?: string) {
        const objective = this.run.objectives.find(o => o.id === objectiveId);
        if (!objective) return;
        objective.status = status;
        if (context) objective.context = context;
    }

    public setObjectiveEvidence(objectiveId: string, evidence: string) {
        const objective = this.run.objectives.find(o => o.id === objectiveId);
        if (objective) objective.verificationEvidence = evidence;
    }

    public getPendingObjectives(): ProgressObjective[] {
        return this.run.objectives.filter(o => o.status !== 'completed' && o.status !== 'skipped');
    }

    public recordAchievement(achievement: string) {
        if (!this.run.achieved.includes(achievement)) {
            this.run.achieved.push(achievement);
        }
    }

    public recordToolUsage(toolName: string) {
        this.run.tools++;
        if (!this.run.toolUsage) {
            this.run.toolUsage = {};
        }
        this.run.toolUsage[toolName] = (this.run.toolUsage[toolName] || 0) + 1;
    }

    public recordFileChange(file: string, added: number, removed: number) {
        if (!this.run.codeStats) {
            this.run.codeStats = { modifiedFiles: {} };
        }
        if (!this.run.codeStats.modifiedFiles[file]) {
            this.run.codeStats.modifiedFiles[file] = { added: 0, removed: 0 };
        }
        this.run.codeStats.modifiedFiles[file].added += added;
        this.run.codeStats.modifiedFiles[file].removed += removed;
    }

    public recordHeuristicFix(toolName: string) {
        if (!this.run.heuristicFixes) this.run.heuristicFixes = [];
        const msg = `Heuristic repair for ${toolName} ✨`;
        if (!this.run.heuristicFixes.includes(msg)) {
            this.run.heuristicFixes.push(msg);
            this.emitProgressUpdate(msg);
        }
    }

    private updateDebounceTimer: NodeJS.Timeout | null = null;
    private pendingUpdate: boolean = false;

    public emitStream(chunk: string) {
        this.callbacks?.onStream?.(chunk, this.run.runId);
    }

    public emitProgressUpdate(context?: string) {
        if (context) {
            this.run.currentContext = context;
        }

        if (this.updateDebounceTimer) {
            this.pendingUpdate = true;
            return;
        }

        this.internalEmitProgress();
        this.updateDebounceTimer = setTimeout(() => {
            this.updateDebounceTimer = null;
            if (this.pendingUpdate) {
                this.pendingUpdate = false;
                this.internalEmitProgress();
            }
        }, 150); // 150ms debounce for UI stability
    }

    private lastObjectivesJson: string = "";
    private lastAchievedJson: string = "";

    private internalEmitProgress() {
        const completed = this.run.objectives.filter(o => o.status === 'completed').length;
        const completionPercent = this.run.objectives.length > 0
            ? Math.round((completed / this.run.objectives.length) * 100)
            : 0;

        // PLANETARY STABILITY: Context Pressure Monitor
        const totalLogs = (this.run as any).logs?.length || 0;
        const totalEvents = (this.run as any).events?.length || 0;
        const pressure = totalLogs + totalEvents;

        if (pressure > 1000) {
            this.emitEvent({
                type: 'reasoning',
                runId: this.run.runId,
                text: `⚠️ CONTEXT PRESSURE: ${pressure} items in memory. Trimming background telemetry...`,
                elapsedMs: this.elapsedMs()
            });

            // Prune events to keep RAM low (keep first 50 and last 100)
            if ((this.run as any).events && (this.run as any).events.length > 500) {
                (this.run as any).events = [
                    ...(this.run as any).events.slice(0, 50),
                    { type: 'reasoning', text: '... [Planetary Pruning: Events recovered] ...' },
                    ...(this.run as any).events.slice(-100)
                ];
            }

            // Prune logs to keep RAM low
            if ((this.run as any).logs && (this.run as any).logs.length > 500) {
                (this.run as any).logs = [
                    ...(this.run as any).logs.slice(0, 50),
                    { type: 'reasoning', text: '... [Planetary Pruning: Logs recovered] ...' },
                    ...(this.run as any).logs.slice(-100)
                ];
            }
        }

        // SPECTRAL INTEGRITY: UI Delta Compression
        const objectivesSnapshot = this.run.objectives.map(o => ({ ...o }));
        const currentObjectivesJson = JSON.stringify(objectivesSnapshot);
        const achievedSnapshot = [...this.run.achieved];
        const currentAchievedJson = JSON.stringify(achievedSnapshot);

        const objectivesChanged = currentObjectivesJson !== this.lastObjectivesJson;
        const achievedChanged = currentAchievedJson !== this.lastAchievedJson;

        this.lastObjectivesJson = currentObjectivesJson;
        this.lastAchievedJson = currentAchievedJson;

        this.emitEvent({
            type: 'progress_update',
            runId: this.run.runId,
            completionPercent,
            activeObjectiveId: this.run.activeObjectiveId,
            activeToolName: this.run.activeToolName,
            lastToolName: this.run.lastToolName,
            objectives: objectivesChanged ? objectivesSnapshot : undefined, // Compact if unchanged
            achieved: achievedChanged ? achievedSnapshot : undefined, // Compact if unchanged
            waitingForApproval: this.run.waitingForApproval,
            context: this.run.currentContext,
            lifecycleStage: this.run.lifecycleStage,
            ritualComplete: this.run.ritualComplete,
            activeFilePath: this.run.activeFilePath,
            currentPass: this.run.currentPass,
            totalPasses: this.run.totalPasses,
            passFocus: this.run.passFocus,
            isResuming: this.run.isResuming,
            passHistory: this.run.passHistory ? [...this.run.passHistory] : undefined,
            metrics: this.run.metrics ? { ...this.run.metrics } : undefined,
            heuristicFixes: this.run.heuristicFixes ? [...this.run.heuristicFixes] : undefined,
            councilSnapshot: this.run.councilSnapshot,
            elapsedMs: Date.now() - this.run.startedAt,
        });
    }

    public flush() {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
        this.pendingUpdate = false;
        this.internalEmitProgress();
    }

    public dispose() {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
    }

    public emitPassTransition(currentPass: number, totalPasses: number, passFocus: string) {
        this.run.currentPass = currentPass;
        this.run.totalPasses = totalPasses;
        this.run.passFocus = passFocus;
        this.emitEvent({
            type: 'pass_transition',
            runId: this.run.runId,
            currentPass,
            totalPasses,
            passFocus,
            elapsedMs: this.elapsedMs()
        });
        this.emitProgressUpdate();
    }

    public elapsedMs(): number {
        return Date.now() - this.run.startedAt;
    }
}
