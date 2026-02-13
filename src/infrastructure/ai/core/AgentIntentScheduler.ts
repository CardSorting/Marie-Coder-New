import { AgentIntentRequest, AgentTurnContext, SpawnPlan } from "./AgentStreamContracts.js";
import { AgentStreamPolicyEngine } from "./AgentStreamPolicyEngine.js";

/**
 * Produces deterministic spawn plans for candidate agent intents.
 * The scheduler is control-plane only and does not execute streams itself.
 */
export class AgentIntentScheduler {
    private runSequence = new Map<string, number>();

    constructor(private policy: AgentStreamPolicyEngine) { }

    private nextSequence(runId: string): number {
        const current = this.runSequence.get(runId) ?? 0;
        const next = current + 1;
        this.runSequence.set(runId, next);
        return next;
    }

    public plan(context: AgentTurnContext, intents: AgentIntentRequest[]): SpawnPlan[] {
        const mode: 'SHADOW' | 'LIVE' = this.policy.isEnabled() ? 'LIVE' : 'SHADOW';
        const plans: SpawnPlan[] = [];

        for (const intent of intents) {
            const candidate = intent.candidateAgents[0];
            if (!candidate) continue;

            const decision = this.policy.evaluateIntent(context, intent);
            const sequence = this.nextSequence(context.runId);
            const policyAccepted = decision.accepted;
            const executionAccepted = policyAccepted && mode === 'LIVE';

            plans.push({
                streamIdentity: {
                    streamId: `agent_${context.runId}_${candidate}_${sequence}`,
                    origin: 'agent',
                    agentId: candidate,
                    parentRunId: context.runId,
                    intent: intent.intent,
                },
                intent: intent.intent,
                agentId: candidate,
                sequence,
                score: decision.score,
                policyAccepted,
                executionAccepted,
                accepted: executionAccepted,
                reason: decision.reason,
                tokenBudget: Math.max(300, Math.round(intent.tokenCostEstimate * 2.5)),
                timeoutMs: this.policy.getDefaultTimeoutMs(),
                mode,
            });
        }

        return plans.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.sequence - b.sequence;
        });
    }
}
