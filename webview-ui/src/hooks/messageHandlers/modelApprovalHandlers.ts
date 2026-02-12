import type { ToolInput } from '../../types';
import type { HandlerContext } from './types';

interface ModelsMessage {
    value: { id: string; name: string }[];
}

interface ApprovalRequestMessage {
    value: {
        requestId: string;
        toolName: string;
        toolInput: ToolInput;
        reasoning?: string;
        activeObjective?: string;
        diff?: { old: string; new: string };
    };
}

/**
 * Handles available models updates from the extension.
 * Updates the models list and stops loading state.
 */
export function handleOnModels(
    message: ModelsMessage,
    ctx: HandlerContext
): void {
    const { setAvailableModels, setIsLoadingModels } = ctx;

    setAvailableModels(message.value);
    setIsLoadingModels(false);
}

/**
 * Handles tool approval requests from the extension.
 * Opens the approval modal with tool call details.
 */
export function handleOnApprovalRequest(
    message: ApprovalRequestMessage,
    ctx: HandlerContext
): void {
    const { setApprovalRequest } = ctx;
    const event = message.value;

    setApprovalRequest({
        requestId: event.requestId,
        toolName: event.toolName,
        toolInput: event.toolInput,
        reasoning: event.reasoning,
        activeObjective: event.activeObjective,
        diff: event.diff
    });
}

