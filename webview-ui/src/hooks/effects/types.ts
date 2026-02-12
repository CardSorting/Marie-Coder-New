/**
 * Type definitions for Marie Effects system.
 *
 * This module contains all types related to the effects system,
 * separated from implementation details.
 */

import type { HandlerContext } from '../messageHandlers';

/**
 * Setters type - all the state setter functions from useMarie.
 * Excludes getCurrentTime (internal), actions (passed separately),
 * and triggerSparkles (UI action).
 */
export type MarieSetters = Omit<HandlerContext, 'getCurrentTime' | 'triggerSparkles' | 'showToast' | 'confirmClearSession'>;

/**
 * Actions type - callback functions from useMarie.
 */
export type MarieActions = Pick<HandlerContext, 'triggerSparkles' | 'showToast' | 'confirmClearSession'>;

/**
 * Configuration for throttled progress updates.
 */
export interface ThrottlingConfig {
    /** Throttle delay in milliseconds */
    readonly throttleDelay: number;
}

/**
 * Default throttling configuration.
 */
export const DEFAULT_THROTTLING_CONFIG: ThrottlingConfig = {
    throttleDelay: 100
};
