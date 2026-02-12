import { RunTelemetry } from '../../domain/marie/MarieTypes.js';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
    toolCalls?: ToolCall[];
}

export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
    output?: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    duration?: number;
}

export interface Session {
    id: string;
    title: string;
    lastModified: number;
    isPinned: boolean;
    messageCount: number;
}

export interface GitStatus {
    branch: string;
    isClean: boolean;
    ahead: number;
    behind: number;
    modified: string[];
    staged: string[];
}

export interface FileContext {
    path: string;
    content?: string;
    isActive: boolean;
}

export interface StreamingState {
    isActive: boolean;
    content: string;
    toolCall?: ToolCall;
    toolCalls?: ToolCall[];
}

export interface ApprovalRequest {
    id: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    diff?: {
        old: string;
        new: string;
    };
    resolve: (approved: boolean) => void;
}

export interface Theme {
    colors: {
        primary: string;
        secondary: string;
        success: string;
        warning: string;
        error: string;
        info: string;
        muted: string;
        background: string;
        foreground: string;
        border: string;
    };
    icons: {
        assistant: string;
        user: string;
        tool: string;
        file: string;
        folder: string;
        git: string;
        spinner: string;
        success: string;
        warning: string;
        error: string;
        info: string;
        checkpoint: string;
        council: string;
    };
}

export type ViewMode = 'chat' | 'sessions' | 'files' | 'settings';

export interface CommandSuggestion {
    label: string;
    value: string;
    description?: string;
    icon?: string;
}
