import { MarieCouncil, CouncilStrategy } from "./MarieCouncil.js";
import { AgentCoordination, AgentContext, AgentConflict, CoordinationResult, AgentPerformance } from "./AgentCoordination.js";
import { YoloTelemetry } from "./MarieCouncilTypes.js";

/**
 * Enhanced Agent Coordination with predictive capabilities and agent affinity scoring
 */
export interface AgentAffinity {
    agentPair: [string, string];
    compatibilityScore: number; // 0-1, how well they work together
    successfulCollaborations: number;
    conflictCount: number;
    avgCollaborationTime: number;
}

export interface PredictedConflict {
    agents: string[];
    predictedIssue: string;
    probability: number; // 0-1
    recommendedPrevention: string;
    historicalPrecedent?: {
        occurredAt: number;
        resolution: string;
    };
}

export interface ResourceContention {
    resource: string; // file path or module
    competingAgents: string[];
    contentionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedResolution: string;
}

/**
 * EnhancedAgentCoordination extends the base coordination with:
 * - Predictive conflict detection using historical patterns
 * - Agent affinity scoring (which agents work well together)
 * - Resource contention detection
 * - Smart timeout adjustment based on agent performance
 * - Collaboration recommendations
 */
export class EnhancedAgentCoordination extends AgentCoordination {
    private agentAffinities: Map<string, AgentAffinity> = new Map();
    private conflictHistory: Array<{
        timestamp: number;
        agents: string[];
        issue: string;
        resolution: string;
        success: boolean;
    }> = [];
    private resourceAccessLog: Map<string, Array<{ agent: string; timestamp: number; operation: string }>> = new Map();
    private collaborationOutcomes: Map<string, { success: boolean; duration: number; timestamp: number }[]> = new Map();
    private readonly MAX_HISTORY = 50;

    constructor(council: MarieCouncil) {
        super(council);
        this.loadHistoricalData();
    }

    /**
     * Predict conflicts before they occur based on historical patterns
     */
    public predictConflicts(agents: string[]): PredictedConflict[] {
        const predictions: PredictedConflict[] = [];

        // Check for historically conflicting agent pairs
        for (let i = 0; i < agents.length; i++) {
            for (let j = i + 1; j < agents.length; j++) {
                const pair = [agents[i], agents[j]].sort();
                const affinity = this.agentAffinities.get(pair.join('|'));

                if (affinity && affinity.conflictCount > 2) {
                    predictions.push({
                        agents: pair,
                        predictedIssue: `Historical conflict pattern detected between ${pair.join(' and ')}`,
                        probability: Math.min(0.9, affinity.conflictCount / 5),
                        recommendedPrevention: `Consider sequential execution or mediator agent`,
                        historicalPrecedent: this.findLastConflictBetween(pair[0], pair[1])
                    });
                }
            }
        }

        // Check for resource contention patterns
        const resourcePredictions = this.predictResourceContention(agents);
        predictions.push(...resourcePredictions);

        // Check for strategy divergence patterns
        const strategyPredictions = this.predictStrategyDivergence(agents);
        predictions.push(...strategyPredictions);

        return predictions.sort((a, b) => b.probability - a.probability);
    }

    /**
     * Detect resource contention between agents
     */
    public detectResourceContention(agents: string[]): ResourceContention[] {
        const contentions: ResourceContention[] = [];
        const recentAccesses = new Map<string, string[]>(); // resource -> agents

        const cutoff = Date.now() - 300000; // 5 minutes

        this.resourceAccessLog.forEach((accesses, resource) => {
            const recent = accesses.filter(a => a.timestamp > cutoff && agents.includes(a.agent));
            if (recent.length > 1) {
                const competingAgents = Array.from(new Set(recent.map(a => a.agent)));
                if (competingAgents.length > 1) {
                    recentAccesses.set(resource, competingAgents);
                }
            }
        });

        recentAccesses.forEach((competingAgents, resource) => {
            const level: 'LOW' | 'MEDIUM' | 'HIGH' =
                competingAgents.length > 2 ? 'HIGH' :
                    competingAgents.length > 1 ? 'MEDIUM' : 'LOW';

            contentions.push({
                resource,
                competingAgents,
                contentionLevel: level,
                suggestedResolution: level === 'HIGH'
                    ? `Sequential access recommended for ${resource}`
                    : `Coordinate access timing for ${resource}`
            });
        });

        return contentions;
    }

