import { useState, useCallback, useMemo } from 'react';
import type { SetStateAction } from 'react';
import type {
    MessageType,
    MarieStatus,
    ToastType,
    ChatState,
    Settings,
    ApprovalRequestPayload,
} from '../types';
import { vscode } from '../utils/vscode';

/** Helper to resolve SetStateAction without `any` casting */
import { validateMessages, validateSessions, validateSettings } from '../utils/validation';

/** Helper to resolve SetStateAction without `any` casting */
function resolveSetStateAction<T>(val: SetStateAction<T>, prev: T): T {
    return typeof val === 'function' ? (val as (prevState: T) => T)(prev) : val;
}

/** Initial chat state factory */
function createInitialChatState(persisted: {
    messages?: any;
    sessions?: any;
    currentSessionId?: any;
}): Omit<ChatState, 'settings' | 'approvalRequest'> {
    // STABILITY: Validate all persisted data before it enters state
    return {
        messages: validateMessages(persisted.messages),
        marieStatus: 'idle',
        toasts: [],
        sessions: validateSessions(persisted.sessions),
        currentSessionId: typeof persisted.currentSessionId === 'string' ? persisted.currentSessionId : null,
        activeFile: 'No active file',
        lettingGoFile: null,
        sproutingFile: null,
        availableModels: [],
        isLoadingModels: false,
    };
}

/**
 * Hook for managing chat-related state.
 * Includes messages, sessions, status, toasts, file operations, models, and approval requests.
 */
export function useChatState() {
    // Load initial state from VS Code persistence
    const persisted = vscode.getState<any>() ?? {};

    // Main chat state (excludes settings and approvalRequest for cleaner separation)
    const [chat, setChat] = useState(createInitialChatState(persisted));

    // Settings stored separately with validation
    const [settings, setSettingsState] = useState<Settings>(validateSettings(persisted.settings));

    // Approval request stored separately for UI/modal handling
    const [approvalRequest, setApprovalRequestState] = useState<ApprovalRequestPayload | null>(null);

    // --- Constants ---
    const MAX_MESSAGES = 100;
    const MAX_TOTAL_CHAR_COUNT = 1000000; // ~1MB of text

    // --- Chat state setters ---
    const setMessages = useCallback((val: SetStateAction<MessageType[]>) => {
        setChat(prev => {
            const next = resolveSetStateAction(val, prev.messages);
            let result = Array.isArray(next) ? next : [];

            // Prune history if it exceeds limit to prevent memory bloat and bridge congestion
            if (result.length > MAX_MESSAGES) {
                result = result.slice(-MAX_MESSAGES);
            }

            // Secondary Prune: Total char count limit (prevent vscode.setState crash)
            let totalChars = 0;
            let pruneIndex = -1;
            for (let i = result.length - 1; i >= 0; i--) {
                const msg = result[i];
                // STABILITY: Safe property access for toolInput depending on msg role and variant
                const toolInputLength = (msg.role === 'marie' && msg.variant === 'tool-call' && typeof msg.toolInput === 'string')
                    ? msg.toolInput.length
                    : 0;

                const msgSize = (msg.text?.length || 0) + toolInputLength;
                totalChars += msgSize;
                if (totalChars > MAX_TOTAL_CHAR_COUNT && i > 0) {
                    pruneIndex = i;
                    break;
                }
            }

            if (pruneIndex !== -1) {
                console.warn(`[useChatState] Pruning ${pruneIndex} messages due to size limits (${totalChars} chars)`);
                result = result.slice(pruneIndex);
            }

            return { ...prev, messages: result };
        });
    }, [MAX_MESSAGES, MAX_TOTAL_CHAR_COUNT]);

    const setMarieStatus = useCallback((val: SetStateAction<MarieStatus>) => {
        setChat(prev => {
            const nextStatus = resolveSetStateAction(val, prev.marieStatus);

            // TRANSITION INTEGRITY: Prevent illogical state jumps
            // e.g., Cannot be 'responding' if there are no messages
            if (nextStatus === 'responding' && prev.messages.length === 0) {
                console.warn("[useChatState] Attempted responding status with empty message history. Reverting to idle.");
                return { ...prev, marieStatus: 'idle' };
            }

            return { ...prev, marieStatus: nextStatus };
        });
    }, []);

    const setToasts = useCallback((val: SetStateAction<ToastType[]>) => {
        setChat(prev => ({ ...prev, toasts: resolveSetStateAction(val, prev.toasts) }));
    }, []);

    const setSessions = useCallback((val: SetStateAction<ChatState['sessions']>) => {
        setChat(prev => {
            const next = resolveSetStateAction(val, prev.sessions);
            return { ...prev, sessions: Array.isArray(next) ? next : [] };
        });
    }, []);

    const setCurrentSessionId = useCallback((val: SetStateAction<string | null>) => {
        setChat(prev => ({ ...prev, currentSessionId: resolveSetStateAction(val, prev.currentSessionId) }));
    }, []);

    const setActiveFile = useCallback((val: SetStateAction<string>) => {
        setChat(prev => ({ ...prev, activeFile: resolveSetStateAction(val, prev.activeFile) }));
    }, []);

    const setLettingGoFile = useCallback((val: SetStateAction<{ fullPath: string; fileName?: string; lines?: number } | null>) => {
        setChat(prev => ({ ...prev, lettingGoFile: resolveSetStateAction(val, prev.lettingGoFile) }));
    }, []);

    const setSproutingFile = useCallback((val: SetStateAction<{ fileName: string; suggestedPath?: string } | null>) => {
        setChat(prev => ({ ...prev, sproutingFile: resolveSetStateAction(val, prev.sproutingFile) }));
    }, []);

    const setAvailableModels = useCallback((val: SetStateAction<{ id: string; name: string }[]>) => {
        setChat(prev => ({ ...prev, availableModels: resolveSetStateAction(val, prev.availableModels) }));
    }, []);

    const setIsLoadingModels = useCallback((val: SetStateAction<boolean>) => {
        setChat(prev => ({ ...prev, isLoadingModels: resolveSetStateAction(val, prev.isLoadingModels) }));
    }, []);

    const setSettings = useCallback((val: SetStateAction<Settings>) => {
        setSettingsState(prev => resolveSetStateAction(val, prev));
    }, []);

    const setApprovalRequest = useCallback((val: SetStateAction<ApprovalRequestPayload | null>) => {
        setApprovalRequestState(prev => resolveSetStateAction(val, prev));
    }, []);

    // --- Computed setters object for effects ---
    const setters = useMemo(() => ({
        setMessages,
        setMarieStatus,
        setToasts,
        setSessions,
        setCurrentSessionId,
        setActiveFile,
        setLettingGoFile,
        setSproutingFile,
        setAvailableModels,
        setIsLoadingModels,
        setSettings,
        setApprovalRequest,
    }), [
        setMessages,
        setMarieStatus,
        setToasts,
        setSessions,
        setCurrentSessionId,
        setActiveFile,
        setLettingGoFile,
        setSproutingFile,
        setAvailableModels,
        setIsLoadingModels,
        setSettings,
        setApprovalRequest,
    ]);

    // --- State output for components ---
    const state = useMemo(() => ({
        ...chat,
        settings,
        approvalRequest,
    }), [chat, settings, approvalRequest]);

    return {
        state,
        setters,
    };
}

export type ChatStateAPI = ReturnType<typeof useChatState>;
