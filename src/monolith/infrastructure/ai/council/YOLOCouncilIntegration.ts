import { MarieCouncil, CouncilStrategy } from "./MarieCouncil.js";
import { AgentCoordination } from "./AgentCoordination.js";
import { YoloTelemetry, CouncilMood, CouncilVote } from "./MarieCouncilTypes.js";
import { MarieProgressTracker } from "../core/MarieProgressTracker.js";

/**
 * YOLOCouncilIntegration - Deep integration layer between MarieYOLO and the Council
 * 
 * This module provides:
 * 1. YOLO-guided strategy arbitration
 * 2. Dynamic mood influence based on YOLO conviction
 * 3. Agent activation/deactivation based on YOLO's guidance
 * 4. Strategic override protocols
 */

export interface YOLOInfluenceMetrics {
    currentConviction: number;
    convictionTrend: 'RISING' | 'FALLING' | 'STABLE';
    overrideAuthority: boolean;
    councilAlignment: number; // 0-1 how much council agrees with YOLO
    suppressedAgents: string[];
    boostedAgents: string[];
}

export interface StrategicOverride {
    originalStrategy: CouncilStrategy;
    yoloStrategy: CouncilStrategy;
    overrideReason: string;
    confidenceThreshold: number;
    councilConsent: boolean;
    timestamp: number;
}

/**
 * YOLOCouncilIntegration manages the complex relationship between the Founder (YOLO)
 * and the Council of agents, ensuring YOLO's vision is respected while maintaining
 * council wisdom and safety checks.
 */
export class YOLOCouncilIntegration {
    private coordination: AgentCoordination;
    private influenceHistory: StrategicOverride[] = [];
    private yoloConvictionHistory: number[] = [];
    private readonly MAX_HISTORY = 20;

    constructor(private council: MarieCouncil) {
        this.coordination = new AgentCoordination(council);
    }

    /**
     * Process a new YOLO decision and integrate it with council operations
     */
    public processYOLODecision(
        decision: YoloTelemetry,
        tracker?: MarieProgressTracker
    ): YOLOInfluenceMetrics {
        // Update conviction history
        this.yoloConvictionHistory.push(decision.confidence);
        if (this.yoloConvictionHistory.length > this.MAX_HISTORY) {
            this.yoloConvictionHistory.shift();
        }

        // Update coordination with YOLO guidance
        this.coordination.updateYOLOGuidance(decision);

        // Calculate influence metrics
        const metrics = this.calculateInfluenceMetrics(decision);

        // Apply YOLO's influence to the council
        this.applyYOLOInfluence(decision, metrics, tracker);

        // Log the override if it occurred
        if (metrics.overrideAuthority) {
            this.logStrategicOverride(decision, metrics);
        }

        return metrics;
    }

    /**
     * Calculate how much influence YOLO should have based on conviction and history
     */
    private calculateInfluenceMetrics(decision: YoloTelemetry): YOLOInfluenceMetrics {
        const currentConviction = decision.confidence;

        // Calculate conviction trend
        let convictionTrend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
        if (this.yoloConvictionHistory.length >= 3) {
            const recent = this.yoloConvictionHistory.slice(-3);
            const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
            const older = this.yoloConvictionHistory.slice(-6, -3);
            if (older.length > 0) {
                const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
                if (avgRecent > avgOlder + 0.2) convictionTrend = 'RISING';
                else if (avgRecent < avgOlder - 0.2) convictionTrend = 'FALLING';
            }
        }

        // Determine override authority
        const overrideAuthority = currentConviction >= 2.5 &&
            !decision.dampened &&
            convictionTrend !== 'FALLING';

        // Calculate council alignment
        const recentVotes = this.council.getSnapshot().lastYoloDecision ?
            this.getRecentVotesForStrategy(decision.strategy) : 0;
        const totalVotes = Math.max(1, this.getTotalRecentVotes());
        const councilAlignment = recentVotes / totalVotes;

        // Determine agent boosts/suppressions
        const { suppressedAgents, boostedAgents } = this.calculateAgentAdjustments(decision);

        return {
            currentConviction,
            convictionTrend,
            overrideAuthority,
            councilAlignment,
            suppressedAgents,
            boostedAgents
        };
    }