    /**
     * Record resource access for contention tracking
     */
    public recordResourceAccess(agent: string, resource: string, operation: string): void {
        const accesses = this.resourceAccessLog.get(resource) || [];
        accesses.push({ agent, timestamp: Date.now(), operation });

        // Keep only recent accesses
        const cutoff = Date.now() - 600000; // 10 minutes
        const filtered = accesses.filter(a => a.timestamp > cutoff);

        this.resourceAccessLog.set(resource, filtered);
    }

    /**
     * Get agent affinity score for a pair of agents
     */
    public getAgentAffinity(agent1: string, agent2: string): AgentAffinity {
        const pair = [agent1, agent2].sort().join('|');
        return this.agentAffinities.get(pair) || {
            agentPair: [agent1, agent2].sort() as [string, string],
            compatibilityScore: 0.5,
            successfulCollaborations: 0,
            conflictCount: 0,
            avgCollaborationTime: 0
        };
    }

    /**
     * Record collaboration outcome for affinity learning
     */
    public recordCollaborationOutcome(
        agents: string[],
        success: boolean,
        duration: number,
        conflictOccurred: boolean = false
    ): void {
        const pair = agents.slice().sort().join('|');
        let affinity = this.agentAffinities.get(pair);

        if (!affinity) {
            affinity = {
                agentPair: agents.slice().sort() as [string, string],
                compatibilityScore: 0.5,
                successfulCollaborations: 0,
                conflictCount: 0,
                avgCollaborationTime: 0
            };
        }

        // Update collaboration stats
        if (success) {
            affinity.successfulCollaborations++;
        }
        if (conflictOccurred) {
            affinity.conflictCount++;
        }

        // Update average collaboration time
        const totalCollabs = affinity.successfulCollaborations + affinity.conflictCount;
        affinity.avgCollaborationTime =
            (affinity.avgCollaborationTime * (totalCollabs - 1) + duration) / totalCollabs;

        // Recalculate compatibility score
        const successRate = totalCollabs > 0
            ? affinity.successfulCollaborations / totalCollabs
            : 0.5;
        const conflictRate = totalCollabs > 0
            ? affinity.conflictCount / totalCollabs
            : 0;

        affinity.compatibilityScore = Math.max(0.1, Math.min(0.9,
            successRate * 0.7 + (1 - conflictRate) * 0.3
        ));

        this.agentAffinities.set(pair, affinity);

        // Record for history
        const outcomes = this.collaborationOutcomes.get(pair) || [];
        outcomes.push({ success, duration, timestamp: Date.now() });
        if (outcomes.length > this.MAX_HISTORY) {
            outcomes.shift();
        }
        this.collaborationOutcomes.set(pair, outcomes);
    }

    /**
     * Get collaboration recommendations for a task
     */
    public getCollaborationRecommendations(taskAgents: string[]): {
        recommendedPairs: Array<{ agents: [string, string]; score: number; reason: string }>;
        avoidPairs: Array<{ agents: [string, string]; score: number; reason: string }>;
        optimalOrdering: string[];
    } {
        const recommendedPairs: Array<{ agents: [string, string]; score: number; reason: string }> = [];
        const avoidPairs: Array<{ agents: [string, string]; score: number; reason: string }> = [];

        for (let i = 0; i < taskAgents.length; i++) {
            for (let j = i + 1; j < taskAgents.length; j++) {
                const affinity = this.getAgentAffinity(taskAgents[i], taskAgents[j]);
                const pair: [string, string] = [taskAgents[i], taskAgents[j]];

                if (affinity.compatibilityScore > 0.7) {
                    recommendedPairs.push({
                        agents: pair,
                        score: affinity.compatibilityScore,
                        reason: `${affinity.successfulCollaborations} successful collaborations`
                    });
                } else if (affinity.compatibilityScore < 0.3 || affinity.conflictCount > 2) {
                    avoidPairs.push({
                        agents: pair,
                        score: affinity.compatibilityScore,
                        reason: `${affinity.conflictCount} historical conflicts`
                    });
                }
            }
        }

        // Sort by score
        recommendedPairs.sort((a, b) => b.score - a.score);
        avoidPairs.sort((a, b) => a.score - b.score);

        // Calculate optimal ordering based on affinities
        const optimalOrdering = this.calculateOptimalOrdering(taskAgents, avoidPairs);

        return { recommendedPairs, avoidPairs, optimalOrdering };
    }

