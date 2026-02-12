import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { marieTheme, getToolIcon, formatDuration } from '../styles/theme.js';
import { ToolCall } from '../types/cli.js';

interface ToolCallDisplayProps {
    tool: ToolCall;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ tool }) => {
    const [expanded, setExpanded] = useState(false);

    useInput((input, key) => {
        if (key.return) {
            setExpanded(!expanded);
        }
    });

    const getStatusColor = (status: ToolCall['status']) => {
        switch (status) {
            case 'completed': return marieTheme.colors.success;
            case 'error': return marieTheme.colors.error;
            case 'running': return marieTheme.colors.warning;
            default: return marieTheme.colors.muted;
        }
    };

    const getStatusIcon = (status: ToolCall['status']) => {
        switch (status) {
            case 'completed': return marieTheme.icons.success;
            case 'error': return marieTheme.icons.error;
            case 'running': return marieTheme.icons.spinner;
            default: return marieTheme.icons.info;
        }
    };

    const icon = getToolIcon(tool.name);
    const statusColor = getStatusColor(tool.status);
    const statusIcon = getStatusIcon(tool.status);

    // Format tool name for display
    const displayName = tool.name
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

    return (
        <Box
            flexDirection="column"
            marginY={1}
            marginLeft={2}
            borderStyle="single"
            borderColor={statusColor}
            paddingX={1}
        >
            <Box justifyContent="space-between">
                <Box>
                    <Text color={statusColor}>{icon} {displayName}</Text>
                    <Text color={marieTheme.colors.muted}> {statusIcon}</Text>
                </Box>
                {tool.duration && (
                    <Text color={marieTheme.colors.muted}>{formatDuration(tool.duration)}</Text>
                )}
            </Box>

            {expanded && (
                <Box flexDirection="column" marginTop={1}>
                    <Text color={marieTheme.colors.secondary} bold>Input:</Text>
                    <Text color={marieTheme.colors.muted}>
                        {JSON.stringify(tool.input, null, 2)}
                    </Text>
                    {tool.output && (
                        <>
                            <Box marginTop={1}><Text color={marieTheme.colors.secondary} bold>Output:</Text></Box>
                            <Text color={marieTheme.colors.muted}>
                                {tool.output.slice(0, 500)}{tool.output.length > 500 ? '...' : ''}
                            </Text>
                        </>
                    )}
                </Box>
            )}

            {!expanded && tool.output && (
                <Text color={marieTheme.colors.muted} dimColor>
                    Press Enter to expand
                </Text>
            )}
        </Box>
    );
};
