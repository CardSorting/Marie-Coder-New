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

    useEffect(() => {
        marieRef.current = new MarieCLI(options.workingDir);
        return () => {
            marieRef.current?.dispose();
        };
    }, [options.workingDir]);

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
        setStreamingState({ isActive: true, content: '' });

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
                }));
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
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: `msg_${Date.now()}`,
                role: 'system',
                content: `Error: ${error}`,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setStreamingState({ isActive: false, content: '' });
        }
    }, [isLoading]);

    const stopGeneration = useCallback(() => {
        marieRef.current?.stopGeneration();
        setIsLoading(false);
        setStreamingState({ isActive: false, content: '' });
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
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            timestamp: Date.now(),
        })));
    }, []);

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
        sendMessage,
        stopGeneration,
        createSession,
        loadSession,
        clearSession,
        marie: marieRef.current,
    };
}
