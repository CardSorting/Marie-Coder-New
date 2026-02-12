import { MarieSanitizer } from "./MarieSanitizer.js";
export class MarieProgressTracker {
    constructor(callbacks, run) {
        this.callbacks = callbacks;
        this.run = run;
        // REASONING BUDGET: Prevent infinite reasoning growth
        this.reasoningEventCount = 0;
        this.reasoningCharCount = 0;
        this.eventCountInLastSecond = 0;
        this.lastSecondTimestamp = Date.now();
        this.updateDebounceTimer = null;
        this.pendingUpdate = false;
        this.lastObjectivesJson = "";
        this.lastAchievedJson = "";
    }
    /**
     * Resets reasoning budget for new engine turn.
     * Call this at the start of each chatLoop iteration.
     */
    resetReasoningBudget() {
        this.reasoningEventCount = 0;
        this.reasoningCharCount = 0;
    }
    /**
     * Checks if reasoning budget is exhausted.
     */
    isReasoningBudgetExhausted() {
        return this.reasoningEventCount >= MarieProgressTracker.MAX_REASONING_EVENTS_PER_TURN ||
            this.reasoningCharCount >= MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN;
    }
    getRun() {
        return this.run;
    }
    emitEvent(event) {
        if (this.shouldDropEvent(event))
            return;
        // REASONING BUDGET ENFORCEMENT
        if (event.type === 'reasoning') {
            // Check if budget is exhausted
            if (this.isReasoningBudgetExhausted()) {
                // Silently drop excess reasoning events
                return;
            }
            // Track reasoning consumption
            this.reasoningEventCount++;
            const textLength = event.text?.length || 0;
            this.reasoningCharCount += textLength;
            // If this event would exceed char limit, truncate it
            const remainingChars = MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN - this.reasoningCharCount;
            if (remainingChars < 0 && event.text) {
                event.text = event.text.substring(0, Math.max(0, event.text.length + remainingChars)) + '... [truncated]';
                this.reasoningCharCount = MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN;
            }
        }
        const sanitizedEvent = MarieSanitizer.sanitize(event);
        this.callbacks?.onEvent?.(sanitizedEvent);
    }
    shouldDropEvent(event) {
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
    setObjectiveStatus(objectiveId, status, context) {
        const objective = this.run.objectives.find(o => o.id === objectiveId);
        if (!objective)
            return;
        objective.status = status;
        if (context)
            objective.context = context;
    }
    setObjectiveEvidence(objectiveId, evidence) {
        const objective = this.run.objectives.find(o => o.id === objectiveId);
        if (objective)
            objective.verificationEvidence = evidence;
    }
    getPendingObjectives() {
        return this.run.objectives.filter(o => o.status !== 'completed' && o.status !== 'skipped');
    }
    recordAchievement(achievement) {
        if (!this.run.achieved.includes(achievement)) {
            this.run.achieved.push(achievement);
        }
    }
    recordToolUsage(toolName) {
        this.run.tools++;
        if (!this.run.toolUsage) {
            this.run.toolUsage = {};
        }
        this.run.toolUsage[toolName] = (this.run.toolUsage[toolName] || 0) + 1;
    }
    recordFileChange(file, added, removed) {
        if (!this.run.codeStats) {
            this.run.codeStats = { modifiedFiles: {} };
        }
        if (!this.run.codeStats.modifiedFiles[file]) {
            this.run.codeStats.modifiedFiles[file] = { added: 0, removed: 0 };
        }
        this.run.codeStats.modifiedFiles[file].added += added;
        this.run.codeStats.modifiedFiles[file].removed += removed;
    }
    recordHeuristicFix(toolName) {
        if (!this.run.heuristicFixes)
            this.run.heuristicFixes = [];
        const msg = `Heuristic repair for ${toolName} ✨`;
        if (!this.run.heuristicFixes.includes(msg)) {
            this.run.heuristicFixes.push(msg);
            this.emitProgressUpdate(msg);
        }
    }
    emitStream(chunk) {
        this.callbacks?.onStream?.(chunk);
    }
    emitProgressUpdate(context) {
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
    internalEmitProgress() {
        const completed = this.run.objectives.filter(o => o.status === 'completed').length;
        const completionPercent = this.run.objectives.length > 0
            ? Math.round((completed / this.run.objectives.length) * 100)
            : 0;
        // PLANETARY STABILITY: Context Pressure Monitor
        const totalLogs = this.run.logs?.length || 0;
        const totalEvents = this.run.events?.length || 0;
        const pressure = totalLogs + totalEvents;
        if (pressure > 1000) {
            this.emitEvent({
                type: 'reasoning',
                runId: this.run.runId,
                text: `⚠️ CONTEXT PRESSURE: ${pressure} items in memory. Trimming background telemetry...`,
                elapsedMs: this.elapsedMs()
            });
            // Prune events to keep RAM low (keep first 50 and last 100)
            if (this.run.events && this.run.events.length > 500) {
                this.run.events = [
                    ...this.run.events.slice(0, 50),
                    { type: 'reasoning', text: '... [Planetary Pruning: Events recovered] ...' },
                    ...this.run.events.slice(-100)
                ];
            }
            // Prune logs to keep RAM low
            if (this.run.logs && this.run.logs.length > 500) {
                this.run.logs = [
                    ...this.run.logs.slice(0, 50),
                    { type: 'reasoning', text: '... [Planetary Pruning: Logs recovered] ...' },
                    ...this.run.logs.slice(-100)
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
    flush() {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
        this.pendingUpdate = false;
        this.internalEmitProgress();
    }
    dispose() {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
    }
    emitPassTransition(currentPass, totalPasses, passFocus) {
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
    elapsedMs() {
        return Date.now() - this.run.startedAt;
    }
}
MarieProgressTracker.MAX_REASONING_EVENTS_PER_TURN = 10;
MarieProgressTracker.MAX_REASONING_CHARS_PER_TURN = 5000;
