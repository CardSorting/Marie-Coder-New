import { ConfigService } from "../../config/ConfigService.js";
import { AgentEnvelope, AgentStreamCancelReason, SpawnPlan } from "./AgentStreamContracts.js";

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

export interface AgentStreamTerminalState {
    status: AgentStreamHandle['status'];
    reason?: AgentStreamCancelReason | string;
    endedAt: number;
}

/**
 * Data-plane lifecycle manager for isolated agent streams.
 * Current slice: lifecycle registry + timeout/cancel handling.
 */
export class AgentStreamManager {
    private active = new Map<string, AgentStreamHandle>();
    private terminalStates = new Map<string, AgentStreamTerminalState>();

    public spawn(plan: SpawnPlan): AgentStreamHandle | null {
        if (!plan.accepted) return null;
        if (this.active.size >= ConfigService.getAgentStreamMaxConcurrent()) return null;

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
            this.terminalStates.set(handle.streamId, { status: 'timed_out', reason: 'timeout', endedAt: Date.now() });
            current.abortController.abort('timeout');
            this.active.delete(handle.streamId);
        }, handle.timeoutMs);

        handle.abortController.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
        return handle;
    }

    public complete(streamId: string): void {
        const handle = this.active.get(streamId);
        if (!handle) return;
        handle.status = 'completed';
        this.terminalStates.set(streamId, { status: 'completed', endedAt: Date.now() });
        this.active.delete(streamId);
    }

    public fail(streamId: string): void {
        const handle = this.active.get(streamId);
        if (!handle) return;
        handle.status = 'failed';
        this.terminalStates.set(streamId, { status: 'failed', reason: 'unknown', endedAt: Date.now() });
        this.active.delete(streamId);
    }

    public cancel(streamId: string, reason: AgentStreamCancelReason = 'manual_cancel'): void {
        const handle = this.active.get(streamId);
        if (!handle) return;
        handle.status = 'cancelled';
        this.terminalStates.set(streamId, { status: 'cancelled', reason, endedAt: Date.now() });
        handle.abortController.abort(reason);
        this.active.delete(streamId);
    }

    public cancelAll(reason: AgentStreamCancelReason = 'manual_cancel'): void {
        for (const streamId of this.active.keys()) {
            this.cancel(streamId, reason);
        }
    }

    public consumeTerminalState(streamId: string): AgentStreamTerminalState | undefined {
        const state = this.terminalStates.get(streamId);
        if (state) this.terminalStates.delete(streamId);
        return state;
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
