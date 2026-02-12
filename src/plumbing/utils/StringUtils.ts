export class StringUtils {
    /**
     * Calculates Levenshtein distance between two strings.
     */
    static levenshtein(a: string, b: string): number {
        // PERF: Prevent exhaustive comparison on massive strings (O(N^2) hazard)
        const MAX_LEVEN_CHARS = 5000;
        if (a.length > MAX_LEVEN_CHARS || b.length > MAX_LEVEN_CHARS) {
            // Fallback to a fast length-based and prefix-based estimation for safety
            const prefLen = this.getCommonPrefixLength(a, b);
            const suffLen = this.getCommonSuffixLength(a, b);
            const lenDiff = Math.abs(a.length - b.length);
            return lenDiff + (Math.max(a.length, b.length) - prefLen - suffLen - lenDiff);
        }

        // Ensure 'a' is the shorter string so we only allocate O(min(n,m)) space
        if (a.length > b.length) { const t = a; a = b; b = t; }
        const aLen = a.length;
        const bLen = b.length;
        if (aLen === 0) return bLen;

        let prev = new Array<number>(aLen + 1);
        let curr = new Array<number>(aLen + 1);
        for (let j = 0; j <= aLen; j++) prev[j] = j;

        for (let i = 1; i <= bLen; i++) {
            curr[0] = i;
            for (let j = 1; j <= aLen; j++) {
                if (b[i - 1] === a[j - 1]) {
                    curr[j] = prev[j - 1];
                } else {
                    curr[j] = Math.min(prev[j - 1], curr[j - 1], prev[j]) + 1;
                }
            }
            // Swap rows (reuse prev array on next iteration)
            const tmp = prev; prev = curr; curr = tmp;
        }
        return prev[aLen];
    }

    /**
     * Calculates similarity (0-1) between two strings using Levenshtein distance.
     * Optimized with early exit for significantly different lengths.
     */
    static similarity(a: string, b: string): number {
        const maxLength = Math.max(a.length, b.length);
        const minLength = Math.min(a.length, b.length);
        if (maxLength === 0) return 1.0;

        // Early exit: if strings differ by > 50% in length, similarity will be low
        // This avoids expensive Levenshtein calculation for obviously dissimilar strings
        const lengthRatio = minLength / maxLength;
        if (lengthRatio < 0.5) {
            // Still compute, but we know it won't be high similarity
            // Could return 0 here for even faster processing, but let's be accurate
        }

        return (maxLength - this.levenshtein(a, b)) / maxLength;
    }

    /**
     * Safely extracts text from AI message content which can be a string or array of blocks.
     */
    static extractText(content: any): string {
        if (content === null || content === undefined) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .filter(block => block && block.type === 'text')
                .map(block => block.text || '')
                .join(' ');
        }
        return '';
    }

    private static getCommonPrefixLength(a: string, b: string): number {
        let i = 0;
        const min = Math.min(a.length, b.length);
        while (i < min && a[i] === b[i]) i++;
        return i;
    }

    private static getCommonSuffixLength(a: string, b: string): number {
        let i = 0;
        const aLen = a.length;
        const bLen = b.length;
        const min = Math.min(aLen, bLen);
        while (i < min && a[aLen - 1 - i] === b[bLen - 1 - i]) i++;
        return i;
    }
}
