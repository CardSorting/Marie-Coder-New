import { MarieCouncil } from "../council/MarieCouncil.js";
import { MarieStrategist } from "./MarieStrategist.js";
import { MarieAuditor } from "./MarieAuditor.js";
import { MarieQASRE } from "./MarieQASRE.js";
import { MarieISO9001 } from "./MarieISO9001.js";
import { MarieYOLO } from "./MarieYOLO.js";
import { MarieProgressTracker } from "../core/MarieProgressTracker.js";
import { ConfigService } from "../../config/ConfigService.js";

/**
 * Orchestrates parallel agent interactions.
 * Allows multiple agents to think and vote concurrently.
 */
export class MarieAgentSwarm {
    // BALANCED SUPREMACY: Agent coordination state
    private agentConsensusLog: Array<{ agent: string; strategy: string; confidence: number; timestamp: number }> = [];
    private lastCoordinationCycle: number = 0;
    private agentSpecialization: Map<string, string> = new Map();
    private crossAgentSignals: Map<string, any> = new Map();

    constructor(
        private council: MarieCouncil,
        private strategist: MarieStrategist,
        private auditor: MarieAuditor,
        private qasre: MarieQASRE,
        private iso9001: MarieISO9001,
        private yolo: MarieYOLO
    ) {
        // Initialize agent specializations
        this.agentSpecialization.set('YOLO', 'founder-authority');
        this.agentSpecialization.set('Strategist', 'trajectory-planning');
        this.agentSpecialization.set('Auditor', 'verification-safety');
        this.agentSpecialization.set('QASRE', 'quality-regression');
        this.agentSpecialization.set('ISO9001', 'readiness-release');
    }