    /**
     * Calculate smart timeout for an agent based on historical performance
     */
    public calculateSmartTimeout(agent: string, baseTimeout: number): number {
        const metrics = this.getAgentMetrics(agent);
        if (!metrics) return baseTimeout;

        // Adjust timeout based on success rate and average execution time
        const performanceMultiplier = metrics.successRate > 0.8 ? 0.9 :
            metrics.successRate < 0.4 ? 1.3 : 1.0;

        const speedMultiplier = metrics.avgExecutionTime > 0
            ? Math.min(1.5, Math.max(0.8, metrics.avgExecutionTime / 1000))
            : 1.0;

        return Math.round(baseTimeout * performanceMultiplier * speedMultiplier);
    }

    /**
     * Enhanced execution order calculation with affinity consideration
     */
    public calculateEnhancedExecutionOrder(agents: string[]): CoordinationResult & {
        predictions: PredictedConflict[];
        contentions: ResourceContention[];
        coordinationInsights: any;
    } {
        // Get base coordination result
        const baseResult = this.calculateExecutionOrder(agents);

        // Get predictions
        const predictions = this.predictConflicts(agents);

        // Get resource contentions
        const contentions = this.detectResourceContention(agents);

        // Get collaboration recommendations
        const collaboration = this.getCollaborationRecommendations(agents);

        // Calculate smart timeouts
        const timeouts: Record<string, number> = {};
        agents.forEach(agent => {
            timeouts[agent] = this.calculateSmartTimeout(agent, 30000); // 30s base
        });

        // Enhance parallel groups based on affinity
        const enhancedGroups = this.optimizeParallelGroups(
            baseResult.parallelGroups,
            collaboration.recommendedPairs,
            collaboration.avoidPairs
        );

        return {
            ...baseResult,
            parallelGroups: enhancedGroups,
            predictions,
            contentions,
            coordinationInsights: { collaboration, timeouts }
        };
    }

    /**
     * Record a resolved conflict for learning
     */
    public recordConflictResolution(
        agents: string[],
        issue: string,
        resolution: string,
        success: boolean
    ): void {
        this.conflictHistory.push({
            timestamp: Date.now(),
            agents: agents.slice().sort(),
            issue,
            resolution,
            success
        });

        // Keep history manageable
        if (this.conflictHistory.length > this.MAX_HISTORY) {
            this.conflictHistory.shift();
        }

        // Update affinity if conflict was between two agents
        if (agents.length === 2) {
            this.recordCollaborationOutcome(agents, success, 0, true);
        }
    }

