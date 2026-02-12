/**
 * QUANTUM RESILIENCE: MarieSanitizer
 * Purges circular references, enforces depth and breadth limits, and truncates massive strings.
 * Ensures the telemetry stream never crashes the VS Code bridge.
 */
export class MarieSanitizer {
    private static readonly MAX_DEPTH = 10;
    private static readonly STRING_LIMIT = 5000;
    private static readonly BREADTH_LIMIT = 100;
    private static readonly GLOBAL_MAX_SIZE = 512 * 1024; // 512KB total safety cap

    /**
     * Sanitizes an object for safe JSON serialization and bridge transport.
     * @param obj The object to sanitize.
     */
    public static sanitize(obj: any): any {
        const seen = new WeakSet();
        let totalSize = 0;

        const sanitizer = (val: any, depth: number): any => {
            if (totalSize > this.GLOBAL_MAX_SIZE) return "[Global Size Limit Reached]";
            if (depth > this.MAX_DEPTH) return "[Max Depth Reached]";
            if (val === null || val === undefined) return val;

            const type = typeof val;
            if (type === "string") {
                const effectiveLength = Math.min(val.length, this.STRING_LIMIT);
                totalSize += effectiveLength;
                if (val.length > this.STRING_LIMIT) {
                    return val.substring(0, this.STRING_LIMIT) + "... [Truncated]";
                }
                return val;
            }
            if (type === "number") {
                totalSize += 8;
                return val;
            }
            if (type === "boolean") {
                totalSize += 4;
                return val;
            }
            if (type === "function") return "[Function]";
            if (type === "symbol") return "[Symbol]";

            if (type === "object") {
                if (seen.has(val)) return "[Circular Reference]";
                seen.add(val);

                if (Array.isArray(val)) {
                    const arr = val.slice(0, this.BREADTH_LIMIT).map(item => sanitizer(item, depth + 1));
                    if (val.length > this.BREADTH_LIMIT) {
                        (arr as any).push(`... [${val.length - this.BREADTH_LIMIT} items truncated]`);
                    }
                    return arr;
                }

                const sanitized: any = {};
                const keys = Object.keys(val);
                const limitedKeys = keys.slice(0, this.BREADTH_LIMIT);

                for (const key of limitedKeys) {
                    if (key.startsWith('_') || key === 'extensionContext' || key === 'provider') continue;
                    try {
                        totalSize += key.length;
                        sanitized[key] = sanitizer(val[key], depth + 1);
                    } catch {
                        sanitized[key] = "[Unreadable]";
                    }
                }

                if (keys.length > this.BREADTH_LIMIT) {
                    sanitized["_truncated"] = `${keys.length - this.BREADTH_LIMIT} properties truncated`;
                }
                return sanitized;
            }
            return String(val);
        };

        return sanitizer(obj, 0);
    }
}
