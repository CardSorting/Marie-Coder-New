import { useEffect, useMemo, useRef } from 'react';
import { useChatState } from './useChatState';
import { useGardenState } from './useGardenState';
import { useStreamState } from './useStreamState';
import { useUIState } from './useUIState';
import { useMarieActions } from './useMarieActions';
import { useMarieEffects } from './useMarieEffects';
import { useHandlerContext } from './effects/useHandlerContext';
import { vscode } from '../utils/vscode';
import type { MarieSetters } from './effects';

/**
 * Main Marie hook - orchestrates state, actions, and effects.
 *
 * This hook composes smaller, focused hooks for separation of concerns:
 * - useChatState: Messages, sessions, settings, models, approval requests
 * - useGardenState: Joy score, health, lifecycle, achievements
 * - useStreamState: Stream progress, objectives, checkpoints
 * - useUIState: Modal visibility, sparkles, UI toggles
 * - useMarieActions: Message sending, session management, utilities
 * - useMarieEffects: VS Code message handling
 */
export function useMarie() {
    // --- State hooks ---
    const ui = useUIState();
    const chat = useChatState();
    const garden = useGardenState();
    const stream = useStreamState();

    // --- Actions (depends on state values) ---
    const actions = useMarieActions({
        messages: chat.state.messages,
        marieStatus: chat.state.marieStatus,
        lettingGoFile: chat.state.lettingGoFile,
        setMessages: chat.setters.setMessages,
        setMarieStatus: chat.setters.setMarieStatus,
        setToasts: chat.setters.setToasts,
        setIsClearModalOpen: ui.setters.setIsClearModalOpen,
        setIsSettingsOpen: ui.setters.setIsSettingsOpen,
        setIsSessionListOpen: ui.setters.setIsSessionListOpen,
        setSettings: chat.setters.setSettings,
        setLettingGoFile: chat.setters.setLettingGoFile,
        setApprovalRequest: chat.setters.setApprovalRequest,
        setIsLoadingModels: chat.setters.setIsLoadingModels,
        triggerSparkles: ui.actions.triggerSparkles,
    });

    // --- Persistence timer ref ---
    const persistenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Effects ---

    // STABILITY: Atomic reset on session switch
    useEffect(() => {
        if (chat.state.currentSessionId) {
            // PHASE 6: Persistence Protection - Cancel any pending persistence from the PREVIOUS session
            if (persistenceTimerRef.current) {
                clearTimeout(persistenceTimerRef.current);
                persistenceTimerRef.current = null;
            }

            // PHASE 6: Persistence Protection - Explicitly flush/clear VS Code state to prevent pollution
            // This ensures old state is not saved under a new session ID
            try {
                // Clear any pending state and immediately set minimal clean state
                const minimalState = {
                    messages: [],
                    settings: chat.state.settings,
                    sessions: chat.state.sessions,
                    currentSessionId: chat.state.currentSessionId,
                    stream: undefined,
                    _sessionSwitchedAt: Date.now()
                };
                vscode.setState(minimalState);
            } catch (e) {
                console.warn('[useMarie] Failed to clear state on session switch:', e);
            }

            // PHASE 6: Atomic Webview Reset - Wipe volatile stream state using atomic reset
            stream.setters.atomicResetStream();
        }
    }, [chat.state.currentSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Initial array validation - defer state update to avoid sync setState in effect

    // Check project health on wake up
    useEffect(() => {
        vscode.postMessage({ type: 'getProjectHealth' });
    }, []);

    // Debounced persistence (500ms) to reduce extension host overhead
    useEffect(() => {
        if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
        persistenceTimerRef.current = setTimeout(() => {
            // STABILITY: Deep-clean state to ensure JSON-serializable for VS Code bridge
            const stateToPersist = {
                messages: chat.state.messages,
                settings: chat.state.settings,
                sessions: chat.state.sessions,
                currentSessionId: chat.state.currentSessionId,
                stream: stream.state // Consolidated persistence to prevent race conditions
            };

            const sanitizeForPersistence = (obj: any): any => {
                const seen = new WeakSet();
                const MAX_DEPTH = 5; // Slightly shallower for safety
                const MAX_MSG_HISTORY = 100; // Cap persistent history per session

                const internalSanitize = (val: any, depth: number): any => {
                    if (depth > MAX_DEPTH) return undefined;
                    if (val === null || val === undefined) return val;

                    const type = typeof val;
                    if (type === "string" || type === "number" || type === "boolean") return val;
                    if (type !== "object") return undefined;

                    // Circularity check
                    if (seen.has(val)) return undefined;
                    seen.add(val);

                    if (Array.isArray(val)) {
                        // Limit array persistence for extreme cases
                        const cap = depth === 1 && Array.isArray(val) && val.length > MAX_MSG_HISTORY ? MAX_MSG_HISTORY : 200;
                        return val.slice(0, cap).map(item => internalSanitize(item, depth + 1));
                    }

                    const sanitized: any = {};
                    let keys = Object.keys(val);
                    // Prevent huge objects from crashing the bridge
                    if (keys.length > 100) keys = keys.slice(0, 100);

                    for (const key of keys) {
                        if (key.startsWith('$$') || (key.startsWith('_') && key !== '_id')) continue;
                        sanitized[key] = internalSanitize(val[key], depth + 1);
                    }
                    return sanitized;
                };

                try {
                    return internalSanitize(obj, 0);
                } catch (e) {
                    console.warn("[useMarie] Persistence sanitization failed", e);
                    return {};
                }
            };

            const sanitized = sanitizeForPersistence(stateToPersist);

            // Final safety check: if sanitized state is somehow still massive, don't persist it
            // as it might crash the webview-host bridge (IPC limit)
            const serializedLength = JSON.stringify(sanitized).length;
            if (serializedLength > 800000) { // ~800KB limit for VS Code persistence safety
                console.warn("[useMarie] State too large to persist safely:", serializedLength);
                // Maybe persist only settings and session metadata in extreme cases?
                vscode.setState({
                    settings: chat.state.settings,
                    sessions: chat.state.sessions,
                    currentSessionId: chat.state.currentSessionId,
                    _warning: "History too large for persistence"
                });
            } else {
                vscode.setState(sanitized);
            }

            persistenceTimerRef.current = null;
        }, 500);

        return () => {
            if (persistenceTimerRef.current) clearTimeout(persistenceTimerRef.current);
        };
    }, [chat.state.messages, chat.state.settings, chat.state.sessions, chat.state.currentSessionId, stream.state]);

    // Compose handler context - combine all setters to match MarieSetters type
    const allSetters = {
        ...chat.setters,
        ...garden.setters,
        ...stream.setters,
        ...ui.setters,
    };
    const context = useHandlerContext(allSetters as any, actions, chat.state.currentSessionId);

    // Message effects (VS Code integration)
    // Cast to MarieSetters to help TypeScript with type inference from spread operators
    useMarieEffects(
        {
            ...chat.setters,
            ...garden.setters,
            ...stream.setters,
            ...ui.setters,
            currentSessionId: chat.state.currentSessionId
        } as unknown as MarieSetters,
        {
            triggerSparkles: ui.actions.triggerSparkles,
            showToast: actions.showToast,
            confirmClearSession: actions.confirmClearSession,
        },
        context
    );

    // --- Output objects for components ---

    // Health class helper
    const getHealthClass = useMemo(() => {
        if (garden.state.joyScore >= 90) return 'health-high';
        if (garden.state.joyScore < 60) return 'health-low';
        return '';
    }, [garden.state.joyScore]);

    // State output - matches original App.tsx expectations
    const stateOutput = useMemo(() => ({
        ...chat.state,
        joyScore: garden.state.joyScore,
        projectHealth: garden.state.projectHealth,
        currentZone: garden.state.currentZone,
    }), [chat.state, garden.state.joyScore, garden.state.projectHealth, garden.state.currentZone]);

    // UI output - includes modal states and helpers
    // Note: sproutingFile and lettingGoFile are included for backward compatibility
    const uiOutput = useMemo(() => ({
        ...ui.state,
        sproutingFile: chat.state.sproutingFile,
        lettingGoFile: chat.state.lettingGoFile,
        setIsVitalityOpen: ui.setters.setIsVitalityOpen,
        setIsSettingsOpen: ui.setters.setIsSettingsOpen,
        setIsClearModalOpen: ui.setters.setIsClearModalOpen,
        setIsSessionListOpen: ui.setters.setIsSessionListOpen,
        setLettingGoFile: chat.setters.setLettingGoFile,
        setSproutingFile: chat.setters.setSproutingFile,
        triggerSparkles: ui.actions.triggerSparkles,
        getHealthClass: () => getHealthClass,
    }), [
        ui.state,
        chat.state.sproutingFile,
        chat.state.lettingGoFile,
        ui.setters.setIsVitalityOpen,
        ui.setters.setIsSettingsOpen,
        ui.setters.setIsClearModalOpen,
        ui.setters.setIsSessionListOpen,
        chat.setters.setLettingGoFile,
        chat.setters.setSproutingFile,
        ui.actions.triggerSparkles,
        getHealthClass,
    ]);

    // Stream output - includes garden data needed by LiveActivityArea
    const streamOutput = useMemo(() => ({
        ...stream.state,
        showProgressDetails: ui.state.showProgressDetails,
        approvalRequest: chat.state.approvalRequest,
        achievements: garden.state.achievements,
        passHistory: garden.state.passHistory,
        gardenMetrics: garden.state.gardenMetrics,
        lifecycleStage: garden.state.lifecycleStage,
        ritualComplete: garden.state.ritualComplete,
        currentPass: stream.state.currentPass,
        totalPasses: stream.state.totalPasses,
        passFocus: stream.state.passFocus,
        setShowProgressDetails: ui.setters.setShowProgressDetails,
        setApprovalRequest: chat.setters.setApprovalRequest,
        handleApprovalRespond: actions.handleApprovalRespond,
    }), [
        stream.state,
        ui.state.showProgressDetails,
        chat.state.approvalRequest,
        garden.state.achievements,
        garden.state.passHistory,
        garden.state.gardenMetrics,
        garden.state.lifecycleStage,
        garden.state.ritualComplete,
        ui.setters.setShowProgressDetails,
        chat.setters.setApprovalRequest,
        actions.handleApprovalRespond,
    ]);

    return {
        state: stateOutput,
        ui: uiOutput,
        stream: streamOutput,
        actions,
    };
}
