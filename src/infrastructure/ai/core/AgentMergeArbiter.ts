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

    public stage(envelope: AgentEnvelope): void {
        const key = `${envelope.streamIdentity.streamId}:${envelope.createdAt}`;
        this.staged.set(key, envelope);
    }

    public evaluate(): ArbiterDecision {
        const accepted: AgentEnvelope[] = [];
        const rejected: Array<{ envelope: AgentEnvelope; reason: string }> = [];

        for (const envelope of this.staged.values()) {
            if (!envelope.decision || envelope.confidence < 0) {
                rejected.push({ envelope, reason: 'Invalid envelope payload' });
                continue;
            }

            if (envelope.evidenceRefs.length === 0 && envelope.confidence > 2.0) {
                rejected.push({ envelope, reason: 'High-confidence proposal missing evidence refs' });
                continue;
            }

            accepted.push(envelope);
        }

        accepted.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return a.createdAt - b.createdAt;
        });

        return { accepted, rejected };
    }

    public clear(): void {
        this.staged.clear();
    }
}
