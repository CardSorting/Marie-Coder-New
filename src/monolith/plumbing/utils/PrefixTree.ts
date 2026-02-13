import { StringUtils } from "./StringUtils.js";

/**
 * Prefix Tree (Trie) for efficient tag detection.
 * Provides O(k) complexity for finding tags where k = input length.
 */
export class PrefixTree {
    private root: TrieNode = { children: new Map(), isEndOfTag: false };
    private tags: string[] = [];

    constructor(tags: string[]) {
        this.tags = tags;
        for (const tag of tags) {
            this.insert(tag);
        }
    }

    /**
     * Insert a tag into the trie.
     */
    private insert(tag: string): void {
        let node = this.root;
        for (const char of tag) {
            if (!node.children.has(char)) {
                node.children.set(char, { children: new Map(), isEndOfTag: false });
            }
            node = node.children.get(char)!;
        }
        node.isEndOfTag = true;
        node.tag = tag;
    }

    /**
     * Find the earliest complete tag in the text.
     * Returns { index: number, tag: string } if found, null otherwise.
     * Optimized with early-exit for O(k) performance.
     */
    public findEarliestTag(text: string): { index: number; tag: string } | null {
        let earliestIndex = Infinity;
        let earliestTag = "";

        // Try to match from each position in the text (with early-exit)
        for (let startIdx = 0; startIdx < text.length; startIdx++) {
            // Early-exit: if we already found a tag at an earlier position, stop
            if (startIdx >= earliestIndex) {
                break;
            }

            const result = this.matchFromPosition(text, startIdx);
            if (result && result.index < earliestIndex) {
                earliestIndex = result.index;
                earliestTag = result.tag;
            }
        }

        return earliestTag ? { index: earliestIndex, tag: earliestTag } : null;
    }

    /**
     * Match a tag starting from a specific position.
     * Returns the SHORTEST matching tag (to handle prefix overlaps correctly).
     */
    private matchFromPosition(text: string, startIdx: number): { index: number; tag: string } | null {
        let node = this.root;
        let firstMatch: string | null = null;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (!node.children.has(char)) {
                // Can't continue matching
                break;
            }
            node = node.children.get(char)!;
            if (node.isEndOfTag && !firstMatch) {
                // Found first complete tag at this position
                firstMatch = node.tag!;
                // Return immediately to get the shortest match
                return { index: startIdx, tag: firstMatch };
            }
        }

        return null;
    }

    /**
     * Find the longest partial tag at the end of the text.
     * Returns the length of the partial match (0 if none).
     */
    public findLongestPartialAtEnd(text: string): number {
        let maxPartialLength = 0;

        // Try matching from each position toward the end
        for (let startIdx = 0; startIdx < text.length; startIdx++) {
            const partialLength = this.matchPartialFromPosition(text, startIdx);
            if (partialLength > 0 && startIdx + partialLength === text.length) {
                maxPartialLength = Math.max(maxPartialLength, partialLength);
            }
        }

        return maxPartialLength;
    }

    /**
     * Match a partial tag from a position, returns length of match.
     */
    private matchPartialFromPosition(text: string, startIdx: number): number {
        let node = this.root;
        let matchLength = 0;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (!node.children.has(char)) {
                return matchLength;
            }
            node = node.children.get(char)!;
            matchLength++;
            if (node.isEndOfTag) {
                // This is a complete tag, not a partial
                return 0;
            }
        }

        // We matched up to the end of text without completing a tag
        return matchLength;
    }

    private editDistanceCache: Map<string, number> = new Map();
    private static readonly MAX_CACHE_SIZE = 1000;

    /**
     * Find similar tags using edit distance (Levenshtein).
     * Returns tags with edit distance <= maxDistance.
     * Uses caching with eviction for improved performance.
     */
    public findSimilarTags(input: string, maxDistance: number = 2): string[] {
        const similar: string[] = [];
        for (const tag of this.tags) {
            const cacheKey = `${input}:${tag}`;
            let distance = this.editDistanceCache.get(cacheKey);

            if (distance === undefined) {
                distance = this.editDistance(input, tag);

                // Evict oldest half when cache exceeds max size
                if (this.editDistanceCache.size >= PrefixTree.MAX_CACHE_SIZE) {
                    const keysToDelete = Array.from(this.editDistanceCache.keys()).slice(0, PrefixTree.MAX_CACHE_SIZE / 2);
                    for (const key of keysToDelete) {
                        this.editDistanceCache.delete(key);
                    }
                }

                this.editDistanceCache.set(cacheKey, distance);
            }

            if (distance <= maxDistance) {
                similar.push(tag);
            }
        }
        return similar;
    }

    /**
     * Calculate Levenshtein edit distance between two strings.
     * Delegates to StringUtils for the optimized 2-row implementation.
     */
    private editDistance(a: string, b: string): number {
        return StringUtils.levenshtein(a, b);
    }

    /**
     * Clear the edit distance cache to free memory.
     */
    public clearCache(): void {
        this.editDistanceCache.clear();
    }
}

interface TrieNode {
    children: Map<string, TrieNode>;
    isEndOfTag: boolean;
    tag?: string;
}
