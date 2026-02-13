/**
 * Safely extracts a descriptive error message from an unknown error object.
 * Promotes type-safe error handling across the extension.
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
