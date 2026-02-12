export type MarieRunStage = 'thinking' | 'planning' | 'responding' | 'calling_tool' | 'editing' | 'finalizing' | 'done' | 'error';

export type ObjectiveStatus = 'pending' | 'in_progress' | 'completed' | 'verified' | 'blocked' | 'skipped' | 'cancelled';

export interface YoloDecisionSnapshot {
    profile: 'demo_day' | 'balanced' | 'recovery';
    strategy: string;
    confidence: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    dampened: boolean;
    dampenReason?: string;
    structuralUncertainty: boolean;
    requiredActions: string[];
    blockedBy: string[];
    stopCondition: 'landed' | 'structural_uncertainty';
}

export interface ProgressObjective {
    id: string;
    label: string;
    status: ObjectiveStatus;
    verificationEvidence?: string;
    context?: string;
}

export type MarieStreamEvent =
    | { type: 'run_started'; runId: string; startedAt: number }
    | { type: 'stage'; runId: string; stage: MarieRunStage; label: string; elapsedMs: number }
    | { type: 'step'; runId: string; step: number; label: string; elapsedMs: number }
    | { type: 'reasoning'; runId: string; text: string; raw?: boolean; elapsedMs: number }
    | {
        type: 'usage';
        runId: string;
        usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number };
        elapsedMs: number;
    }
    | { type: 'content_delta'; runId: string; text: string; elapsedMs: number }
    | {
        type: 'tool';
        runId: string;
        phase: 'start' | 'complete' | 'denied' | 'error';
        name: string;
        input?: any;
        diff?: { old: string, new: string };
        message?: string;
        heuristicFix?: string;
        elapsedMs: number;
    }
    | {
        type: 'run_completed';
        runId: string;
        elapsedMs: number;
        steps: number;
        tools: number;
        usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number };
    }
    | {
        type: 'progress_update';
        runId: string;
        completionPercent: number;
        activeObjectiveId?: string;
        activeToolName?: string;
        lastToolName?: string;
        objectives?: ProgressObjective[];
        achieved?: string[];
        waitingForApproval?: boolean;
        context?: string;
        lifecycleStage?: 'sprout' | 'bloom' | 'compost';
        ritualComplete?: boolean;
        activeFilePath?: string;
        currentPass?: number;
        totalPasses?: number;
        passFocus?: string;
        elapsedMs: number;
        isResuming?: boolean;
        passHistory?: Array<{ pass: number, summary: string, reflection: string }>;
        metrics?: { cherishedFiles: string[], releasedDebtCount: number };
        heuristicFixes?: string[];
        councilSnapshot?: {
            strategy: string;
            mood: string;
            flowState: number;
            errorHotspots: Record<string, number>;
            toolHistoryLength: number;
            recentFiles: string[];
            lastVote?: string;
            strategyTimeline: { strategy: string, reason: string, ago: string }[];
            comboPeak: number;
            successStreak: number;
            moodHistory: string[];
            lastYoloDecision?: YoloDecisionSnapshot;
        };
    }
    | {
        type: 'council_heartbeat';
        runId: string;
        strategy: string;
        mood: string;
        flow: number;
        streak: number;
        errors: number;
        toolCount: number;
        elapsedMs: number;
    }
    | {
        type: 'checkpoint';
        runId: string;
        status: 'awaiting_approval' | 'approved' | 'denied';
        toolName: string;
        summary: { what: string; why: string; impact: string };
        elapsedMs: number;
    }
    | {
        type: 'tool_delta';
        runId: string;
        name: string;
        inputDelta: string;
        elapsedMs: number;
    }
    | {
        type: 'pass_transition';
        runId: string;
        currentPass: number;
        totalPasses: number;
        passFocus: string;
        passHistory?: Array<{ pass: number, summary: string, reflection: string }>;
        elapsedMs: number;
    }
    | { type: 'approval_request'; requestId: string; toolName: string; toolInput: any; elapsedMs: number; reasoning?: string; activeObjective?: string; diff?: { old: string, new: string } }
    | { type: 'run_error'; runId: string; elapsedMs: number; message: string };

export interface RunTelemetry {
    runId: string;
    startedAt: number;
    steps: number;
    tools: number;
    activeToolName?: string;
    lastToolName?: string;
    toolUsage?: Record<string, number>;
    codeStats?: {
        modifiedFiles: Record<string, { added: number, removed: number }>;
    };
    objectives: ProgressObjective[];
    activeObjectiveId?: string;
    achieved: string[];
    waitingForApproval?: boolean;
    currentContext?: string;
    lifecycleStage?: 'sprout' | 'bloom' | 'compost';
    ritualComplete?: boolean;
    activeFilePath?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number };
    currentPass?: number;
    totalPasses?: number;
    passFocus?: string;
    isResuming?: boolean;
    passHistory?: Array<{ pass: number, summary: string, reflection: string }>;
    metrics?: { cherishedFiles: string[], releasedDebtCount: number };
    heuristicFixes?: string[];
    // PHASE 6: Store originating session ID for deep session fencing
    originatingSessionId?: string;
    councilSnapshot?: {
        strategy: string;
        mood: string;
        flowState: number;
        errorHotspots: Record<string, number>;
        toolHistoryLength: number;
        recentFiles: string[];
        lastVote?: string;
        strategyTimeline: { strategy: string, reason: string, ago: string }[];
        comboPeak: number;
        successStreak: number;
        moodHistory: string[];
        lastYoloDecision?: YoloDecisionSnapshot;
    };
}

export interface MarieCallbacks {
    // PHASE 6: Added originatingSessionId for deep session fencing
    onStream?: (chunk: string, runId?: string, originatingSessionId?: string) => void;
    onTool?: (tool: { name: string, input: any, diff?: { old: string, new: string } }, runId?: string, originatingSessionId?: string) => void;
    onToolDelta?: (delta: { name: string, inputDelta: string }, runId?: string, originatingSessionId?: string) => void;
    onEvent?: (event: MarieStreamEvent) => void;
}

export interface ProgressUpdate {
    context?: string;
    completedObjectiveIds?: string[];
    activeObjectiveId?: string;
    achieved?: string[];
    lifecycleStage?: 'sprout' | 'bloom' | 'compost';
    ritualComplete?: boolean;
    activeFilePath?: string;
    currentPass?: number;
    totalPasses?: number;
    passFocus?: string;
    isResuming?: boolean;
    passHistory?: Array<{ pass: number, summary: string, reflection: string }>;
    metrics?: { cherishedFiles: string[], releasedDebtCount: number };
    heuristicFixes?: string[];
}
