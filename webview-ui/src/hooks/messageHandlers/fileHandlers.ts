import type { JoyZone } from '../../types';
import type { HandlerContext } from './types';

interface ActiveFileMessage {
    value: string;
}

interface LettingGoMessage {
    value: {
        fullPath: string;
        fileName?: string;
        lines?: number;
    };
}

interface NewFileMessage {
    value: string;
    suggestedPath?: string;
}

/**
 * Determines the Joy Zone based on file path.
 * Zones help categorize files by their architectural layer.
 */
function determineZoneFromPath(filePath: string): JoyZone {
    if (filePath.includes('/domain/') || filePath.includes('/core/')) {
        return 'joyful';
    } else if (filePath.includes('/infrastructure/') || filePath.includes('/services/')) {
        return 'infrastructure';
    } else if (filePath.includes('/plumbing/') || filePath.includes('/utils/')) {
        return 'plumbing';
    } else {
        return null;
    }
}

/**
 * Handles active file updates from the extension.
 * Updates the active file path and calculates the current Joy Zone.
 */
export function handleOnActiveFile(
    message: ActiveFileMessage,
    ctx: HandlerContext
): void {
    const { setActiveFile, setCurrentZone } = ctx;
    const filePath = message.value;

    setActiveFile(filePath);
    setCurrentZone(determineZoneFromPath(filePath));
}

/**
 * Handles letting go (file deletion) requests from the extension.
 * Opens the letting go modal with file information.
 */
export function handleRequestLettingGo(
    message: LettingGoMessage,
    ctx: HandlerContext
): void {
    const { setLettingGoFile } = ctx;

    setLettingGoFile(message.value);
}

/**
 * Handles new file (sprouting) notifications from the extension.
 * Shows the sprouting modal with file information.
 */
export function handleOnNewFile(
    message: NewFileMessage,
    ctx: HandlerContext
): void {
    const { setSproutingFile } = ctx;

    setSproutingFile({
        fileName: message.value,
        suggestedPath: message.suggestedPath
    });
}
