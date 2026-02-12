import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarieMascot, UserIcon, CopyIcon, CheckIcon } from '../plumbing/ui/Icons'
import { CodeBlock } from './CodeBlock'
import { ThinkingIndicator } from './ThinkingIndicator'
import { DiffViewer } from './DiffViewer'
import { vscode } from '../utils/vscode'
import { extractCodeFromInput } from '../utils/parsing'
import { ReasoningTrace } from './ReasoningTrace'
import { ObjectiveRoadmap } from './ObjectiveRoadmap'
import { WalkthroughCard } from './WalkthroughCard'
import { ClockIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import type { StreamStage, ProgressObjective } from '../types'

const ProgressRail = React.memo(({ percent }: { percent: number }) => (
    <div className="message-progress-rail" style={{ width: `${percent}%` }} />
));

const MessageStatusBadge = React.memo(({ semanticContext, activeObjective, showRoadmap, onToggleRoadmap, hasObjectives }: {
    semanticContext: string;
    activeObjective?: string;
    showRoadmap: boolean;
    onToggleRoadmap: () => void;
    hasObjectives: boolean;
}) => (
    <div className="message-status-badge-container">
        <div className="message-status-badge stage-flash">
            <span className="badge-orbit"></span>
            <span className="badge-text">{semanticContext}</span>
        </div>
        {activeObjective && (
            <div className="active-objective-label fade-in-out">
                Target: {activeObjective}
            </div>
        )}
        {hasObjectives && (
            <button className="roadmap-toggle-pill" onClick={onToggleRoadmap}>
                {showRoadmap ? <ChevronUpIcon size={10} /> : <ChevronDownIcon size={10} />}
                Roadmap
            </button>
        )}
    </div>
));

interface MessageProps {
    role: 'user' | 'marie'
    text?: string
    variant?: 'default' | 'thinking' | 'tool-call'
    timestamp?: string
    toolName?: string
    toolInput?: unknown
    diff?: { old: string, new: string }
    hideMetadata?: boolean
    stream?: {
        stage: StreamStage;
        completionPercent?: number;
        activeFilePath?: string;
        currentStepLabel?: string;
        reasoning?: string;
        activeObjective?: string;
        objectives?: ProgressObjective[];
        elapsedMs?: number;
        waitingForApproval?: boolean;
    }
}

export const Message = React.memo(function Message({ role, text, variant = 'default', timestamp, toolName, toolInput, diff, hideMetadata, stream }: MessageProps) {
    const senderName = role === 'marie' ? 'Marie' : 'You';
    const [copied, setCopied] = useState(false);
    const [showRoadmap, setShowRoadmap] = useState(false);

    const isCurrentStreaming = !!stream && variant !== 'default' && role === 'marie';
    const completionPercent = stream?.completionPercent ?? 0;

    // Semantic Context derivation
    const semanticContext = useMemo(() =>
        stream?.currentStepLabel || stream?.activeFilePath || stream?.stage?.replace('_', ' '),
        [stream?.currentStepLabel, stream?.activeFilePath, stream?.stage]
    );

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCopy = async () => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    const toolPreview = useMemo(() => {
        if (variant !== 'tool-call' || !toolName) return null;
        if (['write_file', 'replace_in_file', 'write_to_file'].includes(toolName)) {
            return extractCodeFromInput(toolName, toolInput);
        }
        return null;
    }, [toolName, toolInput, variant]);

    return (
        <div className={`message-row ${role} ${hideMetadata ? 'consecutive' : ''}`}>
            {!hideMetadata && (
                <div className="avatar">
                    {role === 'marie' ? <MarieMascot /> : <UserIcon />}
                </div>
            )}
            {hideMetadata && <div className="avatar-ghost" />}
            <div className="message-content">
                {!hideMetadata && (
                    <div className={`message-meta ${role}`}>
                        <span className="sender-name">{senderName}</span>
                        {timestamp && <span className="timestamp">• {timestamp}</span>}
                        {isCurrentStreaming && stream?.elapsedMs !== undefined && (
                            <span className="intelligence-snapshot">
                                <ClockIcon size={10} />
                                {formatTime(stream.elapsedMs)}
                            </span>
                        )}
                        {text && variant !== 'tool-call' && (
                            <button
                                className={`message-copy-button ${copied ? 'copied' : ''}`}
                                onClick={handleCopy}
                                title="Copy message"
                            >
                                {copied ? <CheckIcon width={12} height={12} /> : <CopyIcon width={12} height={12} />}
                            </button>
                        )}
                    </div>
                )}
                <div className={`message-bubble ${role} ${variant === 'thinking' ? 'thinking-bubble' : ''} ${variant === 'tool-call' ? 'tool-call-bubble' : ''} ${isCurrentStreaming ? 'is-streaming' : ''} ${stream?.waitingForApproval ? 'blocked-pulse' : ''}`}>
                    {isCurrentStreaming && (
                        <ProgressRail percent={completionPercent} />
                    )}
                    {isCurrentStreaming && stream?.stage !== 'thinking' && semanticContext && (
                        <MessageStatusBadge
                            semanticContext={semanticContext}
                            activeObjective={stream?.activeObjective}
                            showRoadmap={showRoadmap}
                            onToggleRoadmap={() => setShowRoadmap(!showRoadmap)}
                            hasObjectives={!!(stream?.objectives && stream.objectives.length > 0)}
                        />
                    )}
                    {variant === 'thinking' ? (
                        <>
                            <ThinkingIndicator stage={stream?.stage} context={stream?.activeFilePath || stream?.currentStepLabel} />
                            {showRoadmap && stream?.objectives && (
                                <ObjectiveRoadmap objectives={stream.objectives} />
                            )}
                        </>
                    ) : variant === 'tool-call' ? (
                        <div className="tool-call-card">
                            <div className="tool-header">
                                <span className="tool-icon">🔧</span>
                                <span className="tool-name">
                                    {toolName === 'write_file' && toolPreview?.fileName
                                        ? `Writing to ${toolPreview.fileName}`
                                        : toolName === 'replace_in_file'
                                            ? `Modifying ${toolPreview?.fileName || ''}`
                                            : `Executing: ${toolName}`}
                                </span>
                            </div>

                            {stream?.reasoning && (
                                <ReasoningTrace reasoning={stream.reasoning} isStreaming={isCurrentStreaming} />
                            )}

                            {showRoadmap && stream?.objectives && (
                                <ObjectiveRoadmap objectives={stream.objectives} />
                            )}

                            {/* File Operation Preview (Smart) */}
                            {toolPreview && toolPreview.code && (
                                <div className="tool-input-preview">
                                    <CodeBlock
                                        language={toolPreview.language}
                                        value={toolPreview.code + (typeof toolInput === 'string' ? '▌' : '')}
                                    />
                                </div>
                            )}

                            {/* Standard Input View (Fallback for other tools) */}
                            {toolName && !toolPreview && !['write_file', 'replace_in_file', 'write_to_file'].includes(toolName) && (
                                <div className="tool-input">
                                    <CodeBlock language="json" value={typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)} />
                                </div>
                            )}

                            {diff && (
                                <div className="tool-diff">
                                    <DiffViewer
                                        oldCode={diff.old}
                                        newCode={diff.new}
                                        language="typescript" // Default or infer from potential file name context
                                        fileName={toolName === 'write_file' || toolName === 'replace_in_file' ? toolPreview?.fileName : undefined}
                                        isStreaming={typeof toolInput === 'string'}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    code({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
                                        const match = /language-(\w+)/.exec(className || '')
                                        return !inline && match ? (
                                            <CodeBlock
                                                language={match[1]}
                                                value={String(children).replace(/\n$/, '')}
                                            />
                                        ) : (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        )
                                    },
                                    a({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
                                        const isFileLink = href?.startsWith('/') || href?.includes('.');
                                        const handleLinkClick = (e: React.MouseEvent) => {
                                            if (isFileLink && href) {
                                                e.preventDefault();
                                                vscode.postMessage({ type: 'openFile', value: href });
                                            }
                                        };
                                        return (
                                            <a
                                                href={href || '#'}
                                                onClick={handleLinkClick}
                                                className={isFileLink ? 'file-link' : ''}
                                                {...props}
                                            >
                                                {children}
                                            </a>
                                        );
                                    },
                                    table({ children }) {
                                        return <table className="markdown-table">{children}</table>
                                    },
                                    thead({ children }) {
                                        return <thead className="markdown-thead">{children}</thead>
                                    },
                                    tbody({ children }) {
                                        return <tbody className="markdown-tbody">{children}</tbody>
                                    },
                                    tr({ children }) {
                                        return <tr className="markdown-tr">{children}</tr>
                                    },
                                    th({ children }) {
                                        return <th className="markdown-th">{children}</th>
                                    },
                                    td({ children }) {
                                        return <td className="markdown-td">{children}</td>
                                    }
                                }}
                            >
                                {text || ''}
                            </ReactMarkdown>

                            {/* Smart Narrative Cards */}
                            {role === 'marie' && text && text.includes('walkthrough.md') && (
                                <div className="narrative-cards-section">
                                    {/* Detect Walkthrough Link Pattern: [link label](file:///path/to/walkthrough.md) */}
                                    {Array.from((text || '').matchAll(/\[(.*?)\]\((.*?walkthrough\.md)\)/g)).map((match, idx) => (
                                        <WalkthroughCard
                                            key={idx}
                                            title={match[1].replace('walkthrough.md', 'Phase Completion')}
                                            description="Review the narrative of progress, reasoning traces, and impact reflections for this phase."
                                            filePath={match[2]}
                                        />
                                    ))}
                                </div>
                            )}

                            {stream?.reasoning && (
                                <ReasoningTrace reasoning={stream.reasoning} isStreaming={isCurrentStreaming} />
                            )}
                            {showRoadmap && stream?.objectives && (
                                <ObjectiveRoadmap objectives={stream.objectives} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}, (prev, next) => {
    // Custom comparison to minimize re-renders during high-velocity streaming
    if (prev.role !== next.role || prev.text !== next.text || prev.variant !== next.variant || prev.timestamp !== next.timestamp || prev.hideMetadata !== next.hideMetadata) return false;
    if (prev.toolName !== next.toolName) return false;

    // Deep compare toolInput ONLY if it's not a string (streaming text)
    if (typeof next.toolInput === 'string') {
        if (prev.toolInput !== next.toolInput) return false;
    } else if (JSON.stringify(prev.toolInput) !== JSON.stringify(next.toolInput)) {
        return false;
    }

    // Stream comparison - only re-render if essential metrics CHANGED
    return (
        prev.stream?.stage === next.stream?.stage &&
        prev.stream?.completionPercent === next.stream?.completionPercent &&
        prev.stream?.activeFilePath === next.stream?.activeFilePath &&
        prev.stream?.reasoning === next.stream?.reasoning &&
        prev.stream?.waitingForApproval === next.stream?.waitingForApproval &&
        prev.stream?.currentStepLabel === next.stream?.currentStepLabel &&
        prev.stream?.activeObjective === next.stream?.activeObjective
    );
});
