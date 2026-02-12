import type { MessageType } from '../../types';
import type { HandlerContext, ThrottledHandlerContext } from './types';

interface ResponseMessage {
    value: string;
}

interface StreamUpdateMessage {
    value: string;
}

interface SessionLoadedMessage {
    role: 'user' | 'marie';
    content?: unknown;
    toolName?: string;
    toolInput?: unknown;
    diff?: { old: string; new: string };
}

interface ToolCallMessage {
    name: string;
    input: unknown;
    diff?: { old: string; new: string };
}

interface ToolDeltaMessage {
    name?: string;
    inputDelta: string;
}

/**
 * Handles final response messages from the extension.
 * Finalizes streaming messages or creates new message entries.
 */
export function handleOnResponse(
    message: ResponseMessage,
    ctx: HandlerContext
): void {
    const { setMarieStatus, setStreamStage, setCurrentStepLabel, setMessages, triggerSparkles, getCurrentTime } = ctx;
    const { value } = message;

    setMarieStatus('idle');
    setStreamStage('done');
    setCurrentStepLabel('Completed');

    setMessages((prev: MessageType[]) => {
        const lastMsg = prev[prev.length - 1];
        // If we have a streaming message, finalize it
        if (lastMsg && lastMsg.role === 'marie') {
            return [
                ...prev.slice(0, -1),
                {
                    ...lastMsg,
                    text: value,
                    timestamp: getCurrentTime()
                }
            ];
        }
        // Fallback if no stream occurred
        return [...prev, {
            role: 'marie',
            text: value,
            timestamp: getCurrentTime()
        }];
    });

    // Trigger sparkles for short or successful responses
    if (value.includes('✓') || value.includes('✨') || value.length < 50) {
        triggerSparkles();
    }
}

/**
 * Handles streaming updates from the extension with throttling.
 * Appends chunks to existing streaming messages or creates new ones.
 */
export function handleOnStreamUpdate(
    message: StreamUpdateMessage,
    ctx: ThrottledHandlerContext
): void {
    const { setMarieStatus, setMessages, getCurrentTime, throttled } = ctx;
    let { value: chunk } = message;
    const { chatBufferRef, chatTimerRef } = throttled;

    // STABILITY: Safety cap for incoming chunk size to prevent bridge-induced hangs
    const MAX_CHUNK_SIZE = 100000; // 100KB per chunk is safely massive
    if (chunk && chunk.length > MAX_CHUNK_SIZE) {
        console.warn(`[chatHandlers] Massive chunk detected (${chunk.length} chars). Truncating for UI safety.`);
        chunk = chunk.substring(0, MAX_CHUNK_SIZE) + '... [Chunk truncated for stability]';
    }

    setMarieStatus('responding');
    chatBufferRef.current.push(chunk);

    if (!chatTimerRef.current) {
        chatTimerRef.current = setTimeout(() => {
            const combinedChunk = chatBufferRef.current.join('');
            chatBufferRef.current = [];
            chatTimerRef.current = null;

            setMessages((prev: MessageType[]) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'marie' && lastMsg.variant !== 'tool-call') {
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, text: lastMsg.text + combinedChunk }
                    ];
                } else {
                    return [...prev, {
                        role: 'marie',
                        text: combinedChunk,
                        timestamp: getCurrentTime()
                    }];
                }
            });
        }, 100); // 100ms throttle for smooth text streaming
    }
}

/**
 * Handles loaded session data from the extension.
 * Transforms backend message format to UI message format.
 */
