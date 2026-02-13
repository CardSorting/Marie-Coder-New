import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { ApprovalRequest, UiConfig, UiMessage, WebviewState } from "../types.js"
import { vscode } from "../vscode.js"

const defaultConfig: UiConfig = {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    autonomyMode: "balanced",
    hasAnyApiKey: false,
}

const initialState: WebviewState = {
    messages: [],
    sessions: [],
    currentSessionId: "default",
    isLoading: false,
    streamingBuffer: "",
    pendingApproval: null,
    config: defaultConfig,
}

type WebviewActions = {
    sendMessage: (text: string) => void
    createSession: () => void
    refreshSessions: () => void
    loadSession: (id: string) => void
    clearSession: () => void
    stopGeneration: () => void
    openSettings: () => void
    getModels: () => void
    approveTool: (approved: boolean) => void
    setAutonomyMode: (mode: string) => void
}

type WebviewStateContextValue = {
    state: WebviewState
    actions: WebviewActions
}

const WebviewStateContext = createContext<WebviewStateContextValue | undefined>(undefined)

function newMessage(role: UiMessage["role"], content: string): UiMessage {
    return {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        timestamp: Date.now(),
    }
}

export function WebviewStateProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<WebviewState>(initialState)

    const addMessage = useCallback((role: UiMessage["role"], content: string) => {
        setState((prev) => ({ ...prev, messages: [...prev.messages, newMessage(role, content)] }))
    }, [])

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const message = event.data

            switch (message?.type) {
                case "init_state":
                    setState((prev) => ({
                        ...prev,
                        messages: Array.isArray(message.state?.messages) ? message.state.messages : [],
                        config: message.state?.config || prev.config,
                        currentSessionId: message.state?.currentSessionId || prev.currentSessionId,
                        streamingBuffer: "",
                    }))
                    return

                case "sessions":
                    setState((prev) => ({
                        ...prev,
                        sessions: Array.isArray(message.sessions) ? message.sessions : [],
                        currentSessionId: message.currentSessionId || prev.currentSessionId,
                    }))
                    return

                case "status":
                    setState((prev) => {
                        const nextLoading = Boolean(message.isLoading)
                        if (!nextLoading && prev.streamingBuffer) {
                            return {
                                ...prev,
                                isLoading: false,
                                streamingBuffer: "",
                                messages: [...prev.messages, newMessage("assistant", prev.streamingBuffer)],
                            }
                        }
                        return { ...prev, isLoading: nextLoading }
                    })
                    return

                case "user_echo":
                    addMessage("user", String(message.text || ""))
                    return

                case "message_stream":
                    setState((prev) => ({ ...prev, streamingBuffer: prev.streamingBuffer + String(message.chunk || "") }))
                    return

                case "assistant_response":
                    setState((prev) => {
                        if (prev.streamingBuffer) return prev
                        return { ...prev, messages: [...prev.messages, newMessage("assistant", String(message.text || ""))] }
                    })
                    return

                case "runtime_event": {
                    const runtimeEvent = message.event
                    if (runtimeEvent?.type === "approval_request") {
                        const pendingApproval: ApprovalRequest = {
                            requestId: runtimeEvent.requestId,
                            toolName: runtimeEvent.toolName,
                            toolInput: runtimeEvent.toolInput,
                        }
                        setState((prev) => ({ ...prev, pendingApproval }))
                        return
                    }

                    if (runtimeEvent?.type === "run_error") {
                        addMessage("system", `Error: ${runtimeEvent.message || "Unknown error"}`)
                        return
                    }

                    return
                }

                case "tool_event":
                    addMessage("system", `Tool: ${message.tool?.name || "unknown"}`)
                    return

                case "models":
                    addMessage(
                        "system",
                        `Available models:\n${(message.models || []).map((m: any) => `- ${m.id || m.name || String(m)}`).join("\n")}`,
                    )
                    return

                case "config":
                    setState((prev) => ({ ...prev, config: message.config || prev.config }))
                    return

                case "error":
                    addMessage("system", String(message.message || "Unknown error"))
                    return

                default:
                    return
            }
        }

        window.addEventListener("message", onMessage)
        vscode.postMessage({ type: "ready" })
        vscode.postMessage({ type: "list_sessions" })

        return () => {
            window.removeEventListener("message", onMessage)
        }
    }, [addMessage])

    const actions = useMemo<WebviewActions>(
        () => ({
            sendMessage: (text: string) => vscode.postMessage({ type: "send_message", text }),
            createSession: () => vscode.postMessage({ type: "create_session" }),
            refreshSessions: () => vscode.postMessage({ type: "list_sessions" }),
            loadSession: (id: string) => vscode.postMessage({ type: "load_session", id }),
            clearSession: () => vscode.postMessage({ type: "clear_session" }),
            stopGeneration: () => vscode.postMessage({ type: "stop_generation" }),
            openSettings: () => vscode.postMessage({ type: "open_settings" }),
            getModels: () => vscode.postMessage({ type: "get_models" }),
            approveTool: (approved: boolean) => {
                if (!state.pendingApproval) return
                vscode.postMessage({ type: "approve_tool", requestId: state.pendingApproval.requestId, approved })
                setState((prev) => ({ ...prev, pendingApproval: null }))
            },
            setAutonomyMode: (mode: string) => vscode.postMessage({ type: "set_autonomy_mode", mode }),
        }),
        [state.pendingApproval],
    )

    return <WebviewStateContext.Provider value={{ state, actions }}>{children}</WebviewStateContext.Provider>
}

export function useWebviewState() {
    const context = useContext(WebviewStateContext)
    if (!context) {
        throw new Error("useWebviewState must be used within WebviewStateProvider")
    }
    return context
}
