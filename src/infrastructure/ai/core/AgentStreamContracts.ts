import { StreamIdentity } from "../../../domain/marie/MarieTypes.js";

export type AgentId = 'YOLO' | 'Strategist' | 'Auditor' | 'QASRE' | 'ISO9001' | string;

export type AgentIntentClass =
    | 'SAFETY_BLOCKER_CHECK'
    | 'QUALITY_REGRESSION_SCAN'
    | 'READINESS_GATE'
    | 'TRAJECTORY_OPTIMIZATION'
    | 'SPECULATIVE_DISCOVERY';

export interface AgentIntentRequest {
    intent: AgentIntentClass;
    candidateAgents: AgentId[];
    urgency: number;
    risk: number;
    expectedValue: number;
    tokenCostEstimate: number;
    contentionFactor: number;
    metadata?: Record<string, unknown>;
}

export interface SpawnPlan {
    streamIdentity: StreamIdentity;
    intent: AgentIntentClass;
    agentId: AgentId;
    sequence: number;
    score: number;
    policyAccepted: boolean;
    executionAccepted: boolean;
    accepted: boolean;
    reason: string;
    tokenBudget: number;
    timeoutMs: number;
    mode: 'SHADOW' | 'LIVE';
}

export type AgentStreamCancelReason = 'timeout' | 'manual_cancel' | 'engine_dispose' | 'pressure_shed' | 'unknown';

export interface AgentEnvelope {
    streamIdentity: StreamIdentity;
    intent: AgentIntentClass;
    decision: string;
    confidence: number;
    evidenceRefs: string[];
    recommendedActions: string[];
    blockingConditions: string[];
    summary?: string;
    createdAt: number;
}

export interface AgentTurnContext {
    runId: string;
    flowState: number;
    errorCount: number;
    hotspotCount: number;
    objectiveCount: number;
    pressure: 'LOW' | 'MEDIUM' | 'HIGH';
}
