/**
 * Utilities for handling shaky AI-generated JSON and non-standard tool call formats.
 */

export interface ExtractedToolCall {
    name: string;
    input: any;
    id?: string;
    repaired?: boolean;
}

export class JsonUtils {
    /**
     * Repairs truncated or unclosed JSON strings.
     * Returns the repaired string and a flag indicating if any changes were made.
     */
    public static repairJsonDetailed(json: any): { repaired: string, wasFixed: boolean } {
        if (typeof json !== 'string') return { repaired: "{}", wasFixed: false };
        let repaired = json.trim();
        if (!repaired) return { repaired: "{}", wasFixed: false };

        let wasFixed = false;
        const original = repaired;

        // Pre-processing: Fix unquoted keys or single quotes
        repaired = repaired.replace(/'/g, '"');

        let isInsideString = false;
        let stack: string[] = [];
        let i = 0;

        while (i < repaired.length) {
            const char = repaired[i];
            const prevChar = i > 0 ? repaired[i - 1] : '';
            const isEscaped = prevChar === '\\';

            if (char === '"' && !isEscaped) {
                isInsideString = !isInsideString;
            } else if (!isInsideString) {
                if (char === '{' || char === '[') {
                    stack.push(char);
                } else if (char === '}' || char === ']') {
                    const expected = char === '}' ? '{' : '[';
                    if (stack.length > 0 && stack[stack.length - 1] === expected) {
                        stack.pop();
                    }
                }
            }
            i++;
        }

        if (isInsideString) {
            repaired += '"';
        }

        // Close unclosed structures
        const hadUnclosed = stack.length > 0;
        while (stack.length > 0) {
            const last = stack.pop();
            if (last === '{') repaired += '}';
            else if (last === '[') repaired += ']';
        }

        // Extreme: Fix unquoted property names: { name: "val" } -> { "name": "val" }
        repaired = repaired.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*):/g, '$1"$2"$3:');