    /**
     * Executes high-velocity parallel reasoning turn with Race-to-Consensus and Entropy pivots.
     * 
     * ENHANCED: Now uses AgentCoordination + AgentSpecialization for intelligent agent prioritization.
     */
    public async evaluateSwarm(tracker: MarieProgressTracker, turnErrorCount: number, messages: any[]): Promise<void> {
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: "🧠 SWARM SYNTHESIS: Engaging high-frequency parallel reasoning...",
            elapsedMs: tracker.elapsedMs()
        });

        const startTime = Date.now();

        // 0. Task Analysis for Specialization (NEW)
        const lastMessage = messages[messages.length - 1]?.content || '';
        const taskAnalysis = this.council.analyzeTask(lastMessage);

        if (taskAnalysis.confidence > 0.5) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🎯 TASK ANALYSIS: ${taskAnalysis.taskType} (${taskAnalysis.complexity}) - confidence: ${(taskAnalysis.confidence * 100).toFixed(0)}%`,
                elapsedMs: tracker.elapsedMs()
            });
        }

        // 1. Predictive Error Shielding (Phase 8) - Sync Check
        const snapshotRaw = this.council.getSnapshot();
        const snapshot = JSON.parse(JSON.stringify(snapshotRaw));
        const activeFile = snapshot.recentFiles[snapshot.recentFiles.length - 1];
        if (activeFile && (snapshot.errorHotspots[activeFile] || 0) > 2) {
            this.council.registerVote('Auditor', 'DEBUG', `Predictive Shield: Hotspot detected in ${activeFile}`, 2.0);
        }

        // 2. Founder Evaluation First (YOLO sets the trajectory)
        await this.runYOLOEvaluation(tracker, messages);

        // 3. Get swarm guidance from YOLO-Council integration
        const swarmGuidance = this.council.getSwarmGuidance();
        const yoloDecision = this.council.getLastYoloDecision();
        const yoloHighConfidence = !!(yoloDecision && yoloDecision.confidence >= 2.5);

        // 4. Setup Coordination with Specialization (ENHANCED)
        const coordination = this.council.getAgentCoordination();
        const specialization = this.council.getAgentSpecialization();

        // Register agent contexts based on YOLO guidance
        this.registerAgentContexts(coordination, swarmGuidance, turnErrorCount);

        // Apply task specialization (NEW)
        if (taskAnalysis.confidence > 0.5) {
            specialization.applySpecialization(coordination, taskAnalysis);

            // Get best agent for this task type
            const bestAgent = specialization.getBestAgentForTask(taskAnalysis.taskType);
            if (bestAgent) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `⭐ SPECIALIZED AGENT: ${bestAgent} recommended for ${taskAnalysis.taskType}`,
                    elapsedMs: tracker.elapsedMs()
                });
            }
        }

        // 5. Calculate optimal execution order
        const allAgents = ['Strategist', 'Auditor', 'QASRE', 'ISO9001'];
        const coordinationResult = coordination.calculateExecutionOrder(allAgents);

        // Log coordination insights
        if (coordinationResult.conflicts.length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `⚠️ Agent conflicts detected: ${coordinationResult.conflicts.map(c => c.issue).join('; ')}`,
                elapsedMs: tracker.elapsedMs()
            });
        }

        if (coordinationResult.recommendations.length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `📋 Coordination: ${coordinationResult.recommendations.join('; ')}`,
                elapsedMs: tracker.elapsedMs()
            });
        }

        // 6. Execute agents according to coordination plan
        const agentPromises: Promise<void>[] = [];

        // Execute in parallel groups as determined by coordination
        for (const group of coordinationResult.parallelGroups) {
            const groupPromises = group.map(agent =>
                this.executeAgent(agent, tracker, messages, turnErrorCount, yoloHighConfidence, taskAnalysis.taskType)
            );
            agentPromises.push(...groupPromises);
        }

        // Add Intuition Pulse
        agentPromises.push(
            (async () => {
                const intuition = activeFile ? this.council.getIntuition(activeFile) : [];
                if (intuition.length > 0) {
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: `🧠 INTUITION PULSE: Recalling patterns for ${activeFile}: ${intuition.join(', ')}`,
                        elapsedMs: tracker.elapsedMs()
                    });
                }
            })()
        );

        await Promise.all(agentPromises).then(() => {
            // Enhanced Post-Resolution with YOLO Authority
            this.resolveAgentConsensus(tracker, yoloHighConfidence);
        });

        // 7. Record performance for adaptive coordination and specialization
        this.recordAgentPerformanceMetrics(coordination, taskAnalysis.taskType);

        const duration = Date.now() - startTime;
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `⚡ SWARM SYNC: Reasoning synchronized in ${duration}ms.`,
            elapsedMs: tracker.elapsedMs()
        });
    }

    /**
     * Register agent contexts for coordination
     */
    private registerAgentContexts(
        coordination: import("../council/AgentCoordination.js").AgentCoordination,
        guidance: ReturnType<MarieCouncil['getSwarmGuidance']>,
        turnErrorCount: number
    ): void {
        // Strategist: Always active, priority varies by context
        coordination.registerAgentContext('Strategist', {
            priority: guidance.yoloPrecedence ? 2.0 : 1.5,
            dependencies: [], // Strategist can run independently
            recommendedStrategy: turnErrorCount > 0 ? 'DEBUG' : 'EXECUTE'
        });

        // Auditor: Critical when errors present
        coordination.registerAgentContext('Auditor', {
            priority: turnErrorCount > 0 ? 2.5 : 1.2,
            dependencies: guidance.yoloPrecedence ? ['YOLO'] : [],
            recommendedStrategy: turnErrorCount > 0 ? 'DEBUG' : 'EXECUTE'
        });

        // QASRE: Quality assurance
        coordination.registerAgentContext('QASRE', {
            priority: guidance.deferredAgents.includes('QASRE') ? 0.7 : 1.3,
            dependencies: guidance.yoloPrecedence ? ['YOLO', 'Strategist'] : [],
            recommendedStrategy: 'DEBUG'
        });

        // ISO9001: Readiness check
        coordination.registerAgentContext('ISO9001', {
            priority: guidance.deferredAgents.includes('ISO9001') ? 0.8 : 1.2,
            dependencies: ['Strategist'],
            recommendedStrategy: 'RESEARCH'
        });
    }

    /**
     * Execute a specific agent
     */
    private async executeAgent(
        agent: string,
        tracker: MarieProgressTracker,
        messages: any[],
        turnErrorCount: number,
        yoloHighConfidence: boolean,
        taskType: import("../council/AgentSpecialization.js").TaskType
    ): Promise<void> {
        const startTime = Date.now();
        let success = true;

        try {
            switch (agent) {
                case 'Strategist':
                    await this.runStrategistEvaluation(turnErrorCount, !yoloHighConfidence);
                    break;
                case 'Auditor':
                    await this.runAuditorEvaluation(tracker);
                    break;
                case 'QASRE':
                    await this.runQASREEvaluation(tracker, messages);
                    break;
                case 'ISO9001':
                    await this.runISO9001Evaluation(tracker, messages);
                    break;
            }
        } catch (error) {
            success = false;
            console.error(`Agent ${agent} execution failed:`, error);
        }

        // Record performance for adaptive coordination and specialization
        const duration = Date.now() - startTime;
        this.council.getAgentCoordination().recordAgentPerformance(agent, success, duration);

        // Record for specialization learning if task type is known
        if (taskType && taskType !== 'UNKNOWN') {
            this.council.recordTaskCompletion(agent, taskType, success, duration);
        }
    }

    /**
     * Record performance metrics for all agents
     */
    private recordAgentPerformanceMetrics(
        coordination: import("../council/AgentCoordination.js").AgentCoordination,
        taskType: import("../council/AgentSpecialization.js").TaskType
    ): void {
        const metrics = coordination.getMetrics();

        // Share performance insights across agents via blackboard
        if (metrics.performanceStats.length > 0) {
            this.council.blackboard.write('agent:performanceSnapshot', {
                timestamp: Date.now(),
                stats: metrics.performanceStats,
                avgPriority: metrics.avgAgentPriority,
                taskType
            });
        }
    }

    /**
     * Shotgun Debugging (Phase 9): Injects a burst of context-harvesting tools.
     */
    public async runShotgunRecovery(tracker: MarieProgressTracker, file: string): Promise<any[]> {
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `🔫 SHOTGUN RECOVERY: Firing parallel diagnostic burst for ${file}...`,
            elapsedMs: tracker.elapsedMs()
        });

        return [
            { name: 'read_file', input: { path: file } },
            { name: 'get_file_diagnostics', input: { path: file } },
            { name: 'grep_search', input: { query: "TODO|FIXME|ERROR|LINT", searchPath: file } }
        ];
    }

    private async runStrategistEvaluation(errorCount: number, highConfidence: boolean = false): Promise<void> {
        const lastVeto = this.council.blackboard.read('lastVeto');
        if (lastVeto) {
            this.council.registerVote('Strategist', 'DEBUG', `Recovery mode: addressing previous veto: ${lastVeto.substring(0, 50)}...`, 1.5);
            // Clear once ack'd by vote
            this.council.blackboard.write('lastVeto', '');
        }

        const confidence = highConfidence ? 2.0 : 1.0;
        this.strategist.assessTurn(errorCount);
        const strategy = this.council.getStrategy();
        this.council.registerVote('Strategist', strategy, 'Race Consensus Boost', confidence);
    }

    /**
     * BALANCED SUPREMACY: Founder Agent (MarieYOLO) - Highest authority with gentler guardrails.
     * YOLO leads but does not silence. The council advises; YOLO decides when conviction is high.
     * 
     * ENHANCED: Full integration with AgentCoordination and YOLOCouncilIntegration
     */
    private async runYOLOEvaluation(tracker: MarieProgressTracker, messages: any[]): Promise<void> {
        if (!ConfigService.isYoloEnabled()) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `The Founder rests. Council deliberation continues.`,
                elapsedMs: tracker.elapsedMs()
            });
            return;
        }

        const snapshot = this.council.getSnapshot();
        const hotspotCount = Object.values(snapshot.errorHotspots || {}).filter(c => (c as number) > 0).length;
        const profile = ConfigService.getYoloProfile();
        const aggression = ConfigService.getYoloAggression();
        const maxRequiredActions = ConfigService.getYoloMaxRequiredActions();

        const decision = await this.yolo.evaluate(messages, this.council.getReadinessContext(), {
            flowState: snapshot.flowState,
            successStreak: snapshot.successStreak,
            totalErrors: this.council.getErrorCount(),
            hotspotCount,
            profile,
            aggression,
            maxRequiredActions
        });

        let strategy = decision.strategy;
        let confidence = decision.confidence;
        let dampened = false;
        let dampenReason: string | undefined;

        // BALANCED SUPREMACY: Gentler risk thresholds for YOLO
        const highRisk = snapshot.flowState < 30 || this.council.getErrorCount() > 10 || hotspotCount > 5 || this.council.getEntropy() >= 100;
        const healthyMomentum = snapshot.flowState >= 60 && snapshot.successStreak >= 2 && hotspotCount <= 3;
        // YOLO can vote during panic cooldown (Founder doesn't hide during crisis)
        const inPanicCoolDown = this.council.isInCoolDown();

        if (profile === 'recovery') {
            // Gentler recovery dampening
            confidence = Math.max(1.0, confidence * 0.9);
            if (strategy === 'HYPE' && highRisk) strategy = 'DEBUG';
        } else if (profile === 'demo_day' && !highRisk) {
            // Demo day boost
            confidence = Math.min(3.0, confidence + 0.2);
        }

        if (decision.structuralUncertainty) {
            // BALANCED SUPREMACY: Higher cap on structural uncertainty (was 1.3)
            strategy = strategy === 'RESEARCH' ? 'RESEARCH' : 'DEBUG';
            confidence = Math.min(confidence, 1.5);
            dampened = true;
            dampenReason = 'structural uncertainty';
        }

        // BALANCED SUPREMACY: Gentler dampening (0.85 vs 0.75), no panic cooldown blocking
        if (highRisk) {
            if (strategy === 'HYPE') strategy = 'DEBUG';
            confidence = Math.max(1.0, confidence * 0.85);
            dampened = true;
            dampenReason = 'high risk advisory active';
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `The Council advises caution. The Founder considers (flow=${snapshot.flowState}, hotspots=${hotspotCount}).`,
                elapsedMs: tracker.elapsedMs()
            });
        } else if (inPanicCoolDown) {
            // YOLO can still vote during cooldown, just with advisory note
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `The Founder speaks even in turmoil. Council recovers.`,
                elapsedMs: tracker.elapsedMs()
            });
        } else if (healthyMomentum && (strategy === 'EXECUTE' || strategy === 'HYPE')) {
            // Enhanced momentum boost
            confidence = Math.min(3.0, confidence + 0.3);
        }

        // BALANCED SUPREMACY: Stronger continue directive boost (was +0.15)
        if (decision.isContinueDirective && (strategy === 'EXECUTE' || strategy === 'HYPE')) {
            confidence = Math.min(3.0, confidence + 0.3);
        }

        if (decision.stopCondition === 'structural_uncertainty') {
            strategy = strategy === 'RESEARCH' ? 'RESEARCH' : 'DEBUG';
            confidence = Math.min(confidence, 1.4);
        }

        const reason = `${decision.reason}${decision.isContinueDirective ? ' | continue-immediately honored' : ''}`;
        this.council.registerVote('YOLO', strategy, reason, confidence);

        // Create telemetry for the decision
        const telemetry = {
            profile: decision.profile,
            strategy,
            confidence,
            urgency: decision.urgency,
            dampened,
            dampenReason,
            structuralUncertainty: decision.structuralUncertainty,
            requiredActions: decision.requiredActions,
            blockedBy: decision.blockedBy,
            stopCondition: decision.stopCondition,
            timestamp: Date.now()
        };

        this.council.recordYoloDecision(telemetry);

        // ENHANCED: Process YOLO decision with full council integration
        const influenceMetrics = this.council.processYOLODecision(telemetry);

        // Log influence metrics for debugging
        if (influenceMetrics.overrideAuthority) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `YOLO Override Authority Active: ${influenceMetrics.boostedAgents.join(', ')} boosted`,
                elapsedMs: tracker.elapsedMs()
            });
        }

        if (decision.requiredActions.length > 0) {
            this.council.blackboard.write('yolo:requiredActions', decision.requiredActions);
        }
        if (decision.blockedBy.length > 0) {
            this.council.blackboard.write('yolo:blockedBy', decision.blockedBy);
        }

        // BALANCED SUPREMACY: Ceremonial language reflecting authority
        const authorityMarker = confidence >= 2.5 ? 'The Founder decrees' : 'The Founder suggests';
        tracker.emitEvent({
            type: 'reasoning',
            runId: tracker.getRun().runId,
            text: `${authorityMarker}: ${strategy} @ ${confidence.toFixed(2)} (${decision.urgency})`,
            elapsedMs: tracker.elapsedMs()
        });
    }

    private async runAuditorEvaluation(tracker: MarieProgressTracker): Promise<void> {
        const snapshot = this.council.getSnapshot();
        if (snapshot.flowState < 40) {
            this.council.registerVote('Auditor', 'DEBUG', 'Flow state low. Auditor recommends careful verification.');
        } else if (snapshot.successStreak > 5) {
            this.council.registerVote('Auditor', 'EXECUTE', 'Momentum is stable. Auditor approves continued execution.');
        }
    }

    private async runSpeculativePreFetch(tracker: MarieProgressTracker, messages: any[]): Promise<void> {
        const candidates = new Set<string>();
        const filePathRegex = /(?:src\/[\w\/\-\.]+\.\w+)/g;

        // 1. Scan Last Message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && typeof lastMsg.content === 'string') {
            const mentions = lastMsg.content.match(filePathRegex) || [];
            mentions.forEach((m: string) => candidates.add(m));
        }

        // 2. Scan Active Objective (Pass 4 Enhancement)
        const activeObjective = tracker.getRun().objectives.find((o: any) => o.status === 'in_progress');
        if (activeObjective) {
            const objMentions = activeObjective.label.match(filePathRegex) || [];
            objMentions.forEach((m: string) => candidates.add(m));
        }

        // 3. Filter & Exec
        const uniqueCandidates = Array.from(candidates)
            .filter(f => !this.council.hasRecentlyRead(f))
            .slice(0, 3); // Cap at 3 to avoid flooding

        if (uniqueCandidates.length > 0) {
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: `🔮 SPECULATIVE PRE-FETCH: Warming context for: ${uniqueCandidates.join(', ')}`,
                elapsedMs: tracker.elapsedMs()
            });
            // Record in parallel
            await Promise.all(uniqueCandidates.map(f => this.council.recordFileContext(f)));
        }
    }

    /**
     * Phase 10: Neuro-Critique (Async & Intelligent)
     * Agents analyze the 'reason' fields of other agents to find logical inconsistencies.
     * NOW POWERED BY: Background LLM "Ghost Critic"
     */
    private async runNeuroCritique(tracker: MarieProgressTracker, messages?: any[]): Promise<void> {
        const snapshot = this.council.getSnapshot();

        // 1. Sync Check: Velocity vs Risk
        const lastVote = (snapshot as any).lastVote;
        if (lastVote && lastVote.includes('Strategist') && lastVote.includes('Race Consensus')) {
            if (snapshot.flowState < 50 || snapshot.errorHotspots[snapshot.recentFiles[snapshot.recentFiles.length - 1]] > 0) {
                // Keep the heuristic as a fast guard rail
                this.council.registerVote('Auditor', 'DEBUG', 'Critique: Velocity too high for current hotspot density.', 1.5);
            }
        }

        // 2. Async Check: Ghost Critic (LLM based)
        // Only run if we have messages context and flow isn't perfect
        if (messages && messages.length > 2 && snapshot.flowState < 90) {
            const critique = await this.auditor.quickCritique(messages);
            if (critique) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🧐 GHOST CRITIC: "${critique}"`,
                    elapsedMs: tracker.elapsedMs()
                });
                this.council.registerVote('Auditor', 'DEBUG', `Ghost Critic: ${critique}`, 2.0);
                this.council.setMood('DOUBT');

                // Active Self-Healing: Persist critique for the next turn
                this.council.blackboard.write('activeCritique', critique);
            }
        }
    }

    /**
     * BALANCED SUPREMACY: QA + Sanity Evaluation with Founder-Aware Override Protocol.
     * QASRE advises; only CRITICAL issues can challenge high YOLO conviction.
     */
    private async runQASREEvaluation(tracker: MarieProgressTracker, messages: any[]): Promise<void> {
        const snapshot = this.council.getSnapshot();
        const wasModified = Array.isArray((snapshot as any).writtenFiles)
            ? (snapshot as any).writtenFiles.length > 0
            : false;
        if (wasModified || snapshot.flowState > 50 || snapshot.successStreak > 2) {
            const context = this.council.getRecentChangesSummary();
            const evaluation = await this.qasre.evaluate(messages, context);

            if (evaluation && !evaluation.includes("No action recommended")) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🧹 QASRE: ${evaluation.split('\n')[0]}`,
                    elapsedMs: tracker.elapsedMs()
                });

                // BALANCED SUPREMACY: Check YOLO confidence for override threshold
                const yoloDecision = this.council.getLastYoloDecision();
                const yoloHighConfidence = yoloDecision && yoloDecision.confidence >= 2.5;
                const isCriticalRisk = evaluation.includes("CRITICAL") || evaluation.includes("DATA LOSS") || evaluation.includes("SECURITY");

                // QASRE Veto Logic: Only force DEBUG on CRITICAL risks if YOLO has high conviction
                if (isCriticalRisk) {
                    // CRITICAL risks get stronger weight, but still advisory if YOLO ≥ 2.5
                    const vetoConfidence = yoloHighConfidence ? 3.0 : 2.5;
                    this.council.registerVote('QASRE', 'DEBUG', `QASRE CRITICAL: Immediate attention required.`, vetoConfidence);
                    this.council.setMood('CAUTIOUS');
                    this.council.blackboard.write('lastVeto', evaluation);
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: yoloHighConfidence
                            ? `The Council raises a critical concern. The Founder weighs this against their conviction.`
                            : `QASRE CRITICAL: High risk detected. Council votes DEBUG.`,
                        elapsedMs: tracker.elapsedMs()
                    });
                } else if (evaluation.includes("RISK: HIGH")) {
                    // HIGH risk is advisory when YOLO has high conviction
                    if (!yoloHighConfidence) {
                        this.council.registerVote('QASRE', 'DEBUG', `QASRE Advisory: High risk noted.`, 2.0);
                        this.council.setMood('DOUBT');
                    } else {
                        // Advisory only - don't override
                        this.council.registerVote('QASRE', 'DEBUG', `QASRE Advisory: Risk noted, deferring to Founder.`, 1.0);
                        tracker.emitEvent({
                            type: 'reasoning',
                            runId: tracker.getRun().runId,
                            text: `The Council notes a concern. The Founder considers it.`,
                            elapsedMs: tracker.elapsedMs()
                        });
                    }
                } else {
                    this.council.registerVote('QASRE', 'DEBUG', `QASRE: ${evaluation.substring(0, 100)}`, 1.2);
                }
            }
        }
    }

    /**
     * Phase 11: ISO9001 Readiness Evaluation (Parallel)
     */
    private async runISO9001Evaluation(tracker: MarieProgressTracker, messages: any[]): Promise<void> {
        const snapshot = this.council.getSnapshot();
        // Trigger ISO check when nearing completion or after any file modification
        const wasModified = Array.from(snapshot.writtenFiles).length > 0;
        if (wasModified || snapshot.flowState < 40 || tracker.getRun().objectives.every(o => o.status === 'completed')) {
            const context = this.council.getReadinessContext();
            const verification = await this.iso9001.verifyReadiness(messages, context);

            if (verification) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🧠 ISO9001 READINESS: ${verification.split('\n')[0]}`,
                    elapsedMs: tracker.elapsedMs()
                });

                if (verification.includes("Stop Signal: YES")) {
                    this.council.registerVote('ISO9001', 'HYPE', 'ISO9001: Work is stable. Stop Signal: YES.', 2.0);
                    this.council.setMood('STABLE');
                } else if (verification.includes("Stop Signal: NO") || verification.includes("Build Risk: High")) {
                    this.council.registerVote('ISO9001', 'DEBUG', 'ISO9001: Readiness check failed or risk detected.', 2.0);
                    this.council.setMood('CAUTIOUS');
                }
            }
        }
    }

    /**
     * BALANCED SUPREMACY: Wiring Integrity Check
     * Verifies that newly written files are properly integrated into the codebase.
     * Checks for exports, imports, and references to prevent orphaned modules.
     */
    private async runWiringIntegrityCheck(tracker: MarieProgressTracker): Promise<void> {
        const snapshot = this.council.getSnapshot();
        const writtenFiles = Array.from((snapshot as any).writtenFiles || []);

        for (const file of writtenFiles as string[]) {
            // Only check TypeScript/JavaScript files
            if (!file.endsWith('.ts') && !file.endsWith('.js') && !file.endsWith('.tsx') && !file.endsWith('.jsx')) {
                continue;
            }

            // Skip test files, declarations, and generated files
            if (file.includes('.test.') || file.includes('.spec.') || file.includes('.d.ts') || file.includes('node_modules')) {
                continue;
            }

            // Check 1: Does the file have exports?
            const hasExports = this.checkFileHasExports(file);
            this.council.blackboard.write(`exports:${file}`, hasExports);

            // Check 2: Is the file referenced by other files?
            const isReferenced = this.checkFileIsReferenced(file);
            this.council.blackboard.write(`referenced:${file}`, isReferenced);

            // Check 3: If file has exports but no references, flag as potential loose end
            if (hasExports && !isReferenced) {
                // Get the relative path for cleaner messaging
                const fileName = file.split('/').pop() || file;
                const alert = `Wiring Alert: ${fileName} exports code but is not imported anywhere`;
                this.council.recordWiringAlert(alert);

                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🔌 ${alert}. Consider adding to index.ts or importing from a parent module.`,
                    elapsedMs: tracker.elapsedMs()
                });
            }

            // Check 4: Verify import paths are valid (catch broken imports)
            const brokenImports = this.checkBrokenImports(file);
            if (brokenImports.length > 0) {
                const alert = `Wiring Alert: ${file.split('/').pop()} has ${brokenImports.length} broken import(s)`;
                this.council.recordWiringAlert(alert);

                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: `🔌 ${alert}: ${brokenImports.join(', ')}`,
                    elapsedMs: tracker.elapsedMs()
                });
            }
        }
    }

    /**
     * Check if a file has exports (classes, functions, variables, etc.)
     */
    private checkFileHasExports(file: string): boolean {
        // Check blackboard cache first
        const cached = this.council.blackboard.read(`fileExports:${file}`);
        if (cached !== undefined) return cached as boolean;

        // Read file content from council's recent files
        const snapshot = this.council.getSnapshot();
        const recentFiles = snapshot.recentFiles || [];

        // If file was just written, check the written files content
        const writtenFiles = snapshot.writtenFiles || [];
        if (!writtenFiles.includes(file) && !recentFiles.includes(file)) {
            return false;
        }

        // For now, assume files in src/ have exports if they're not index files
        // In a full implementation, this would parse the file AST
        const isIndexFile = file.includes('index.ts') || file.includes('index.js');
        const isInSrc = file.includes('/src/');

        return isInSrc && !isIndexFile;
    }

    /**
     * Check if a file is referenced (imported) by other files
     */
    private checkFileIsReferenced(file: string): boolean {
        // Check blackboard cache
        const cached = this.council.blackboard.read(`fileReferenced:${file}`);
        if (cached !== undefined) return cached as boolean;

        // Get recent files from the session
        const snapshot = this.council.getSnapshot();
        const recentFiles = snapshot.recentFiles || [];

        // Check if file appears in recent tool executions as a target
        const toolExecutions = this.council.getToolExecutions();
        const fileMentioned = toolExecutions.some(exec =>
            exec.filePath && exec.filePath !== file &&
            (exec.name === 'read_file' || exec.name === 'write_to_file' || exec.name === 'replace_file_content')
        );

        // Also check if it's in the import chain of recently modified files
        const recentlyModified = snapshot.writtenFiles || [];
        const isInModificationChain = recentlyModified.some(modifiedFile =>
            modifiedFile !== file && this.filesAreRelated(file, modifiedFile)
        );

        return fileMentioned || isInModificationChain;
    }

    /**
     * Check if two files are likely related (same directory or shared parent)
     */
    private filesAreRelated(file1: string, file2: string): boolean {
        const dir1 = file1.substring(0, file1.lastIndexOf('/'));
        const dir2 = file2.substring(0, file2.lastIndexOf('/'));

        // Same directory
        if (dir1 === dir2) return true;

        // Parent-child relationship
        if (dir1.startsWith(dir2 + '/') || dir2.startsWith(dir1 + '/')) return true;

        // Share common ancestor (e.g., both in src/infrastructure)
        const parts1 = dir1.split('/');
        const parts2 = dir2.split('/');
        const commonLength = Math.min(parts1.length, parts2.length);

        for (let i = 0; i < commonLength; i++) {
            if (parts1[i] !== parts2[i]) {
                return i >= 2; // Share at least 2 path segments
            }
        }

        return true;
    }

    /**
     * Check for broken imports in a file
     * Returns array of broken import paths
     */
    private checkBrokenImports(file: string): string[] {
        // This would ideally parse the file and check import paths
        // For now, return empty array - the actual implementation
        // would need access to the file system
        return [];
    }

    /**
     * BALANCED SUPREMACY: Enhanced consensus resolution with YOLO authority.
     * Resolves agent disagreements while respecting Founder's high conviction.
     */
    private resolveAgentConsensus(tracker: MarieProgressTracker, yoloHighConfidence: boolean): void {
        const entropy = this.council.getEntropy();
        const snapshot = this.council.getSnapshot();

        // Log the coordination cycle
        this.lastCoordinationCycle = Date.now();

        if (entropy >= 100) {
            // High entropy detected - council is fractured
            if (yoloHighConfidence) {
                // YOLO's high conviction can override entropy in non-critical situations
                const yoloDecision = this.council.getLastYoloDecision();
                if (yoloDecision && yoloDecision.strategy !== 'DEBUG') {
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: "The Council speaks with fractured voices. The Founder unifies.",
                        elapsedMs: tracker.elapsedMs()
                    });
                    // Don't force RESEARCH - trust YOLO's direction
                    return;
                }
            }

            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "🌪️ HIGH SWARM ENTROPY: Disagreement detected. Forcing RESEARCH reset...",
                elapsedMs: tracker.elapsedMs()
            });
            this.council.registerVote('Strategist', 'RESEARCH', 'Entropy Guard: Consensus is fractured.', 2.0);
        } else if (entropy > 50) {
            // Moderate friction
            if (yoloHighConfidence) {
                tracker.emitEvent({
                    type: 'reasoning',
                    runId: tracker.getRun().runId,
                    text: "The Council deliberates. The Founder holds course.",
                    elapsedMs: tracker.elapsedMs()
                });
            } else {
                this.council.setMood('FRICTION');
            }
        } else if (this.council.getSuccessStreak() > 10 && yoloHighConfidence) {
            // High success with YOLO confidence = euphoria
            this.council.setMood('EUPHORIA');
            tracker.emitEvent({
                type: 'reasoning',
                runId: tracker.getRun().runId,
                text: "The Council rejoices. The Founder's conviction is validated.",
                elapsedMs: tracker.elapsedMs()
            });
        } else if (this.council.getSuccessStreak() > 10) {
            this.council.setMood('EUPHORIA');
        }

        // Record consensus state for future analysis
        this.agentConsensusLog.push({
            agent: 'SWARM',
            strategy: snapshot.strategy,
            confidence: yoloHighConfidence ? 2.5 : 1.5,
            timestamp: Date.now()
        });

        // Keep log manageable
        if (this.agentConsensusLog.length > 50) {
            this.agentConsensusLog = this.agentConsensusLog.slice(-25);
        }
    }
}
