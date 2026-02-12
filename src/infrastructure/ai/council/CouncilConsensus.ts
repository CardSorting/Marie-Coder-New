import { CouncilState as StateManager } from './CouncilState.js';
import { CouncilVote, CouncilStrategy, CouncilMood } from './MarieCouncilTypes.js';

export class CouncilConsensus {
    // BALANCED SUPREMACY: YOLO has highest weight but council still matters
    public agentWeights: Record<string, number> = {
        'YOLO': 2.5,        // Founder - First Among Equals (highest authority)
        'Strategist': 2.0,  // Strategic planning
        'Auditor': 1.5,     // Verification
        'QASRE': 1.3,       // Quality/Safety (slight boost for importance)
        'ISO9001': 1.3,     // Readiness (slight boost for importance)
        'Engine': 1.0       // Base execution
    };
    public agentAccuracy: Record<string, { success: number, total: number }> = {
        'Strategist': { success: 0, total: 0 },
        'Auditor': { success: 0, total: 0 },
        'Engine': { success: 0, total: 0 },
        'QASRE': { success: 0, total: 0 },
        'ISO9001': { success: 0, total: 0 },
        'YOLO': { success: 0, total: 0 }
    };
    public entropyScore: number = 0;
    public lastConsensus: { strategy: CouncilStrategy, weights: Record<string, number> } | null = null;
    public consensusDirty: boolean = true;

    constructor(private state: StateManager) { }

    public registerVote(agent: 'Engine' | 'Strategist' | 'Auditor' | 'QASRE' | 'ISO9001' | 'YOLO', strategy: CouncilStrategy, reason: string, confidence: number = 1.0) {
        const vote: CouncilVote = {
            agent,
            strategy,
            reason,
            timestamp: Date.now(),
            confidence
        };

        this.state.addVote(vote);
        this.consensusDirty = true;
        this.calculateEntropy();
    }

    public calculateEntropy() {
        const recentVotes = this.state.getRecentVotes(3);
        if (recentVotes.length < 3) {
            this.entropyScore = 0;
            return;
        }

        const uniqueStrategies = new Set(recentVotes.map(v => v.strategy)).size;
        this.entropyScore = (uniqueStrategies - 1) * 50;

        if (this.entropyScore >= 100) {
            this.state.blackboard.write('highEntropyDetected', true);
        } else {
            this.state.blackboard.clear('highEntropyDetected');
        }
    }

    public getWinningStrategy(predictFailureFn: (s: CouncilStrategy) => boolean): CouncilStrategy | null {
        if (!this.consensusDirty && this.lastConsensus) return this.lastConsensus.strategy;

        const now = Date.now();
        const STALENESS_WINDOW = 30000;
        const recentVotes = this.state.getRecentVotes(3);
        if (recentVotes.length === 0) return null;

        // Fast-Path
        const topVote = recentVotes[recentVotes.length - 1];
        if (topVote && topVote.confidence >= 1.8) {
            this.lastConsensus = { strategy: topVote.strategy, weights: { [topVote.strategy]: topVote.confidence } };
            this.consensusDirty = false;
            return topVote.strategy;
        }

        const strategyCounts: Record<string, number> = {};
        for (const v of recentVotes) {
            let baseWeight = (this.agentWeights[v.agent] || 1.0) * (v.confidence || 1.0);

            // BALANCED SUPREMACY: YOLO's conviction carries more weight, gentler dampening
            if (v.agent === 'YOLO') {
                const flow = this.state.memory.flowState;
                const totalErrors = this.state.memory.totalErrorCount;
                const hotspotCount = Object.keys(this.state.memory.errorHotspots || {}).length;
                const hasEntropyAlert = !!this.state.blackboard.read('highEntropyDetected');

                const healthy = flow >= 60 && totalErrors <= 4 && hotspotCount <= 3 && !hasEntropyAlert;
                const risky = flow < 30 || totalErrors > 10 || hotspotCount > 5 || hasEntropyAlert;

                // Enhanced boost in healthy conditions, gentler dampening in risk
                if (healthy) baseWeight *= 1.3;
                if (risky) baseWeight *= 0.8; // Gentler than before (was 0.65)

                // Founder's Preference: YOLO wins ties through confidence multiplier
                baseWeight *= (1 + (v.confidence - 1) * 0.1);
            }

            const stats = this.state.strategyStats[v.strategy];
            if (stats && stats.attempts > 3) {
                const successRate = stats.successes / stats.attempts;
                if (successRate > 0.7) baseWeight *= 1.2;
                else if (successRate < 0.3) baseWeight *= 0.8;
            }

            if (predictFailureFn(v.strategy)) {
                baseWeight *= 0.2;
            }

            const fresh = (now - v.timestamp) > STALENESS_WINDOW ? 0.5 : 1.0;
            strategyCounts[v.strategy] = (strategyCounts[v.strategy] || 0) + (baseWeight * fresh);
        }

        // BALANCED SUPREMACY: Determine winner with Founder's Preference
        let winningStrategy: CouncilStrategy = recentVotes[recentVotes.length - 1].strategy;
        let maxWeight = 0;
        let yoloPreferredStrategy: CouncilStrategy | null = null;
        let yoloWeight = 0;

        for (const [s, w] of Object.entries(strategyCounts)) {
            // Track YOLO's preference separately
            const yoloVote = recentVotes.find(v => v.agent === 'YOLO' && v.strategy === s);
            if (yoloVote && w > yoloWeight) {
                yoloWeight = w;
                yoloPreferredStrategy = s as CouncilStrategy;
            }

            if (w > maxWeight) {
                maxWeight = w;
                winningStrategy = s as CouncilStrategy;
            }
        }

        // Founder's Preference: In ties or close calls (< 0.5 difference), YOLO wins
        if (yoloPreferredStrategy && yoloWeight > 0) {
            const weightDiff = maxWeight - yoloWeight;
            if (weightDiff < 0.5 && yoloPreferredStrategy !== winningStrategy) {
                winningStrategy = yoloPreferredStrategy;
            }
        }

        this.lastConsensus = { strategy: winningStrategy, weights: strategyCounts };
        this.consensusDirty = false;
        return winningStrategy;
    }

    public calibrateWeights(success: boolean) {
        const consensus = this.lastConsensus;
        if (!consensus) return;

        const recent = this.state.getRecentVotes(3);
        const winners = recent.filter(v => v.strategy === consensus.strategy);

        for (const agent of ['Engine', 'Strategist', 'Auditor', 'QASRE', 'ISO9001', 'YOLO'] as const) {
            const stats = this.agentAccuracy[agent];
            stats.total++;
            const supportedWinner = winners.some(v => v.agent === agent);
            if ((supportedWinner && success) || (!supportedWinner && !success)) {
                stats.success++;
            }

            const accuracy = stats.success / Math.max(1, stats.total);
            // BALANCED SUPREMACY: Updated base weights with YOLO elevated
            const base: Record<string, number> = {
                'YOLO': 2.5,        // Founder authority
                'Strategist': 2.0,
                'Auditor': 1.5,
                'QASRE': 1.3,
                'ISO9001': 1.3,
                'Engine': 1.0
            };
            let newWeight = (base[agent] || 1.0) * (0.8 + (accuracy * 0.4));

            // STABILITY GUARD: Ensure the weight is a finite number
            if (!Number.isFinite(newWeight)) {
                console.error(`[Council] INVALID WEIGHT DETECTED for ${agent}: ${newWeight}. Resetting to base.`);
                newWeight = base[agent] || 1.0;
            }
            this.agentWeights[agent] = newWeight;
        }
    }
}
