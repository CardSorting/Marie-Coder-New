import type { StreamStage, ProgressUpdatePayload, CheckpointPayload } from '../../types';
import type { HandlerContext } from './types';

interface RunStartMessage {
    value: {
        timestamp: number;
    };
}

interface RunCompleteMessage {
    value?: {
        steps?: number;
        tools?: number;
        usage?: unknown;
    };
}

interface StageChangeMessage {
    value: {
        stage: string;
        label?: string;
    };
}

interface StepUpdateMessage {
    value: {
        step: number;
        label?: string;
    };
}

interface ReasoningUpdateMessage {
    value: string;
}

interface UsageUpdateMessage {
    value: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number } | null;
}

interface RunErrorMessage {
    value?: {
        message?: string;
    };
}

interface ProgressUpdateMessage {
    value: ProgressUpdatePayload;
}

interface CheckpointStateMessage {
    value: CheckpointPayload;
}

/**
 * Handles run start events from the extension.
 * Resets all stream-related state for a new run.
 */
export function handleOnRunStart(
    message: RunStartMessage & { sessionId?: string },
    ctx: HandlerContext
): void {
    // PHASE 6: Deep Session Investigation - Session guard for stream handlers
    const { currentSessionId } = ctx;
    const messageSessionId = message.sessionId;

    if (messageSessionId && messageSessionId !== currentSessionId) {
        console.warn(`[streamHandlers] Ignored run start from stale session: ${messageSessionId}`);
        return;
    }

    const {
        setStreamStartedAt,
        setStreamStage,
        setStepCount,
        setToolCount,
        setReasoning,
        setTokenUsage,
        setCurrentStepLabel,
        setRunError,
        setCheckpoint,
        setLifecycleStage,
        setRitualComplete,
        setPassHistory,
        setGardenMetrics,
        setProgressObjectives,
        setActiveObjectiveId,
        setCompletionPercent,
        setProgressContext,
        setAchievements,
        setActiveFilePath,
        setCurrentPass,
        setTotalPasses,
        setPassFocus,
    } = ctx;

    setStreamStartedAt(message.value.timestamp);
    setStreamStage('thinking');
    setStepCount(0);
    setToolCount(0);
    setReasoning('');
    setTokenUsage(null);
    setCurrentStepLabel('Preparing objectives...');
    setRunError(null);
    setCheckpoint(null);
    setLifecycleStage(undefined);
    setRitualComplete(false);
    setPassHistory([]);
    setGardenMetrics({ cherishedFiles: [], releasedDebtCount: 0 });
    setProgressObjectives([]);
    setActiveObjectiveId(undefined);
    setCompletionPercent(0);
    setProgressContext('');
    setAchievements([]);
    setActiveFilePath(undefined);
    setCurrentPass(undefined);
    setTotalPasses(undefined);
    setPassFocus(undefined);
}

/**
 * Handles run complete events from the extension.
 * Finalizes stream state with final metrics.
 */
export function handleOnRunComplete(
    message: RunCompleteMessage & { sessionId?: string },
    ctx: HandlerContext
): void {
    // PHASE 6: Deep Session Investigation - Session guard for stream handlers
    const { currentSessionId } = ctx;
    const messageSessionId = message.sessionId;

    if (messageSessionId && messageSessionId !== currentSessionId) {
        console.warn(`[streamHandlers] Ignored run complete from stale session: ${messageSessionId}`);
        return;
    }

    const { setStreamStage, setCurrentStepLabel, setStepCount, setToolCount, setTokenUsage } = ctx;

    setStreamStage('done');
    setCurrentStepLabel('Completed');

    if (message.value?.steps !== undefined) {
        setStepCount(message.value.steps);
    }
    if (message.value?.tools !== undefined) {
        setToolCount(message.value.tools);
    }
    if (message.value?.usage) {
        setTokenUsage(message.value.usage);
    }
}

/**
 * Handles stage change events from the extension.
 * Updates the current stream stage and optional label.
 */
export function handleOnStageChange(
    message: StageChangeMessage & { sessionId?: string },
    ctx: HandlerContext
): void {
    // PHASE 6: Deep Session Investigation - Session guard for stream handlers
    const { currentSessionId } = ctx;
    const messageSessionId = message.sessionId;

    if (messageSessionId && messageSessionId !== currentSessionId) {
        console.warn(`[streamHandlers] Ignored stage change from stale session: ${messageSessionId}`);
        return;
    }

    const { setStreamStage, setCurrentStepLabel } = ctx;

    setStreamStage(message.value.stage as StreamStage);
    if (message.value.label) {
        setCurrentStepLabel(message.value.label);
    }
}

/**
 * Handles step update events from the extension.
 * Updates step count and current step label.
 */
export function handleOnStepUpdate(
    message: StepUpdateMessage,
    ctx: HandlerContext
): void {
    const { setStepCount, setCurrentStepLabel } = ctx;

    setStepCount(message.value.step);
    setCurrentStepLabel(message.value.label || '');
}

/**
 * Handles reasoning update events from the extension.
 * Appends reasoning text to the current reasoning buffer.
 */
export function handleOnReasoningUpdate(
    message: ReasoningUpdateMessage & { sessionId?: string },
    ctx: HandlerContext
): void {
    // PHASE 6: Deep Session Investigation - Session guard for stream handlers
    const { currentSessionId } = ctx;
    const messageSessionId = message.sessionId;

    if (messageSessionId && messageSessionId !== currentSessionId) {
        console.warn(`[streamHandlers] Ignored reasoning from stale session: ${messageSessionId}`);
        return;
    }

    const { setReasoning } = ctx;

    setReasoning((prev: string) => prev + message.value);
}

