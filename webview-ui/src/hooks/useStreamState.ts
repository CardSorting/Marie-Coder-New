import { useState, useCallback, useMemo, useEffect } from 'react';
import { vscode } from '../utils/vscode';
import type { SetStateAction } from 'react';
import type { StreamState, StreamStage, CheckpointPayload, ProgressObjective } from '../types';

/** Helper to resolve SetStateAction without `any` casting */
function resolveSetStateAction<T>(val: SetStateAction<T>, prev: T): T {
    return typeof val === 'function' ? (val as (prevState: T) => T)(prev) : val;
}

/** Initial stream state factory */
function createInitialStreamState(): StreamState {
    const saved = vscode.getState<{ stream?: StreamState }>();
    return saved?.stream || {
        streamStage: 'idle',
        streamStartedAt: null,
        stepCount: 0,
        toolCount: 0,
        reasoning: '',
        currentStepLabel: '',
        tokenUsage: null,
        progressObjectives: [],
        activeObjectiveId: undefined,
        completionPercent: 0,
        progressContext: '',
        checkpoint: null,
        runError: null,
        activeFilePath: undefined,
        currentPass: undefined,
        totalPasses: undefined,
        passFocus: undefined,
    };
}

/**
 * Hook for managing stream/progress-related state.
 * Includes streaming status, progress tracking, objectives, checkpoints, and errors.
 */
