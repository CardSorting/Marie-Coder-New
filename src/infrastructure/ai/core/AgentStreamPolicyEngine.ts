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
        const contention = Math.max(0.25, intent.contentionFactor);
        const tokenCost = Math.max(1, intent.tokenCostEstimate);
        const pressureMultiplier = context.pressure === 'HIGH' ? 1.4 : context.pressure === 'MEDIUM' ? 1.1 : 1.0;

        const rawScore = (intent.urgency * intent.risk * intent.expectedValue) / (tokenCost * contention * pressureMultiplier);
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
