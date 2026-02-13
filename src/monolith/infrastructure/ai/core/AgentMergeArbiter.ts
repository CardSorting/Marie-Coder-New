import { AgentEnvelope } from "./AgentStreamContracts.js";

export interface ArbiterDecision {
    accepted: AgentEnvelope[];
    rejected: Array<{ envelope: AgentEnvelope; reason: string }>;
}

/**
 * Single-writer merge lane for agent proposals.
 * Current slice: deterministic filtering and ordering for safe integration.
 */
export class AgentMergeArbiter {
    private readonly staged = new Map<string, AgentEnvelope>();
    private readonly intentPriority: Record<string, number> = {
        SAFETY_BLOCKER_CHECK: 5,
        QUALITY_REGRESSION_SCAN: 4,
        READINESS_GATE: 3,
        TRAJECTORY_OPTIMIZATION: 2,
        SPECULATIVE_DISCOVERY: 1,
    };

    public stage(envelope: AgentEnvelope): void {
        const key = `${envelope.streamIdentity.streamId}:${envelope.createdAt}`;
        this.staged.set(key, envelope);
    }

    public evaluate(): ArbiterDecision {
        const accepted: AgentEnvelope[] = [];
        const rejected: Array<{ envelope: AgentEnvelope; reason: string }> = [];
        const valid: AgentEnvelope[] = [];

        for (const envelope of this.staged.values()) {
            if (!envelope.decision || envelope.confidence < 0) {
                rejected.push({ envelope, reason: 'Invalid envelope payload' });
                continue;
            }

            if (envelope.evidenceRefs.length === 0 && envelope.confidence > 2.0) {
                rejected.push({ envelope, reason: 'High-confidence proposal missing evidence refs' });
                continue;
            }

            valid.push(envelope);
        }

        valid.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            const intentDelta = (this.intentPriority[b.intent] ?? 0) - (this.intentPriority[a.intent] ?? 0);
            if (intentDelta !== 0) return intentDelta;
            return a.createdAt - b.createdAt;
        });

        const dominantBlocking = valid.find(v => v.blockingConditions.length > 0);
        const collisionKeys = new Set<string>();

        for (const envelope of valid) {
            if (dominantBlocking && envelope.blockingConditions.length === 0) {
                rejected.push({ envelope, reason: `Dominated by blocking proposal from ${dominantBlocking.streamIdentity.agentId || 'unknown agent'}` });
                continue;
            }

            const key = `${envelope.streamIdentity.agentId || 'unknown'}:${envelope.intent}`;
            if (collisionKeys.has(key)) {
                rejected.push({ envelope, reason: 'Rejected by deterministic conflict resolution (duplicate agent+intent)' });
                continue;
            }

            collisionKeys.add(key);
            accepted.push(envelope);
        }

        return { accepted, rejected };
    }

    public clear(): void {
        this.staged.clear();
    }
}
