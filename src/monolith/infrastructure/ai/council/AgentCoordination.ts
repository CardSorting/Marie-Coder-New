import { MarieCouncil, CouncilStrategy } from "./MarieCouncil.js";
import { CouncilVote, YoloTelemetry } from "./MarieCouncilTypes.js";

/**
 * Enhanced Agent Coordination System
 * 
 * Provides sophisticated cross-agent communication, dynamic prioritization,
 * and conflict resolution mechanisms for the Marie Swarm.
 */

export interface AgentContext {
    agent: string;
    priority: number;
    dependencies: string[];
    blockingIssues: string[];
    estimatedComplexity: number;
    recommendedStrategy: CouncilStrategy;
}

export interface CoordinationResult {
    executionOrder: string[];
    parallelGroups: string[][];
    conflicts: AgentConflict[];
    recommendations: string[];
}

export interface AgentConflict {
    agents: string[];
    issue: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    resolution?: string;
}

export interface AgentPerformance {
    agent: string;
    successRate: number;
    avgExecutionTime: number;
    totalCalls: number;
    accuracyDelta: number; // vs expected
}

/**
 * AgentCoordination manages the complex interactions between swarm agents,
 * enabling dynamic task allocation, conflict resolution, and performance optimization.
 */
export class AgentCoordination {
    private agentContexts: Map<string, AgentContext> = new Map();
    private performanceHistory: Map<string, AgentPerformance> = new Map();
    private coordinationLog: Array<{ timestamp: number; event: string; agents: string[] }> = [];
    private yoloGuidance: YoloTelemetry | undefined;

    constructor(private council: MarieCouncil) { }

    /**
     * Register an agent's context before execution
     */
    public registerAgentContext(agent: string, context: Partial<AgentContext>): void {
        const existing = this.agentContexts.get(agent) || {
            agent,
            priority: 1.0,
            dependencies: [],
            blockingIssues: [],
            estimatedComplexity: 1,
            recommendedStrategy: 'EXECUTE'
        };

        this.agentContexts.set(agent, { ...existing, ...context, agent });
    }

    /**
     * Update YOLO's guidance for agent coordination
     */
    public updateYOLOGuidance(guidance: YoloTelemetry): void {
        this.yoloGuidance = guidance;
        this.applyYOLOPrioritization();
    }

    /**
     * Apply YOLO's strategic guidance to agent prioritization
     */
    private applyYOLOPrioritization(): void {
        if (!this.yoloGuidance) return;

        const { strategy, confidence, urgency } = this.yoloGuidance;
        const priorityMultiplier = confidence * (urgency === 'HIGH' ? 1.5 : urgency === 'MEDIUM' ? 1.2 : 1.0);

        // Adjust agent priorities based on YOLO's strategy
        this.agentContexts.forEach((context, agent) => {
            let strategyAlignment = 1.0;

            // Agents that align with YOLO's strategy get priority boost
            switch (strategy) {
                case 'HYPE':
                    if (agent === 'YOLO' || agent === 'Strategist') strategyAlignment = 1.5;
                    if (agent === 'Auditor' || agent === 'QASRE') strategyAlignment = 0.8;
                    break;
                case 'DEBUG':
                    if (agent === 'Auditor' || agent === 'QASRE') strategyAlignment = 1.5;
                    if (agent === 'YOLO') strategyAlignment = 0.9; // YOLO still leads but adapts
                    break;
                case 'RESEARCH':
                    if (agent === 'Strategist' || agent === 'ISO9001') strategyAlignment = 1.4;
                    break;
                case 'EXECUTE':
                    strategyAlignment = 1.0; // Balanced
                    break;
            }

            context.priority = Math.min(3.0, context.priority * priorityMultiplier * strategyAlignment);
            this.agentContexts.set(agent, context);
        });

        this.logCoordinationEvent('YOLO_PRIORITIZATION_APPLIED', Array.from(this.agentContexts.keys()));
    }

