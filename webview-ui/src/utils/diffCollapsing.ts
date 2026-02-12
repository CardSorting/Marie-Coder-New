import type { DiffLine } from './diffAlgorithm';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CollapsedRegion {
    type: 'collapsed';
    lineCount: number;
    startOld: number;
    startNew: number;
}

export type DisplayLine = DiffLine | CollapsedRegion;

// ─────────────────────────────────────────────────────────────────────────────
// Functions
// ─────────────────────────────────────────────────────────────────────────────

export function isCollapsedRegion(line: DisplayLine): line is CollapsedRegion {
    return 'type' in line && line.type === 'collapsed';
}

export function collapseUnchangedRegions(
    lines: DiffLine[],
    contextLines: number
): DisplayLine[] {
    if (contextLines <= 0 || lines.length < contextLines * 3) {
        return lines;
    }

    const result: DisplayLine[] = [];
    let unchangedStart = -1;
    let unchangedCount = 0;

    const flushUnchanged = (endIndex: number) => {
        if (unchangedCount > contextLines * 2 + 1) {
            // Add leading context
            for (let i = 0; i < contextLines; i++) {
                result.push(lines[unchangedStart + i]);
            }

            // Add collapsed region
            const collapsedCount = unchangedCount - contextLines * 2;
            result.push({
                type: 'collapsed',
                lineCount: collapsedCount,
                startOld: lines[unchangedStart + contextLines].oldLineNumber ?? 0,
                startNew: lines[unchangedStart + contextLines].newLineNumber ?? 0
            });

            // Add trailing context
            for (let i = unchangedCount - contextLines; i < unchangedCount; i++) {
                result.push(lines[unchangedStart + i]);
            }
        } else {
            // Not enough to collapse, add all
            for (let i = unchangedStart; i < endIndex; i++) {
                result.push(lines[i]);
            }
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.type === 'same') {
            if (unchangedStart === -1) {
                unchangedStart = i;
            }
            unchangedCount++;
        } else {
            if (unchangedStart !== -1) {
                flushUnchanged(i);
                unchangedStart = -1;
                unchangedCount = 0;
            }
            result.push(line);
        }
    }

    // Handle trailing unchanged
    if (unchangedStart !== -1) {
        flushUnchanged(lines.length);
    }

    return result;
}
