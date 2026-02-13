export type UiRole = "user" | "assistant" | "system"

export type UiMessage = {
    id: string
    role: UiRole
    content: string
    timestamp: number
}

export type Session = {
    id: string
    title: string
    lastModified: number
    isPinned: boolean
}

export type ApprovalRequest = {
    requestId: string
    toolName: string
    toolInput: unknown
}

export type UiConfig = {
    provider: string
    model: string
    autonomyMode: string
    hasAnyApiKey: boolean
}

export type WebviewState = {
    messages: UiMessage[]
    sessions: Session[]
    currentSessionId: string
    isLoading: boolean
    streamingBuffer: string
    pendingApproval: ApprovalRequest | null
    config: UiConfig
}