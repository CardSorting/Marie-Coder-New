import React from 'react';
import { Box, Text } from 'ink';
import { marieTheme } from '../styles/theme.js';
import { GitStatus } from '../types/cli.js';

interface HeaderProps {
    model: string;
    sessionTitle: string;
    gitStatus?: GitStatus;
    isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ model, sessionTitle, gitStatus, isLoading }) => {
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
                        <Text color={marieTheme.colors.warning}>{marieTheme.icons.spinner} Thinking...</Text>
                    )}
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
