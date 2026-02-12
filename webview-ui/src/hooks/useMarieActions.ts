import { useCallback, useMemo, useRef } from 'react';
import type { SetStateAction } from 'react';
import type { Settings, MessageType, ToastType, ApprovalRequestPayload } from '../types';
import { vscode } from '../utils/vscode';
import { useSafeCallback } from '../utils/useSafeCallback';

/** Dependencies needed for actions */
interface ActionDeps {
    // State values
    messages: MessageType[];
    marieStatus: 'idle' | 'thinking' | 'responding' | 'error';
    lettingGoFile: { fullPath: string; fileName?: string; lines?: number } | null;

    // Setters
    setMessages: (val: SetStateAction<MessageType[]>) => void;
    setMarieStatus: (val: SetStateAction<'idle' | 'thinking' | 'responding' | 'error'>) => void;
    setToasts: (val: SetStateAction<ToastType[]>) => void;
    setIsClearModalOpen: (val: SetStateAction<boolean>) => void;
    setIsSettingsOpen: (val: SetStateAction<boolean>) => void;
    setIsSessionListOpen: (val: SetStateAction<boolean>) => void;
    setSettings: (val: SetStateAction<Settings>) => void;
    setLettingGoFile: (val: SetStateAction<{ fullPath: string; fileName?: string; lines?: number } | null>) => void;
    setApprovalRequest: (val: SetStateAction<ApprovalRequestPayload | null>) => void;
    setIsLoadingModels: (val: SetStateAction<boolean>) => void;

    // Actions
    triggerSparkles: () => void;
}

/**
 * Hook for managing all Marie actions.
 * Includes message sending, session management, settings, and utility actions.
 */
