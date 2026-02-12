import React, { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { marieTheme } from '../styles/theme.js';
import { Message } from '../types/cli.js';
import { ToolCallDisplay } from './ToolCallDisplay.js';

interface MessageBubbleProps {
    message: Message;
    isStreaming?: boolean;
    showTimestamp?: boolean;
}

// Format timestamp to readable time
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Wrap text to fit within max width
function wrapText(text: string, maxWidth: number): string[] {
    if (!text) return [];

    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        if (paragraph.length <= maxWidth) {
            lines.push(paragraph);
            continue;
        }

        let currentLine = '';
        const words = paragraph.split(' ');

        for (const word of words) {
            if ((currentLine + ' ' + word).trim().length <= maxWidth) {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            } else {
                if (currentLine) lines.push(currentLine);
                if (word.length > maxWidth) {
                    for (let i = 0; i < word.length; i += maxWidth) {
                        lines.push(word.slice(i, i + maxWidth));
                    }
                    currentLine = '';
                } else {
                    currentLine = word;
                }
            }
        }
        if (currentLine) lines.push(currentLine);
    }

    return lines;
}

// Truncate long messages
function truncateContent(content: string, maxLines: number = 50): { lines: string[]; wasTruncated: boolean } {
    const lines = content.split('\n');
    if (lines.length <= maxLines) {
        return { lines, wasTruncated: false };
    }
    return {
        lines: [...lines.slice(0, maxLines), '... (message truncated, use /expand to see full content)'],
        wasTruncated: true
    };
}

// Detect code blocks and format them
function formatContent(content: string): { type: 'text' | 'code'; content: string; language?: string }[] {
    const parts: { type: 'text' | 'code'; content: string; language?: string }[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: content.slice(lastIndex, match.index).trim()
            });
        }

        parts.push({
            type: 'code',
            language: match[1],
            content: match[2].trim()
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push({
            type: 'text',
            content: content.slice(lastIndex).trim()
        });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    isStreaming,
    showTimestamp = true
}) => {
    const { stdout } = useStdout();
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    const maxWidth = Math.max(20, stdout.columns - 8);
    const contentParts = useMemo(() => formatContent(message.content), [message.content]);
    const timeStr = showTimestamp ? formatTime(message.timestamp) : '';

    if (isSystem) {
        const wrappedLines = wrapText(message.content, maxWidth);
        return (
            <Box marginY={0} paddingY={1} justifyContent="center">
                <Box flexDirection="column">
                    {wrappedLines.map((line, i) => (
                        <Text key={i} color={marieTheme.colors.error} italic dimColor>
                            {line || ' '}
                        </Text>
                    ))}
                    {showTimestamp && (
                        <Text color={marieTheme.colors.muted} dimColor>
                            {timeStr}
                        </Text>
                    )}
                </Box>
            </Box>
        );
    }

    if (isUser) {
        const wrappedLines = wrapText(message.content, maxWidth - 2);
        return (
            <Box flexDirection="column" marginTop={0} marginBottom={1} paddingX={1}>
                <Box>
                    <Text bold color={marieTheme.colors.primary}>
                        {marieTheme.icons.user} You
                    </Text>
                    {showTimestamp && (
                        <Text color={marieTheme.colors.muted} dimColor>
                            {' '}{timeStr}
                        </Text>
                    )}
                    <Text color={marieTheme.colors.primary}> › </Text>
                    <Text color={marieTheme.colors.foreground}>
                        {wrappedLines[0] || ''}
                    </Text>
                </Box>
                {wrappedLines.slice(1).map((line, i) => (
                    <Box key={i} marginLeft={4}>
                        <Text color={marieTheme.colors.foreground}>{line || ' '}</Text>
                    </Box>
                ))}
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            marginTop={0}
            marginBottom={1}
            paddingX={1}
            borderStyle="round"
            borderColor={marieTheme.colors.secondary}
        >
            <Box justifyContent="space-between">
                <Box>
                    <Text bold color={marieTheme.colors.success}>
                        {marieTheme.icons.assistant} Marie
                    </Text>
                    {isStreaming && (
                        <Text color={marieTheme.colors.muted}> {marieTheme.icons.spinner}</Text>
                    )}
                </Box>
                {showTimestamp && (
                    <Text color={marieTheme.colors.muted} dimColor>
                        {timeStr}
                    </Text>
                )}
            </Box>

            <Box flexDirection="column" marginLeft={0}>
                {contentParts.map((part, partIndex) => {
                    if (part.type === 'code') {
                        const codeLines = wrapText(part.content, maxWidth - 4);
                        return (
                            <Box
                                key={partIndex}
                                flexDirection="column"
                                marginY={1}
                                paddingX={1}
                                borderStyle="single"
                                borderColor={marieTheme.colors.muted}
                            >
                                {part.language && (
                                    <Text color={marieTheme.colors.info} dimColor>
                                        {part.language}
                                    </Text>
                                )}
                                {codeLines.map((line, i) => (
                                    <Text key={i} color={marieTheme.colors.foreground}>
                                        {line || ' '}
                                    </Text>
                                ))}
                            </Box>
                        );
                    }

                    const textLines = wrapText(part.content, maxWidth - 2);
                    return textLines.map((line, i) => (
                        <Text key={`${partIndex}-${i}`} color={marieTheme.colors.foreground}>
                            {line || ' '}
                        </Text>
                    ));
                })}

                {isStreaming && (
                    <Text color={marieTheme.colors.primary}>▊</Text>
                )}
            </Box>

            {message.toolCalls && message.toolCalls.map(tool => (
                <ToolCallDisplay key={tool.id} tool={tool} />
            ))}
        </Box>
    );
};
