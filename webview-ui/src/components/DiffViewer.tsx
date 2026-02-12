import { memo, useMemo, useCallback, useState, useRef, useEffect, lazy, Suspense } from 'react';
import {
    computeDiff,
    type DiffLine,
    type DiffStats,
    type DiffViewerProps,
    type DiffHunk
} from '../utils/diffAlgorithm';
import {
    collapseUnchangedRegions,
    isCollapsedRegion,
    type DisplayLine,
    type CollapsedRegion
} from '../utils/diffCollapsing';
import { useVirtualScroll } from '../hooks/useVirtualScroll';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy load syntax highlighter for better initial bundle size
// ─────────────────────────────────────────────────────────────────────────────

const SyntaxHighlighter = lazy(() =>
    import('react-syntax-highlighter').then(mod => ({ default: mod.Prism }))
);

// Dynamically import the theme
let cachedStyle: Record<string, React.CSSProperties> | null = null;
const getStyle = async () => {
    if (!cachedStyle) {
        const { vscDarkPlus } = await import('react-syntax-highlighter/dist/esm/styles/prism');
        cachedStyle = vscDarkPlus;
    }
    return cachedStyle;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Configuration
// ─────────────────────────────────────────────────────────────────────────────

const VIRTUALIZATION_THRESHOLD = 150; // Lowered for better performance on mid-range devices
const DEFAULT_CONTEXT_LINES = 3;
const LINE_HEIGHT_PX = 22;
const OVERSCAN_COUNT = 5;

// Pre-computed style objects - frozen for immutability
const HIGHLIGHTER_CUSTOM_STYLE = Object.freeze({
    margin: 0,
    padding: 0,
    background: 'transparent',
    display: 'inline'
} as const);

const HIGHLIGHTER_CODE_TAG_PROPS = Object.freeze({
    style: { fontFamily: 'inherit' }
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Code Display (No syntax highlighting for performance)
// ─────────────────────────────────────────────────────────────────────────────

const LightweightCode = memo(function LightweightCode({ content }: { content: string }) {
    return <code className="diff-code-plain">{content || ' '}</code>;
});

// ─────────────────────────────────────────────────────────────────────────────
// Syntax Highlighted Code (Lazy loaded)
// ─────────────────────────────────────────────────────────────────────────────

interface HighlightedCodeProps {
    content: string;
    language: string;
}

const HighlightedCode = memo(function HighlightedCode({ content, language }: HighlightedCodeProps) {
    const [style, setStyle] = useState<Record<string, React.CSSProperties> | null>(null);

    useEffect(() => {
        getStyle().then(setStyle);
    }, []);

    if (!style) {
        return <LightweightCode content={content} />;
    }

    return (
        <Suspense fallback={<LightweightCode content={content} />}>
            <SyntaxHighlighter
                language={language}
                style={style}
                customStyle={HIGHLIGHTER_CUSTOM_STYLE}
                codeTagProps={HIGHLIGHTER_CODE_TAG_PROPS}
                PreTag="span"
            >
                {content || ' '}
            </SyntaxHighlighter>
        </Suspense>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Diff Line Row Component
// ─────────────────────────────────────────────────────────────────────────────

interface DiffLineRowProps {
    line: DiffLine;
    language: string;
    useSyntaxHighlighting: boolean;
    isStreaming?: boolean;
}

const DiffLineRow = memo(function DiffLineRow({
    line,
    language,
    useSyntaxHighlighting,
    isStreaming
}: DiffLineRowProps) {
    const markerChar = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : null;

    // Apply pulse animation to added lines during streaming
    const rowClass = [
        'diff-row',
        `diff-row--${line.type}`,
        isStreaming && line.type === 'added' ? 'diff-row--new-pulse' : ''
    ].filter(Boolean).join(' ');

    return (
        <tr className={rowClass} data-type={line.type}>
            <td className="diff-gutter diff-gutter--old">{line.oldLineNumber ?? ''}</td>
            <td className="diff-gutter diff-gutter--new">{line.newLineNumber ?? ''}</td>
            <td className="diff-marker" aria-label={line.type}>{markerChar}</td>
            <td className="diff-code">
                {useSyntaxHighlighting ? (
                    <HighlightedCode content={line.content} language={language} />
                ) : (
                    <LightweightCode content={line.content} />
                )}
            </td>
        </tr>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for better memoization
    return (
        prevProps.line.hash === nextProps.line.hash &&
        prevProps.line.type === nextProps.line.type &&
        prevProps.language === nextProps.language &&
        prevProps.useSyntaxHighlighting === nextProps.useSyntaxHighlighting
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Collapsed Region Row
// ─────────────────────────────────────────────────────────────────────────────

interface CollapsedRowProps {
    region: CollapsedRegion;
    onExpand: () => void;
}

const CollapsedRow = memo(function CollapsedRow({ region, onExpand }: CollapsedRowProps) {
    return (
        <tr className="diff-row diff-row--collapsed">
            <td colSpan={4} className="diff-collapsed-cell">
                <button
                    className="diff-expand-btn"
                    onClick={onExpand}
                    aria-label={`Expand ${region.lineCount} hidden lines`}
                >
                    <span className="diff-expand-icon">⋯</span>
                    <span className="diff-expand-text">
                        {region.lineCount} unchanged line{region.lineCount !== 1 ? 's' : ''}
                    </span>
                </button>
            </td>
        </tr>
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main DiffViewer Component
// ─────────────────────────────────────────────────────────────────────────────

export const DiffViewer = memo(function DiffViewer({
    oldCode,
    newCode,
    language = 'typescript',
    fileName,
    viewMode = 'unified',
    contextLines = DEFAULT_CONTEXT_LINES,
    enableVirtualization = true,
    isStreaming = false,
    onDiffComputed
}: DiffViewerProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());

    // Memoize the diff computation
    const diffLines = useMemo(
        () => computeDiff(oldCode, newCode),
        [oldCode, newCode]
    );

    // Compute statistics
    const stats = useMemo<DiffStats>(() => {
        let added = 0, removed = 0, same = 0;
        for (const line of diffLines) {
            if (line.type === 'added') added++;
            else if (line.type === 'removed') removed++;
            else same++;
        }
        return { added, removed, same, total: diffLines.length, hunks: 1 };
    }, [diffLines]);

    // Notify parent of stats
    useEffect(() => {
        onDiffComputed?.(stats);
    }, [stats, onDiffComputed]);

    // Collapse unchanged regions
    const displayLines = useMemo(() => {
        const collapsed = collapseUnchangedRegions(diffLines, contextLines);
        // Apply expanded regions
        if (expandedRegions.size === 0) return collapsed;

        // Re-expand any collapsed regions that should be expanded
        return collapsed.flatMap((line: DisplayLine, idx: number) => {
            if (isCollapsedRegion(line) && expandedRegions.has(idx)) {
                // Find and return the original lines
                const startOld = line.startOld;
                return diffLines.filter(l =>
                    l.type === 'same' &&
                    l.oldLineNumber !== undefined &&
                    l.oldLineNumber >= startOld &&
                    l.oldLineNumber < startOld + line.lineCount
                );
            }
            return [line];
        });
    }, [diffLines, contextLines, expandedRegions]);

    // Auto-scroll to changes during streaming
    useEffect(() => {
        if (isStreaming && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const firstAddedLine = container.querySelector('.diff-row--added');
            if (firstAddedLine) {
                // Only scroll if it's a significant change or we were already near the bottom
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                if (isNearBottom) {
                    firstAddedLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }, [isStreaming, displayLines.length]);

    // Determine if we should use virtualization
    const shouldVirtualize = enableVirtualization && displayLines.length > VIRTUALIZATION_THRESHOLD;

    // STABILITY: Only use syntax highlighting for smaller, static diffs.
    // Highlighting is heavy and can cause frame drops during and after streaming.
    const useSyntaxHighlighting = !isStreaming && diffLines.length < 300;

    // Virtual scroll state
    const virtualState = useVirtualScroll(
        scrollContainerRef,
        displayLines.length,
        LINE_HEIGHT_PX,
        OVERSCAN_COUNT
    );

    // Get visible lines
    const visibleLines = shouldVirtualize
        ? displayLines.slice(virtualState.startIndex, virtualState.endIndex)
        : displayLines;

    // Handle expand collapsed region
    const handleExpand = useCallback((index: number) => {
        setExpandedRegions(prev => new Set([...prev, index]));
    }, []);

    // Stable key generator
    const getRowKey = useCallback((line: DisplayLine, idx: number) => {
        if (isCollapsedRegion(line)) {
            return `collapsed-${line.startOld}-${line.startNew}`;
        }
        return `${line.type}-${line.oldLineNumber ?? 'x'}-${line.newLineNumber ?? 'x'}-${idx}`;
    }, []);

    // Empty state
    if (diffLines.length === 0) {
        return (
            <div className="diff-viewer diff-viewer--empty" role="region" aria-label="Diff viewer">
                <div className="diff-empty-message">
                    <span className="diff-empty-icon">✓</span>
                    <span>No changes</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`diff-viewer diff-viewer--${viewMode}`}
            role="region"
            aria-label={`Diff viewer: ${stats.added} additions, ${stats.removed} deletions`}
            data-lines={stats.total}
            data-added={stats.added}
            data-removed={stats.removed}
        >
            {/* Header */}
            {fileName && (
                <header className="diff-header">
                    <span className="diff-header__icon" aria-hidden="true">📝</span>
                    <span className="diff-header__filename">{fileName}</span>
                    <div className="diff-header__stats">
                        {isStreaming && (
                            <div className="diff-header__streaming-badge">
                                <span className="diff-header__streaming-dot" />
                                <span>Streaming</span>
                            </div>
                        )}
                        {stats.added > 0 && (
                            <span className="diff-stat diff-stat--added" aria-label={`${stats.added} additions`}>
                                +{stats.added}
                            </span>
                        )}
                        {stats.removed > 0 && (
                            <span className="diff-stat diff-stat--removed" aria-label={`${stats.removed} deletions`}>
                                −{stats.removed}
                            </span>
                        )}
                    </div>
                </header>
            )}

            {/* Scrollable content */}
            <div
                ref={scrollContainerRef}
                className="diff-scroll"
                tabIndex={0}
                role="table"
                aria-rowcount={displayLines.length}
            >
                {shouldVirtualize && (
                    <div
                        className="diff-virtual-spacer"
                        style={{ height: virtualState.totalHeight }}
                        aria-hidden="true"
                    />
                )}

                <table
                    className="diff-table"
                    style={shouldVirtualize ? {
                        position: 'absolute',
                        top: virtualState.offsetTop,
                        left: 0,
                        right: 0
                    } : undefined}
                >
                    <colgroup>
                        <col className="diff-col--gutter-old" />
                        <col className="diff-col--gutter-new" />
                        <col className="diff-col--marker" />
                        <col className="diff-col--code" />
                    </colgroup>
                    <tbody>
                        {visibleLines.map((line: DisplayLine, idx: number) => {
                            const absoluteIndex = shouldVirtualize
                                ? virtualState.startIndex + idx
                                : idx;

                            if (isCollapsedRegion(line)) {
                                return (
                                    <CollapsedRow
                                        key={getRowKey(line, absoluteIndex)}
                                        region={line}
                                        onExpand={() => handleExpand(absoluteIndex)}
                                    />
                                );
                            }

                            return (
                                <DiffLineRow
                                    key={getRowKey(line, absoluteIndex)}
                                    line={line}
                                    language={language}
                                    useSyntaxHighlighting={useSyntaxHighlighting}
                                    isStreaming={isStreaming}
                                />
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

// Default export
export default DiffViewer;

// Export types for consumers
export type { DiffLine, DiffStats, DiffViewerProps, DiffHunk };
