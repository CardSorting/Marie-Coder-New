import type { SetStateAction, Dispatch, MutableRefObject } from 'react';
import type {
    MessageType,
    MarieStatus,
    Settings,
    StreamStage,
    ProgressUpdatePayload,
    CheckpointPayload,
    ProgressObjective,
    JoyZone,
    ApprovalRequestPayload,
    ProjectHealth
} from '../../types';


/**
 * Helper type for state setters from React.
 */
export type StateSetter<T> = Dispatch<SetStateAction<T>>;

/**
 * Context passed to all message handlers containing setters and actions.
 * This provides a consistent interface for all handlers.
 */
export interface HandlerContext {
    // Chat state setters
    setMessages: StateSetter<MessageType[]>;
    setMarieStatus: StateSetter<MarieStatus>;
    setSettings: StateSetter<Settings>;
    setSessions: StateSetter<{ id: string; title: string; lastModified: number; isPinned?: boolean }[]>;
    setCurrentSessionId: StateSetter<string | null>;
    setActiveFile: StateSetter<string>;

    // Stream state setters
    setStreamStage: StateSetter<StreamStage>;
    setCurrentStepLabel: StateSetter<string>;
    setStreamStartedAt: StateSetter<number | null>;
    setStepCount: StateSetter<number>;
    setToolCount: StateSetter<number>;
    setReasoning: StateSetter<string>;
    setTokenUsage: StateSetter<{ inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number } | null>;
    setProgressObjectives: StateSetter<ProgressObjective[]>;
    setActiveObjectiveId: StateSetter<string | undefined>;
    setCompletionPercent: StateSetter<number>;
    setProgressContext: StateSetter<string>;
    setAchievements: StateSetter<string[]>;
    setCheckpoint: StateSetter<CheckpointPayload | null>;
    setRunError: StateSetter<string | null>;
    setActiveFilePath: StateSetter<string | undefined>;
    setCurrentPass: StateSetter<number | undefined>;
    setTotalPasses: StateSetter<number | undefined>;
    setPassFocus: StateSetter<string | undefined>;

    // Garden state setters
    setCurrentZone: StateSetter<JoyZone>;
    setJoyScore: StateSetter<number>;
    setProjectHealth: StateSetter<ProjectHealth | null>;
    setLifecycleStage: StateSetter<'sprout' | 'bloom' | 'compost' | undefined>;

    setRitualComplete: StateSetter<boolean>;
    setPassHistory: StateSetter<Array<{ pass: number; summary: string; reflection: string }>>;
    setGardenMetrics: StateSetter<{ cherishedFiles: string[]; releasedDebtCount: number }>;

    // File/tidying setters
    setLettingGoFile: StateSetter<{ fullPath: string; fileName?: string; lines?: number } | null>;
    setSproutingFile: StateSetter<{ fileName: string; suggestedPath?: string } | null>;

    // Model/approval setters
    setApprovalRequest: StateSetter<ApprovalRequestPayload | null>;
    setAvailableModels: StateSetter<{ id: string; name: string }[]>;
    setIsLoadingModels: StateSetter<boolean>;

    // UI state setters
    setIsClearModalOpen: StateSetter<boolean>;
    setIsSettingsOpen: StateSetter<boolean>;
    setIsSessionListOpen: StateSetter<boolean>;
    setIsVitalityOpen: StateSetter<boolean>;
    setShowSparkles: StateSetter<boolean>;
    setShowProgressDetails: StateSetter<boolean>;

    // Actions
    triggerSparkles: () => void;
    showToast: (message: string) => void;
    confirmClearSession: () => void;

    // Utilities
    getCurrentTime: () => string;
    currentSessionId: string | null;
    resetStreamState: () => void;
}

/**
 * Utility type for handler functions.
 * Each handler receives the message value and the handler context.
 */
export type MessageHandler<T = unknown> = (value: T, ctx: HandlerContext) => void;

/**
 * Type for throttled handlers that need to manage their own buffering/timing.
 */
export interface ThrottledHandlerConfig {
    /** Ref for progress updates buffering */
    bufferRef: MutableRefObject<ProgressUpdatePayload | null>;
    /** Ref for progress update throttling timer */
    timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    /** Ref for chat content chunks buffering */
    chatBufferRef: MutableRefObject<string[]>;
    /** Ref for tool delta buffering */
    toolDeltaBufferRef: MutableRefObject<{ name?: string; inputDelta: string }[]>;
    /** Ref for chat/tool update throttling timer */
    chatTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

/**
 * Extended context for handlers that need throttling.
 */
export interface ThrottledHandlerContext extends HandlerContext {
    throttled: ThrottledHandlerConfig;
}