    /**
     * Detect and resolve conflicts between agents
     */
    public detectConflicts(): AgentConflict[] {
        const conflicts: AgentConflict[] = [];
        const contexts = Array.from(this.agentContexts.values());

        // Check for strategy conflicts
        const strategyVotes = new Map<CouncilStrategy, string[]>();
        for (const ctx of contexts) {
            const agents = strategyVotes.get(ctx.recommendedStrategy) || [];
            agents.push(ctx.agent);
            strategyVotes.set(ctx.recommendedStrategy, agents);
        }

        // Detect divergent strategies (high entropy)
        if (strategyVotes.size >= 3) {
            const agents = contexts.map(c => c.agent);
            conflicts.push({
                agents,
                issue: `Divergent strategies: ${Array.from(strategyVotes.keys()).join(', ')}`,
                severity: 'HIGH',
                resolution: this.yoloGuidance && this.yoloGuidance.confidence >= 2.0
                    ? `Defer to YOLO's ${this.yoloGuidance.strategy} strategy`
                    : 'Force RESEARCH to realign'
            });
        }

        // Check for dependency conflicts (circular dependencies)
        for (const ctx of contexts) {
            for (const dep of ctx.dependencies) {
                const depCtx = this.agentContexts.get(dep);
                if (depCtx && depCtx.dependencies.includes(ctx.agent)) {
                    conflicts.push({
                        agents: [ctx.agent, dep],
                        issue: 'Circular dependency detected',
                        severity: 'CRITICAL',
                        resolution: 'Break cycle via blackboard-mediated coordination'
                    });
                }
            }
        }

        // Check for resource contention (same files being accessed)
        const fileAccessMap = new Map<string, string[]>();
        // This would be populated by the swarm during execution

        return conflicts;
    }

    /**
     * Resolve conflicts using YOLO-guided arbitration
     */
    public resolveConflicts(conflicts: AgentConflict[]): void {
        for (const conflict of conflicts) {
            // YOLO-guided resolution for high-confidence scenarios
            if (this.yoloGuidance && this.yoloGuidance.confidence >= 2.5) {
                // Override conflicting agents with YOLO's direction
                for (const agent of conflict.agents) {
                    const ctx = this.agentContexts.get(agent);
                    if (ctx && agent !== 'YOLO') {
                        ctx.recommendedStrategy = this.yoloGuidance!.strategy;
                        ctx.priority = Math.min(ctx.priority, 1.0); // Deprioritize conflicting agents
                        this.agentContexts.set(agent, ctx);
                    }
                }
                conflict.resolution = `YOLO arbitration: Following ${this.yoloGuidance.strategy} strategy`;
            } else {
                // Default resolution: escalate to RESEARCH
                for (const agent of conflict.agents) {
                    const ctx = this.agentContexts.get(agent);
                    if (ctx) {
                        ctx.recommendedStrategy = 'RESEARCH';
                        this.agentContexts.set(agent, ctx);
                    }
                }
                if (!conflict.resolution) {
                    conflict.resolution = 'Forced RESEARCH to resolve conflict';
                }
            }
        }
    }

