export class CouncilBrain {
    constructor(state) {
        this.state = state;
    }
    assessHealth(toolHistory, errorCount) {
        // BALANCED SUPREMACY: Check YOLO's last decision for override
        const lastYolo = this.state.memory.lastYoloDecision;
        if (lastYolo && lastYolo.confidence >= 2.5) {
            // High YOLO conviction overrides standard health assessment
            if (lastYolo.strategy === 'HYPE' || lastYolo.strategy === 'EXECUTE') {
                // Only override if not in critical error state
                if (errorCount < 3)
                    return lastYolo.strategy;
            }
        }
        if (errorCount >= 4)
            return 'PANIC';
        if (errorCount >= 2)
            return 'DEBUG';
        if (toolHistory.length >= 3) {
            const last3 = toolHistory.slice(-3);
            if (last3[0] === last3[1] && last3[1] === last3[2])
                return 'RESEARCH';
        }
        if (toolHistory.length >= 4) {
            const last4 = toolHistory.slice(-4);
            if (last4[0] === last4[2] && last4[1] === last4[3])
                return 'RESEARCH';
        }
        if (toolHistory.length >= 6) {
            const last6 = toolHistory.slice(-6);
            if (new Set(last6).size < 3)
                return 'RESEARCH';
        }
        if (this.assessMomentum() === 'HYPE')
            return 'HYPE';
        return 'EXECUTE';
    }
    assessMomentum() {
        // BALANCED SUPREMACY: YOLO conviction contributes to momentum assessment
        const lastYolo = this.state.memory.lastYoloDecision;
        const yoloBoost = lastYolo ? lastYolo.confidence * 0.5 : 0;
        // Adjusted thresholds with YOLO influence
        const effectiveStreak = this.state.memory.successStreak + yoloBoost;
        const effectiveFlow = this.state.memory.flowState + (yoloBoost * 5);
        if (effectiveStreak >= 8 && effectiveFlow >= 75) {
            return 'HYPE';
        }
        return null;
    }
    predictFailure(strategy, filePath) {
        if (!filePath)
            return null;
        const hotspot = this.state.memory.errorHotspots[filePath] || 0;
        if (hotspot >= 2 && strategy !== 'DEBUG' && strategy !== 'RESEARCH') {
            return `[PREDICTED FAILURE]: Risky strategy ${strategy} on high-error file ${filePath}.`;
        }
        return null;
    }
    detectStrategicLoop(history) {
        if (history.length < 4)
            return false;
        const last4 = history.slice(-4);
        return last4[0].strategy === last4[2].strategy &&
            last4[1].strategy === last4[3].strategy &&
            last4[0].strategy !== last4[1].strategy;
    }
    classifyError(message) {
        const lower = message.toLowerCase();
        if (lower.includes('syntax') || lower.includes('unexpected token') || lower.includes('parse error'))
            return 'SYNTAX';
        if (lower.includes('not found') || lower.includes('enoent'))
            return 'NOT_FOUND';
        if (lower.includes('permission') || lower.includes('eacces'))
            return 'PERMISSION';
        if (lower.includes('timeout'))
            return 'TIMEOUT';
        if (lower.includes('type') || lower.includes('undefined') || lower.includes('null'))
            return 'LOGIC';
        return 'UNKNOWN';
    }
    detectTunnelVision(pendingObjectiveCount) {
        // Tunnel vision if we have many successes but objectives aren't closing
        return this.state.memory.successStreak > 5 && pendingObjectiveCount > 2;
    }
    calculateSessionScore() {
        const streakBonus = this.state.memory.successStreak * 2;
        const flowBonus = this.state.memory.flowState / 10;
        const errorPenalty = Object.values(this.state.memory.errorHotspots).reduce((a, b) => a + b, 0) * 5;
        // BALANCED SUPREMACY: YOLO conviction bonus to session score
        const lastYolo = this.state.memory.lastYoloDecision;
        const yoloBonus = lastYolo ? lastYolo.confidence * 2 : 0;
        const score = Math.max(0, Math.min(100, 50 + streakBonus + flowBonus - errorPenalty + yoloBonus));
        let grade = 'C';
        if (score >= 95)
            grade = 'S+';
        else if (score >= 90)
            grade = 'S';
        else if (score >= 80)
            grade = 'A';
        else if (score >= 70)
            grade = 'B';
        else if (score < 30)
            grade = 'F';
        return { score, grade };
    }
    /**
     * BALANCED SUPREMACY: Founder-led recovery protocol
     * When YOLO has high conviction, suggest recovery strategies that maintain momentum
     */
    suggestRecoveryStrategy() {
        const lastYolo = this.state.memory.lastYoloDecision;
        if (lastYolo && lastYolo.confidence >= 2.5) {
            // High conviction YOLO prefers EXECUTE over DEBUG when possible
            if (lastYolo.strategy === 'EXECUTE' || lastYolo.strategy === 'HYPE') {
                // Check if we can still execute despite errors
                const totalErrors = this.state.memory.totalErrorCount;
                const hotspots = Object.keys(this.state.memory.errorHotspots).length;
                if (totalErrors < 5 && hotspots < 3) {
                    return 'EXECUTE'; // Trust the Founder's momentum
                }
            }
        }
        // Default to conservative approach
        return 'DEBUG';
    }
}
