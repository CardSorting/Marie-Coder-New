import type { HandlerContext } from './types';
import {
    handleOnResponse,
    handleOnStreamUpdate,
    handleOnSessionLoaded,
    handleOnToolCall,
    handleOnToolDelta
} from './chatHandlers';
import {
    handleOnSettings,
    handleOnSessionsList
} from './sessionHandlers';
import {
    handleOnRunStart,
    handleOnRunComplete,
    handleOnStageChange,
    handleOnStepUpdate,
    handleOnReasoningUpdate,
    handleOnUsageUpdate,
    handleOnRunError,
    createProgressUpdateHandler,
    handleOnCheckpointState,
    handleOnRunState
} from './streamHandlers';
import {
    handleOnJoyScore,
    handleOnProjectHealth,
    handleOnRitualUpdate
} from './gardenHandlers';
import {
    handleOnActiveFile,
    handleRequestLettingGo,
    handleOnNewFile
} from './fileHandlers';
import {
    handleOnToast,
    handleTriggerClear
} from './uiHandlers';
import {
    handleOnModels,
    handleOnApprovalRequest
} from './modelApprovalHandlers';

/**
 * Message handler function type.
 * All handlers receive the message value and handler context.
 */
type MessageHandlerFn = (message: { value: unknown }, ctx: HandlerContext) => void;

/**
 * Registry mapping message types to their handlers.
 * This declarative approach makes it easy to add new message types.
 */
export interface HandlerRegistry {
    [messageType: string]: MessageHandlerFn | undefined;
}

/**
 * Creates a handler registry with all message handlers configured.
 * Handlers are provided with throttling refs where necessary.
 */
export function createHandlerRegistry(
    throttled: import('./types').ThrottledHandlerConfig
): HandlerRegistry {
    const handleOnProgressUpdate = createProgressUpdateHandler(throttled.bufferRef, throttled.timerRef);

    return {
        // Chat message handlers
        onResponse: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnResponse(val as any, ctx);
        }) as MessageHandlerFn,
        onStreamUpdate: (val: any, ctx: HandlerContext) => {
            if (typeof val?.value === 'string') handleOnStreamUpdate(val, { ...ctx, throttled });
        },
        onSessionLoaded: ((val, ctx) => {
            if (Array.isArray(val?.value)) handleOnSessionLoaded(val as any, ctx);
        }) as MessageHandlerFn,
        onToolCall: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnToolCall(val as any, ctx);
        }) as MessageHandlerFn,
        onToolDelta: (val: any, ctx: HandlerContext) => {
            if (val?.value && typeof val.value === 'object') handleOnToolDelta(val, { ...ctx, throttled });
        },

        // Session/settings handlers
        onSettings: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnSettings(val as any, ctx);
        }) as MessageHandlerFn,
        onSessionsList: ((val, ctx) => {
            if (Array.isArray(val?.value)) handleOnSessionsList(val as any, ctx);
        }) as MessageHandlerFn,

        // Stream/progress handlers
        onRunStart: handleOnRunStart as MessageHandlerFn,
        onRunComplete: handleOnRunComplete as MessageHandlerFn,
        onStageChange: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnStageChange(val as any, ctx);
        }) as MessageHandlerFn,
        onStepUpdate: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnStepUpdate(val as any, ctx);
        }) as MessageHandlerFn,
        onReasoningUpdate: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnReasoningUpdate(val as any, ctx);
        }) as MessageHandlerFn,
        onUsageUpdate: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnUsageUpdate(val as any, ctx);
        }) as MessageHandlerFn,
        onRunError: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnRunError(val as any, ctx);
        }) as MessageHandlerFn,
        onProgressUpdate: handleOnProgressUpdate as MessageHandlerFn,
        onCheckpointState: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnCheckpointState(val as any, ctx);
        }) as MessageHandlerFn,
        onRunState: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnRunState(val as any, ctx);
        }) as MessageHandlerFn,

        // Garden/joy handlers
        onJoyScore: ((val, ctx) => {
            if (typeof val?.value === 'number') handleOnJoyScore(val as any, ctx);
        }) as MessageHandlerFn,
        onProjectHealth: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnProjectHealth(val as any, ctx);
        }) as MessageHandlerFn,
        onRitualUpdate: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnRitualUpdate(val as any, ctx);
        }) as MessageHandlerFn,

        // File/tidying handlers
        onActiveFile: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnActiveFile(val as any, ctx);
        }) as MessageHandlerFn,
        requestLettingGo: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleRequestLettingGo(val as any, ctx);
        }) as MessageHandlerFn,
        onNewFile: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnNewFile(val as any, ctx);
        }) as MessageHandlerFn,

        // UI handlers
        onToast: ((val, ctx) => {
            if (typeof val?.value === 'string') handleOnToast(val as any, ctx);
        }) as MessageHandlerFn,
        triggerClear: handleTriggerClear as MessageHandlerFn,

        // Model/approval handlers
        onModels: ((val, ctx) => {
            if (Array.isArray(val?.value)) handleOnModels(val as any, ctx);
        }) as MessageHandlerFn,
        onApprovalRequest: ((val, ctx) => {
            if (val?.value && typeof val.value === 'object') handleOnApprovalRequest(val as any, ctx);
        }) as MessageHandlerFn
    };
}

// Re-export all types and handlers for testing and advanced use cases
export * from './types';
export * from './chatHandlers';
export * from './sessionHandlers';
export * from './streamHandlers';
export * from './gardenHandlers';
export * from './fileHandlers';
export * from './uiHandlers';
export * from './modelApprovalHandlers';
