import { useState, useEffect, useCallback } from 'react';
import { MarieCLI } from '../../cli/MarieCLI.js';
import { Session } from '../types/cli.js';

interface UseSessionsOptions {
    marie: MarieCLI | null;
}

export function useSessions(options: UseSessionsOptions) {
    const { marie } = options;
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string>('');

    const refreshSessions = useCallback(() => {
        if (!marie) return;

        const metadata = marie.listSessions();
        const currentId = marie.getCurrentSessionId();

        setSessions(metadata.map(m => ({
            id: m.id,
            title: m.title,
            lastModified: m.lastModified,
            isPinned: m.isPinned,
            messageCount: 0, // Would need to calculate from history
        })));

        setCurrentSessionId(currentId);
    }, [marie]);

    useEffect(() => {
        refreshSessions();
    }, [refreshSessions]);

    const createSession = useCallback(async () => {
        if (!marie) return;
        const id = await marie.createSession();
        refreshSessions();
        return id;
    }, [marie, refreshSessions]);

    const switchSession = useCallback(async (id: string) => {
        if (!marie || id === currentSessionId) return;
        await marie.loadSession(id);
        setCurrentSessionId(id);
        refreshSessions();
    }, [marie, currentSessionId, refreshSessions]);

    const deleteSession = useCallback(async (id: string) => {
        if (!marie) return;
        await marie.deleteSession(id);
        refreshSessions();
    }, [marie, refreshSessions]);

    const renameSession = useCallback(async (id: string, newTitle: string) => {
        if (!marie) return;
        await marie.renameSession(id, newTitle);
        refreshSessions();
    }, [marie, refreshSessions]);

    const togglePinSession = useCallback(async (id: string) => {
        if (!marie) return;
        await marie.togglePinSession(id);
        refreshSessions();
    }, [marie, refreshSessions]);

    return {
        sessions,
        currentSessionId,
        createSession,
        switchSession,
        deleteSession,
        renameSession,
        togglePinSession,
        refreshSessions,
    };
}
