import { MarieMemoryStore } from "../../services/MarieMemoryStore.js";
import {
    CouncilStrategy,
    CouncilMood,
    CouncilVote,
    HiveMemory,
    ErrorCategory,
    ToolExecution,
    Blackboard,
    YoloTelemetry
} from "./MarieCouncilTypes.js";
import { CouncilState } from "./CouncilState.js";
import { CouncilConsensus } from "./CouncilConsensus.js";
import { CouncilBrain } from "./CouncilBrain.js";
import { CouncilMoods } from "./CouncilMoods.js";
import { MarieStabilityMonitor } from "../core/MarieStabilityMonitor.js";
import { YOLOCouncilIntegration } from "./YOLOCouncilIntegration.js";
import { AgentSpecialization, TaskType } from "./AgentSpecialization.js";
import { YOLOInfluenceMetrics } from "./YOLOCouncilIntegration.js";
import { AgentCoordination } from "./AgentCoordination.js";

export * from "./MarieCouncilTypes.js";

export class MarieCouncil {
    private state: CouncilState;
    private consensus: CouncilConsensus;
    private brain: CouncilBrain;
    private moods: CouncilMoods;
    private yoloIntegration: YOLOCouncilIntegration;
    private specialization: AgentSpecialization;

    constructor() {
        this.state = new CouncilState();
        this.consensus = new CouncilConsensus(this.state);
        this.brain = new CouncilBrain(this.state);
        this.moods = new CouncilMoods(this.state);
        this.yoloIntegration = new YOLOCouncilIntegration(this);
        this.specialization = new AgentSpecialization(this);

        this.state.loadPersistent();
        this.loadPersistentPerformance();
    }

    public get blackboard(): Blackboard {
        return this.state.blackboard;
    }

    // ── Consensus & Voting ──

    public registerVote(agent: 'Engine' | 'Strategist' | 'Auditor' | 'QASRE' | 'ISO9001' | 'YOLO', strategy: CouncilStrategy, reason: string, confidence: number = 1.0) {
        this.consensus.registerVote(agent, strategy, reason, confidence);
        if (this.brain.detectStrategicLoop(this.state.strategyHistory)) {
            this.setStrategy('RESEARCH', 'Strategic Loop (A-B-A-B) detected by Brain.');
        }
    }

    public detectStaleStrategy(): boolean {
        const current = this.state.strategyHistory[this.state.strategyHistory.length - 1];
        if (!current) return false;

        const stats = this.state.strategyStats[current.strategy];
        // SPECTRAL INTEGRITY: If strategy has failed/stagnated for 4 attempts, it's stale
        if (stats && stats.attempts >= 4) {
            return true;
        }
        return false;
    }