export function useMarieActions(deps: ActionDeps) {
    const {
        messages,
        marieStatus,
        lettingGoFile,
        setMessages,
        setMarieStatus,
        setToasts,
        setIsClearModalOpen,
        setIsSettingsOpen,
        setIsSessionListOpen,
        setSettings,
        setLettingGoFile,
        setApprovalRequest,
        setIsLoadingModels,
        triggerSparkles,
    } = deps;

    // Toast timer ref
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Utility functions ---
    const getCurrentTime = useCallback(() => {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, []);

    // --- Toast system ---
    const showToast = useSafeCallback((message: string) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

        setToasts(prev => {
            if (prev.length > 0 && prev[0].message === message) {
                return prev;
            }
            const id = Math.random().toString(36).substring(7);
            return [{ id, message }];
        });

        const duration = Math.max(3000, message.length * 50 + 1000);
        toastTimerRef.current = setTimeout(() => {
            setToasts([]);
            toastTimerRef.current = null;
        }, duration);
    }, [setToasts], 'showToast');

    // --- Core actions ---
    const confirmClearSession = useSafeCallback(() => {
        setMessages([]);
        setIsClearModalOpen(false);
        setToasts(prev => [...prev, {
            id: Date.now().toString(),
            message: "Session cleared with gratitude. ✨",
            type: 'success'
        }]);
        triggerSparkles();
    }, [setMessages, setIsClearModalOpen, setToasts, triggerSparkles], 'confirmClearSession');

    const sendMessage = useSafeCallback((text: string) => {
        const trimmedText = text?.trim();
        if (!trimmedText) return;

        const currentTime = getCurrentTime();

        // Slash Commands
        if (trimmedText === '/clear') {
            confirmClearSession();
            return;
        }

        if (trimmedText === '/tidy') {
            setMessages(prev => [...prev, {
                role: 'user',
                text: trimmedText,
                timestamp: currentTime
            }]);
            vscode.postMessage({ type: 'requestTidy' });
            setMessages(prev => [...prev, {
                role: 'marie',
                text: "Tidying up your file... ✨",
                timestamp: currentTime
            }]);
            triggerSparkles();
            return;
        }

        if (trimmedText === '/commit') {
            const commitMsg = "Generate a joyful commit message for the staged changes.";
            setMessages(prev => [...prev, {
                role: 'user',
                text: "/commit",
                timestamp: currentTime
            }]);
            setMarieStatus('thinking');
            vscode.postMessage({ type: 'onMessage', value: commitMsg });
            return;
        }

        if (trimmedText === '/help') {
            setMessages(prev => [...prev, {
                role: 'user',
                text: trimmedText,
                timestamp: currentTime
            }]);

            setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: 'marie',
                    text: "**Available Commands:**\n\n- `/tidy` - Format & organize imports\n- `/commit` - Generate a joyful commit message\n- `/clear` - Clear the session history\n- `/help` - Show this help message",
                    timestamp: getCurrentTime()
                }]);
            }, 200);
            return;
        }

        setMessages(prev => [...prev, {
            role: 'user',
            text: trimmedText,
            timestamp: currentTime
        }]);
        setMarieStatus('thinking');
        vscode.postMessage({ type: 'onMessage', value: trimmedText });
    }, [setMessages, setMarieStatus, triggerSparkles, confirmClearSession, getCurrentTime], 'sendMessage');

    const handleStop = useSafeCallback(() => {
        if (marieStatus !== 'idle') {
            vscode.postMessage({ type: 'stop' });
            setMarieStatus('idle');
        }
    }, [marieStatus, setMarieStatus], 'handleStop');

    const requestClearSession = useSafeCallback(() => {
        if (messages?.length > 0) {
            setIsClearModalOpen(true);
        }
    }, [messages?.length, setIsClearModalOpen], 'requestClearSession');

    const handleSaveSettings = useSafeCallback((newSettings: Settings) => {
        if (!newSettings) return;
        setSettings(newSettings);
        setIsSettingsOpen(false);
        vscode.postMessage({ type: 'updateSettings', value: newSettings });
    }, [setSettings, setIsSettingsOpen], 'handleSaveSettings');

    const handleLettingGoConfirm = useSafeCallback(() => {
        if (lettingGoFile) {
            vscode.postMessage({ type: 'confirmDelete', value: lettingGoFile.fullPath });
            setLettingGoFile(null);
            triggerSparkles();
        }
    }, [lettingGoFile, setLettingGoFile, triggerSparkles], 'handleLettingGoConfirm');

    const handleApprovalRespond = useSafeCallback((requestId: string, approved: boolean) => {
        if (!requestId) return;
        vscode.postMessage({
            type: 'toolApprovalResponse',
            value: { requestId, approved }
        });
        setApprovalRequest(null);
    }, [setApprovalRequest], 'handleApprovalRespond');

    // --- Session actions ---
    const createNewSession = useSafeCallback(() => {
        vscode.postMessage({ type: 'newSession' });
        setIsSessionListOpen(false);
    }, [setIsSessionListOpen], 'createNewSession');

    const switchSession = useSafeCallback((id: string) => {
        if (!id) return;
        vscode.postMessage({ type: 'loadSession', value: id });
        setIsSessionListOpen(false);
    }, [setIsSessionListOpen], 'switchSession');

    const removeSession = useSafeCallback((id: string) => {
        if (!id) return;
        vscode.postMessage({ type: 'deleteSession', value: id });
    }, [], 'removeSession');

    const renameSession = useSafeCallback((id: string, title: string) => {
        if (!id) return;
        vscode.postMessage({ type: 'renameSession', value: { id, title } });
    }, [], 'renameSession');

    const togglePinSession = useSafeCallback((id: string) => {
        if (!id) return;
        vscode.postMessage({ type: 'togglePinSession', value: id });
    }, [], 'togglePinSession');

    // --- Model actions ---
    const fetchModels = useSafeCallback((provider: 'anthropic' | 'openrouter' | 'cerebras') => {
        if (!provider) return;
        setIsLoadingModels(true);
        vscode.postMessage({ type: 'fetchModels', provider });
    }, [setIsLoadingModels], 'fetchModels');

    // --- Computed actions object ---
    const actions = useMemo(() => ({
        sendMessage,
        handleStop,
        requestClearSession,
        handleSaveSettings,
        handleLettingGoConfirm,
        confirmClearSession,
        createNewSession,
        switchSession,
        removeSession,
        renameSession,
        togglePinSession,
        fetchModels,
        handleApprovalRespond,
        showToast,
        triggerSparkles,
    }), [
        sendMessage,
        handleStop,
        requestClearSession,
        handleSaveSettings,
        handleLettingGoConfirm,
        confirmClearSession,
        createNewSession,
        switchSession,
        removeSession,
        renameSession,
        togglePinSession,
        fetchModels,
        handleApprovalRespond,
        showToast,
        triggerSparkles,
    ]);

    return actions;
}

export type MarieActions = ReturnType<typeof useMarieActions>;