export function handleOnSessionLoaded(
    message: { value: SessionLoadedMessage[] },
    ctx: HandlerContext
): void {
    const { setMessages, setMarieStatus, triggerSparkles, getCurrentTime } = ctx;

    if (!Array.isArray(message.value)) {
        console.error('handleOnSessionLoaded: message.value is not an array', message.value);
        setMessages([]);
        return;
    }

    const loadedMessages: MessageType[] = message.value.map((m) => {
        let text = '';
        let variant: 'tool-call' | 'thinking' | 'default' | undefined = undefined;
        let toolName = m.toolName;
        let toolInput = m.toolInput;
        const diff = m.diff;

        if (Array.isArray(m.content)) {
            // Handle complex content blocks
            const textBlock = m.content.find((c: { type: string; text?: string }) => c.type === 'text');
            if (textBlock) {
                text = textBlock.text ?? '';
            }

            const toolUseBlock = m.content.find((c: { type: string; name?: string; input?: unknown }) => c.type === 'tool_use');
            if (toolUseBlock) {
                variant = 'tool-call';
                toolName = toolUseBlock.name;
                toolInput = toolUseBlock.input;
            }
        } else {
            // Handle simple string content
            text = (m.content as string) || '';
            if (m.role === 'marie' && !text) {
                variant = 'tool-call';
            }
        }

        if (m.role === 'user') {
            return { role: 'user', text, timestamp: getCurrentTime() };
        }

        if (variant === 'tool-call') {
            return {
                role: 'marie',
                text,
                timestamp: getCurrentTime(),
                variant: 'tool-call',
                toolName: toolName || 'unknown_tool',
                toolInput: toolInput ?? {},
                diff
            };
        }

        return {
            role: 'marie',
            text,
            timestamp: getCurrentTime(),
            variant: variant as 'thinking' | 'default' | undefined
        };
    });

    setMessages(loadedMessages);
    setMarieStatus('idle');
    triggerSparkles();
}

/**
 * Handles tool call notifications from the extension.
 * Creates tool-call message entries.
 */
export function handleOnToolCall(
    message: { value: ToolCallMessage & { sessionId?: string } },
    ctx: HandlerContext
): void {
    const { setToolCount, setMessages, getCurrentTime, currentSessionId } = ctx;
    const { name, input, diff, sessionId } = message.value;

    // SESSION GUARD
    if (sessionId && currentSessionId && sessionId !== currentSessionId) {
        console.warn(`[chatHandlers] Ignored tool call from stale session: ${sessionId}`);
        return;
    }

    setToolCount((prev: number) => prev + 1);
    setMessages((prev: MessageType[]) => [...prev, {
        role: 'marie',
        text: '', // Tool calls don't need text
        timestamp: getCurrentTime(),
        variant: 'tool-call',
        toolName: name,
        toolInput: input,
        diff: diff
    }]);
}

/**
 * Handles tool delta (streaming tool input) updates with throttling.
 * Updates existing tool-call messages or creates new ones.
 */
export function handleOnToolDelta(
    message: { value: ToolDeltaMessage & { sessionId?: string } },
    ctx: ThrottledHandlerContext
): void {
    const { setMessages, getCurrentTime, throttled, currentSessionId } = ctx;
    const { name, inputDelta, sessionId } = message.value;
    const { toolDeltaBufferRef, chatTimerRef } = throttled;

    // SESSION GUARD
    if (sessionId && currentSessionId && sessionId !== currentSessionId) {
        console.warn(`[chatHandlers] Ignored tool delta from stale session: ${sessionId}`);
        return;
    }

    toolDeltaBufferRef.current.push({ name, inputDelta });

    if (!chatTimerRef.current) {
        chatTimerRef.current = setTimeout(() => {
            const deltas = [...toolDeltaBufferRef.current];
            toolDeltaBufferRef.current = [];
            chatTimerRef.current = null;

            setMessages((prev: MessageType[]) => {
                let currentPrev = [...prev];

                // Process all buffered deltas in one go to minimize re-renders
                for (const d of deltas) {
                    const lastMsg = currentPrev[currentPrev.length - 1];
                    const isTargetMsg = lastMsg && lastMsg.role === 'marie' &&
                        'variant' in lastMsg && lastMsg.variant === 'tool-call' &&
                        (lastMsg.toolName === d.name || !lastMsg.toolName);

                    if (isTargetMsg) {
                        currentPrev = [
                            ...currentPrev.slice(0, -1),
                            {
                                ...lastMsg,
                                variant: 'tool-call',
                                toolName: d.name || lastMsg.toolName,
                                toolInput: (lastMsg.toolInput || '') + d.inputDelta
                            }
                        ];
                    } else {
                        currentPrev = [
                            ...currentPrev,
                            {
                                role: 'marie',
                                variant: 'tool-call',
                                toolName: d.name || 'unknown_tool',
                                toolInput: d.inputDelta,
                                text: '',
                                timestamp: getCurrentTime()
                            }
                        ];
                    }
                }
                return currentPrev as MessageType[];
            });
        }, 100);
    }
}