    public getStrategy(): CouncilStrategy {
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

    public setStrategy(strategy: CouncilStrategy, reason: string) {
        const last = this.state.strategyHistory[this.state.strategyHistory.length - 1];
        if (!last || last.strategy !== strategy) {
            this.state.strategyHistory.push({ strategy, reason, timestamp: Date.now() });
            if (this.state.strategyHistory.length > 20) this.state.strategyHistory.splice(0, 1);

            const mood = this.getMoodForStrategy(strategy);
            this.moods.setMood(mood);
        }
    }

    private getMoodForStrategy(strategy: CouncilStrategy): CouncilMood {
        if (strategy === 'DEBUG') return 'CAUTIOUS';
        if (strategy === 'EXECUTE') return 'AGGRESSIVE';
        if (strategy === 'RESEARCH') return 'INQUISITIVE';
        if (strategy === 'HYPE') return 'ZEN';
        return this.moods.currentMood;
    }

    // ── Tool & Memory Tracking ──

    public recordToolCall(name: string) {
        this.state.recordToolCall(name);
    }

    public recordToolExecution(name: string, durationMs: number, success: boolean, filePath?: string) {
        const execution: ToolExecution = { name, durationMs, success, timestamp: Date.now(), filePath };
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
        } else {
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

    public recordError(type: string, message: string, filePath?: string) {
        this.state.memory.totalErrorCount++;
        const file = filePath || this.state.memory.lastActiveFile || 'unknown';
        this.state.memory.errorHotspots[file] = (this.state.memory.errorHotspots[file] || 0) + 1;
        this.state.pruneHotspots();
    }

    public updateFlowState(delta: number) {
        this.state.memory.flowState = Math.max(0, Math.min(100, this.state.memory.flowState + delta));
        if (this.state.memory.flowState >= 90) this.moods.setMood('EUPHORIA');
        else if (this.state.memory.flowState <= 15) this.moods.setMood('FRICTION');
        else if (this.state.memory.flowState < 40) this.moods.setMood('DOUBT');
    }

    public getMood(): CouncilMood { return this.moods.getEffectiveMood(); }
    public getMoodColor(): string { return this.moods.getMoodColor(); }

    /**
     * BALANCED SUPREMACY: Get the council's effective mood considering YOLO's influence
     */
    public getEffectiveMood(): CouncilMood {
        return this.moods.getEffectiveMood();
    }
    public getFlowState(): number { return this.state.memory.flowState; }
    public getEntropy(): number { return this.consensus.entropyScore; }

    public getStatusMessage(): string {
        const lastVote = this.state.getRecentVotes(1)[0];
        if (!lastVote) return "Council is assembling...";
        return `${lastVote.agent} suggested ${lastVote.strategy}`;
    }

    public getSnapshot() {
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

    public getMemory(): HiveMemory { return this.state.memory; }

    public getAverageToolSpeed(): number {
        const execs = this.state.memory.toolExecutions;
        if (execs.length === 0) return 0;
        const sum = execs.reduce((acc, e) => acc + e.durationMs, 0);
        return sum / execs.length;
    }

    public recordSuccess() {
        this.state.memory.successStreak++;
        this.state.comboPeak = Math.max(this.state.comboPeak, this.state.memory.successStreak);
        this.updateFlowState(5);
    }

    public isInCoolDown(): boolean {
        return Date.now() < this.state.panicCoolDown;
    }

    public hasRecentlyRead(filePath: string): boolean {
        return this.state.memory.toolExecutions.some(e => e.name === 'read_file' && e.filePath === filePath && (Date.now() - e.timestamp) < 300000);
    }

    public getRecentFiles(): string[] {
        return Array.from(new Set(this.state.memory.toolExecutions.filter(e => !!e.filePath).map(e => e.filePath!))).slice(-10);
    }

    public getToolHistory(): string[] {
        return this.state.memory.toolHistory;
    }

    public detectTunnelVision(pendingObjectiveCount: number): string | null {
        if (this.brain.detectTunnelVision(pendingObjectiveCount)) {
            return "Tunnel Vision Detected: High momentum but objectives aren't closing. Consider broadening focus.";
        }
        return null;
    }

    public decayFlowIfStale() {
        const elapsed = Date.now() - this.state.lastToolTimestamp;

        // HARDWARE STRESS DECAY
        if (MarieStabilityMonitor.isHighPressure()) {
            this.updateFlowState(-1); // Slow bleed of flow under pressure
            if (this.moods.currentMood !== 'CAUTIOUS' && this.moods.currentMood !== 'FRICTION') {
                this.moods.setMood('CAUTIOUS'); // Force caution when host is lagging
            }
        }

        if (elapsed > 120000) { // 2 mins
            this.updateFlowState(-1);
            this.state.lastToolTimestamp = Date.now();
        }
    }

    public recordShakyResponse() {
        this.state.memory.shakyResponseDensity = Math.min(1.0, this.state.memory.shakyResponseDensity + 0.2);
        this.updateFlowState(-10);
        if (this.state.memory.shakyResponseDensity > 0.6) this.moods.setMood('DOUBT');
    }

    public trackStreamCadence(durationMs: number, isTool: boolean) {
        // Simple moving average
        this.state.streamCadence = (this.state.streamCadence * 0.9) + (durationMs * 0.1);
        if (durationMs > 2000 && !isTool) this.updateFlowState(-2);
    }

    public recordQualityResponse() {
        this.state.memory.shakyResponseDensity = Math.max(0, this.state.memory.shakyResponseDensity - 0.1);
        this.updateFlowState(2);
    }

    public activatePanicCoolDown(durationMs: number) {
        this.state.panicCoolDown = Date.now() + durationMs;
        this.moods.setMood('CAUTIOUS');
        this.setStrategy('PANIC', 'Panic Cooldown Activated');
    }

    public getSessionScore() {
        return this.brain.calculateSessionScore();
    }

    public recordStrategyOutcome(success: boolean) {
        this.consensus.calibrateWeights(success);
        // Track stats in state
        const last = this.state.strategyHistory[this.state.strategyHistory.length - 1];
        if (last) {
            const stats = this.state.strategyStats[last.strategy] || { attempts: 0, successes: 0 };
            stats.attempts++;
            if (success) stats.successes++;
            this.state.strategyStats[last.strategy] = stats;
        }
    }

    public getIntuition(file: string): string[] {
        return this.state.intuition.get(file) || [];
    }

    public getAllIntuition(): Record<string, string[]> {
        return Object.fromEntries(this.state.intuition.entries());
    }

    public getSuccessStreak(): number {
        return this.state.memory.successStreak;
    }

    public getErrorCount(file?: string): number {
        if (file) return this.state.memory.errorHotspots[file] || 0;
        return this.state.memory.totalErrorCount;
    }

    public getErrorMessages(file: string): string[] {
        return []; // Disabled for memory stability - use logs if needed
    }

    public getToolExecutions(): ToolExecution[] {
        return this.state.memory.toolExecutions;
    }

    public setMood(mood: CouncilMood) {
        this.moods.setMood(mood);
    }

    public getRecoveryPatterns() { return Array.from(this.state.recoveryPatterns.values()); }
    public getRecoveryHint(failedTool: string, filePath: string): string | null {
        for (const p of Array.from(this.state.recoveryPatterns.values())) {
            if (p.failedTool === failedTool) return `Suggested Recovery: Use ${p.recoveryTool} (learned from history).`;
        }
        return null;
    }
    public assessHealth(toolHistory: string[], errorCount: number): CouncilStrategy {
        return this.brain.assessHealth(toolHistory, errorCount);
    }

    /**
     * BALANCED SUPREMACY: Get founder-led recovery strategy when YOLO has high conviction
     */
    public suggestRecoveryStrategy(): CouncilStrategy {
        return this.brain.suggestRecoveryStrategy();
    }
    public predictFailure(toolName: string, filePath?: string): string | null { return this.brain.predictFailure(toolName, filePath); }
    public recordFileContext(filePath: string) { this.state.memory.lastActiveFile = filePath; }
    public recordIntuition(file: string, pattern: string) {
        const patterns = this.state.intuition.get(file) || [];
        if (!patterns.includes(pattern)) {
            patterns.push(pattern);
            this.state.intuition.set(file, patterns.slice(-5));
        }
        // Memory Pruning: limit total unique files in intuition map to 50
        if (this.state.intuition.size > 50) {
            const firstKey = this.state.intuition.keys().next().value;
            if (firstKey) this.state.intuition.delete(firstKey);
        }
    }

    public recordWiringAlert(alert: string) {
        if (!this.state.memory.wiringAlerts.includes(alert)) {
            this.state.memory.wiringAlerts.push(alert);
        }
    }

    public recordYoloDecision(decision: YoloTelemetry) {
        this.state.memory.lastYoloDecision = { ...decision, timestamp: Date.now() };
    }

    /**
     * Resets turn-specific state to ensure each request starts clean.
     */
    public clearTurnState() {
        this.state.clearTurnState();
        this.yoloIntegration.clearTurnState();
    }

    // ── YOLO Integration ──

    /**
     * Process a YOLO decision with full council integration
     */
    public processYOLODecision(decision: YoloTelemetry): YOLOInfluenceMetrics {
        return this.yoloIntegration.processYOLODecision(decision);
    }

    /**
     * Get YOLO-guided swarm execution guidance
     */
    public getSwarmGuidance() {
        return this.yoloIntegration.getSwarmGuidance();
    }

    /**
     * Check if YOLO should veto a proposed strategy
     */
    public shouldYOLOVeto(proposedStrategy: CouncilStrategy, yoloDecision: YoloTelemetry) {
        return this.yoloIntegration.shouldVetoCouncilDecision(proposedStrategy, yoloDecision);
    }

    /**
     * Get YOLO influence analytics
     */
    public getYOLOAnalytics() {
        return this.yoloIntegration.getInfluenceAnalytics();
    }

    /**
     * Get the agent coordination system
     */
    public getAgentCoordination(): AgentCoordination {
        return this.yoloIntegration.getCoordination();
    }

    // ── Agent Specialization ──

    /**
     * Get the agent specialization system
     */
    public getAgentSpecialization(): AgentSpecialization {
        return this.specialization;
    }

    /**
     * Analyze a task to determine its type
     */
    public analyzeTask(context: string) {
        return this.specialization.analyzeTask(context);
    }

    /**
     * Record task completion for specialization learning
     */
    public recordTaskCompletion(agent: string, taskType: TaskType, success: boolean, duration: number): void {
        this.specialization.recordTaskCompletion(agent, taskType, success, duration);
        this.persistAgentPerformance();
    }

    /**
     * Get specialization report
     */
    public getSpecializationReport() {
        return this.specialization.getSpecializationReport();
    }

    // ── Cross-Session Persistence ──

    /**
     * Persist agent performance data for cross-session learning
     */
    public async persistAgentPerformance(): Promise<void> {
        const coordination = this.getAgentCoordination();
        const metrics = coordination.getMetrics();

        const persistenceData = {
            timestamp: Date.now(),
            performanceStats: metrics.performanceStats,
            specializationProfiles: Array.from(this.specialization['profiles'].entries()),
            yoloAnalytics: this.getYOLOAnalytics()
        };

        await MarieMemoryStore.syncAgentPerformance(persistenceData);
    }

    /**
     * Load persistent agent performance data
     */
    private loadPersistentPerformance(): void {
        const saved = MarieMemoryStore.loadAgentPerformance();
        if (!saved) return;

        // Restore performance stats to coordination
        if (saved.performanceStats) {
            const coordination = this.getAgentCoordination();
            saved.performanceStats.forEach((stat: any) => {
                for (let i = 0; i < stat.totalCalls; i++) {
                    coordination.recordAgentPerformance(stat.agent, stat.successRate > 0.5, stat.avgExecutionTime);
                }
            });
        }

        // Restore specialization profiles
        if (saved.specializationProfiles) {
            saved.specializationProfiles.forEach(([agent, profile]: [string, any]) => {
                this.specialization['profiles'].set(agent, profile);
            });
        }
    }

    public getLastYoloDecision(): YoloTelemetry | undefined {
        return this.state.memory.lastYoloDecision;
    }

    /**
     * Retrieves a summary of recent file changes for the QASRE agent.
     */
    public getRecentChangesSummary(): string {
        const writtenFiles = this.state.memory.writtenFiles;
        if (!writtenFiles || writtenFiles.length === 0) return "No files were actually modified in this turn.";

        const diffs = Object.entries(this.state.memory.actionDiffs).map(([f, summary]) => {
            return `- ${f}: ${summary}`;
        });

        return `CONCRETE CHANGES SUMMARY:\n${diffs.join('\n')}`;
    }

    /**
     * Determines if the session is stable enough to stop (ISO9001 logic).
     */
    public getReadinessContext(): string {
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
    public async persistAsync() {
        const snapshot = this.state.getPersistentSnapshot();
        const sessionScore = this.getSessionScore();
        await MarieMemoryStore.syncRun(
            snapshot.recoveryPatterns,
            snapshot.toolExecutions,
            sessionScore,
            snapshot.intuition
        );

        // Also persist agent performance
        await this.persistAgentPerformance();
    }
}
