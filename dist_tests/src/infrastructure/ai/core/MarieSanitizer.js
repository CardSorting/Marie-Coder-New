/**
 * QUANTUM RESILIENCE: MarieSanitizer
 * Purges circular references, enforces depth limits, and truncates massive strings.
 * Ensures the telemetry stream never crashes the VS Code bridge.
 */
export class MarieSanitizer {
    /**
     * Sanitizes an object for safe JSON serialization and bridge transport.
     */
    static sanitize(obj, maxDepth = 10) {
        const seen = new WeakSet();
        const process = (value, depth) => {
            // Primitive types are safe
            if (value === null || typeof value !== 'object') {
                if (typeof value === 'string' && value.length > 51200) {
                    return value.substring(0, 51200) + "... [TRUNCATED BY MARIE-SANITIZER]";
                }
                return value;
            }
            // Guard against recursion
            if (seen.has(value)) {
                return "[Circular Reference Detected]";
            }
            // Depth Limit
            if (depth > maxDepth) {
                return "[Depth Limit Exceeded]";
            }
            // Handle Arrays
            if (Array.isArray(value)) {
                seen.add(value);
                const result = value.map(item => process(item, depth + 1));
                return result;
            }
            // Handle Objects
            seen.add(value);
            const sanitizedObj = {};
            for (const key in value) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    // Skip potentially massive or internal VS Code objects if they leaked in
                    if (key.startsWith('_') || key === 'extensionContext' || key === 'provider') {
                        continue;
                    }
                    sanitizedObj[key] = process(value[key], depth + 1);
                }
            }
            return sanitizedObj;
        };
        try {
            return process(obj, 0);
        }
        catch (e) {
            console.error("[MarieSanitizer] Critical failure during sanitation:", e);
            return "[Sanitization Failure]";
        }
    }
}
