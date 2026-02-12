import { MarieMemoryStore } from "../../services/MarieMemoryStore.js";
import { CouncilState } from "./CouncilState.js";
import { CouncilConsensus } from "./CouncilConsensus.js";
import { CouncilBrain } from "./CouncilBrain.js";
import { CouncilMoods } from "./CouncilMoods.js";
import { YOLOCouncilIntegration } from "./YOLOCouncilIntegration.js";
export * from "./MarieCouncilTypes.js";
export class MarieCouncil {
    constructor() {
        this.state = new CouncilState();
        this.consensus = new CouncilConsensus(this.state);
        this.brain = new CouncilBrain(this.state);
        this.moods = new CouncilMoods(this.state);
        this.yoloIntegration = new YOLOCouncilIntegration(this);
        this.state.loadPersistent();
    }
    get blackboard() {
        return this.state.blackboard;
    }
    // ── Consensus & Voting ──
    registerVote(agent, strategy, reason, confidence = 1.0) {
        this.consensus.registerVote(agent, strategy, reason, confidence);
        if (this.brain.detectStrategicLoop(this.state.strategyHistory)) {
            this.setStrategy('RESEARCH', 'Strategic Loop (A-B-A-B) detected by Brain.');
        }
    }
    detectStaleStrategy() {
        const current = this.state.strategyHistory[this.state.strategyHistory.length - 1];
        if (!current)
            return false;
        const stats = this.state.strategyStats[current.strategy];
        // SPECTRAL INTEGRITY: If strategy has failed/stagnated for 4 attempts, it's stale
        if (stats && stats.attempts >= 4) {
            return true;
        }
        return false;
    }
    getStrategy() {
        if (this.detectStaleStrategy()) {
            const current = this.state.strategyHistory[this.state.strategyHistory.length - 1];
            const next = current?.strategy === 'RESEARCH' ? 'EXECUTE' : 'RESEARCH';
            this.setStrategy(next, "Reasoning Stagnation: Forced rotation after 4 attempts.");
            return next;
        }
        const strategy = this.consensus.getWinningStrategy((s) => {
            return this.state.memory.lastActiveFile ? !!this.brain.predictFailure(s, this.state.memory.lastActiveFile) : false;
        });
        if (strategy) {
            this.setStrategy(strategy, "Consensus Logic Triggered");
            return strategy;
        }
        return this.state.memory.flowState > 50 ? 'EXECUTE' : 'RESEARCH';
    }
    setStrategy(strategy, reason) {
        const last = this.state.strategyHistory[this.state.strategyHistory.length - 1];
        if (!last || last.strategy !== strategy) {
            this.state.strategyHistory.push({ strategy, reason, timestamp: Date.now() });
            if (this.state.strategyHistory.length > 20)
                this.state.strategyHistory.splice(0, 1);
            const mood = this.getMoodForStrategy(strategy);
            this.moods.setMood(mood);
        }
    }
    getMoodForStrategy(strategy) {
        if (strategy === 'DEBUG')
            return 'CAUTIOUS';
        if (strategy === 'EXECUTE')
            return 'AGGRESSIVE';
        if (strategy === 'RESEARCH')
            return 'INQUISITIVE';
        if (strategy === 'HYPE')
            return 'ZEN';
        return this.moods.currentMood;
    }
    // ── Tool & Memory Tracking ──
    recordToolCall(name) {
        this.state.recordToolCall(name);
    }
    recordToolExecution(name, durationMs, success, filePath) {
        const execution = { name, durationMs, success, timestamp: Date.now(), filePath };
        this.state.memory.toolExecutions.push(execution);
        this.consensus.calibrateWeights(success);
        // Recovery Detection
        if (success && filePath && this.state.lastFailureKey === filePath && this.state.lastFailedTool) {
            const failedTool = this.state.lastFailedTool;
            const key = `${failedTool}:${name}`;
            const pattern = this.state.recoveryPatterns.get(key) || { failedTool, recoveryTool: name, count: 0 };
            pattern.count++;
            this.state.recoveryPatterns.set(key, pattern);
            this.state.lastFailureKey = null;
            this.state.lastFailedTool = null;
        }
        if (success) {
            this.state.memory.successStreak++;
            this.state.comboPeak = Math.max(this.state.comboPeak, this.state.memory.successStreak);
            this.updateFlowState(5);
        }
        else {
            this.state.memory.successStreak = 0;
            if (filePath) {
                this.state.lastFailureKey = filePath;
                this.state.lastFailedTool = name;
            }
            this.updateFlowState(-15);
            this.recordError('TOOL_FAILURE', `Error on ${filePath}`, filePath);
        }
        // Phase 13: Harvest Diffs for QASRE
        if (success && filePath && ['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(name)) {
            this.state.recordFileWrite(filePath, `Modified ${name} with positive duration.`);
        }
        if (this.state.memory.toolExecutions.length > 110) {
            this.state.memory.toolExecutions.splice(0, this.state.memory.toolExecutions.length - 100);
        }
    }
    recordError(type, message, filePath) {
        this.state.memory.totalErrorCount++;
        const file = filePath || this.state.memory.lastActiveFile || 'unknown';
        this.state.memory.errorHotspots[file] = (this.state.memory.errorHotspots[file] || 0) + 1;
        this.state.pruneHotspots();
    }
    updateFlowState(delta) {
        this.state.memory.flowState = Math.max(0, Math.min(100, this.state.memory.flowState + delta));
        if (this.state.memory.flowState >= 90)
            this.moods.setMood('EUPHORIA');
        else if (this.state.memory.flowState <= 15)
            this.moods.setMood('FRICTION');
        else if (this.state.memory.flowState < 40)
            this.moods.setMood('DOUBT');
    }
    getMood() { return this.moods.getEffectiveMood(); }
    getMoodColor() { return this.moods.getMoodColor(); }
    /**
     * BALANCED SUPREMACY: Get the council's effective mood considering YOLO's influence
     */
    getEffectiveMood() {
        return this.moods.getEffectiveMood();
    }
    getFlowState() { return this.state.memory.flowState; }
    getEntropy() { return this.consensus.entropyScore; }
    getStatusMessage() {
        const lastVote = this.state.getRecentVotes(1)[0];
        if (!lastVote)
            return "Council is assembling...";
        return `${lastVote.agent} suggested ${lastVote.strategy}`;
    }
    getSnapshot() {
        return {
            strategy: this.state.strategyHistory[this.state.strategyHistory.length - 1]?.strategy || 'EXECUTE',
            mood: this.getMood(),
            flowState: this.getFlowState(),
            agentWeights: this.consensus.agentWeights,
            successStreak: this.state.memory.successStreak,
            comboPeak: this.state.comboPeak,
            errorHotspots: this.state.memory.errorHotspots,
            strategyTimeline: this.state.strategyHistory.map(h => ({
                strategy: h.strategy,
                reason: h.reason,
                ago: `${Math.round((Date.now() - h.timestamp) / 1000)}s`
            })),
            recoveryPatterns: Array.from(this.state.recoveryPatterns.values()),
            sessionScore: this.brain.calculateSessionScore(),
            recentFiles: this.getRecentFiles(),
            writtenFiles: this.state.memory.writtenFiles,
            toolHistoryLength: this.state.memory.toolHistory.length,
            moodHistory: this.state.moodHistory,
            lastYoloDecision: this.state.memory.lastYoloDecision
        };
    }
    getMemory() { return this.state.memory; }
    getAverageToolSpeed() {
        const execs = this.state.memory.toolExecutions;
        if (execs.length === 0)
            return 0;
        const sum = execs.reduce((acc, e) => acc + e.durationMs, 0);
        return sum / execs.length;
    }
    recordSuccess() {
        this.state.memory.successStreak++;
        this.state.comboPeak = Math.max(this.state.comboPeak, this.state.memory.successStreak);
        this.updateFlowState(5);
    }
    isInCoolDown() {
        return Date.now() < this.state.panicCoolDown;
    }
    hasRecentlyRead(filePath) {
        return this.state.memory.toolExecutions.some(e => e.name === 'read_file' && e.filePath === filePath && (Date.now() - e.timestamp) < 300000);
    }
    getRecentFiles() {
        return Array.from(new Set(this.state.memory.toolExecutions.filter(e => !!e.filePath).map(e => e.filePath))).slice(-10);
    }
    getToolHistory() {
        return this.state.memory.toolHistory;
    }
    detectTunnelVision(pendingObjectiveCount) {
        if (this.brain.detectTunnelVision(pendingObjectiveCount)) {
            return "Tunnel Vision Detected: High momentum but objectives aren't closing. Consider broadening focus.";
        }
        return null;
    }
    decayFlowIfStale() {
        const elapsed = Date.now() - this.state.lastToolTimestamp;
        if (elapsed > 120000) { // 2 mins
            this.updateFlowState(-1);
            this.state.lastToolTimestamp = Date.now();
        }
    }
    recordShakyResponse() {
        this.state.memory.shakyResponseDensity = Math.min(1.0, this.state.memory.shakyResponseDensity + 0.2);
        this.updateFlowState(-10);
        if (this.state.memory.shakyResponseDensity > 0.6)
            this.moods.setMood('DOUBT');
    }
    trackStreamCadence(durationMs, isTool) {
        // Simple moving average
        this.state.streamCadence = (this.state.streamCadence * 0.9) + (durationMs * 0.1);
        if (durationMs > 2000 && !isTool)
            this.updateFlowState(-2);
    }
    recordQualityResponse() {
        this.state.memory.shakyResponseDensity = Math.max(0, this.state.memory.shakyResponseDensity - 0.1);
        this.updateFlowState(2);
    }
    activatePanicCoolDown(durationMs) {
        this.state.panicCoolDown = Date.now() + durationMs;
        this.moods.setMood('CAUTIOUS');
        this.setStrategy('PANIC', 'Panic Cooldown Activated');
    }
    getSessionScore() {
        return this.brain.calculateSessionScore();
    }
    recordStrategyOutcome(success) {
        this.consensus.calibrateWeights(success);
        // Track stats in state
        const last = this.state.strategyHistory[this.state.strategyHistory.length - 1];
        if (last) {
            const stats = this.state.strategyStats[last.strategy] || { attempts: 0, successes: 0 };
            stats.attempts++;
            if (success)
                stats.successes++;
            this.state.strategyStats[last.strategy] = stats;
        }
    }
    getIntuition(file) {
        return this.state.intuition.get(file) || [];
    }
    getAllIntuition() {
        return Object.fromEntries(this.state.intuition.entries());
    }
    getSuccessStreak() {
        return this.state.memory.successStreak;
    }
    getErrorCount(file) {
        if (file)
            return this.state.memory.errorHotspots[file] || 0;
        return this.state.memory.totalErrorCount;
    }
    getErrorMessages(file) {
        return []; // Disabled for memory stability - use logs if needed
    }
    getToolExecutions() {
        return this.state.memory.toolExecutions;
    }
    setMood(mood) {
        this.moods.setMood(mood);
    }
    getRecoveryPatterns() { return Array.from(this.state.recoveryPatterns.values()); }
    getRecoveryHint(failedTool, filePath) {
        for (const p of Array.from(this.state.recoveryPatterns.values())) {
            if (p.failedTool === failedTool)
                return `Suggested Recovery: Use ${p.recoveryTool} (learned from history).`;
        }
        return null;
    }
    assessHealth(toolHistory, errorCount) {
        return this.brain.assessHealth(toolHistory, errorCount);
    }
    /**
     * BALANCED SUPREMACY: Get founder-led recovery strategy when YOLO has high conviction
     */
    suggestRecoveryStrategy() {
        return this.brain.suggestRecoveryStrategy();
    }
    predictFailure(toolName, filePath) { return this.brain.predictFailure(toolName, filePath); }
    recordFileContext(filePath) { this.state.memory.lastActiveFile = filePath; }
    recordIntuition(file, pattern) {
        const patterns = this.state.intuition.get(file) || [];
        if (!patterns.includes(pattern)) {
            patterns.push(pattern);
            this.state.intuition.set(file, patterns.slice(-5));
        }
        // Memory Pruning: limit total unique files in intuition map to 50
        if (this.state.intuition.size > 50) {
            const firstKey = this.state.intuition.keys().next().value;
            if (firstKey)
                this.state.intuition.delete(firstKey);
        }
    }
    recordWiringAlert(alert) {
        if (!this.state.memory.wiringAlerts.includes(alert)) {
            this.state.memory.wiringAlerts.push(alert);
        }
    }
    recordYoloDecision(decision) {
        this.state.memory.lastYoloDecision = { ...decision, timestamp: Date.now() };
    }
    /**
     * Resets turn-specific state to ensure each request starts clean.
     */
    clearTurnState() {
        this.state.clearTurnState();
        this.yoloIntegration.clearTurnState();
    }
    // ── YOLO Integration ──
    /**
     * Process a YOLO decision with full council integration
     */
    processYOLODecision(decision) {
        return this.yoloIntegration.processYOLODecision(decision);
    }
    /**
     * Get YOLO-guided swarm execution guidance
     */
    getSwarmGuidance() {
        return this.yoloIntegration.getSwarmGuidance();
    }
    /**
     * Check if YOLO should veto a proposed strategy
     */
    shouldYOLOVeto(proposedStrategy, yoloDecision) {
        return this.yoloIntegration.shouldVetoCouncilDecision(proposedStrategy, yoloDecision);
    }
    /**
     * Get YOLO influence analytics
     */
    getYOLOAnalytics() {
        return this.yoloIntegration.getInfluenceAnalytics();
    }
    /**
     * Get the agent coordination system
     */
    getAgentCoordination() {
        return this.yoloIntegration.getCoordination();
    }
    getLastYoloDecision() {
        return this.state.memory.lastYoloDecision;
    }
    /**
     * Retrieves a summary of recent file changes for the QASRE agent.
     */
    getRecentChangesSummary() {
        const writtenFiles = this.state.memory.writtenFiles;
        if (!writtenFiles || writtenFiles.length === 0)
            return "No files were actually modified in this turn.";
        const diffs = Object.entries(this.state.memory.actionDiffs).map(([f, summary]) => {
            return `- ${f}: ${summary}`;
        });
        return `CONCRETE CHANGES SUMMARY:\n${diffs.join('\n')}`;
    }
    /**
     * Determines if the session is stable enough to stop (ISO9001 logic).
     */
    getReadinessContext() {
        const snapshot = this.getSnapshot();
        const writtenFiles = this.state.memory.writtenFiles || [];
        const wiringAlerts = this.state.memory.wiringAlerts;
        return `READINESS AUDIT:
- Flow State: ${snapshot.flowState}
- Success Streak: ${snapshot.successStreak}
- Total Errors: ${this.getErrorCount()}
- Modified Files: ${writtenFiles.join(', ') || 'None'}
- Wiring Alerts: ${wiringAlerts.length > 0 ? wiringAlerts.join('; ') : 'All systems wired.'}
- Recent Strategy: ${snapshot.strategy}`;
    }
    /**
     * ATMOSPHERIC PERSISTENCE: Flushes learned heuristics to disk.
     */
    async persistAsync() {
        const snapshot = this.state.getPersistentSnapshot();
        const sessionScore = this.getSessionScore();
        await MarieMemoryStore.syncRun(snapshot.recoveryPatterns, snapshot.toolExecutions, sessionScore, snapshot.intuition);
    }
}