export function useStreamState() {
    const [stream, setStream] = useState<StreamState>(createInitialStreamState());

    // --- Persistence ---
    // MOVED to useMarie.ts to prevent competing setState calls and state erasure

    // --- Re-sync with Extension Host ---
    useEffect(() => {
        // When the hook mounts, if we're not idle, we might have had a crash/reload
        // Or we just want to pulse the backend to get the latest snapshot
        vscode.postMessage({ type: 'requestRunState' });
    }, []);

    // --- Stream state setters ---
    const setStreamStage = useCallback((val: SetStateAction<StreamStage>) => {
        setStream(prev => ({ ...prev, streamStage: resolveSetStateAction(val, prev.streamStage) }));
    }, []);

    const setStreamStartedAt = useCallback((val: SetStateAction<number | null>) => {
        setStream(prev => ({ ...prev, streamStartedAt: resolveSetStateAction(val, prev.streamStartedAt) }));
    }, []);

    const setStepCount = useCallback((val: SetStateAction<number>) => {
        setStream(prev => ({ ...prev, stepCount: resolveSetStateAction(val, prev.stepCount) }));
    }, []);

    const setToolCount = useCallback((val: SetStateAction<number>) => {
        setStream(prev => ({ ...prev, toolCount: resolveSetStateAction(val, prev.toolCount) }));
    }, []);

    // REASONING BUFFER CAP: Circular buffer to prevent infinite growth
    const setReasoning = useCallback((val: SetStateAction<string>) => {
        setStream(prev => {
            const newValue = resolveSetStateAction(val, prev.reasoning);
            // Cap at 10,000 characters - keep last portion with indicator
            const MAX_REASONING_LENGTH = 10000;
            if (newValue.length > MAX_REASONING_LENGTH) {
                return {
                    ...prev,
                    reasoning: '... [buffer truncated] ...\n' + newValue.slice(-MAX_REASONING_LENGTH + 30)
                };
            }
            return { ...prev, reasoning: newValue };
        });
    }, []);

    const setCurrentStepLabel = useCallback((val: SetStateAction<string>) => {
        setStream(prev => ({ ...prev, currentStepLabel: resolveSetStateAction(val, prev.currentStepLabel) }));
    }, []);

    const setTokenUsage = useCallback((val: SetStateAction<StreamState['tokenUsage']>) => {
        setStream(prev => ({ ...prev, tokenUsage: resolveSetStateAction(val, prev.tokenUsage) }));
    }, []);

    const setProgressObjectives = useCallback((val: SetStateAction<ProgressObjective[]>) => {
        setStream(prev => {
            const next = resolveSetStateAction(val, prev.progressObjectives);
            return { ...prev, progressObjectives: Array.isArray(next) ? next : [] };
        });
    }, []);

    const setActiveObjectiveId = useCallback((val: SetStateAction<string | undefined>) => {
        setStream(prev => ({ ...prev, activeObjectiveId: resolveSetStateAction(val, prev.activeObjectiveId) }));
    }, []);

    const setCompletionPercent = useCallback((val: SetStateAction<number>) => {
        setStream(prev => ({ ...prev, completionPercent: resolveSetStateAction(val, prev.completionPercent) }));
    }, []);

    const setProgressContext = useCallback((val: SetStateAction<string>) => {
        setStream(prev => ({ ...prev, progressContext: resolveSetStateAction(val, prev.progressContext) }));
    }, []);

    const setCheckpoint = useCallback((val: SetStateAction<CheckpointPayload | null>) => {
        setStream(prev => ({ ...prev, checkpoint: resolveSetStateAction(val, prev.checkpoint) }));
    }, []);

    const setRunError = useCallback((val: SetStateAction<string | null>) => {
        setStream(prev => ({ ...prev, runError: resolveSetStateAction(val, prev.runError) }));
    }, []);

    const setActiveFilePath = useCallback((val: SetStateAction<string | undefined>) => {
        setStream(prev => ({ ...prev, activeFilePath: resolveSetStateAction(val, prev.activeFilePath) }));
    }, []);

    const setCurrentPass = useCallback((val: SetStateAction<number | undefined>) => {
        setStream(prev => ({ ...prev, currentPass: resolveSetStateAction(val, prev.currentPass) }));
    }, []);

    const setTotalPasses = useCallback((val: SetStateAction<number | undefined>) => {
        setStream(prev => ({ ...prev, totalPasses: resolveSetStateAction(val, prev.totalPasses) }));
    }, []);

    const setPassFocus = useCallback((val: SetStateAction<string | undefined>) => {
        setStream(prev => ({ ...prev, passFocus: resolveSetStateAction(val, prev.passFocus) }));
    }, []);

    const resetStreamState = useCallback(() => {
        setStream({
            streamStage: 'idle',
            streamStartedAt: null,
            stepCount: 0,
            toolCount: 0,
            reasoning: '',
            currentStepLabel: '',
            tokenUsage: null,
            progressObjectives: [],
            activeObjectiveId: undefined,
            completionPercent: 0,
            progressContext: '',
            checkpoint: null,
            runError: null,
            activeFilePath: undefined,
            currentPass: undefined,
            totalPasses: undefined,
            passFocus: undefined,
        });
    }, []);

    // PHASE 6: Atomic Webview Reset - Specialized reset for session transitions
    // Clears reasoning, progress rails, and checkpoints instantly on switch
    const atomicResetStream = useCallback(() => {
        // Immediately clear all volatile stream state
        setStream({
            streamStage: 'idle',
            streamStartedAt: null,
            stepCount: 0,
            toolCount: 0,
            reasoning: '',
            currentStepLabel: '',
            tokenUsage: null,
            progressObjectives: [],
            activeObjectiveId: undefined,
            completionPercent: 0,
            progressContext: '',
            checkpoint: null,
            runError: null,
            activeFilePath: undefined,
            currentPass: undefined,
            totalPasses: undefined,
            passFocus: undefined,
        });

        // PHASE 6: Also clear persisted VS Code state to prevent stale data on reload
        // This ensures a clean slate when switching sessions
        try {
            const vscode = (window as any).acquireVsCodeApi?.();
            if (vscode?.setState) {
                // Clear only stream-related persisted state, preserve other settings
                const current = vscode.getState?.() || {};
                vscode.setState({
                    ...current,
                    stream: undefined,
                    _lastSessionReset: Date.now()
                });
            }
        } catch (e) {
            console.warn('[useStreamState] Failed to clear persisted state:', e);
        }
    }, []);

    // --- Computed setters object for effects ---
    const setters = useMemo(() => ({
        setStreamStage,
        setStreamStartedAt,
        setStepCount,
        setToolCount,
        setReasoning,
        setCurrentStepLabel,
        setTokenUsage,
        setProgressObjectives,
        setActiveObjectiveId,
        setCompletionPercent,
        setProgressContext,
        setCheckpoint,
        setRunError,
        setActiveFilePath,
        setCurrentPass,
        setTotalPasses,
        setPassFocus,
        resetStreamState,
        atomicResetStream,
    }), [
        setStreamStage,
        setStreamStartedAt,
        setStepCount,
        setToolCount,
        setReasoning,
        setCurrentStepLabel,
        setTokenUsage,
        setProgressObjectives,
        setActiveObjectiveId,
        setCompletionPercent,
        setProgressContext,
        setCheckpoint,
        setRunError,
        setActiveFilePath,
        setCurrentPass,
        setTotalPasses,
        setPassFocus,
        resetStreamState,
        atomicResetStream,
    ]);

    // --- State output for components ---
    const state = useMemo(() => stream, [stream]);

    return {
        state,
        setters,
    };
}

export type StreamStateAPI = ReturnType<typeof useStreamState>;
