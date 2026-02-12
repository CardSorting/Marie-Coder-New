import React from 'react';
import { Message } from './Message';
import { WelcomeScreen } from './WelcomeScreen';
import type { MessageType, MarieStatus, StreamState } from '../types';
import { ErrorBoundary } from './ErrorBoundary';

interface MessageListProps {
    messages: MessageType[];
    marieStatus: MarieStatus;
    stream: StreamState & {
        elapsedMs?: number;
        waitingForApproval?: boolean;
    };
    messagesListRef: React.RefObject<HTMLDivElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    hasUnreadMessages: boolean;
    scrollProgress?: number;
    onSendMessage: (text: string) => void;
    onNewSession: () => void;
}

export const MessageList = React.memo<MessageListProps>(function MessageList({
    messages,
    marieStatus,
    stream,
    messagesListRef,
    messagesEndRef,
    handleScroll,
    hasUnreadMessages,
    onSendMessage,
    onNewSession
}) {
    const [showHistory, setShowHistory] = React.useState(false);
    const safeMessages = Array.isArray(messages) ? messages : [];

    // STABILITY: Windowing/History Collapsing logic
    // We only show the last 30 messages by default to prevent DOM bloat in long sessions
    const WINDOW_SIZE = 30;
    const hasLargeHistory = safeMessages.length > WINDOW_SIZE + 10;
    const displayMessages = (hasLargeHistory && !showHistory)
        ? safeMessages.slice(-WINDOW_SIZE)
        : safeMessages;
    const historyCount = safeMessages.length - displayMessages.length;

    const lastMsg = safeMessages.length > 0 ? safeMessages[safeMessages.length - 1] : null;

    // Optimistic working state: if marieStatus is 'thinking', we are working even if stream hasn't started
    const isMarieWorking = (marieStatus !== 'idle' && stream.streamStage !== 'done') || marieStatus === 'thinking';

    const getActiveStream = (isLast: boolean, role: MessageType['role']) => {
        if (!(isLast && isMarieWorking && role === 'marie')) {
            return undefined;
        }

        return {
            stage: stream.streamStage,
            completionPercent: stream.completionPercent,
            activeFilePath: stream.activeFilePath,
            currentStepLabel: stream.currentStepLabel,
            reasoning: stream.reasoning,
            activeObjective: Array.isArray(stream.progressObjectives) ? stream.progressObjectives.find((o: { id: string }) => o.id === stream.activeObjectiveId)?.label : undefined,
            objectives: Array.isArray(stream.progressObjectives) ? stream.progressObjectives : [],
            elapsedMs: stream.elapsedMs,
            waitingForApproval: stream.waitingForApproval
        };
    };

    // Apply streaming class for instant scroll during active generation
    const isStreaming = marieStatus === 'thinking' || marieStatus === 'responding';

    return (
        <div
            className={`messages-list ${hasUnreadMessages ? 'has-unread-pulse' : ''} ${isStreaming ? 'streaming' : ''}`}
            ref={messagesListRef}
            onScroll={handleScroll}
        >
            {safeMessages.length === 0 ? (
                <WelcomeScreen onAction={onSendMessage} onNewSession={onNewSession} />
            ) : (
                <>
                    {hasLargeHistory && !showHistory && (
                        <div className="history-expansion-link" onClick={() => setShowHistory(true)}>
                            Show {historyCount} previous messages...
                        </div>
                    )}

                    {displayMessages.map((msg, i) => {
                        // Create a stable key combining timestamp and content hash if possible
                        // Using actual index in safeMessages if we are windowing to maintain continuity
                        const globalIndex = safeMessages.length - displayMessages.length + i;
                        const messageKey = `${msg.timestamp}-${msg.role}-${globalIndex}`;

                        const isLast = globalIndex === safeMessages.length - 1;
                        const prevMsg = globalIndex > 0 ? safeMessages[globalIndex - 1] : null;

                        // Type narrowing for variant checking
                        const isToolCall = (m: MessageType) => m.role === 'marie' && 'variant' in m && m.variant === 'tool-call';
                        const hideMetadata = !!(prevMsg && prevMsg.role === msg.role && !isToolCall(prevMsg) && !isToolCall(msg));
                        const activeStream = getActiveStream(isLast, msg.role);

                        // Type narrowing for tool-call messages
                        const isToolCallMsg = msg.role === 'marie' && 'variant' in msg && msg.variant === 'tool-call';

                        return (
                            <ErrorBoundary key={messageKey}>
                                <Message
                                    role={msg.role}
                                    text={msg.text}
                                    timestamp={msg.timestamp}
                                    variant={msg.role === 'marie' && 'variant' in msg ? msg.variant : undefined}
                                    toolName={isToolCallMsg ? (msg as any).toolName : undefined}
                                    toolInput={isToolCallMsg ? (msg as any).toolInput : undefined}
                                    diff={isToolCallMsg ? (msg as any).diff : undefined}
                                    hideMetadata={hideMetadata}
                                    stream={activeStream}
                                />
                            </ErrorBoundary>
                        );
                    })}

                    {/* Work-in-progress Ghost Message */}
                    {isMarieWorking && (!lastMsg || lastMsg.role !== 'marie' || (lastMsg.variant === 'tool-call' && stream.streamStage !== 'responding')) && (
                        <Message
                            key="ghost-message"
                            role="marie"
                            variant="thinking"
                            stream={{
                                stage: stream.streamStage,
                                completionPercent: stream.completionPercent,
                                activeFilePath: stream.activeFilePath,
                                currentStepLabel: stream.currentStepLabel,
                                reasoning: stream.reasoning,
                                activeObjective: Array.isArray(stream.progressObjectives) ? stream.progressObjectives.find((o: { id: string }) => o.id === stream.activeObjectiveId)?.label : undefined,
                                objectives: Array.isArray(stream.progressObjectives) ? stream.progressObjectives : [],
                                elapsedMs: stream.elapsedMs,
                                waitingForApproval: stream.waitingForApproval
                            }}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </>
            )}
        </div >
    );
},
    (prevProps, nextProps) => {
        // Custom comparison function for React.memo
        // Only re-render if messages, stream state, or marieStatus actually changed
        return (
            prevProps.messages === nextProps.messages &&
            prevProps.marieStatus === nextProps.marieStatus &&
            prevProps.stream.streamStage === nextProps.stream.streamStage &&
            prevProps.stream.completionPercent === nextProps.stream.completionPercent &&
            prevProps.hasUnreadMessages === nextProps.hasUnreadMessages
        );
    });
