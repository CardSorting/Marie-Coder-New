// Minimal types for Marie Chat - flattened from types/index.ts

export interface Settings {
    apiKey?: string;
    openrouterApiKey?: string;
    cerebrasApiKey?: string;
    aiProvider: 'anthropic' | 'openrouter' | 'cerebras';
    model: string;
}

export interface ToastType {
    id: string;
    message: string;
}

export type MarieStatus = 'idle' | 'thinking' | 'responding' | 'error';
export type StreamStage = 'idle' | 'thinking' | 'responding' | 'done' | 'error';

export interface ProjectHealth {
    average: number;
    clutterCount: number;
    joyfulFiles: number;
    plumbingFiles: number;
}

export interface MessageType {
    role: 'user' | 'marie';
    text: string;
    timestamp: string;
    variant?: 'thinking';
}

export interface Session {
    id: string;
    title: string;
    lastModified: number;
    isPinned?: boolean;
}

export interface AppState {
    messages: MessageType[];
    marieStatus: MarieStatus;
    sessions: Session[];
    currentSessionId: string | null;
    activeFile: string;
    settings: Settings;
    availableModels: { id: string; name: string }[];
    isLoadingModels: boolean;
    toasts: ToastType[];
    // Stream state
    streamStage: StreamStage;
    completionPercent: number;
    // UI state
    isSettingsOpen: boolean;
    isSessionListOpen: boolean;
}

export type WebviewMessage =
    | { type: 'onMessage'; value: string }
    | { type: 'stop' }
    | { type: 'newSession' }
    | { type: 'loadSession'; value: string }
    | { type: 'deleteSession'; value: string }
    | { type: 'renameSession'; value: { id: string; title: string } }
    | { type: 'togglePinSession'; value: string }
    | { type: 'updateSettings'; value: Settings }
    | { type: 'fetchModels'; provider: 'anthropic' | 'openrouter' | 'cerebras' }
    | { type: 'requestTidy' }
    | { type: 'error'; value: { message: string; stack?: string } };
