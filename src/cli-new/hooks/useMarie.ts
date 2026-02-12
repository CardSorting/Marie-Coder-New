import { useState, useCallback, useRef, useEffect } from 'react';
import { MarieCLI } from '../../cli/MarieCLI.js';
import { MarieCallbacks } from '../../domain/marie/MarieTypes.js';
import { Message, ToolCall, ApprovalRequest, StreamingState } from '../types/cli.js';

interface UseMarieOptions {
    workingDir: string;
}

export function useMarie(options: UseMarieOptions) {
    const marieRef = useRef<MarieCLI | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingState, setStreamingState] = useState<StreamingState>({
        isActive: false,
        content: '',
    });
    const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
    const [currentRun, setCurrentRun] = useState<any>(null);
    const [runElapsedMs, setRunElapsedMs] = useState(0);
    const currentToolCallsRef = useRef<ToolCall[]>([]);

    const upsertToolCall = useCallback((nextTool: ToolCall) => {
        const existing = currentToolCallsRef.current;
        const idx = existing.findIndex(t => t.id === nextTool.id);
        if (idx >= 0) {
            const updated = [...existing];
            updated[idx] = { ...updated[idx], ...nextTool };
            currentToolCallsRef.current = updated;
        } else {
            currentToolCallsRef.current = [...existing, nextTool];
        }
    }, []);

    const formatHistoryMessage = useCallback((message: any): { content: string; toolCalls?: ToolCall[] } => {
        if (typeof message?.content === 'string') {
            return { content: message.content };
        }

        if (!Array.isArray(message?.content)) {
            return { content: String(message?.content ?? '') };
        }

        const textParts: string[] = [];
        const toolCalls: ToolCall[] = [];

        for (const block of message.content) {
            if (!block || typeof block !== 'object') continue;

            if (block.type === 'text' && typeof block.text === 'string') {
                textParts.push(block.text);
            } else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id || `tool_hist_${Date.now()}_${toolCalls.length}`,
                    name: block.name || 'unknown_tool',
                    input: (block.input || {}) as Record<string, unknown>,
                    status: 'completed',
                });
            } else if (block.type === 'tool_result') {
                const toolId = block.tool_use_id;
                const idx = toolCalls.findIndex(t => t.id === toolId);
                if (idx >= 0) {
                    toolCalls[idx] = {
                        ...toolCalls[idx],
                        output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                        status: 'completed',
                    };
                }
            }
        }

        return {
            content: textParts.join('\n').trim() || '(Structured assistant response)',
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
    }, []);

    useEffect(() => {
        marieRef.current = new MarieCLI(options.workingDir);
        return () => {
            marieRef.current?.dispose();
        };
    }, [options.workingDir]);

    useEffect(() => {
        if (!isLoading || !currentRun?.startedAt) return;

        const interval = setInterval(() => {
            setRunElapsedMs(Date.now() - currentRun.startedAt);
        }, 250);

        return () => clearInterval(interval);
    }, [isLoading, currentRun?.startedAt]);

    const sendMessage = useCallback(async (content: string) => {
        if (!marieRef.current || isLoading) return;

        const userMessage: Message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        currentToolCallsRef.current = [];
        setStreamingState({ isActive: true, content: '', toolCalls: [] });

        const callbacks: MarieCallbacks = {
            onStream: (chunk: string) => {
                setStreamingState(prev => ({
                    ...prev,
                    content: prev.content + chunk,
                }));
            },
            onTool: (tool: any) => {
                const toolCall: ToolCall = {
                    id: tool.id || `tool_${Date.now()}`,
                    name: tool.name,
                    input: tool.input || {},
                    status: 'running',
                };
                setStreamingState(prev => ({
                    ...prev,
                    toolCall,
                    toolCalls: [...(prev.toolCalls || []).filter(t => t.id !== toolCall.id), toolCall],
                }));
                upsertToolCall(toolCall);
            },
            onToolDelta: (delta: any) => {
                // Handle tool execution updates
            },
            onEvent: (event: any) => {
                if (event.type === 'approval_request') {
                    const approval: ApprovalRequest = {
                        id: event.requestId,
                        toolName: event.toolName,
                        toolInput: event.toolInput,
                        diff: event.diff,
                        resolve: (approved: boolean) => {
                            marieRef.current?.handleToolApproval(event.requestId, approved);
                            setPendingApproval(null);
                        },
                    };
                    setPendingApproval(approval);
                } else if (event.type === 'run_started') {
                    setCurrentRun(event);
                    setRunElapsedMs(0);
                } else if (event.type === 'progress_update' && typeof event.elapsedMs === 'number') {
                    setRunElapsedMs(event.elapsedMs);
                } else if (event.type === 'tool') {
                    const phase = event.phase as ToolCall['status'] | 'start' | 'complete';
                    const status: ToolCall['status'] =
                        phase === 'error' ? 'error'
                            : phase === 'complete' ? 'completed'
                                : 'running';

                    const eventToolId = event.id || `tool_evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    const mergedTool: ToolCall = {
                        id: eventToolId,
                        name: event.name,
                        input: (event.input || {}) as Record<string, unknown>,
                        status,
                        output: event.message,
                    };

                    setStreamingState(prev => {
                        const existing = prev.toolCalls || [];
                        const index = existing.findIndex(t => t.id === mergedTool.id || (t.name === mergedTool.name && t.status === 'running'));

                        if (index >= 0) {
                            const updated = [...existing];
                            updated[index] = {
                                ...updated[index],
                                ...mergedTool,
                                output: mergedTool.output || updated[index].output,
                            };
                            return {
                                ...prev,
                                toolCalls: updated,
                                toolCall: updated[updated.length - 1],
                            };
                        }

                        return {
                            ...prev,
                            toolCalls: [...existing, mergedTool],
                            toolCall: mergedTool,
                        };
                    });

                    upsertToolCall(mergedTool);
                }
            },
        };

        try {
            const response = await marieRef.current.handleMessage(content, callbacks);

            const assistantMessage: Message = {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: Date.now(),
                toolCalls: currentToolCallsRef.current.length > 0 ? currentToolCallsRef.current : undefined,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorContent = error instanceof Error ? error.message : String(error);
            const errorMessage: Message = {
                id: `msg_${Date.now()}`,
                role: 'system',
                content: errorContent.startsWith('Error:') ? errorContent : `Error: ${errorContent}`,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setStreamingState({ isActive: false, content: '', toolCalls: [] });
            currentToolCallsRef.current = [];
            setCurrentRun(null);
            setRunElapsedMs(0);
        }
    }, [isLoading, upsertToolCall]);

    const stopGeneration = useCallback(() => {
        marieRef.current?.stopGeneration();
        setIsLoading(false);
        setStreamingState({ isActive: false, content: '', toolCalls: [] });
        currentToolCallsRef.current = [];
        setCurrentRun(null);
        setRunElapsedMs(0);
    }, []);

    const createSession = useCallback(async () => {
        const id = await marieRef.current?.createSession();
        setMessages([]);
        return id;
    }, []);

    const loadSession = useCallback(async (id: string) => {
        await marieRef.current?.loadSession(id);
        const history = marieRef.current?.getMessages() || [];
        setMessages(history.map((m: any, i: number) => ({
            id: `hist_${i}`,
            role: m.role,
            ...formatHistoryMessage(m),
            timestamp: Date.now(),
        })));
    }, [formatHistoryMessage]);

    const clearSession = useCallback(async () => {
        await marieRef.current?.clearCurrentSession();
        setMessages([]);
    }, []);

    return {
        messages,
        isLoading,
        streamingState,
        pendingApproval,
        currentRun,
        runElapsedMs,
        sendMessage,
        stopGeneration,
        createSession,
        loadSession,
        clearSession,
        marie: marieRef.current,
    };
}
