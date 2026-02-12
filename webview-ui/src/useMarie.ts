// Single state hook for Marie Chat - replaces 6+ hooks and handler system

import { useState, useEffect, useCallback, useRef } from 'react';
import { vscode } from './vscode';
import type { AppState, Settings } from './types';

const defaultSettings: Settings = {
    aiProvider: 'anthropic',
    model: 'claude-3-sonnet-20240229'
};

const createInitialState = (): AppState => {
    const persisted = vscode.getState<Partial<AppState>>() ?? {};
    return {
        messages: persisted.messages ?? [],
        marieStatus: 'idle',
        sessions: persisted.sessions ?? [],
        currentSessionId: persisted.currentSessionId ?? null,
        activeFile: 'No active file',
        settings: persisted.settings ?? defaultSettings,
        availableModels: [],
        isLoadingModels: false,
        toasts: [],
        streamStage: 'idle',
        completionPercent: 0,
        isSettingsOpen: false,
        isSessionListOpen: false,
    };
};

export function useMarie() {
    const [state, setState] = useState<AppState>(createInitialState);
    const persistenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Persistence - debounced
    useEffect(() => {
        if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
        persistenceTimer.current = setTimeout(() => {
            vscode.setState({
                messages: state.messages.slice(-50), // Keep last 50
                settings: state.settings,
                sessions: state.sessions,
                currentSessionId: state.currentSessionId,
            });
        }, 300);
        return () => { if (persistenceTimer.current) clearTimeout(persistenceTimer.current); };
    }, [state.messages, state.settings, state.sessions, state.currentSessionId]);

    // Message listener - simplified
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const msg = event.data;
            if (!msg?.type) return;

            switch (msg.type) {
                case 'onResponse':
                    setState(s => ({
                        ...s,
                        marieStatus: 'idle',
                        streamStage: 'done',
                        messages: [...s.messages, { role: 'marie', text: msg.value, timestamp: getTime() }]
                    }));
                    break;
                case 'onStreamUpdate':
                    setState(s => {
                        const last = s.messages[s.messages.length - 1];
                        if (last && last.role === 'marie' && !last.variant) {
                            const updated = [...s.messages];
                            updated[updated.length - 1] = { ...last, text: last.text + msg.value };
                            return { ...s, messages: updated, marieStatus: 'responding' };
                        }
                        return {
                            ...s,
                            marieStatus: 'responding',
                            messages: [...s.messages, { role: 'marie', text: msg.value, timestamp: getTime() }]
                        };
                    });
                    break;
                case 'onSessionLoaded':
                    if (Array.isArray(msg.value)) {
                        setState(s => ({
                            ...s,
                            messages: msg.value.map((m: any) => ({
                                role: m.role,
                                text: typeof m.content === 'string' ? m.content : '',
                                timestamp: getTime()
                            })),
                            marieStatus: 'idle'
                        }));
                    }
                    break;
                case 'onSessionsList':
                    if (Array.isArray(msg.value)) {
                        setState(s => ({ ...s, sessions: msg.value }));
                    }
                    break;
                case 'onSettings':
                    setState(s => ({ ...s, settings: { ...s.settings, ...msg.value } }));
                    break;
                case 'onModels':
                    if (Array.isArray(msg.value)) {
                        setState(s => ({ ...s, availableModels: msg.value, isLoadingModels: false }));
                    }
                    break;
                case 'onActiveFile':
                    if (typeof msg.value === 'string') {
                        setState(s => ({ ...s, activeFile: msg.value }));
                    }
                    break;
                case 'onRunStart':
                    setState(s => ({ ...s, streamStage: 'thinking', completionPercent: 0 }));
                    break;
                case 'onRunComplete':
                    setState(s => ({ ...s, streamStage: 'done', marieStatus: 'idle' }));
                    break;
                case 'onProgressUpdate':
                    setState(s => ({
                        ...s,
                        completionPercent: msg.value?.completionPercent ?? s.completionPercent
                    }));
                    break;
                case 'onRunError':
                    setState(s => ({ ...s, marieStatus: 'error', streamStage: 'error' }));
                    break;
                case 'onToast':
                    showToast(msg.value);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'getProjectHealth' });
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const showToast = useCallback((message: string) => {
        const id = Math.random().toString(36).slice(2);
        setState(s => ({ ...s, toasts: [{ id, message }] }));
        setTimeout(() => setState(s => ({ ...s, toasts: [] })), 3000);
    }, []);

    // Actions
    const sendMessage = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        if (trimmed === '/clear') {
            setState(s => ({ ...s, messages: [] }));
            return;
        }

        if (trimmed === '/help') {
            setState(s => ({
                ...s,
                messages: [
                    ...s.messages,
                    { role: 'user', text: trimmed, timestamp: getTime() },
                    { role: 'marie', text: '**Commands:** /clear, /tidy, /help', timestamp: getTime() }
                ]
            }));
            return;
        }

        if (trimmed === '/tidy') {
            vscode.postMessage({ type: 'requestTidy' });
        }

        setState(s => ({
            ...s,
            marieStatus: 'thinking',
            messages: [...s.messages, { role: 'user', text: trimmed, timestamp: getTime() }]
        }));
        vscode.postMessage({ type: 'onMessage', value: trimmed });
    }, []);

    const handleStop = useCallback(() => {
        vscode.postMessage({ type: 'stop' });
        setState(s => ({ ...s, marieStatus: 'idle', streamStage: 'idle' }));
    }, []);

    const createNewSession = useCallback(() => {
        vscode.postMessage({ type: 'newSession' });
        setState(s => ({ ...s, isSessionListOpen: false, messages: [] }));
    }, []);

    const switchSession = useCallback((id: string) => {
        vscode.postMessage({ type: 'loadSession', value: id });
        setState(s => ({ ...s, isSessionListOpen: false, streamStage: 'idle' }));
    }, []);

    const removeSession = useCallback((id: string) => {
        vscode.postMessage({ type: 'deleteSession', value: id });
    }, []);

    const renameSession = useCallback((id: string, title: string) => {
        vscode.postMessage({ type: 'renameSession', value: { id, title } });
    }, []);

    const togglePinSession = useCallback((id: string) => {
        vscode.postMessage({ type: 'togglePinSession', value: id });
    }, []);

    const saveSettings = useCallback((settings: Settings) => {
        setState(s => ({ ...s, settings, isSettingsOpen: false }));
        vscode.postMessage({ type: 'updateSettings', value: settings });
    }, []);

    const fetchModels = useCallback((provider: 'anthropic' | 'openrouter' | 'cerebras') => {
        setState(s => ({ ...s, isLoadingModels: true }));
        vscode.postMessage({ type: 'fetchModels', provider });
    }, []);

    const setIsSettingsOpen = useCallback((open: boolean) => {
        setState(s => ({ ...s, isSettingsOpen: open }));
    }, []);

    const setIsSessionListOpen = useCallback((open: boolean) => {
        setState(s => ({ ...s, isSessionListOpen: open }));
    }, []);

    return {
        state,
        actions: {
            sendMessage,
            handleStop,
            createNewSession,
            switchSession,
            removeSession,
            renameSession,
            togglePinSession,
            saveSettings,
            fetchModels,
            setIsSettingsOpen,
            setIsSessionListOpen,
        }
    };
}
