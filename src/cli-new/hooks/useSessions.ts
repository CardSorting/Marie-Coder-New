import { useState, useEffect, useCallback } from 'react';
import { MarieCLI } from '../../monolith/adapters/CliMarieAdapter.js';
import { Session } from '../types/cli.js';

interface UseSessionsOptions {
    marie: MarieCLI | null;
}

export function useSessions(options: UseSessionsOptions) {
    const { marie } = options;
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string>('');

    const refreshSessions = useCallback(async () => {
        if (!marie) return;

        const metadata = await marie.listSessions();
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
        refreshSessions().catch(() => undefined);
    }, [refreshSessions]);

    const createSession = useCallback(async () => {
        if (!marie) return;
        const id = await marie.createSession();
        await refreshSessions();
        return id;
    }, [marie, refreshSessions]);

    const switchSession = useCallback(async (id: string) => {
        if (!marie || id === currentSessionId) return;
        await marie.loadSession(id);
        setCurrentSessionId(id);
        await refreshSessions();
    }, [marie, currentSessionId, refreshSessions]);

    const deleteSession = useCallback(async (id: string) => {
        if (!marie) return;
        await marie.deleteSession(id);
        await refreshSessions();
    }, [marie, refreshSessions]);

    const renameSession = useCallback(async (id: string, newTitle: string) => {
        if (!marie) return;
        await marie.renameSession(id, newTitle);
        await refreshSessions();
    }, [marie, refreshSessions]);

    const togglePinSession = useCallback(async (id: string) => {
        if (!marie) return;
        await marie.togglePinSession(id);
        await refreshSessions();
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
