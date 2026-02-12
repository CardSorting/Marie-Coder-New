// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DiffLineType = 'same' | 'added' | 'removed';

export interface DiffLine {
    readonly type: DiffLineType;
    readonly content: string;
    readonly oldLineNumber?: number;
    readonly newLineNumber?: number;
    readonly hash?: number;
}

export interface DiffHunk {
    readonly startOld: number;
    readonly startNew: number;
    readonly lines: readonly DiffLine[];
}

export interface DiffStats {
    added: number;
    removed: number;
    same: number;
    total: number;
    hunks: number;
}

export interface DiffViewerProps {
    oldCode: string;
    newCode: string;
    language?: string;
    fileName?: string;
    /** Whether the diff is currently being streamed */
    isStreaming?: boolean;
    /** Show unified or split view */
    viewMode?: 'unified' | 'split';
    /** Collapse unchanged regions with this many context lines */
    contextLines?: number;
    /** Enable virtual scrolling for large diffs */
    enableVirtualization?: boolean;
    /** Callback when diff computation completes */
    onDiffComputed?: (stats: DiffStats) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_DIFF: DiffLine[] = [];
const MAX_DIFF_SIZE = 10000;

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/** Fast string hash for efficient comparison */
export function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Myers Diff Algorithm - Highly Optimized
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a minimal diff between two strings using an optimized Myers algorithm.
 * Features: hash-based comparison, common prefix/suffix trimming, early termination.
 */
export function computeDiff(oldText: string, newText: string): DiffLine[] {
    // Fast path: exact match
    if (oldText === newText) {
        if (oldText === '') return EMPTY_DIFF;
        return oldText.split('\n').map((content, i) => ({
            type: 'same' as const,
            content,
            oldLineNumber: i + 1,
            newLineNumber: i + 1,
            hash: hashString(content)
        }));
    }

    // Fast path: one side is empty
    if (oldText === '') {
        return newText.split('\n').map((content, i) => ({
            type: 'added' as const,
            content,
            newLineNumber: i + 1,
            hash: hashString(content)
        }));
    }

    if (newText === '') {
        return oldText.split('\n').map((content, i) => ({
            type: 'removed' as const,
            content,
            oldLineNumber: i + 1,
            hash: hashString(content)
        }));
    }

    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Guard against extremely large diffs
    if (oldLines.length + newLines.length > MAX_DIFF_SIZE) {
        return computeSimplifiedDiff(oldLines, newLines);
    }

    // Create hash maps for faster comparison
    const oldHashes = oldLines.map(hashString);
    const newHashes = newLines.map(hashString);

    // Optimization: trim common prefix and suffix using hashes
    const {
        prefixLines,
        suffixLines,
        trimmedOldStart,
        trimmedOldEnd,
        trimmedNewStart,
        trimmedNewEnd
    } = trimCommonLinesOptimized(oldLines, newLines, oldHashes, newHashes);

    const trimmedOld = oldLines.slice(trimmedOldStart, trimmedOldEnd);
    const trimmedNew = newLines.slice(trimmedNewStart, trimmedNewEnd);
    const trimmedOldHashes = oldHashes.slice(trimmedOldStart, trimmedOldEnd);
    const trimmedNewHashes = newHashes.slice(trimmedNewStart, trimmedNewEnd);

    // If everything matched, return immediately
    if (trimmedOld.length === 0 && trimmedNew.length === 0) {
        return [...prefixLines, ...suffixLines];
    }

    // Compute diff only on the trimmed middle section
    const middleDiff = computeMyersDiffOptimized(
        trimmedOld,
        trimmedNew,
        trimmedOldHashes,
        trimmedNewHashes,
        trimmedOldStart
    );

    return [...prefixLines, ...middleDiff, ...suffixLines];
}

/**
 * Optimized trimming using pre-computed hashes.
 */
function trimCommonLinesOptimized(
    oldLines: string[],
    newLines: string[],
    oldHashes: number[],
    newHashes: number[]
) {
    let prefixLength = 0;
    const minLen = Math.min(oldLines.length, newLines.length);

    // Find common prefix using hash comparison first
    while (prefixLength < minLen && oldHashes[prefixLength] === newHashes[prefixLength]) {
        // Verify actual string match (hash collision check)
        if (oldLines[prefixLength] !== newLines[prefixLength]) break;
        prefixLength++;
    }

    // Find common suffix
    let suffixLength = 0;
    while (
        suffixLength < minLen - prefixLength &&
        oldHashes[oldLines.length - 1 - suffixLength] === newHashes[newLines.length - 1 - suffixLength]
    ) {
        if (oldLines[oldLines.length - 1 - suffixLength] !== newLines[newLines.length - 1 - suffixLength]) break;
        suffixLength++;
    }

    const prefixLines: DiffLine[] = [];
    for (let i = 0; i < prefixLength; i++) {
        prefixLines.push({
            type: 'same',
            content: oldLines[i],
            oldLineNumber: i + 1,
            newLineNumber: i + 1,
            hash: oldHashes[i]
        });
    }

    const suffixLines: DiffLine[] = [];
    const oldSuffixStart = oldLines.length - suffixLength;
    const newSuffixStart = newLines.length - suffixLength;
    for (let i = 0; i < suffixLength; i++) {
        suffixLines.push({
            type: 'same',
            content: oldLines[oldSuffixStart + i],
            oldLineNumber: oldSuffixStart + i + 1,
            newLineNumber: newSuffixStart + i + 1,
            hash: oldHashes[oldSuffixStart + i]
        });
    }

    return {
        prefixLines,
        suffixLines,
        trimmedOldStart: prefixLength,
        trimmedOldEnd: oldLines.length - suffixLength,
        trimmedNewStart: prefixLength,
        trimmedNewEnd: newLines.length - suffixLength
    };
}

/**
 * Simplified diff for extremely large inputs.
 */
function computeSimplifiedDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const result: DiffLine[] = new Array(oldLines.length + newLines.length);
    let idx = 0;

