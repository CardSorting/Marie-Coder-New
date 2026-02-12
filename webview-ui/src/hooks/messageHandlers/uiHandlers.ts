import type { HandlerContext } from './types';

interface ToastMessage {
    value: string;
}

/**
 * Handles toast notifications from the extension.
 * Displays ephemeral messages to the user.
 */
export function handleOnToast(
    message: ToastMessage,
    ctx: HandlerContext
): void {
    const { showToast } = ctx;

    showToast(message.value);
}

/**
 * Handles clear session triggers from the extension.
 * Initiates the session clearing flow.
 */
export function handleTriggerClear(
    _message: unknown,
    ctx: HandlerContext
): void {
    const { confirmClearSession } = ctx;

    confirmClearSession();
}