    /**
     * Calculate optimal execution order for agents
     */
    public calculateExecutionOrder(agents: string[]): CoordinationResult {
        // Build dependency graph
        const graph = new Map<string, Set<string>>();
        const priorities = new Map<string, number>();

        for (const agent of agents) {
            const ctx = this.agentContexts.get(agent);
            if (ctx) {
                graph.set(agent, new Set(ctx.dependencies));
                priorities.set(agent, ctx.priority);
            } else {
                graph.set(agent, new Set());
                priorities.set(agent, 1.0);
            }
        }

        // Topological sort with priority weighting
        const visited = new Set<string>();
        const executionOrder: string[] = [];
        const parallelGroups: string[][] = [];

        // Kahn's algorithm with priority
        const inDegree = new Map<string, number>();
        graph.forEach((deps, agent) => {
            inDegree.set(agent, deps.size);
        });

        // Process agents with no dependencies first
        let currentGroup: string[] = [];
        const queue = Array.from(graph.keys())
            .filter(a => (inDegree.get(a) || 0) === 0)
            .sort((a, b) => (priorities.get(b) || 1) - (priorities.get(a) || 1));

        while (queue.length > 0) {
            const agent = queue.shift()!;
            if (visited.has(agent)) continue;

            visited.add(agent);
            executionOrder.push(agent);
            currentGroup.push(agent);

            // Check if we can parallelize with next agent
            const nextInQueue = queue[0];
            if (nextInQueue) {
                const nextCtx = this.agentContexts.get(nextInQueue);
                const currentCtx = this.agentContexts.get(agent);

                // Can parallelize if no shared dependencies and similar priority
                const canParallelize = !nextCtx?.dependencies.includes(agent) &&
                    !currentCtx?.dependencies.includes(nextInQueue) &&
                    Math.abs((priorities.get(agent) || 1) - (priorities.get(nextInQueue) || 1)) < 0.5;

                if (!canParallelize && currentGroup.length > 0) {
                    parallelGroups.push([...currentGroup]);
                    currentGroup = [];
                }
            }

            // Update in-degrees
            graph.forEach((deps, otherAgent) => {
                if (deps.has(agent)) {
                    const newDegree = (inDegree.get(otherAgent) || 1) - 1;
                    inDegree.set(otherAgent, newDegree);
                    if (newDegree === 0 && !visited.has(otherAgent)) {
                        // Insert in priority order
                        const priority = priorities.get(otherAgent) || 1;
                        const insertIndex = queue.findIndex(a => (priorities.get(a) || 1) < priority);
                        if (insertIndex === -1) {
                            queue.push(otherAgent);
                        } else {
                            queue.splice(insertIndex, 0, otherAgent);
                        }
                    }
                }
            });
        }

        if (currentGroup.length > 0) {
            parallelGroups.push(currentGroup);
        }

        const conflicts = this.detectConflicts();
        this.resolveConflicts(conflicts);

        return {
            executionOrder,
            parallelGroups,
            conflicts,
            recommendations: this.generateRecommendations(agents, conflicts)
        };
    }

    /**
     * Generate coordination recommendations based on current state
     */
    private generateRecommendations(agents: string[], conflicts: AgentConflict[]): string[] {
        const recommendations: string[] = [];

        if (conflicts.length > 0) {
            recommendations.push(`Resolve ${conflicts.length} agent conflict(s) before proceeding`);
        }

        const highPriorityAgents = agents.filter(a => {
            const ctx = this.agentContexts.get(a);
            return ctx && ctx.priority >= 2.0;
        });

        if (highPriorityAgents.length > 0) {
            recommendations.push(`Prioritize: ${highPriorityAgents.join(', ')}`);
        }

        if (this.yoloGuidance) {
            recommendations.push(`YOLO guidance: ${this.yoloGuidance.strategy} @ ${this.yoloGuidance.confidence.toFixed(2)} confidence`);
        }

        // Check for performance issues
        this.performanceHistory.forEach((perf, agent) => {
            if (perf.successRate < 0.5 && perf.totalCalls > 5) {
                recommendations.push(`${agent} has low success rate (${(perf.successRate * 100).toFixed(0)}%) - consider deprioritizing`);
            }
        });

        return recommendations;
    }

    /**
     * Record agent performance for adaptive coordination
     */
    public recordAgentPerformance(agent: string, success: boolean, durationMs: number): void {
        const existing = this.performanceHistory.get(agent) || {
            agent,
            successRate: 0.5,
            avgExecutionTime: 0,
            totalCalls: 0,
            accuracyDelta: 0
        };

        existing.totalCalls++;
        const successWeight = 0.3; // EMA factor
        existing.successRate = (existing.successRate * (1 - successWeight)) + (success ? 1 : 0) * successWeight;
        existing.avgExecutionTime = (existing.avgExecutionTime * (existing.totalCalls - 1) + durationMs) / existing.totalCalls;

        this.performanceHistory.set(agent, existing);

        // Adapt agent weights based on performance
        this.adaptAgentWeights(agent, existing);
    }

