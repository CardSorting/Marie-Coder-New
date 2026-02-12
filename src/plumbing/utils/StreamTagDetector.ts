import { PrefixTree } from "./PrefixTree.js";

export class StreamTagDetector {
    private buffer: string = "";
    private static readonly MAX_BUFFER_SIZE = 100000; // 100k chars safety limit

    // Tags we want to detect.
    // We strictly look for the start of a tool block or the end of one.
    // Also includes Llama 3 variations and control tokens.
    private tags: string[] = [
        "<|tool_call_begin|>",
        "<|tool_call_end|>",
        "<|tool_call_id|>",           // Some models emit tool IDs separately
        "<|tool_call_argument_begin|>",
        "<|tool_call_arguments_begin|>", // Plural variant
        "<tool>",
        "</tool>",
        "<function_calls>",
        "</function_calls>",
        "<invoke",
        "</invoke>",
        "<thought>",
        "</thought>",
        "<tool_code>",
        "</tool_code>",
        "<tool_call>",
        "</tool_call>",
        "<|eot_id|>",                 // End of turn marker
        "<|start_header_id|>",        // Header start marker
        "<|end_header_id|>"           // Header end marker
    ];

    private prefixTree: PrefixTree;

    constructor() {
        this.prefixTree = new PrefixTree(this.tags);
    }

    /**
     * Processes a chunk of text and returns a status indicating what happened.
     * 
     * - 'tag': A full tag was found. The returned `text` is content BEFORE the tag. `tag` is the tag itself.
     *          The buffer will contain any remainder AFTER the tag for the next call.
     * - 'incomplete': A partial tag was found at the end. `text` is the safe content before it. 
     *                 The buffer holds the partial tag.
     * - 'content': No tags found. `text` Is the full content. Buffer is empty.
     */
    public process(chunk: string): { type: 'content' | 'incomplete' | 'tag', text: string, tag?: string, fuzzyMatch?: boolean } {
        this.buffer += chunk;

        // --- Buffer Growth Safety ---
        if (this.buffer.length > StreamTagDetector.MAX_BUFFER_SIZE) {
            console.error("[Marie] StreamTagDetector buffer exceeded safety limit. Flushing.");
            const flushed = this.buffer;
            this.buffer = "";
            return { type: 'content', text: flushed };
        }

        // 1. Check if we have any FULL tags using prefix tree (O(k) complexity)
        const tagMatch = this.prefixTree.findEarliestTag(this.buffer);

        if (tagMatch) {
            // Found a tag!
            // Emit content up to tag
            const content = this.buffer.substring(0, tagMatch.index);
            // Remove content + tag from buffer, keep remainder
            this.buffer = this.buffer.substring(tagMatch.index + tagMatch.tag.length);

            console.log(`[Marie] Tag detected: ${tagMatch.tag} at index ${tagMatch.index}`);
            return { type: 'tag', text: content, tag: tagMatch.tag };
        }

        // 2. Check for dynamic/malformed tags using regex
        const lookbackLength = Math.min(200, this.buffer.length);
        const recentBuffer = this.buffer.substring(this.buffer.length - lookbackLength);

        // Pattern: word:id> or <|tag|> or <tag>
        // Use [^a-zA-Z0-9_] as a boundary instead of \b to be more explicit about what we consider a "word start"
        const dynamicTagPattern = /<\|[\w_]{3,}[|>]?|<\/?[\w]{3,}>?|(?:^|[^a-zA-Z0-9_])([\w_]{3,}(?::\d+)?>)/g;
        const matches = Array.from(recentBuffer.matchAll(dynamicTagPattern));

        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            // If we have a capture group (index 1), use it, otherwise use the full match
            const potentialTag = lastMatch[1] || lastMatch[0];

            // If it's a perfect match for a known tag or matches our dynamic pattern
            // If we used a capture group, we need to adjust the index to point to that group specifically
            const matchIndex = this.buffer.length - lookbackLength + lastMatch.index! + (lastMatch[0].length - potentialTag.length);

            // Check if this is a definite tag (ends with > or is a known tag)
            if (potentialTag.endsWith('>') || this.tags.includes(potentialTag)) {
                const content = this.buffer.substring(0, matchIndex);
                this.buffer = this.buffer.substring(matchIndex + potentialTag.length);
                console.log(`[Marie] Dynamic tag detected: ${potentialTag}`);
                return { type: 'tag', text: content, tag: potentialTag };
            }
        }

        // 3. Check for partials (both prefix tree and dynamic)
        const partialLength = this.prefixTree.findLongestPartialAtEnd(this.buffer);

        // Dynamic partial check: also look for any trailing word characters that might be a tool name or tag
        const trailingWordMatch = this.buffer.match(/[\w_:|<]+$/);
        const dynamicPartialLength = trailingWordMatch ? trailingWordMatch[0].length : 0;

        const maxPartial = Math.max(partialLength, dynamicPartialLength);

        if (maxPartial > 0) {
            const unsafeStart = this.buffer.length - maxPartial;
            const content = this.buffer.substring(0, unsafeStart);
            this.buffer = this.buffer.substring(unsafeStart);
            return { type: 'incomplete', text: content };
        }

        // 4. No tags, no partials. Emit all.
        const allContent = this.buffer;
        this.buffer = "";
        return { type: 'content', text: allContent };
    }

    /**
     * Resets the internal buffer. Useful for cleanup between sessions.
     */
    public reset(): void {
        this.buffer = "";
    }

    /**
     * Returns the current buffer size for monitoring.
     */
    public getBufferSize(): number {
        return this.buffer.length;
    }
}
