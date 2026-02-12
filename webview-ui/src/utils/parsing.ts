/**
 * Robustly parses a partial JSON string to extract specific fields.
 * Handles open strings, escapes, and incomplete structures.
 */
export function parsePartialJson(input: string, keyToExtract: string): string | null {
    let i = 0;
    let state: 'WAITING_KEY' | 'IN_KEY' | 'WAITING_COLON' | 'WAITING_VALUE' | 'IN_STRING_VALUE' = 'WAITING_KEY';
    let currentKey = '';
    let currentValue = '';

    while (i < input.length) {
        const char = input[i];

        if (state === 'WAITING_KEY') {
            if (char === '"') {
                state = 'IN_KEY';
                currentKey = '';
            }
        } else if (state === 'IN_KEY') {
            if (char === '"') {
                state = 'WAITING_COLON';
            } else {
                currentKey += char;
            }
        } else if (state === 'WAITING_COLON') {
            if (char === ':') {
                state = 'WAITING_VALUE';
            }
        } else if (state === 'WAITING_VALUE') {
            if (char === '"') {
                if (currentKey === keyToExtract) {
                    state = 'IN_STRING_VALUE';
                    currentValue = ''; // Start capturing
                } else {
                    // Skip this string value
                    let j = i + 1;
                    while (j < input.length) {
                        if (input[j] === '"' && input[j - 1] !== '\\') break;
                        j++;
                    }
                    i = j; // Advance
                    state = 'WAITING_KEY'; // Reset to look for next key
                }
            } else if (char === '{' || char === '[') {
                // Skip nested objects/arrays if we are strictly looking for a string field at top level
                // Simple skip logic (counting braces) could go here if needed
                state = 'WAITING_KEY';
            } else if (/\s/.test(char)) {
                // whitespace, ignore
            } else if (char === ',' || char === '}') {
                state = 'WAITING_KEY';
            }
        } else if (state === 'IN_STRING_VALUE') {
            if (char === '"' && input[i - 1] !== '\\') {
                // End of value
                return currentValue;
            }
            // Handle escapes
            if (char === '\\' && input[i + 1] === '"') {
                currentValue += '"';
                i++; // Skip quote
            } else if (char === '\\' && input[i + 1] === 'n') {
                currentValue += '\n';
                i++;
            } else if (char === '\\' && input[i + 1] === '\\') {
                currentValue += '\\';
                i++;
            } else {
                if (char !== '\\') currentValue += char;
                // Keep newlines literal if they appear in the stream
            }
        }
        i++;
    }

    // If we end while still IN_STRING_VALUE, return what we have (partial stream)
    if (state === 'IN_STRING_VALUE') {
        return currentValue;
    }

    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function extractCodeFromInput(toolName: string, input: unknown): { code: string, language: string, fileName?: string } | null {
    if (!input) return null;
    const isString = typeof input === 'string';

    let code = "";
    let fileName = "";

    if (!isString && isRecord(input)) {
        // Already parsed object
        fileName = typeof input.path === 'string' ? input.path : "";
        if (toolName === 'write_file' || toolName === 'write_to_file') {
            code = typeof input.content === 'string' ? input.content : '';
        }
        else if (toolName === 'replace_in_file') {
            code = typeof input.replace === 'string' ? input.replace : '';
        }
    } else {
        // Streaming string - use robust parser
        const rawInput = typeof input === 'string' ? input : '';
        const pathVal = parsePartialJson(rawInput, 'path');
        if (pathVal) fileName = pathVal;

        if (toolName === 'write_file' || toolName === 'write_to_file') {
            // Try robust parser first
            const contentVal = parsePartialJson(rawInput, 'content');
            if (contentVal !== null) {
                code = contentVal;
            } else {
                // Fallback to regex if specific parser fails or structure is very weird
                const regex = /"content"\s*:\s*"((?:[^"\\]|\\.)*)/s;
                const match = rawInput.match(regex);
                if (match) code = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
        } else if (toolName === 'replace_in_file') {
            const replaceVal = parsePartialJson(rawInput, 'replace');
            if (replaceVal !== null) {
                code = replaceVal;
            }
        }
    }

    if (!code && !fileName) return null;

    // Infer language
    let language = 'text';
    if (fileName) {
        if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) language = 'typescript';
        else if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) language = 'javascript';
        else if (fileName.endsWith('.py')) language = 'python';
        else if (fileName.endsWith('.html')) language = 'html';
        else if (fileName.endsWith('.css')) language = 'css';
        else if (fileName.endsWith('.md')) language = 'markdown';
        else if (fileName.endsWith('.json')) language = 'json';
    }

    return { code, language, fileName };
}
