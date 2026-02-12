import { MarieCouncil, CouncilStrategy, CouncilMood } from "./MarieCouncil.js";
import { YoloTelemetry, CouncilVote } from "./MarieCouncilTypes.js";
import { MarieProgressTracker } from "../core/MarieProgressTracker.js";
import { YOLOCouncilIntegration, YOLOInfluenceMetrics } from "./YOLOCouncilIntegration.js";

/**
 * VetoOutcome tracks the result of a YOLO veto
 */
export interface VetoOutcome {
    timestamp: number;
    originalStrategy: CouncilStrategy;
    yoloStrategy: CouncilStrategy;
    vetoSuccessful: boolean; // Did YOLO's override lead to success?
    councilAlignmentBefore: number;
    yoloConviction: number;
    context: string;
}

/**
 * ConvictionMomentum tracks the trajectory of YOLO's confidence
 */
export interface ConvictionMomentum {
    current: number;
    trend: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
    volatility: number; // Standard deviation of recent convictions
    momentumScore: number; // -1 to 1, negative means declining confidence
}

/**
 * StrategicAlignment measures how well the council aligns with YOLO's vision
 */
export interface StrategicAlignment {
    overallAlignment: number; // 0-1
    agentAlignments: Record<string, number>; // per-agent alignment
    alignmentTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    consensusStrength: number; // 0-1, how unified the council is
}

/**
 * AdvancedYOLOIntegration extends the base YOLO-Council integration with:
 * - Strategic consensus alignment scoring
 * - Conviction momentum tracking
 * - Veto success analytics
 * - Dynamic mood influence propagation
 * - Rollback detection
 */
export interface VetoAnalytics {
    totalVetoes: number;
    successRate: number;
    avgConvictionAtVeto: number;
    bestVetoContext: string;
    recommendation: string;
}

export class AdvancedYOLOIntegration {
    private vetoOutcomes: VetoOutcome[] = [];
    private convictionHistory: Array<{ timestamp: number; conviction: number; strategy: CouncilStrategy }> = [];
    private alignmentHistory: StrategicAlignment[] = [];
    private readonly MAX_HISTORY = 30;

    // Mood influence intensity based on conviction
    private moodInfluenceIntensity: number = 0.5; // 0-1

    // Base integration for delegation
    private baseIntegration: YOLOCouncilIntegration;

    constructor(private council: MarieCouncil) {
        this.baseIntegration = new YOLOCouncilIntegration(council);
    }

    /**
     * Process YOLO decision with advanced analytics
     */
    public processYOLODecision(
        decision: YoloTelemetry,
        tracker?: MarieProgressTracker
    ): YOLOInfluenceMetrics & {
        momentum: ConvictionMomentum;
        alignment: StrategicAlignment;
        moodImpact: string;
    } {
        // Update conviction history
        this.updateConvictionHistory(decision);

        // Calculate momentum
        const momentum = this.calculateConvictionMomentum();

        // Calculate strategic alignment
        const alignment = this.calculateStrategicAlignment(decision);

        // Apply mood influence
        const moodImpact = this.applyMoodInfluence(decision, momentum);

        // Call base implementation
        const baseMetrics = this.baseIntegration.processYOLODecision(decision, tracker);

        // Record alignment for trend analysis
        this.alignmentHistory.push(alignment);
        if (this.alignmentHistory.length > this.MAX_HISTORY) {
            this.alignmentHistory.shift();
        }

        return {
            ...baseMetrics,
            momentum,
            alignment,
            moodImpact
        };
    }

    /**
     * Record the outcome of a veto for learning
     */
    public recordVetoOutcome(
        originalStrategy: CouncilStrategy,
        yoloStrategy: CouncilStrategy,
        success: boolean,
        context: string
    ): void {
        const yoloDecision = this.council.getLastYoloDecision();
        if (!yoloDecision) return;

        const outcome: VetoOutcome = {
            timestamp: Date.now(),
            originalStrategy,
            yoloStrategy,
            vetoSuccessful: success,
            councilAlignmentBefore: this.calculateCurrentAlignment(),
            yoloConviction: yoloDecision.confidence,
            context
        };

        this.vetoOutcomes.push(outcome);
        if (this.vetoOutcomes.length > this.MAX_HISTORY) {
            this.vetoOutcomes.shift();
        }

        // Update mood influence intensity based on veto success rate
        this.updateMoodInfluenceIntensity();
    }