/**
 * Handles usage update events from the extension.
 * Updates token usage information.
 */
export function handleOnUsageUpdate(
    message: UsageUpdateMessage,
    ctx: HandlerContext
): void {
    const { setTokenUsage } = ctx;

    setTokenUsage(message.value);
}

/**
 * Handles run error events from the extension.
 * Sets error state and cleans up any dangling tool call messages.
 */
export function handleOnRunError(
    message: RunErrorMessage & { sessionId?: string },
    ctx: HandlerContext
): void {
    // PHASE 6: Deep Session Investigation - Session guard for stream handlers
    const { currentSessionId } = ctx;
    const messageSessionId = message.sessionId;

    if (messageSessionId && messageSessionId !== currentSessionId) {
        console.warn(`[streamHandlers] Ignored run error from stale session: ${messageSessionId}`);
        return;
    }

    const { setRunError, setStreamStage, setMessages } = ctx;

    setRunError(message.value?.message || 'Unknown run error');
    setStreamStage('error');

    // Cleanup: ensure no dangling 'executing' states
    setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === 'marie' && lastMsg.variant === 'tool-call' && !lastMsg.toolInput) {
            return prev.slice(0, -1);
        }
        return prev;
    });
}

/**
 * Creates a throttled progress update handler.
 * Buffers progress updates and applies them after a delay for visual stability.
 */
export function createProgressUpdateHandler(
    bufferRef: React.MutableRefObject<ProgressUpdatePayload | null>,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
    return function handleOnProgressUpdate(
        message: ProgressUpdateMessage,
        ctx: HandlerContext
    ): void {
        const {
            setProgressObjectives,
            setActiveObjectiveId,
            setCompletionPercent,
            setProgressContext,
            setAchievements,
            setActiveFilePath,
            setPassHistory,
            setGardenMetrics,
            setCurrentPass,
            setTotalPasses,
            setPassFocus,
        } = ctx;

        const payload = message.value;
        bufferRef.current = payload;

        if (!timerRef.current) {
            timerRef.current = setTimeout(() => {
                const buffered = bufferRef.current;
                if (buffered) {
                    setProgressObjectives(buffered.objectives || []);
                    setActiveObjectiveId(buffered.activeObjectiveId);
                    setCompletionPercent(buffered.completionPercent || 0);
                    setProgressContext(buffered.context || '');
                    setAchievements(buffered.achieved || []);
                    setActiveFilePath(buffered.activeFilePath);
                    if (buffered.passHistory) setPassHistory(buffered.passHistory);
                    if (buffered.metrics) setGardenMetrics(buffered.metrics);
                    setCurrentPass(buffered.isResuming ? undefined : (buffered.passHistory?.length ? buffered.passHistory.length + 1 : 1));
                    setTotalPasses(15); // Default total passes if not provided by backend
                    setPassFocus(buffered.passFocus);
                }
                timerRef.current = null;
            }, 100); // 100ms throttle for visual stability
        }
    };
}

/**
 * Handles checkpoint state events from the extension.
 * Updates checkpoint information for approval flows.
 */
export function handleOnCheckpointState(
    message: CheckpointStateMessage,
    ctx: HandlerContext
): void {
    const { setCheckpoint } = ctx;

    setCheckpoint(message.value);
}

/**
 * Handles full run state synchronization events from the extension.
 * Populates all stream and garden metrics for a re-joining webview.
 */
export function handleOnRunState(
    message: { value: any },
    ctx: HandlerContext
): void {
    const {
        setStreamStartedAt,
        setStreamStage,
        setStepCount,
        setToolCount,
        setProgressObjectives,
        setActiveObjectiveId,
        setCompletionPercent,
        setProgressContext,
        setAchievements,
        setActiveFilePath,
        setCurrentPass,
        setTotalPasses,
        setPassFocus,
        setLifecycleStage,
        setRitualComplete,
        setPassHistory,
        setGardenMetrics,
    } = ctx;

    const run = message.value;
    if (!run) return;

    // Stream state
    if (run.startedAt) setStreamStartedAt(run.startedAt);
    setStreamStage('thinking'); // Assume thinking if run is active
    if (run.steps !== undefined) setStepCount(run.steps);
    if (run.tools !== undefined) setToolCount(run.tools);
    if (run.objectives) setProgressObjectives(run.objectives);
    if (run.activeObjectiveId) setActiveObjectiveId(run.activeObjectiveId);
    if (run.context) setProgressContext(run.context);
    if (run.activeFilePath) setActiveFilePath(run.activeFilePath);

    // Heuristic completion if not provided
    const completedCount = run.objectives?.filter((o: any) => o.status === 'completed').length || 0;
    const totalCount = run.objectives?.length || 1;
    setCompletionPercent(Math.round((completedCount / totalCount) * 100));

    // Garden/Progress state
    if (run.achieved) setAchievements(run.achieved);
    if (run.passFocus) setPassFocus(run.passFocus);
    if (run.currentPass) setCurrentPass(run.currentPass);
    if (run.totalPasses) setTotalPasses(run.totalPasses);

    // Fallbacks for garden metrics if present in run object
    if (run.lifecycleStage) setLifecycleStage(run.lifecycleStage);
    if (run.ritualComplete !== undefined) setRitualComplete(run.ritualComplete);
    if (run.passHistory) setPassHistory(run.passHistory);
    if (run.metrics) setGardenMetrics(run.metrics);
}
