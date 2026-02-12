import React, { useState, useCallback } from 'react';
import { Box, useApp, useInput, Text } from 'ink';
import { Header } from './Header.js';
import { ChatArea } from './ChatArea.js';
import { InputArea } from './InputArea.js';
import { SessionSwitcher } from './SessionSwitcher.js';
import { ApprovalDialog } from './ApprovalDialog.js';
import { useMarie } from '../hooks/useMarie.js';
import { useSessions } from '../hooks/useSessions.js';
import { useGit } from '../hooks/useGit.js';
import { ViewMode } from '../types/cli.js';
import { marieTheme } from '../styles/theme.js';
import { Storage } from '../../cli/storage.js';

interface AppProps {
    workingDir: string;
}

export const App: React.FC<AppProps> = ({ workingDir }) => {
    const { exit } = useApp();
    const [viewMode, setViewMode] = useState<ViewMode>('chat');

    // Core hooks
    const {
        messages,
        isLoading,
        streamingState,
        pendingApproval,
        sendMessage,
        stopGeneration,
        createSession,
        loadSession,
        clearSession,
        marie,
    } = useMarie({ workingDir });

    const {
        sessions,
        currentSessionId,
        createSession: createNewSession,
        switchSession,
        deleteSession,
        renameSession,
        togglePinSession,
    } = useSessions({ marie });

    const {
        gitStatus,
        createCheckpoint,
        undoLastCommit,
    } = useGit({ workingDir });

    // Get current session title
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const sessionTitle = currentSession?.title || 'New Session';

    // Command handlers
    const handleCommand = useCallback(async (command: string) => {
        const [cmd, ...args] = command.slice(1).split(' ');

        switch (cmd.toLowerCase()) {
            case 'help':
                // Help is shown via input suggestions
                break;
            case 'clear':
                await clearSession();
                break;
            case 'new':
                await createNewSession();
                break;
            case 'sessions':
                setViewMode('sessions');
                break;
            case 'exit':
            case 'quit':
                exit();
                break;
            case 'checkpoint':
                const checkpointMsg = args.join(' ') || undefined;
                const commit = await createCheckpoint(checkpointMsg);
                if (commit) {
                    // Show success message
                }
                break;
            case 'undo':
                const result = await undoLastCommit();
                if (!result.success) {
                    // Show error
                }
                break;
            default:
                // Unknown command
                break;
        }
    }, [clearSession, createNewSession, setViewMode, exit, createCheckpoint, undoLastCommit]);

    const handleSubmit = useCallback(async (value: string) => {
        if (value.startsWith('/')) {
            await handleCommand(value);
        } else {
            await sendMessage(value);
        }
    }, [handleCommand, sendMessage]);

    // Keyboard shortcuts
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            if (isLoading) {
                stopGeneration();
            } else {
                exit();
            }
        } else if (key.ctrl && input === 's') {
            setViewMode(viewMode === 'sessions' ? 'chat' : 'sessions');
        } else if (key.ctrl && input === 'n') {
            createNewSession();
        }
    });

    // Get current model
    const model = Storage.getConfig().model || 'claude-3-5-sonnet-20241022';

    if (viewMode === 'sessions') {
        return (
            <SessionSwitcher
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={(id) => {
                    switchSession(id);
                    setViewMode('chat');
                }}
                onCreate={() => {
                    createNewSession();
                    setViewMode('chat');
                }}
                onDelete={deleteSession}
                onRename={renameSession}
                onTogglePin={togglePinSession}
                onClose={() => setViewMode('chat')}
            />
        );
    }

    return (
        <Box flexDirection="column" height="100%">
            <Header
                model={model}
                sessionTitle={sessionTitle}
                gitStatus={gitStatus || undefined}
                isLoading={isLoading}
            />

            {pendingApproval && (
                <ApprovalDialog request={pendingApproval} />
            )}

            <ChatArea
                messages={messages}
                streamingState={streamingState}
            />

            <InputArea
                onSubmit={handleSubmit}
                isLoading={isLoading}
            />

            <Box marginTop={1}>
                <Text color={marieTheme.colors.muted} dimColor>
                    Ctrl+C Cancel • Ctrl+S Sessions • Ctrl+N New • /help Commands
                </Text>
            </Box>
        </Box>
    );
};
