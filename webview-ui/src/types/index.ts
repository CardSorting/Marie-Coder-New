export interface Settings {
    apiKey?: string;
    openrouterApiKey?: string;
    cerebrasApiKey?: string;
    aiProvider: 'anthropic' | 'openrouter' | 'cerebras';
    model: string;
}

export interface ToastType {
    id: string;
    message: string;
    type?: string;
}

export type MarieStatus = 'idle' | 'thinking' | 'responding' | 'error';
export type StreamStage = 'idle' | 'thinking' | 'planning' | 'responding' | 'calling_tool' | 'editing' | 'finalizing' | 'executing' | 'reviewing' | 'optimizing' | 'done' | 'error';
export type JoyZone = 'joyful' | 'infrastructure' | 'plumbing' | null;

export interface ProjectHealth {
    average: number;
    log: { id: string; description: string; timestamp: number }[];
    clutterCount: number;
    joyfulFiles: number;
    plumbingFiles: number;
    zoningViolations: number;
    migrationAlerts?: { file: string; reason: string }[];
    clusteringAlerts?: { zone: string; fileCount: number; suggestedClusters: string[]; reason: string }[];
    isJoyful?: boolean;
}

export interface ToolInput {
    path?: string;
    targetFile?: string;
    target_file?: string;
    command?: string;
    query?: string;
    [key: string]: unknown;
}

export type ObjectiveStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface ProgressObjective {
    id: string;
    label: string;
    status: ObjectiveStatus;
    context?: string;
}

export interface ProgressUpdatePayload {
    runId: string;
    completionPercent: number;
    activeObjectiveId?: string;
    objectives: ProgressObjective[];
    achieved: string[];
    waitingForApproval?: boolean;
    context?: string;
    elapsedMs: number;
    activeFilePath?: string;
    lifecycleStage?: 'sprout' | 'bloom' | 'compost';
    ritualComplete?: boolean;
    passFocus?: string;
    isResuming?: boolean;
    passHistory?: Array<{ pass: number, summary: string, reflection: string }>;
    metrics?: { cherishedFiles: string[], releasedDebtCount: number };
}

export interface CheckpointPayload {
    runId: string;
    status: 'awaiting_approval' | 'approved' | 'denied';
    toolName: string;
    summary: {
        what: string;
        why: string;
        impact: string;
    };
}

export type MessageType =
    | { role: 'user'; text: string; timestamp: string }
    | { role: 'marie'; text: string; timestamp: string; variant?: 'default' | 'thinking' }
    | { role: 'marie'; text: string; timestamp: string; variant: 'tool-call'; toolName: string; toolInput: unknown; diff?: { old: string, new: string } };

export interface ApprovalRequestPayload {
    requestId: string;
    toolName: string;
    toolInput: ToolInput;
    reasoning?: string;
    activeObjective?: string;
    diff?: { old: string, new: string };
}

export type WebviewToExtensionMessage =
    | { type: 'onMessage'; value: string }
    | { type: 'stop' }
    | { type: 'getProjectHealth' }
    | { type: 'plantIntent'; value: { fileName: string; intent: string; finalPath: string } }
    | { type: 'confirmDelete'; value: string }
    | { type: 'toolApprovalResponse'; value: { requestId: string; approved: boolean } }
    | { type: 'updateSettings'; value: Settings }
    | { type: 'newSession' }
    | { type: 'loadSession'; value: string }
    | { type: 'deleteSession'; value: string }
    | { type: 'renameSession'; value: { id: string; title: string } }
    | { type: 'togglePinSession'; value: string }
    | { type: 'requestClearSession' } // If used? useMarie uses confirmClearSession internaly, but actions.requestClearSession might trigger something? useMarie has requestClearSession but it just opens modal.
    | { type: 'fetchModels'; provider: 'anthropic' | 'openrouter' | 'cerebras' }
    | { type: 'requestTidy' }
    | { type: 'insertCode'; value: string }
    | { type: 'foldCode' }
    | { type: 'openFile'; value: string }
    | { type: 'showDiff'; value: { modified: string; fileName: string } }
    | { type: 'requestRunState' }
    | { type: 'error'; value: { message: string, stack?: string, componentStack?: string } }
    | { command: 'executeTool'; tool: string; args: unknown }; // Legacy format support or standardization?

export interface ChatState {
    messages: MessageType[];
    marieStatus: MarieStatus;
    toasts: ToastType[];
    sessions: Array<{ id: string; title: string; lastModified: number; isPinned?: boolean }>;
    currentSessionId: string | null;
    activeFile: string;
    lettingGoFile: { fullPath: string; fileName?: string; lines?: number } | null;
    sproutingFile: { fileName: string; suggestedPath?: string } | null;
    availableModels: { id: string; name: string }[];
    isLoadingModels: boolean;
    approvalRequest: ApprovalRequestPayload | null;
}

export interface UIState {
    isClearModalOpen: boolean;
    isSettingsOpen: boolean;
    isSessionListOpen: boolean;
    isVitalityOpen: boolean;
    showSparkles: boolean;
    showProgressDetails: boolean;
}

export interface GardenState {
    joyScore: number;
    projectHealth: ProjectHealth | null;
    currentZone: JoyZone;
    achievements: string[];
    lifecycleStage: 'sprout' | 'bloom' | 'compost' | undefined;
    ritualComplete: boolean;
    passHistory: Array<{ pass: number; summary: string; reflection: string }>;
    gardenMetrics: { cherishedFiles: string[]; releasedDebtCount: number };
}

export interface StreamState {
    streamStage: StreamStage;
    streamStartedAt: number | null;
    stepCount: number;
    toolCount: number;
    reasoning: string;
    currentStepLabel: string;
    tokenUsage: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number } | null;
    progressObjectives: ProgressObjective[];
    activeObjectiveId: string | undefined;
    completionPercent: number;
    progressContext: string;
    checkpoint: CheckpointPayload | null;
    runError: string | null;
    activeFilePath: string | undefined;
    currentPass?: number;
    totalPasses?: number;
    passFocus?: string;
}