    /**
     * Adapt coordination weights based on agent performance
     */
    private adaptAgentWeights(agent: string, performance: AgentPerformance): void {
        const ctx = this.agentContexts.get(agent);
        if (!ctx) return;

        // Adjust priority based on success rate
        if (performance.successRate > 0.8 && performance.totalCalls > 3) {
            ctx.priority = Math.min(3.0, ctx.priority * 1.1); // Boost high performers
        } else if (performance.successRate < 0.4 && performance.totalCalls > 3) {
            ctx.priority = Math.max(0.5, ctx.priority * 0.9); // Reduce low performers
        }

        this.agentContexts.set(agent, ctx);
    }

    /**
     * Share context between agents via the council blackboard
     */
    public shareContext(sourceAgent: string, targetAgents: string[], key: string, value: any): void {
        const sharedKey = `coordination:${sourceAgent}:${key}`;
        this.council.blackboard.write(sharedKey, {
            value,
            timestamp: Date.now(),
            source: sourceAgent,
            targets: targetAgents
        });

        // Notify target agents
        for (const target of targetAgents) {
            const targetCtx = this.agentContexts.get(target);
            if (targetCtx && !targetCtx.dependencies.includes(sourceAgent)) {
                targetCtx.dependencies.push(sourceAgent);
                this.agentContexts.set(target, targetCtx);
            }
        }

        this.logCoordinationEvent('CONTEXT_SHARED', [sourceAgent, ...targetAgents]);
    }

    /**
     * Get shared context for an agent
     */
    public getSharedContext(agent: string): Record<string, any> {
        const context: Record<string, any> = {};
        const allNotes = this.council.blackboard.notes;

        for (const [key, value] of Object.entries(allNotes)) {
            if (key.startsWith('coordination:') && typeof value === 'object') {
                const coordData = value as { targets?: string[]; value: any; timestamp: number };
                if (coordData.targets?.includes(agent)) {
                    context[key] = coordData.value;
                }
            }
        }

        return context;
    }

    /**
     * Get coordination metrics for monitoring
     */
    public getMetrics(): {
        activeAgents: number;
        conflictsDetected: number;
        avgAgentPriority: number;
        yoloGuidanceActive: boolean;
        performanceStats: AgentPerformance[];
    } {
        const contexts = Array.from(this.agentContexts.values());
        const avgPriority = contexts.reduce((sum, c) => sum + c.priority, 0) / Math.max(1, contexts.length);

        return {
            activeAgents: contexts.length,
            conflictsDetected: this.detectConflicts().length,
            avgAgentPriority: avgPriority,
            yoloGuidanceActive: !!this.yoloGuidance && this.yoloGuidance.confidence >= 2.0,
            performanceStats: Array.from(this.performanceHistory.values())
        };
    }

    /**
     * Clear coordination state for a new turn
     */
    public clearTurnState(): void {
        this.agentContexts.clear();
        this.coordinationLog.push({
            timestamp: Date.now(),
            event: 'TURN_CLEARED',
            agents: []
        });

        // Keep only last 100 log entries
        if (this.coordinationLog.length > 100) {
            this.coordinationLog = this.coordinationLog.slice(-100);
        }
    }

    private logCoordinationEvent(event: string, agents: string[]): void {
        this.coordinationLog.push({
            timestamp: Date.now(),
            event,
            agents
        });
    }

    /**
     * Get the full coordination log for debugging
     */
    public getCoordinationLog(): Array<{ timestamp: number; event: string; agents: string[] }> {
        return [...this.coordinationLog];
    }
}
