import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { marieTheme } from '../styles/theme.js';
import { Session } from '../types/cli.js';

interface SessionSwitcherProps {
    sessions: Session[];
    currentSessionId: string;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onTogglePin: (id: string) => void;
    onClose: () => void;
}

export const SessionSwitcher: React.FC<SessionSwitcherProps> = ({
    sessions,
    currentSessionId,
    onSelect,
    onCreate,
    onDelete,
    onRename,
    onTogglePin,
    onClose,
}) => {
    const [mode, setMode] = useState<'list' | 'confirm-delete'>('list');
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

    // Sort sessions: pinned first, then by last modified
    const sortedSessions = [...sessions].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.lastModified - a.lastModified;
    });

    const items = [
        { label: '➕ Create New Session', value: '__new__' },
        ...sortedSessions.map(s => ({
            label: `${s.isPinned ? '⭐ ' : '  '}${s.title}${s.id === currentSessionId ? ' (current)' : ''}`,
            value: s.id,
        })),
    ];

    useInput((input, key) => {
        if (key.escape || (input === 'q' && mode === 'list')) {
            onClose();
        }
    });

    const handleSelect = (item: { value: string }) => {
        if (item.value === '__new__') {
            onCreate();
            onClose();
        } else {
            onSelect(item.value);
            onClose();
        }
    };

    if (mode === 'confirm-delete' && sessionToDelete) {
        return (
            <Box flexDirection="column" borderStyle="single" borderColor={marieTheme.colors.error} padding={1}>
                <Text color={marieTheme.colors.error} bold>
                    Delete session?
                </Text>
                <Text color={marieTheme.colors.muted}>
                    This action cannot be undone.
                </Text>
                <Box marginTop={1} gap={2}>
                    <Text color={marieTheme.colors.error}>y - Yes, delete</Text>
                    <Text color={marieTheme.colors.muted}>n - Cancel</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" borderStyle="single" borderColor={marieTheme.colors.primary} padding={1}>
            <Box marginBottom={1}>
                <Text color={marieTheme.colors.primary} bold>
                    {marieTheme.icons.assistant} Session Manager
                </Text>
            </Box>

            <Text color={marieTheme.colors.muted} dimColor>
                ↑↓ Navigate • Enter Select • D Delete • P Pin • R Rename • Q Quit
            </Text>

            <Box marginTop={1}>
                <SelectInput
                    items={items}
                    onSelect={handleSelect}
                    indicatorComponent={({ isSelected }) => (
                        <Text color={isSelected ? marieTheme.colors.primary : marieTheme.colors.muted}>
                            {isSelected ? '▸ ' : '  '}
                        </Text>
                    )}
                    itemComponent={({ isSelected, label }) => (
                        <Text color={isSelected ? marieTheme.colors.foreground : marieTheme.colors.muted}>
                            {label}
                        </Text>
                    )}
                />
            </Box>
        </Box>
    );
};