    /**
     * Apply YOLO's influence to council operations
     */
    private applyYOLOInfluence(
        decision: YoloTelemetry,
        metrics: YOLOInfluenceMetrics,
        tracker?: MarieProgressTracker
    ): void {
        // Override authority: YOLO can force strategy when conviction is high
        if (metrics.overrideAuthority) {
            const currentStrategy = this.council.getStrategy();

            if (currentStrategy !== decision.strategy) {
                // YOLO overrides the council's strategy
                this.council.setStrategy(decision.strategy,
                    `YOLO Override: High conviction (${decision.confidence.toFixed(2)}) Founder directive`);

                if (tracker) {
                    tracker.emitEvent({
                        type: 'reasoning',
                        runId: tracker.getRun().runId,
                        text: `The Founder's conviction (${decision.confidence.toFixed(2)}) overrides the Council. Strategy: ${decision.strategy}`,
                        elapsedMs: tracker.elapsedMs()
                    });
                }
            }

            // Override mood when conviction is very high
            if (decision.confidence >= 2.8) {
                const yoloMood = this.strategyToMood(decision.strategy);
                this.council.setMood(yoloMood);
            }
        }

        // Even without override, YOLO influences agent priorities
        this.adjustAgentPriorities(metrics);
    }

    /**
     * Calculate which agents to boost or suppress based on YOLO's strategy
     */
    private calculateAgentAdjustments(decision: YoloTelemetry): {
        suppressedAgents: string[];
        boostedAgents: string[]
    } {
        const suppressedAgents: string[] = [];
        const boostedAgents: string[] = [];

        switch (decision.strategy) {
            case 'HYPE':
                boostedAgents.push('YOLO', 'Strategist');
                suppressedAgents.push('Auditor', 'QASRE');
                break;
            case 'DEBUG':
                boostedAgents.push('Auditor', 'QASRE');
                suppressedAgents.push('Strategist');
                break;
            case 'RESEARCH':
                boostedAgents.push('Strategist', 'ISO9001');
                suppressedAgents.push('YOLO'); // YOLO steps back to let research happen
                break;
            case 'EXECUTE':
                // Balanced - no major suppressions
                boostedAgents.push('Engine');
                break;
            case 'PANIC':
                // All agents focus on recovery
                boostedAgents.push('Auditor', 'QASRE', 'ISO9001');
                break;
        }

        return { suppressedAgents, boostedAgents };
    }

    /**
     * Adjust agent priorities in the coordination layer
     */
    private adjustAgentPriorities(metrics: YOLOInfluenceMetrics): void {
        for (const agent of metrics.boostedAgents) {
            this.coordination.registerAgentContext(agent, {
                priority: 2.5,
                recommendedStrategy: this.council.getStrategy()
            });
        }

        for (const agent of metrics.suppressedAgents) {
            this.coordination.registerAgentContext(agent, {
                priority: 0.7,
                recommendedStrategy: 'RESEARCH' // Deprioritized agents do research
            });
        }
    }

    /**
     * Convert strategy to corresponding mood
     */
    private strategyToMood(strategy: CouncilStrategy): CouncilMood {
        switch (strategy) {
            case 'HYPE': return 'EUPHORIA';
            case 'DEBUG': return 'CAUTIOUS';
            case 'RESEARCH': return 'INQUISITIVE';
            case 'EXECUTE': return 'AGGRESSIVE';
            case 'PANIC': return 'FRICTION';
            default: return 'STABLE';
        }
    }

    /**
     * Get the number of recent votes matching a strategy
     */
    private getRecentVotesForStrategy(strategy: CouncilStrategy): number {
        // Access the council's state through the snapshot
        const snapshot = this.council.getSnapshot();
        return 0; // Simplified - would need access to vote history
    }

    private getTotalRecentVotes(): number {
        return 1; // Simplified
    }

    /**
     * Log a strategic override for analysis
     */
    private logStrategicOverride(decision: YoloTelemetry, metrics: YOLOInfluenceMetrics): void {
        const override: StrategicOverride = {
            originalStrategy: this.council.getStrategy(),
            yoloStrategy: decision.strategy,
            overrideReason: 'YOLO high conviction override',
            confidenceThreshold: decision.confidence,
            councilConsent: metrics.councilAlignment > 0.5,
            timestamp: Date.now()
        };

        this.influenceHistory.push(override);
        if (this.influenceHistory.length > this.MAX_HISTORY) {
            this.influenceHistory.shift();
        }

        // Write to blackboard for agent awareness
        this.council.blackboard.write('yolo:lastOverride', override);
    }

