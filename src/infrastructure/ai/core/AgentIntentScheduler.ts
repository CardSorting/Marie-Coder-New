import { AgentIntentRequest, AgentTurnContext, SpawnPlan } from "./AgentStreamContracts.js";
import { AgentStreamPolicyEngine } from "./AgentStreamPolicyEngine.js";

/**
 * Produces deterministic spawn plans for candidate agent intents.
 * The scheduler is control-plane only and does not execute streams itself.
 */
export class AgentIntentScheduler {
    constructor(private policy: AgentStreamPolicyEngine) { }

    public plan(context: AgentTurnContext, intents: AgentIntentRequest[]): SpawnPlan[] {
        const mode: 'SHADOW' | 'LIVE' = this.policy.isEnabled() ? 'LIVE' : 'SHADOW';
        const plans: SpawnPlan[] = [];

        for (const intent of intents) {
            const candidate = intent.candidateAgents[0];
            if (!candidate) continue;

            const decision = this.policy.evaluateIntent(context, intent);
            const accepted = decision.accepted && mode === 'LIVE';

            plans.push({
                streamIdentity: {
                    streamId: `agent_${context.runId}_${candidate}_${Date.now()}`,
                    origin: 'agent',
                    agentId: candidate,
                    parentRunId: context.runId,
                    intent: intent.intent,
                },
                intent: intent.intent,
                agentId: candidate,
                score: decision.score,
                accepted,
                reason: decision.reason,
                tokenBudget: Math.max(300, Math.round(intent.tokenCostEstimate * 2.5)),
                timeoutMs: this.policy.getDefaultTimeoutMs(),
                mode,
            });
        }

        return plans.sort((a, b) => b.score - a.score);
    }
}
