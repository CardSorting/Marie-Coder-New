import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { marieTheme } from '../styles/theme.js';
import { CommandSuggestion } from '../types/cli.js';

interface InputAreaProps {
    onSubmit: (value: string) => void;
    isLoading: boolean;
    placeholder?: string;
    suggestions?: CommandSuggestion[];
}

const COMMANDS: CommandSuggestion[] = [
    { label: 'Help', value: '/help', description: 'Show available commands', icon: '❓' },
    { label: 'Clear', value: '/clear', description: 'Clear the screen', icon: '🧹' },
    { label: 'New Session', value: '/new', description: 'Create a new session', icon: '🆕' },
    { label: 'Sessions', value: '/sessions', description: 'Manage sessions', icon: '📋' },
    { label: 'Checkpoint', value: '/checkpoint', description: 'Create git checkpoint', icon: '◈' },
    { label: 'Undo', value: '/undo', description: 'Rollback last changes', icon: '↩️' },
    { label: 'Exit', value: '/exit', description: 'Exit Marie', icon: '👋' },
];

export const InputArea: React.FC<InputAreaProps> = ({
    onSubmit,
    isLoading,
    placeholder = 'Type your message...',
    suggestions = []
}) => {
    const [input, setInput] = useState('');
    const [showCommands, setShowCommands] = useState(false);
    const [selectedCommand, setSelectedCommand] = useState(0);
    const { exit } = useApp();

    const filteredCommands = input.startsWith('/')
        ? COMMANDS.filter(cmd => cmd.value.startsWith(input.toLowerCase()))
        : [];

    useInput((char, key) => {
        if (key.upArrow && showCommands) {
            setSelectedCommand(prev => Math.max(0, prev - 1));
        } else if (key.downArrow && showCommands) {
            setSelectedCommand(prev => Math.min(filteredCommands.length - 1, prev + 1));
        } else if (key.tab && showCommands && filteredCommands.length > 0) {
            setInput(filteredCommands[selectedCommand].value + ' ');
            setShowCommands(false);
        } else if (key.return && !isLoading) {
            if (showCommands && filteredCommands.length > 0) {
                setInput(filteredCommands[selectedCommand].value + ' ');
                setShowCommands(false);
            } else if (input.trim()) {
                onSubmit(input);
                setInput('');
                setShowCommands(false);
            }
        } else if (key.escape) {
            setShowCommands(false);
        }
    });

    const handleChange = useCallback((value: string) => {
        setInput(value);
        setShowCommands(value.startsWith('/'));
        setSelectedCommand(0);
    }, []);

    if (isLoading) {
        return (
            <Box marginY={1}>
                <Text color={marieTheme.colors.muted}>
                    {marieTheme.icons.spinner} Marie is thinking... Press Ctrl+C to cancel
                </Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" marginY={1}>
            <Box>
                <Text color={marieTheme.colors.primary} bold>{marieTheme.icons.user} </Text>
                <TextInput
                    value={input}
                    onChange={handleChange}
                    onSubmit={(value) => {
                        if (value.trim()) {
                            onSubmit(value);
                            setInput('');
                            setShowCommands(false);
                        }
                    }}
                    placeholder={placeholder}
                    focus={true}
                />
            </Box>

            {showCommands && filteredCommands.length > 0 && (
                <Box flexDirection="column" marginTop={1} marginLeft={2}>
                    {filteredCommands.map((cmd, index) => (
                        <Box key={cmd.value}>
                            <Text color={index === selectedCommand ? marieTheme.colors.primary : marieTheme.colors.muted}>
                                {index === selectedCommand ? '▸ ' : '  '}
                                {cmd.icon} {cmd.value} - {cmd.description}
                            </Text>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};