    /**
     * Get coordination health metrics
     */
    public getCoordinationHealth(): {
        overallHealth: number; // 0-1
        avgAffinityScore: number;
        conflictRate: number;
        recentPredictionsAccuracy: number;
        recommendations: string[];
    } {
        const affinities = Array.from(this.agentAffinities.values());
        const avgAffinity = affinities.length > 0
            ? affinities.reduce((sum, a) => sum + a.compatibilityScore, 0) / affinities.length
            : 0.5;

        const recentConflicts = this.conflictHistory.filter(
            c => c.timestamp > Date.now() - 3600000 // Last hour
        );
        const conflictRate = recentConflicts.length / Math.max(1, this.conflictHistory.length);

        // Calculate prediction accuracy
        const recentAgents = Array.from(new Set(this.conflictHistory.flatMap(c => c.agents)));
        const recentPredictions = this.predictConflicts(recentAgents);
        const accuratePredictions = recentPredictions.filter(p =>
            this.conflictHistory.some(h =>
                p.agents.every(a => h.agents.includes(a)) &&
                h.timestamp > Date.now() - 3600000
            )
        );
        const predictionAccuracy = recentPredictions.length > 0
            ? accuratePredictions.length / recentPredictions.length
            : 0.5;

        const overallHealth = (avgAffinity * 0.4 + (1 - conflictRate) * 0.4 + predictionAccuracy * 0.2);

        const recommendations: string[] = [];
        if (avgAffinity < 0.5) {
            recommendations.push('Low agent affinity detected - consider team building strategies');
        }
        if (conflictRate > 0.3) {
            recommendations.push('High conflict rate - review agent interaction patterns');
        }
        if (predictionAccuracy < 0.5) {
            recommendations.push('Prediction accuracy low - more historical data needed');
        }

        return {
            overallHealth,
            avgAffinityScore: avgAffinity,
            conflictRate,
            recentPredictionsAccuracy: predictionAccuracy,
            recommendations
        };
    }

    // Private helper methods

    private predictResourceContention(agents: string[]): PredictedConflict[] {
        const predictions: PredictedConflict[] = [];
        const resourceUsage = new Map<string, string[]>();

        // Analyze recent resource access patterns
        this.resourceAccessLog.forEach((accesses, resource) => {
            const relevantAgents = accesses
                .filter(a => agents.includes(a.agent))
                .map(a => a.agent);

            if (relevantAgents.length > 1) {
                const uniqueAgents = Array.from(new Set(relevantAgents));
                resourceUsage.set(resource, uniqueAgents);
            }
        });

        resourceUsage.forEach((usedBy, resource) => {
            if (usedBy.length >= 2) {
                predictions.push({
                    agents: usedBy,
                    predictedIssue: `Likely contention on ${resource}`,
                    probability: Math.min(0.8, usedBy.length * 0.2),
                    recommendedPrevention: `Coordinate access to ${resource}`
                });
            }
        });

        return predictions;
    }

    private predictStrategyDivergence(agents: string[]): PredictedConflict[] {
        const predictions: PredictedConflict[] = [];

        // Check if agents have historically voted for different strategies
        const agentContexts = agents.map(a => this.getAgentContext(a));
        const strategies = new Map<CouncilStrategy, string[]>();

        agentContexts.forEach(ctx => {
            if (ctx) {
                const list = strategies.get(ctx.recommendedStrategy) || [];
                list.push(ctx.agent);
                strategies.set(ctx.recommendedStrategy, list);
            }
        });

        if (strategies.size >= 3) {
            predictions.push({
                agents,
                predictedIssue: 'Multiple divergent strategies detected',
                probability: 0.6,
                recommendedPrevention: 'Align agents on common strategy before execution'
            });
        }

        return predictions;
    }

    private getAgentContext(agent: string): AgentContext | undefined {
        // Access parent class's private field through any cast
        return (this as any).agentContexts?.get(agent);
    }

    private getAgentMetrics(agent: string): AgentPerformance | undefined {
        // Access parent class's private field through any cast
        return (this as any).performanceHistory?.get(agent);
    }

    private findLastConflictBetween(agent1: string, agent2: string): {
        occurredAt: number;
        resolution: string;
    } | undefined {
        const sorted = [agent1, agent2].sort();
        const conflict = this.conflictHistory
            .filter(c =>
                c.agents.length === 2 &&
                c.agents[0] === sorted[0] &&
                c.agents[1] === sorted[1]
            )
            .pop();

        return conflict ? {
            occurredAt: conflict.timestamp,
            resolution: conflict.resolution
        } : undefined;
    }

