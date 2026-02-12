import React from 'react';
import { Box, Text } from 'ink';
import { marieTheme } from '../styles/theme.js';
import { GitStatus } from '../types/cli.js';

interface HeaderProps {
    model: string;
    sessionTitle: string;
    gitStatus?: GitStatus;
    isLoading: boolean;
    elapsedMs?: number;
    autonomyMode?: 'balanced' | 'high' | 'yolo';
}

function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const Header: React.FC<HeaderProps> = ({ model, sessionTitle, gitStatus, isLoading, elapsedMs = 0, autonomyMode = 'yolo' }) => {
    const formatModelName = (m: string) => {
        if (m.includes('claude')) return 'Claude';
        if (m.includes('gpt')) return 'GPT';
        return m;
    };

    return (
        <Box flexDirection="column" borderStyle="single" borderColor={marieTheme.colors.primary} paddingX={1}>
            <Box justifyContent="space-between">
                <Box>
                    <Text color={marieTheme.colors.primary}>{marieTheme.icons.assistant} Marie</Text>
                    <Text color={marieTheme.colors.muted}> v0.2.0</Text>
                </Box>
                <Box gap={2}>
                    {isLoading && (
                        <Text color={marieTheme.colors.warning}>{marieTheme.icons.spinner} Thinking... {formatElapsed(elapsedMs)}</Text>
                    )}
                    <Text color={marieTheme.colors.muted}>Mode: {autonomyMode.toUpperCase()}</Text>
                    <Text color={marieTheme.colors.secondary}>{formatModelName(model)}</Text>
                </Box>
            </Box>

            <Box justifyContent="space-between" marginTop={1}>
                <Text color={marieTheme.colors.foreground} bold>
                    {sessionTitle}
                </Text>
                {gitStatus && (
                    <Box gap={1}>
                        <Text color={marieTheme.colors.info}>
                            {marieTheme.icons.git} {gitStatus.branch}
                        </Text>
                        {!gitStatus.isClean && (
                            <Text color={marieTheme.colors.warning}>
                                *{gitStatus.modified.length + gitStatus.staged.length}
                            </Text>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};