    /**
     * Get veto analytics for strategic improvement
     */
    public getVetoAnalytics(): VetoAnalytics {
        const totalVetoes = this.vetoOutcomes.length;
        if (totalVetoes === 0) {
            return {
                totalVetoes: 0,
                successRate: 0,
                avgConvictionAtVeto: 0,
                bestVetoContext: 'N/A',
                recommendation: 'No veto history available'
            };
        }

        const successfulVetoes = this.vetoOutcomes.filter(v => v.vetoSuccessful);
        const successRate = successfulVetoes.length / totalVetoes;
        const avgConviction = this.vetoOutcomes.reduce((sum, v) => sum + v.yoloConviction, 0) / totalVetoes;

        // Find best context
        const contextSuccess = new Map<string, { attempts: number; successes: number }>();
        this.vetoOutcomes.forEach(v => {
            const stats = contextSuccess.get(v.context) || { attempts: 0, successes: 0 };
            stats.attempts++;
            if (v.vetoSuccessful) stats.successes++;
            contextSuccess.set(v.context, stats);
        });

        let bestContext = 'N/A';
        let bestContextRate = 0;
        contextSuccess.forEach((stats, context) => {
            const rate = stats.successes / stats.attempts;
            if (rate > bestContextRate) {
                bestContextRate = rate;
                bestContext = context;
            }
        });

        const recommendation = successRate > 0.7
            ? 'YOLO vetoes are highly effective - maintain current thresholds'
            : successRate > 0.4
                ? 'YOLO vetoes are moderately effective - consider context adjustments'
                : 'YOLO vetoes need review - may indicate misalignment';

        return {
            totalVetoes,
            successRate,
            avgConvictionAtVeto: avgConviction,
            bestVetoContext: bestContext,
            recommendation
        };
    }

    /**
     * Check if YOLO should veto with enhanced context awareness
     */
    public shouldVetoWithContext(
        proposedStrategy: CouncilStrategy,
        yoloDecision: YoloTelemetry,
        contextFactors: {
            recentSuccessRate: number;
            currentEntropy: number;
            councilAlignment: number;
        }
    ): { veto: boolean; reason?: string; confidence: number } {
        // Base veto decision from base integration
        const baseResult = this.baseIntegration.shouldVetoCouncilDecision(proposedStrategy, yoloDecision);

        // Enhance with context factors
        let confidence = yoloDecision.confidence;

        // Adjust confidence based on context
        if (contextFactors.recentSuccessRate < 0.3) {
            // Low success rate - be more cautious about overriding
            confidence *= 0.9;
        }

        if (contextFactors.currentEntropy > 80) {
            // High entropy - YOLO can provide needed direction
            confidence *= 1.1;
        }

        if (contextFactors.councilAlignment < 0.3) {
            // Council is fractured - YOLO's guidance is valuable
            confidence *= 1.15;
        }

        // Clamp confidence
        confidence = Math.min(3.0, Math.max(0, confidence));

        // Require higher threshold for veto when context is unclear
        const vetoThreshold = contextFactors.recentSuccessRate < 0.3 ? 2.8 : 2.7;

        if (baseResult.veto && confidence >= vetoThreshold) {
            return {
                veto: true,
                reason: baseResult.reason,
                confidence
            };
        }

        return { veto: false, confidence };
    }

    /**
     * Detect if a strategic rollback is needed based on conviction momentum
     */
    public detectRollbackNeeded(currentStrategy: CouncilStrategy): {
        rollbackNeeded: boolean;
        reason?: string;
        suggestedStrategy: CouncilStrategy;
    } {
        const momentum = this.calculateConvictionMomentum();

        // If conviction is decelerating rapidly and we're in an aggressive strategy
        if (momentum.momentumScore < -0.5 &&
            (currentStrategy === 'HYPE' || currentStrategy === 'EXECUTE')) {
            return {
                rollbackNeeded: true,
                reason: `Conviction decelerating (${momentum.momentumScore.toFixed(2)}) - rolling back from ${currentStrategy}`,
                suggestedStrategy: 'DEBUG'
            };
        }

        // If conviction is accelerating and we're in a conservative strategy
        if (momentum.momentumScore > 0.5 && currentStrategy === 'RESEARCH') {
            return {
                rollbackNeeded: true,
                reason: `Conviction accelerating (${momentum.momentumScore.toFixed(2)}) - moving from RESEARCH to EXECUTE`,
                suggestedStrategy: 'EXECUTE'
            };
        }

        return { rollbackNeeded: false, suggestedStrategy: currentStrategy };
    }

