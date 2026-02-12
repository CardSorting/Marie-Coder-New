import type { Settings } from '../../types';
import type { HandlerContext } from './types';

interface SettingsMessage {
    value: {
        sessions?: { id: string; title: string; lastModified: number; isPinned?: boolean }[];
        currentSessionId?: string;
        apiKey?: string;
        openrouterApiKey?: string;
        cerebrasApiKey?: string;
        aiProvider: 'anthropic' | 'openrouter' | 'cerebras';
        model: string;
    };
}

interface SessionsListMessage {
    value: {
        sessions?: { id: string; title: string; lastModified: number; isPinned?: boolean }[];
        currentSessionId?: string;
    } | { id: string; title: string; lastModified: number; isPinned?: boolean }[];
}

/**
 * Handles settings updates from the extension.
 * Updates settings and optionally session info.
 */
export function handleOnSettings(
    message: SettingsMessage,
    ctx: HandlerContext
): void {
    const { setSettings, setSessions, setCurrentSessionId } = ctx;
    const { sessions: initialSessions, currentSessionId: initialId, ...restSettings } = message.value;

    setSettings(restSettings as Settings);
    if (initialSessions) setSessions(initialSessions);
    if (initialId) setCurrentSessionId(initialId);
}

/**
 * Handles session list updates from the extension.
 * Handles both new format (with sessions array) and legacy format.
 */
export function handleOnSessionsList(
    message: SessionsListMessage,
    ctx: HandlerContext
): void {
    const { setSessions, setCurrentSessionId } = ctx;

    if (message.value && 'sessions' in message.value && Array.isArray(message.value.sessions)) {
        setSessions(message.value.sessions);
        if (message.value.currentSessionId) {
            setCurrentSessionId(message.value.currentSessionId);
        }
    } else if (Array.isArray(message.value)) {
        // Fallback for old simple list format just in case
        setSessions(message.value);
    }
}