    private calculateOptimalOrdering(
        agents: string[],
        avoidPairs: Array<{ agents: [string, string]; score: number; reason: string }>
    ): string[] {
        const avoidSet = new Set(
            avoidPairs.flatMap(p => [`${p.agents[0]}|${p.agents[1]}`, `${p.agents[1]}|${p.agents[0]}`])
        );

        // Simple greedy ordering: place conflicting agents far apart
        const ordered: string[] = [];
        const remaining = new Set(agents);

        while (remaining.size > 0) {
            let bestAgent: string | null = null;
            let bestScore = -Infinity;

            // Convert Set to Array for iteration
            Array.from(remaining).forEach(agent => {
                let score = 0;
                ordered.forEach((placed, index) => {
                    const pair = [agent, placed].sort().join('|');
                    if (avoidSet.has(pair)) {
                        // Prefer placing far from conflicting agents
                        score += index;
                    }
                });

                if (score > bestScore) {
                    bestScore = score;
                    bestAgent = agent;
                }
            });

            if (bestAgent) {
                ordered.push(bestAgent);
                remaining.delete(bestAgent);
            } else {
                // Fallback: just take any remaining
                const next = Array.from(remaining)[0];
                if (next) {
                    ordered.push(next);
                    remaining.delete(next);
                }
            }
        }

        return ordered;
    }

    private optimizeParallelGroups(
        groups: string[][],
        recommendedPairs: Array<{ agents: [string, string]; score: number; reason: string }>,
        avoidPairs: Array<{ agents: [string, string]; score: number; reason: string }>
    ): string[][] {
        const recommendedSet = new Set(
            recommendedPairs.map(p => p.agents.slice().sort().join('|'))
        );
        const avoidSet = new Set(
            avoidPairs.map(p => p.agents.slice().sort().join('|'))
        );

        // Try to keep recommended pairs together and avoid pairs separate
        return groups.map(group => {
            // Sort within group to keep compatible agents adjacent
            return group.sort((a, b) => {
                const pair = [a, b].sort().join('|');
                if (recommendedSet.has(pair)) return -1;
                if (avoidSet.has(pair)) return 1;
                return 0;
            });
        });
    }

    private loadHistoricalData(): void {
        try {
            // Load agent performance data from MarieMemoryStore
            const council = (this as any).council;
            const saved = council?.state?.memory?.agentPerformance;
            if (!saved) return;

            // Restore agent affinities
            if (saved.agentAffinities) {
                for (const [pair, affinity] of Object.entries(saved.agentAffinities)) {
                    this.agentAffinities.set(pair, affinity as AgentAffinity);
                }
            }

            // Restore conflict history
            if (saved.conflictHistory) {
                this.conflictHistory = saved.conflictHistory;
            }

            // Restore collaboration outcomes
            if (saved.collaborationOutcomes) {
                for (const [pair, outcomes] of Object.entries(saved.collaborationOutcomes)) {
                    this.collaborationOutcomes.set(pair, outcomes as any[]);
                }
            }

            // Restore resource access log
            if (saved.resourceAccessLog) {
                for (const [resource, accesses] of Object.entries(saved.resourceAccessLog)) {
                    this.resourceAccessLog.set(resource, accesses as any[]);
                }
            }
        } catch (error) {
            console.warn('[EnhancedAgentCoordination] Failed to load historical data:', error);
        }
    }

    /**
     * Persist coordination data to MarieMemoryStore
     */
    public persistHistoricalData(): void {
        try {
            const data = {
                agentAffinities: Object.fromEntries(this.agentAffinities),
                conflictHistory: this.conflictHistory.slice(-this.MAX_HISTORY),
                collaborationOutcomes: Object.fromEntries(this.collaborationOutcomes),
                resourceAccessLog: Object.fromEntries(this.resourceAccessLog)
            };

            // Write to council blackboard for persistence
            const council = (this as any).council;
            council?.blackboard?.write('coordination:historicalData', data);
        } catch (error) {
            console.warn('[EnhancedAgentCoordination] Failed to persist historical data:', error);
        }
    }
}

export default EnhancedAgentCoordination;
