/**
 * Effects system barrel export.
 *
 * This module provides a clean API for the effects system,
 * re-exporting all related types and hooks.
 */

// Types
export type {
    MarieSetters,
    MarieActions,
    ThrottlingConfig
} from './types';

export { DEFAULT_THROTTLING_CONFIG } from './types';

// Hooks
export type { ThrottlingState } from './useThrottling';
export { useThrottling } from './useThrottling';

export type { CompleteHandlerContext, ContextUtilities } from './useHandlerContext';
export { useHandlerContext } from './useHandlerContext';

export type { MessageListenerProps } from './useMessageListener';
export { useMessageListener } from './useMessageListener';
