import { ConfigService } from "../../config/ConfigService.js";
import { AgentIntentRequest, AgentTurnContext } from "./AgentStreamContracts.js";

export interface PolicyDecision {
    score: number;
    accepted: boolean;
    reason: string;
}

/**
 * Control-plane policy engine for on-demand agent stream spawning.
 * Safe default: conservative admission that can run in shadow mode.
 */
export class AgentStreamPolicyEngine {
    private readonly intentPriors: Record<AgentIntentRequest['intent'], number> = {
        SAFETY_BLOCKER_CHECK: 2.2,
        QUALITY_REGRESSION_SCAN: 1.8,
        READINESS_GATE: 1.2,
        TRAJECTORY_OPTIMIZATION: 1.0,
        SPECULATIVE_DISCOVERY: 0.7,
    };

    public isEnabled(): boolean {
        return ConfigService.isAgentStreamsEnabled();
    }

    public getSpawnThreshold(): number {
        return ConfigService.getAgentStreamSpawnThreshold();
    }

    public getMaxConcurrentStreams(): number {
        return ConfigService.getAgentStreamMaxConcurrent();
    }

    public getDefaultTimeoutMs(): number {
        return ConfigService.getAgentStreamTimeoutMs();
    }

    public evaluateIntent(context: AgentTurnContext, intent: AgentIntentRequest): PolicyDecision {
        const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
        const urgency = clamp(intent.urgency, 0.1, 3);
        const risk = clamp(intent.risk, 0.1, 3);
        const expectedValue = clamp(intent.expectedValue, 0.1, 3);
        const contention = clamp(intent.contentionFactor, 0.25, 4);
        const tokenCostUnits = Math.max(0.5, intent.tokenCostEstimate / 250);
        const pressureMultiplier = context.pressure === 'HIGH' ? 1.4 : context.pressure === 'MEDIUM' ? 1.1 : 1.0;
        const intentPrior = this.intentPriors[intent.intent] ?? 1.0;

        const weightedSignal = ((urgency * 0.45) + (risk * 0.55)) * expectedValue * intentPrior;
        const rawScore = weightedSignal / (tokenCostUnits * contention * pressureMultiplier);
        const score = Number.isFinite(rawScore) ? rawScore : 0;
        const threshold = this.getSpawnThreshold();

        if (context.pressure === 'HIGH' && intent.intent === 'SPECULATIVE_DISCOVERY') {
            return { score, accepted: false, reason: 'Rejected: speculative intent under high pressure' };
        }

        if (score < threshold) {
            return { score, accepted: false, reason: `Rejected: score ${score.toFixed(2)} below threshold ${threshold.toFixed(2)}` };
        }

        return { score, accepted: true, reason: `Accepted: score ${score.toFixed(2)} >= ${threshold.toFixed(2)}` };
    }
}
