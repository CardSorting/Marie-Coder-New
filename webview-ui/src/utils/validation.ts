import type { MessageType, Settings, ChatState } from '../types';

/**
 * Validates a message object to ensure it has required fields and correct types.
 */
export function validateMessage(msg: any): msg is MessageType {
    if (!msg || typeof msg !== 'object') return false;

    // role is required and must be user or marie
    if (msg.role !== 'user' && msg.role !== 'marie') return false;

    // text should be a string (or at least exist if not a tool call)
    if (msg.role === 'user' && typeof msg.text !== 'string') return false;

    return true;
}

/**
 * Validates an array of messages.
 */
export function validateMessages(messages: any): MessageType[] {
    if (!Array.isArray(messages)) return [];
    return messages.filter(validateMessage);
}

/**
 * Validates settings object.
 */
export function validateSettings(settings: any): Settings {
    const defaultSettings: Settings = {
        aiProvider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022'
    };

    if (!settings || typeof settings !== 'object') return defaultSettings;

    return {
        aiProvider: typeof settings.aiProvider === 'string' ? settings.aiProvider : defaultSettings.aiProvider,
        model: typeof settings.model === 'string' ? settings.model : defaultSettings.model,
        apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : undefined,
    };
}

/**
 * Validates session object.
 */
export function validateSession(session: any): session is ChatState['sessions'][0] {
    return (
        session &&
        typeof session === 'object' &&
        typeof session.id === 'string' &&
        typeof session.title === 'string' &&
        typeof session.lastModified === 'number'
    );
}

/**
 * Validates sessions array.
 */
export function validateSessions(sessions: any): ChatState['sessions'] {
    if (!Array.isArray(sessions)) return [];
    return sessions.filter(validateSession);
}

/**
 * Deep sanitization for any object before it hits state.
 */
export function sanitizeData<T>(data: T): T {
    try {
        // Simple JSON round-trip to strip non-serializable data (functions, etc.)
        // This is a "brute force" structural hardening step.
        return JSON.parse(JSON.stringify(data));
    } catch {
        return data;
    }
}