    /**
     * Check if YOLO should veto a council decision
     */
    public shouldVetoCouncilDecision(
        proposedStrategy: CouncilStrategy,
        yoloDecision: YoloTelemetry
    ): { veto: boolean; reason?: string } {
        // YOLO can veto when:
        // 1. Conviction is very high (>= 2.7)
        // 2. The proposed strategy contradicts YOLO's assessment
        // 3. There's no critical safety issue (which would override even YOLO)

        if (yoloDecision.confidence < 2.7) {
            return { veto: false };
        }

        // Don't veto safety-critical decisions
        if (proposedStrategy === 'PANIC') {
            return { veto: false, reason: 'Safety override - respecting PANIC' };
        }

        // Veto if strategies conflict significantly
        if (proposedStrategy === 'HYPE' && yoloDecision.strategy === 'DEBUG') {
            return {
                veto: true,
                reason: `YOLO veto: Council HYPE conflicts with Founder DEBUG assessment (confidence: ${yoloDecision.confidence.toFixed(2)})`
            };
        }

        if (proposedStrategy === 'DEBUG' && yoloDecision.strategy === 'EXECUTE' && yoloDecision.confidence >= 2.8) {
            return {
                veto: true,
                reason: `YOLO veto: High conviction (${yoloDecision.confidence.toFixed(2)}) overrides excessive caution`
            };
        }

        return { veto: false };
    }

    /**
     * Get strategic guidance for agent swarm execution
     */
    public getSwarmGuidance(): {
        executionMode: 'PARALLEL' | 'SEQUENTIAL' | 'YOLO_LEAD';
        activeAgents: string[];
        deferredAgents: string[];
        yoloPrecedence: boolean;
    } {
        const yoloDecision = this.council.getLastYoloDecision();
        if (!yoloDecision) {
            return {
                executionMode: 'PARALLEL',
                activeAgents: ['YOLO', 'Strategist', 'Auditor', 'QASRE', 'ISO9001'],
                deferredAgents: [],
                yoloPrecedence: false
            };
        }

        const metrics = this.calculateInfluenceMetrics(yoloDecision);

        // Determine execution mode based on YOLO conviction
        let executionMode: 'PARALLEL' | 'SEQUENTIAL' | 'YOLO_LEAD';
        if (metrics.overrideAuthority) {
            executionMode = 'YOLO_LEAD'; // YOLO runs first, others follow
        } else if (yoloDecision.structuralUncertainty) {
            executionMode = 'SEQUENTIAL'; // Careful, ordered execution
        } else {
            executionMode = 'PARALLEL'; // Normal parallel execution
        }

        return {
            executionMode,
            activeAgents: this.getActiveAgents(metrics),
            deferredAgents: metrics.suppressedAgents,
            yoloPrecedence: metrics.overrideAuthority
        };
    }

    /**
     * Get list of active agents based on current context
     */
    private getActiveAgents(metrics: YOLOInfluenceMetrics): string[] {
        const allAgents = ['YOLO', 'Strategist', 'Auditor', 'QASRE', 'ISO9001'];

        if (metrics.overrideAuthority) {
            // When YOLO has override, all agents are active but follow YOLO
            return allAgents;
        }

        // Filter out suppressed agents
        return allAgents.filter(a => !metrics.suppressedAgents.includes(a));
    }

    /**
     * Get analytics on YOLO's influence over time
     */
    public getInfluenceAnalytics(): {
        totalOverrides: number;
        overrideSuccessRate: number;
        avgConviction: number;
        trendDirection: 'INCREASING' | 'DECREASING' | 'STABLE';
        recentDecisions: StrategicOverride[];
    } {
        const totalOverrides = this.influenceHistory.length;
        const successfulOverrides = this.influenceHistory.filter(o => o.councilConsent).length;
        const overrideSuccessRate = totalOverrides > 0 ? successfulOverrides / totalOverrides : 0;

        const avgConviction = this.yoloConvictionHistory.length > 0
            ? this.yoloConvictionHistory.reduce((a, b) => a + b, 0) / this.yoloConvictionHistory.length
            : 0;

        // Calculate trend
        let trendDirection: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
        if (this.yoloConvictionHistory.length >= 5) {
            const firstHalf = this.yoloConvictionHistory.slice(0, Math.floor(this.yoloConvictionHistory.length / 2));
            const secondHalf = this.yoloConvictionHistory.slice(Math.floor(this.yoloConvictionHistory.length / 2));
            const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

            if (avgSecond > avgFirst + 0.3) trendDirection = 'INCREASING';
            else if (avgSecond < avgFirst - 0.3) trendDirection = 'DECREASING';
        }

        return {
            totalOverrides,
            overrideSuccessRate,
            avgConviction,
            trendDirection,
            recentDecisions: this.influenceHistory.slice(-5)
        };
    }

    /**
     * Get the agent coordination instance
     */
    public getCoordination(): AgentCoordination {
        return this.coordination;
    }

    /**
     * Clear turn-specific state
     */
    public clearTurnState(): void {
        this.coordination.clearTurnState();
    }
}