    for (let i = 0; i < oldLines.length; i++) {
        result[idx++] = {
            type: 'removed',
            content: oldLines[i],
            oldLineNumber: i + 1,
            hash: hashString(oldLines[i])
        };
    }
    for (let i = 0; i < newLines.length; i++) {
        result[idx++] = {
            type: 'added',
            content: newLines[i],
            newLineNumber: i + 1,
            hash: hashString(newLines[i])
        };
    }
    return result;
}

/**
 * Optimized Myers diff with hash-based snake extension.
 */
function computeMyersDiffOptimized(
    oldLines: string[],
    newLines: string[],
    oldHashes: number[],
    newHashes: number[],
    prefixOffset: number
): DiffLine[] {
    const N = oldLines.length;
    const M = newLines.length;

    if (N === 0) {
        return newLines.map((content, i) => ({
            type: 'added' as const,
            content,
            newLineNumber: prefixOffset + i + 1,
            hash: newHashes[i]
        }));
    }

    if (M === 0) {
        return oldLines.map((content, i) => ({
            type: 'removed' as const,
            content,
            oldLineNumber: prefixOffset + i + 1,
            hash: oldHashes[i]
        }));
    }

    const MAX = N + M;
    const vSize = 2 * MAX + 1;

    const v = new Int32Array(vSize);
    v[1 + MAX] = 0;

    const trace: Int32Array[] = [];

    for (let d = 0; d <= MAX; d++) {
        trace.push(v.slice());

        for (let k = -d; k <= d; k += 2) {
            const kOffset = k + MAX;
            let x: number;

            if (k === -d || (k !== d && v[kOffset - 1] < v[kOffset + 1])) {
                x = v[kOffset + 1];
            } else {
                x = v[kOffset - 1] + 1;
            }

            let y = x - k;

            // Snake: extend diagonal using hash comparison first
            while (x < N && y < M && oldHashes[x] === newHashes[y] && oldLines[x] === newLines[y]) {
                x++;
                y++;
            }

            v[kOffset] = x;

            if (x >= N && y >= M) {
                return backtrackMyersOptimized(trace, oldLines, newLines, oldHashes, prefixOffset);
            }
        }
    }

    return computeSimplifiedDiff(oldLines, newLines).map(line => ({
        ...line,
        oldLineNumber: line.oldLineNumber ? line.oldLineNumber + prefixOffset : undefined,
        newLineNumber: line.newLineNumber ? line.newLineNumber + prefixOffset : undefined
    }));
}

/**
 * Optimized backtracking with pre-allocated result array.
 */
function backtrackMyersOptimized(
    trace: Int32Array[],
    oldLines: string[],
    newLines: string[],
    oldHashes: number[],
    prefixOffset: number
): DiffLine[] {
    const diff: DiffLine[] = [];
    let x = oldLines.length;
    let y = newLines.length;
    const MAX = oldLines.length + newLines.length;

    for (let d = trace.length - 1; d > 0; d--) {
        const k = x - y;
        const kOffset = k + MAX;

        // Undo diagonal
        while (x > 0 && y > 0 && oldLines[x - 1] === newLines[y - 1]) {
            x--;
            y--;
            diff.push({
                type: 'same',
                content: oldLines[x],
                oldLineNumber: prefixOffset + x + 1,
                newLineNumber: prefixOffset + y + 1,
                hash: oldHashes[x]
            });
        }

        if (d === 0) break;

        const prevV = trace[d - 1];
        const cameFromInsert = (k === -d) || (k !== d && prevV[kOffset - 1] < prevV[kOffset + 1]);

        if (cameFromInsert) {
            y--;
            diff.push({
                type: 'added',
                content: newLines[y],
                newLineNumber: prefixOffset + y + 1,
                hash: hashString(newLines[y])
            });
        } else {
            x--;
            diff.push({
                type: 'removed',
                content: oldLines[x],
                oldLineNumber: prefixOffset + x + 1,
                hash: oldHashes[x]
            });
        }
    }

    // Handle remaining
    while (x > 0 && y > 0 && oldLines[x - 1] === newLines[y - 1]) {
        x--;
        y--;
        diff.push({
            type: 'same',
            content: oldLines[x],
            oldLineNumber: prefixOffset + x + 1,
            newLineNumber: prefixOffset + y + 1,
            hash: oldHashes[x]
        });
    }

    diff.reverse();
    return diff;
}