    /**
     * Get comprehensive YOLO analytics
     */
    public getAdvancedAnalytics(): {
        convictionMomentum: ConvictionMomentum;
        strategicAlignment: StrategicAlignment;
        vetoAnalytics: VetoAnalytics;
        moodInfluenceIntensity: number;
        recommendations: string[];
    } {
        const momentum = this.calculateConvictionMomentum();
        const alignment = this.getLatestAlignment();
        const vetoAnalytics = this.getVetoAnalytics();

        const recommendations: string[] = [];

        if (momentum.trend === 'DECELERATING' && momentum.momentumScore < -0.3) {
            recommendations.push('YOLO confidence declining - consider more conservative strategies');
        }

        if (alignment.overallAlignment < 0.4) {
            recommendations.push('Low council alignment - YOLO should communicate vision more clearly');
        }

        if (vetoAnalytics.successRate < 0.5 && vetoAnalytics.totalVetoes > 3) {
            recommendations.push('YOLO vetoes underperforming - review override criteria');
        }

        if (momentum.volatility > 0.5) {
            recommendations.push('High conviction volatility - consider smoothing strategies');
        }

        return {
            convictionMomentum: momentum,
            strategicAlignment: alignment,
            vetoAnalytics,
            moodInfluenceIntensity: this.moodInfluenceIntensity,
            recommendations
        };
    }

    // Private helper methods

    private updateConvictionHistory(decision: YoloTelemetry): void {
        this.convictionHistory.push({
            timestamp: Date.now(),
            conviction: decision.confidence,
            strategy: decision.strategy
        });

        if (this.convictionHistory.length > this.MAX_HISTORY) {
            this.convictionHistory.shift();
        }
    }

