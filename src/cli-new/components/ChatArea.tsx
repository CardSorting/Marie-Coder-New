import React, { useEffect, useRef } from 'react';
import { Box, useStdout } from 'ink';
import { MessageBubble } from './MessageBubble.js';
import { Message, StreamingState } from '../types/cli.js';

interface ChatAreaProps {
    messages: Message[];
    streamingState: StreamingState;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, streamingState }) => {
    const { stdout } = useStdout();
    const scrollRef = useRef<number>(0);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        scrollRef.current = messages.length;
    }, [messages.length]);

    // Calculate available height
    const availableHeight = stdout.rows - 10; // Reserve space for header and input

    return (
        <Box
            flexDirection="column"
            height={availableHeight}
            overflow="hidden"
        >
            {messages.map((message, index) => (
                <MessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={streamingState.isActive && index === messages.length - 1}
                />
            ))}

            {streamingState.isActive && streamingState.content && (
                <MessageBubble
                    message={{
                        id: 'streaming',
                        role: 'assistant',
                        content: streamingState.content,
                        timestamp: Date.now(),
                        isStreaming: true,
                    }}
                    isStreaming={true}
                />
            )}
        </Box>
    );
};
