import { AgentEnvelope, SpawnPlan } from "./AgentStreamContracts.js";

export interface AgentStreamHandle {
    streamId: string;
    agentId: string;
    intent: string;
    startedAt: number;
    timeoutMs: number;
    tokenBudget: number;
    status: 'running' | 'completed' | 'cancelled' | 'failed' | 'timed_out';
    abortController: AbortController;
}

/**
 * Data-plane lifecycle manager for isolated agent streams.
 * Current slice: lifecycle registry + timeout/cancel handling.
 */
export class AgentStreamManager {
    private active = new Map<string, AgentStreamHandle>();

    public spawn(plan: SpawnPlan): AgentStreamHandle | null {
        if (!plan.accepted) return null;

        const handle: AgentStreamHandle = {
            streamId: plan.streamIdentity.streamId,
            agentId: plan.agentId,
            intent: plan.intent,
            startedAt: Date.now(),
            timeoutMs: plan.timeoutMs,
            tokenBudget: plan.tokenBudget,
            status: 'running',
            abortController: new AbortController(),
        };

        this.active.set(handle.streamId, handle);

        const timeout = setTimeout(() => {
            const current = this.active.get(handle.streamId);
            if (!current || current.status !== 'running') return;
            current.status = 'timed_out';
            current.abortController.abort();
            this.active.delete(handle.streamId);
        }, handle.timeoutMs);

        handle.abortController.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
        return handle;
    }

    public complete(streamId: string): void {
        const handle = this.active.get(streamId);
        if (!handle) return;
        handle.status = 'completed';
        this.active.delete(streamId);
    }

    public fail(streamId: string): void {
        const handle = this.active.get(streamId);
        if (!handle) return;
        handle.status = 'failed';
        this.active.delete(streamId);
    }

    public cancel(streamId: string, reason?: string): void {
        const handle = this.active.get(streamId);
        if (!handle) return;
        handle.status = 'cancelled';
        handle.abortController.abort(reason);
        this.active.delete(streamId);
    }

    public cancelAll(reason?: string): void {
        for (const streamId of this.active.keys()) {
            this.cancel(streamId, reason);
        }
    }

    public activeCount(): number {
        return this.active.size;
    }

    public getActiveHandles(): AgentStreamHandle[] {
        return Array.from(this.active.values());
    }

    public toEnvelope(handle: AgentStreamHandle, partial: Partial<AgentEnvelope>): AgentEnvelope {
        return {
            streamIdentity: {
                streamId: handle.streamId,
                origin: 'agent',
                agentId: handle.agentId,
            },
            intent: handle.intent as AgentEnvelope['intent'],
            decision: partial.decision || 'NO_DECISION',
            confidence: partial.confidence ?? 0,
            evidenceRefs: partial.evidenceRefs || [],
            recommendedActions: partial.recommendedActions || [],
            blockingConditions: partial.blockingConditions || [],
            summary: partial.summary,
            createdAt: partial.createdAt || Date.now(),
        };
    }
}
