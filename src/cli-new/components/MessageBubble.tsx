import React from 'react';
import { Box, Text } from 'ink';
import { marieTheme } from '../styles/theme.js';
import { Message } from '../types/cli.js';
import { ToolCallDisplay } from './ToolCallDisplay.js';

interface MessageBubbleProps {
    message: Message;
    isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    if (isSystem) {
        return (
            <Box marginY={1} justifyContent="center">
                <Text color={marieTheme.colors.error} italic>
                    {message.content}
                </Text>
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            marginY={1}
            paddingX={1}
            borderStyle={isUser ? undefined : 'round'}
            borderColor={isUser ? undefined : marieTheme.colors.secondary}
        >
            <Box marginBottom={1}>
                <Text bold color={isUser ? marieTheme.colors.primary : marieTheme.colors.success}>
                    {isUser ? marieTheme.icons.user : marieTheme.icons.assistant} {isUser ? 'You' : 'Marie'}
                </Text>
                {isStreaming && (
                    <Text color={marieTheme.colors.muted}> {marieTheme.icons.spinner}</Text>
                )}
            </Box>

            <Box marginLeft={2}>
                <Text color={marieTheme.colors.foreground}>
                    {message.content}
                    {isStreaming && <Text color={marieTheme.colors.primary}>▊</Text>}
                </Text>
            </Box>

            {message.toolCalls && message.toolCalls.map(tool => (
                <ToolCallDisplay key={tool.id} tool={tool} />
            ))}
        </Box>
    );
};