        // Trailing commas
        const hadTrailing = /,\s*[}\]]/.test(repaired);
        repaired = repaired.replace(/,\s*([}\]])/g, '$1');

        wasFixed = (repaired !== original) || hadUnclosed || hadTrailing || isInsideString;

        return { repaired, wasFixed };
    }

    public static repairJson(json: string): string {
        return this.repairJsonDetailed(json).repaired;
    }

    /**
     * LRU cache for repairJson + JSON.parse combined operations.
     * Prevents redundant string repair and parsing for identical inputs.
     */
    private static readonly parseCache = new Map<string, { result: any; wasFixed: boolean }>();
    private static readonly PARSE_CACHE_MAX = 100;

    /**
     * Combines repairJson + JSON.parse into a single cached operation.
     * Returns the parsed object directly. Throws on unrecoverable parse errors.
     */
    public static safeParseJson(json: string): any {
        const cached = this.parseCache.get(json);
        if (cached) return cached.result;

        const { repaired, wasFixed } = this.repairJsonDetailed(json);
        const result = JSON.parse(repaired);

        // Cache the result with FIFO eviction
        this.parseCache.set(json, { result, wasFixed });
        if (this.parseCache.size > this.PARSE_CACHE_MAX) {
            const firstKey = this.parseCache.keys().next().value;
            if (firstKey) this.parseCache.delete(firstKey);
        }

        return result;
    }

    /**
     * Like safeParseJson but also returns whether repair was needed.
     */
    public static safeParseJsonDetailed(json: string): { result: any; wasFixed: boolean } {
        const cached = this.parseCache.get(json);
        if (cached) return cached;

        const { repaired, wasFixed } = this.repairJsonDetailed(json);
        const result = JSON.parse(repaired);

        const entry = { result, wasFixed };
        this.parseCache.set(json, entry);
        if (this.parseCache.size > this.PARSE_CACHE_MAX) {
            const firstKey = this.parseCache.keys().next().value;
            if (firstKey) this.parseCache.delete(firstKey);
        }

        return entry;
    }

    /**
     * Attempts to extract a tool call from a string that might be wrapped in tags,
     * contains noise, or use non-standard formats.
     */
    public static extractToolCall(text: any): ExtractedToolCall | null {
        if (typeof text !== 'string') return null;

        // Guard: Empty or whitespace-only content
        const trimmedText = text.trim();
        if (!trimmedText || trimmedText.length < 5) return null;

        let contentToParse = text;
        let isLlama = false;
        let toolName = "";

        // 0. Handle <thought> tags (some models emit reasoning before tools)
        // We strip them to avoid regex confusion if they contain XML-like text
        contentToParse = contentToParse.replace(/<thought>[\s\S]*?<\/thought>/g, '');

        // 0b. Guard: Check if content is only section markers with nothing between them
        const onlyMarkersPattern = /^\s*<\|tool_calls_section_begin\|>\s*<\|tool_calls_section_end\|>\s*$/;
        if (onlyMarkersPattern.test(contentToParse)) {
            console.warn('[Marie] JsonUtils: Empty tool section markers detected');
            return null;
        }

        // 0c. NEW: Check for JSON tool_calls array format (e.g., from Claude)
        // Format: { "tool_calls": [{ "id": "...", "type": "write_file", "arguments": {...} }] }
        try {
            const jsonStart = contentToParse.indexOf('{');
            const jsonEnd = contentToParse.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                const jsonCandidate = contentToParse.substring(jsonStart, jsonEnd + 1);
                const parsed = JSON.parse(jsonCandidate);
                if (parsed.tool_calls && Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
                    const firstCall = parsed.tool_calls[0];
                    if (firstCall.type && firstCall.arguments) {
                        console.log('[Marie] JsonUtils: Found JSON tool_calls format');
                        return {
                            name: firstCall.type,
                            input: firstCall.arguments,
                            id: firstCall.id,
                            repaired: true
                        };
                    }
                }
            }
        } catch (e) {
            // Not valid JSON or not the right format, continue with other parsers
        }

        // 1. Check for Llama 3 / DeepSeek style tags first (more specific)
        const llamaMatch = contentToParse.match(/<(?:\|tool_call_begin\|>|\|tool_calls_section_begin\|>)\s*([\w\.]+)(?::\d+)?(?:\s*<\|tool_call_arguments?_begin\|>)?\s*([\s\S]*?)(?:\s*(?:<\|tool_call_end\|>|<\|tool_calls_section_end\|>)|$)/);

        // Guard: Check for empty content between markers
        if (llamaMatch) {
            const capturedContent = llamaMatch[2];
            if (!capturedContent || !capturedContent.trim()) {
                console.warn('[Marie] JsonUtils: Tool section markers found but no content between them');
                return null;
            }
            toolName = llamaMatch[1].replace(/^functions\./, '');
            contentToParse = capturedContent;
            isLlama = true;
        } else {
            // 1b. Check for compact Llama 3 / OpenRouter format: tool_name:id>JSON or tool_name>JSON
            // This often appears in raw streams
            const compactMatch = contentToParse.match(/([\w\.]+)(?::(\d+))?>(\{[\s\S]*?)(?:$)/);
            if (compactMatch) {
                toolName = compactMatch[1].replace(/^functions\./, '');
                const toolId = compactMatch[2] ? `call_${compactMatch[2]}` : undefined;
                contentToParse = compactMatch[3];

                const { repaired, wasFixed } = this.repairJsonDetailed(contentToParse);
                try {
                    const parsed = JSON.parse(repaired);
                    return { name: toolName, input: parsed, id: toolId, repaired: wasFixed };
                } catch (e) {
                    // Fall through if not valid JSON yet
                }
            }

            // 2. Check for DeepSeek style <tool_code>...</tool_code>
            const toolCodeMatch = contentToParse.match(/<tool_code>([\s\S]*?)(?:<\/tool_code>|$)/);
            if (toolCodeMatch) {
                contentToParse = toolCodeMatch[1];
            } else {
                // 3. Check for Qwen style <tool_call>...</tool_call>
                const toolCallTagMatch = contentToParse.match(/<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/);
                if (toolCallTagMatch) {
                    contentToParse = toolCallTagMatch[1];
                } else {
                    // 4. Check for <tool>...</tool>
                    const toolTagMatch = contentToParse.match(/<tool>([\s\S]*?)(?:<\/tool>|$)/);
                    if (toolTagMatch) {
                        contentToParse = toolTagMatch[1];
                    } else {
                        // 5. Check for XML style <invoke name="...">...</invoke>
                        const invokeStartMatch = contentToParse.match(/<invoke\s+([^>]*?name=["']?([^"'\s>]+)["']?[^>]*?)>/i);
                        if (invokeStartMatch) {
                            toolName = invokeStartMatch[2];
                            const invokeStartIdx = invokeStartMatch.index!;
                            const contentAfterStart = contentToParse.substring(invokeStartIdx + invokeStartMatch[0].length);

                            // Find closing </invoke> (handling potential nesting)
                            const invokeEndIdx = contentAfterStart.lastIndexOf('</invoke>');
                            const innerContent = invokeEndIdx !== -1
                                ? contentAfterStart.substring(0, invokeEndIdx)
                                : contentAfterStart; // Auto-close if missing

                            // Robust Parameter Extraction (Nesting-Aware)
                            const params: Record<string, any> = {};
                            const paramStartRegex = /<parameter\s+[^>]*?name=["']?([^"'\s>]+)["']?[^>]*?>/gi;
                            let pMatch;

                            while ((pMatch = paramStartRegex.exec(innerContent)) !== null) {
                                const pName = pMatch[1];
                                const pStartIdx = pMatch.index + pMatch[0].length;

                                // Find corresponding </parameter>
                                const nextEndIdx = innerContent.indexOf('</parameter>', pStartIdx);
                                const pValueRaw = nextEndIdx !== -1
                                    ? innerContent.substring(pStartIdx, nextEndIdx)
                                    : innerContent.substring(pStartIdx); // Auto-close

                                const pValue = pValueRaw.trim();

                                // Basic level-1 JSON / Type parsing
                                if (pValue.startsWith('{') || pValue.startsWith('[')) {
                                    try {
                                        // Attempt to repair and parse any block starting with { or [
                                        params[pName] = JSON.parse(this.repairJson(pValue));
                                    } catch (e) {
                                        params[pName] = pValue;
                                    }
                                } else if (pValue.toLowerCase() === 'true') {
                                    params[pName] = true;
                                } else if (pValue.toLowerCase() === 'false') {
                                    params[pName] = false;
                                } else if (!isNaN(Number(pValue)) && pValue !== '') {
                                    params[pName] = Number(pValue);
                                } else {
                                    params[pName] = pValue;
                                }
                            }

                            if (Object.keys(params).length > 0) {
                                return { name: toolName, input: params, repaired: true };
                            }

                            contentToParse = innerContent;
                        }
                    }
                }
            }
        }

        // 3. Clean markdown code blocks (handle truncated blocks too)
        const hasMarkdown = /```/.test(contentToParse);
        if (hasMarkdown) {
            contentToParse = contentToParse.replace(/```(?:json)?/g, '').replace(/```/g, '');
        }

        // 4. Clean preamble/postamble (text outside the first { and last })
        const firstBrace = contentToParse.indexOf('{');
        const lastBrace = contentToParse.lastIndexOf('}');

        if (firstBrace === -1) return null; // No JSON object found

        let jsonCandidate = contentToParse.substring(firstBrace);

        try {
            const { repaired, wasFixed } = this.repairJsonDetailed(jsonCandidate);
            const parsed = JSON.parse(repaired);

            if (isLlama) {
                return { name: toolName, input: parsed, repaired: wasFixed || hasMarkdown };
            }

            const normalized = this.normalizeToolCall(parsed);
            if (normalized) {
                // Heuristic: if we had to strip markdown or prefix, it was "repaired"
                normalized.repaired = wasFixed || hasMarkdown || (firstBrace > 0);
                return normalized;
            }
        } catch (e) {
            // console.error("Failed to parse tool content:", e);
        }

        return null;
    }

    private static normalizeToolCall(parsed: any): ExtractedToolCall | null {
        // Handle different common formats
        if (parsed.tool_name && parsed.tool_input) {
            return {
                name: parsed.tool_name,
                input: parsed.tool_input,
                id: parsed.tool_id
            };
        }

        if (parsed.name && parsed.arguments) {
            return {
                name: parsed.name,
                input: typeof parsed.arguments === 'string' ? this.safeParseJson(parsed.arguments) : parsed.arguments,
                id: parsed.id
            };
        }

        if (parsed.name && parsed.input) {
            return {
                name: parsed.name,
                input: parsed.input,
                id: parsed.id
            };
        }

        // Literal format: { "write_file": { ... } }
        const keys = Object.keys(parsed);
        if (keys.length === 1 && typeof parsed[keys[0]] === 'object' && !Array.isArray(parsed[keys[0]])) {
            return {
                name: keys[0],
                input: parsed[keys[0]]
            };
        }

        return null;
    }
}
