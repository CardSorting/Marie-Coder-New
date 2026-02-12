export interface PartialToolInput {
    path?: string;
    content?: string;
    old_content?: string;
    line_start?: number;
    search?: string;
    replace?: string;
}

/**
 * A pure logical parser for streaming tool call JSON.
 * Zero external dependencies, focused solely on stateful string transformation.
 */
export class PureStreamParser {
    private buffers = new Map<string, string>();

    // Pre-compiled regex patterns for standard keys to avoid excessive GC
    private static readonly KEY_PATTERNS = new Map<string, RegExp>([
        ['"path":', /[{"\s,]"path":/],
        ['"content":', /[{"\s,]"content":/],
        ['"old_content":', /[{"\s,]"old_content":/],
        ['"search":', /[{"\s,]"search":/],
        ['"replace":', /[{"\s,]"replace":/]
    ]);

    private static readonly LINE_START_REGEX = /[{"\s,]"line_start"\s*:\s*(\d+)/;

    public append(toolCallId: string, delta: string): PartialToolInput {
        let currentBuffer = (this.buffers.get(toolCallId) || "") + delta;

        // STABILITY: If the buffer ends with an unescaped backslash, don't parse it yet
        // as it might be the start of a multi-token escape sequence like \uXXXX or \n
        if (currentBuffer.endsWith('\\')) {
            let backslashes = 0;
            for (let i = currentBuffer.length - 1; i >= 0 && currentBuffer[i] === '\\'; i--) {
                backslashes++;
            }
            if (backslashes % 2 !== 0) {
                // Odd number of backslashes at the end - save the last one for the next chunk
                this.buffers.set(toolCallId, currentBuffer.slice(0, -1));
                return this.parse(currentBuffer.slice(0, -1));
            }
        }

        this.buffers.set(toolCallId, currentBuffer);
        return this.parse(currentBuffer);
    }

    private parse(buffer: string): PartialToolInput {
        const result: PartialToolInput = {};

        result.path = this.extractString(buffer, '"path":');
        result.content = this.extractString(buffer, '"content":');
        result.old_content = this.extractString(buffer, '"old_content":');
        result.search = this.extractString(buffer, '"search":');
        result.replace = this.extractString(buffer, '"replace":');

        // Hardened numeric parsing for line_start (ensure it's a key-value pair and not hallucinated text)
        const lineStartMatch = buffer.match(PureStreamParser.LINE_START_REGEX);
        if (lineStartMatch) {
            const val = parseInt(lineStartMatch[1]);
            if (!isNaN(val)) {
                result.line_start = val;
            }
        }

        return result;
    }

    private extractString(buffer: string, key: string): string | undefined {
        const keyIndex = buffer.indexOf(key);
        if (keyIndex === -1) return undefined;

        // Ensure key is a property name (preceded by whitespace/delimiter)
        // and NOT inside an existing string context (Stateful Audit)
        if (this.isInsideString(buffer, keyIndex)) return undefined;

        if (keyIndex > 0) {
            const prev = buffer[keyIndex - 1];
            if (!['{', ',', ' ', '\t', '\n', '\r'].includes(prev)) return undefined;
        }

        const start = keyIndex + key.length;
        const firstQuote = buffer.indexOf('"', start);
        if (firstQuote === -1) return undefined;

        const rawContent = buffer.substring(firstQuote + 1);
        const closingQuoteIndex = this.findClosingQuote(rawContent);

        if (closingQuoteIndex !== -1) {
            return this.unescape(rawContent.substring(0, closingQuoteIndex));
        } else {
            return this.unescape(rawContent);
        }
    }

    private isInsideString(buffer: string, index: number): boolean {
        let inString = false;
        let escaped = false;
        for (let i = 0; i < index; i++) {
            const char = buffer[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
            }
        }
        return inString;
    }

    private findClosingQuote(str: string): number {
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '"') {
                let backslashes = 0;
                for (let j = i - 1; j >= 0 && str[j] === '\\'; j--) {
                    backslashes++;
                }
                if (backslashes % 2 === 0) return i;
            }
        }
        return -1;
    }

    private unescape(str: string): string {
        return str.replace(/\\(u[0-9a-fA-F]{4}|[^u])/g, (_, escape) => {
            if (escape.startsWith('u')) {
                const hex = escape.substring(1);
                if (hex.length === 4) {
                    return String.fromCharCode(parseInt(hex, 16));
                }
                return `\\${escape}`;
            }
            switch (escape) {
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                case 'b': return '\b';
                case 'f': return '\f';
                case '"': return '"';
                case '\\': return '\\';
                case '/': return '/';
                default: return escape;
            }
        });
    }

    public clear(toolCallId: string) {
        this.buffers.delete(toolCallId);
    }

    public clearAll() {
        this.buffers.clear();
    }
}