    private calculateConvictionMomentum(): ConvictionMomentum {
        if (this.convictionHistory.length < 3) {
            return {
                current: this.convictionHistory[this.convictionHistory.length - 1]?.conviction || 1.5,
                trend: 'STABLE',
                volatility: 0,
                momentumScore: 0
            };
        }

        const recent = this.convictionHistory.slice(-5);
        const convictions = recent.map(h => h.conviction);

        // Calculate trend using linear regression slope
        const n = convictions.length;
        const sumX = convictions.reduce((sum, _, i) => sum + i, 0);
        const sumY = convictions.reduce((sum, c) => sum + c, 0);
        const sumXY = convictions.reduce((sum, c, i) => sum + i * c, 0);
        const sumXX = convictions.reduce((sum, _, i) => sum + i * i, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        // Calculate volatility (standard deviation)
        const mean = sumY / n;
        const variance = convictions.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / n;
        const volatility = Math.sqrt(variance);

        // Determine trend
        let trend: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
        if (slope > 0.1) trend = 'ACCELERATING';
        else if (slope < -0.1) trend = 'DECELERATING';
        else trend = 'STABLE';

        // Calculate momentum score (-1 to 1)
        const momentumScore = Math.max(-1, Math.min(1, slope * 2));

        return {
            current: convictions[convictions.length - 1],
            trend,
            volatility,
            momentumScore
        };
    }

    private calculateStrategicAlignment(yoloDecision: YoloTelemetry): StrategicAlignment {
        // Access vote history through council state
        const council = (this as any).council as MarieCouncil;
        const recentVotes = (council as any).state?.getRecentVotes(20) || [];

        // Calculate alignment based on how often each agent agrees with YOLO
        const agentVotes: Record<string, { total: number; matches: number }> = {};

        // Group votes by agent and count matches with YOLO
        for (let i = 0; i < recentVotes.length; i++) {
            const vote = recentVotes[i];
            if (!vote) continue;

            const agent = vote.agent;
            if (!agentVotes[agent]) {
                agentVotes[agent] = { total: 0, matches: 0 };
            }

            agentVotes[agent].total++;

            // Check if this vote matches YOLO's strategy
            // For YOLO itself, always count as aligned
            if (agent === 'YOLO') {
                agentVotes[agent].matches++;
            } else {
                // Find the most recent YOLO vote before this vote
                for (let j = i + 1; j < recentVotes.length; j++) {
                    const yoloVote = recentVotes[j];
                    if (yoloVote?.agent === 'YOLO') {
                        if (vote.strategy === yoloVote.strategy) {
                            agentVotes[agent].matches++;
                        }
                        break;
                    }
                }
            }
        }

        // Calculate alignment scores (0-1)
        const agentAlignments: Record<string, number> = {
            'YOLO': 1.0 // YOLO is always perfectly aligned with itself
        };

        for (const [agent, stats] of Object.entries(agentVotes)) {
            if (agent !== 'YOLO' && stats.total > 0) {
                // Base alignment on match rate
                const matchRate = stats.matches / stats.total;
                // Boost alignment for agents with more votes (more confidence)
                const confidenceBoost = Math.min(0.1, stats.total / 50);
                agentAlignments[agent] = Math.min(1, matchRate + confidenceBoost);
            }
        }

        // Ensure all agents have an alignment value
        const allAgents = ['Strategist', 'Auditor', 'QASRE', 'ISO9001'];
        for (const agent of allAgents) {
            if (!(agent in agentAlignments)) {
                // Default to neutral alignment for agents with no votes
                agentAlignments[agent] = 0.5;
            }
        }

        const alignmentValues = Object.values(agentAlignments);
        const overallAlignment = alignmentValues.reduce((a, b) => a + b, 0) / alignmentValues.length;

        // Calculate consensus strength (lower variance = higher consensus)
        const mean = overallAlignment;
        const variance = alignmentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / alignmentValues.length;
        const consensusStrength = 1 - Math.min(1, variance * 4);

        // Determine trend
        let alignmentTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
        if (this.alignmentHistory.length > 0) {
            const previous = this.alignmentHistory[this.alignmentHistory.length - 1];
            const delta = overallAlignment - previous.overallAlignment;
            if (delta > 0.1) alignmentTrend = 'IMPROVING';
            else if (delta < -0.1) alignmentTrend = 'DECLINING';
        }

        return {
            overallAlignment,
            agentAlignments,
            alignmentTrend,
            consensusStrength
        };
    }

    private getLatestAlignment(): StrategicAlignment {
        if (this.alignmentHistory.length > 0) {
            return this.alignmentHistory[this.alignmentHistory.length - 1];
        }

        // Return default if no history
        const yoloDecision = this.council.getLastYoloDecision();
        return this.calculateStrategicAlignment(yoloDecision || {
            profile: 'balanced',
            strategy: 'EXECUTE',
            confidence: 1.5,
            urgency: 'MEDIUM',
            dampened: false,
            structuralUncertainty: false,
            requiredActions: [],
            blockedBy: [],
            stopCondition: 'landed',
            timestamp: Date.now()
        });
    }

    private calculateCurrentAlignment(): number {
        const latest = this.getLatestAlignment();
        return latest.overallAlignment;
    }

    private applyMoodInfluence(decision: YoloTelemetry, momentum: ConvictionMomentum): string {
        // Calculate mood influence intensity based on conviction and momentum
        let influenceIntensity = decision.confidence / 3.0; // 0-1 based on confidence

        // Boost influence if momentum is accelerating
        if (momentum.trend === 'ACCELERATING') {
            influenceIntensity *= 1.2;
        }

        // Reduce influence if momentum is decelerating
        if (momentum.trend === 'DECELERATING') {
            influenceIntensity *= 0.8;
        }

        this.moodInfluenceIntensity = Math.min(1, influenceIntensity);

        // Apply mood based on strategy and conviction
        let targetMood: CouncilMood;
        switch (decision.strategy) {
            case 'HYPE':
                targetMood = decision.confidence > 2.5 ? 'EUPHORIA' : 'AGGRESSIVE';
                break;
            case 'DEBUG':
                targetMood = decision.confidence > 2.5 ? 'CAUTIOUS' : 'DOUBT';
                break;
            case 'RESEARCH':
                targetMood = 'INQUISITIVE';
                break;
            case 'EXECUTE':
                targetMood = decision.confidence > 2.0 ? 'AGGRESSIVE' : 'STABLE';
                break;
            case 'PANIC':
                targetMood = 'FRICTION';
                break;
            default:
                targetMood = 'STABLE';
        }

        // Only apply mood if influence intensity is high enough
        if (this.moodInfluenceIntensity > 0.6) {
            this.council.setMood(targetMood);
            return `Applied ${targetMood} mood with ${(this.moodInfluenceIntensity * 100).toFixed(0)}% intensity`;
        }

        return `Mood influence at ${(this.moodInfluenceIntensity * 100).toFixed(0)}% - below threshold`;
    }

    private updateMoodInfluenceIntensity(): void {
        const analytics = this.getVetoAnalytics();

        // Increase intensity if vetoes are successful
        if (analytics.successRate > 0.7) {
            this.moodInfluenceIntensity = Math.min(1, this.moodInfluenceIntensity + 0.1);
        }
        // Decrease if vetoes are failing
        else if (analytics.successRate < 0.4 && analytics.totalVetoes > 3) {
            this.moodInfluenceIntensity = Math.max(0.3, this.moodInfluenceIntensity - 0.1);
        }
    }

    /**
     * Get coordination system (delegates to base)
     */
    public getCoordination() {
        return this.baseIntegration.getCoordination();
    }

    /**
     * Get swarm guidance (delegates to base)
     */
    public getSwarmGuidance() {
        return this.baseIntegration.getSwarmGuidance();
    }

    /**
     * Check if YOLO should veto (delegates to base)
     */
    public shouldVetoCouncilDecision(proposedStrategy: CouncilStrategy, yoloDecision: YoloTelemetry) {
        return this.baseIntegration.shouldVetoCouncilDecision(proposedStrategy, yoloDecision);
    }

    /**
     * Get YOLO influence analytics (delegates to base)
     */
    public getInfluenceAnalytics() {
        return this.baseIntegration.getInfluenceAnalytics();
    }

    /**
     * Clear turn state (delegates to base)
     */
    public clearTurnState(): void {
        this.baseIntegration.clearTurnState();
    }
}

export default AdvancedYOLOIntegration;
