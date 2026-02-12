import { useState, useMemo, useEffect, useCallback } from 'react';
import { CodeBlock } from './CodeBlock';
import { DiffViewer } from './DiffViewer';
import { CheckIcon, CrossIcon } from '../plumbing/ui/Icons';
import { Sparkles, Files, Terminal, Search, Zap, AlertTriangle, Command } from 'lucide-react';
import './ApprovalRequest.css';

interface ToolInput {
    path?: string;
    targetFile?: string;
    target_file?: string;
    command?: string;
    query?: string;
    [key: string]: unknown;
}

interface ApprovalRequestProps {
    requestId: string;
    toolName: string;
    toolInput: ToolInput;
    reasoning?: string;
    activeObjective?: string;
    diff?: { old: string, new: string };
    onRespond: (requestId: string, approved: boolean) => void;
}

export function ApprovalRequest({ requestId, toolName, toolInput, reasoning, activeObjective, diff, onRespond }: ApprovalRequestProps) {
    const [responded, setResponded] = useState<'approved' | 'denied' | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [isHoveringAction, setIsHoveringAction] = useState(false);
    const [isHoveringAllow, setIsHoveringAllow] = useState(false);

    const handleApprove = useCallback(() => {
        setResponded('approved');
        onRespond(requestId, true);
    }, [requestId, onRespond]);

    const handleDeny = useCallback(() => {
        setResponded('denied');
        onRespond(requestId, false);
    }, [requestId, onRespond]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (responded) return;
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleApprove();
            else if (e.key === 'Escape') handleDeny();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [responded, handleApprove, handleDeny]);

    const toolMeta = useMemo(() => {
        const isFile = ['write_file', 'replace_in_file', 'read_file', 'delete_file', 'multi_replace_file_content'].includes(toolName);
        const isTerminal = ['run_command', 'execute_shell'].includes(toolName);
        const isSearch = ['search_web', 'codebase_search', 'grep_search', 'find_by_name'].includes(toolName);

        return {
            icon: isFile ? <Files size={12} /> : isTerminal ? <Terminal size={12} /> : isSearch ? <Search size={12} /> : <Zap size={12} />,
            color: isFile ? '#a78bfa' : isTerminal ? '#f472b6' : isSearch ? '#60a5fa' : '#fbbf24',
            isHighRisk: isTerminal || ['delete_file', 'run_command'].includes(toolName)
        };
    }, [toolName]);

    const targetLabel = useMemo(() => {
        return toolInput.path || toolInput.targetFile || toolInput.target_file || toolInput.command || toolInput.query || '';
    }, [toolInput]);

    if (responded) {
        return (
            <div className={`approval-fusion-result ${responded} fade-in`}>
                <div className="result-aura" />
                <div className="result-text">
                    {responded === 'approved' ? (
                        <><span className="check-glow"><CheckIcon width={12} height={12} /></span> Marie is proceeding with the {toolName.replace(/_/g, ' ')}</>
                    ) : (
                        <><span className="cross-glow"><CrossIcon width={12} height={12} /></span> The {toolName.replace(/_/g, ' ')} was released</>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`approval-fusion-container ${toolMeta.isHighRisk ? 'is-high-risk' : ''}`}>
            <div className="fusion-atmosphere-glow" />

            <div className="fusion-narrative">
                <div className="fusion-meta-stream">
                    <Sparkles size={10} className="fusion-sparkle" />
                    <span className="fusion-objective">{activeObjective || 'Processing Intent'}</span>
                    {toolMeta.isHighRisk && (
                        <span className="fusion-risk-tag">
                            <AlertTriangle size={10} />
                            Sensitive Action
                        </span>
                    )}
                    <div className="phantom-shortcuts">
                        <span className="shortcut-pill"><Command size={8} /> ↩ to allow</span>
                        <span className="shortcut-pill">esc to dismiss</span>
                    </div>
                </div>

                <div className="fusion-text-flow">
                    {reasoning ? (
                        <span className="fusion-reasoning">{reasoning} </span>
                    ) : null}

                    <span
                        className="fusion-action-anchor"
                        onMouseEnter={() => setIsHoveringAction(true)}
                        onMouseLeave={() => setIsHoveringAction(false)}
                    >
                        I'm initiating <span className="action-magic" style={{ color: toolMeta.color }}>{toolName.replace(/_/g, ' ')}</span>
                        {isHoveringAction && targetLabel && (
                            <div className="magic-tooltip fade-in">
                                <span className="tooltip-label">Target:</span>
                                <span className="tooltip-value">{targetLabel}</span>
                            </div>
                        )}
                    </span>

                    <button
                        className={`fusion-inspect-toggle ${showPreview ? 'is-active' : ''}`}
                        onClick={() => setShowPreview(!showPreview)}
                    >
                        {showPreview ? 'Collapse' : 'Inspect Details'}
                    </button>
                </div>

                {showPreview && (
                    <div className="fusion-preview-box fade-in">
                        {diff ? (
                            <DiffViewer
                                oldCode={diff.old}
                                newCode={diff.new}
                                language="typescript"
                                fileName={targetLabel}
                            />
                        ) : (
                            <CodeBlock
                                language="json"
                                value={typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}
                            />
                        )}
                    </div>
                )}

                <div className="fusion-interactions">
                    <button className="pill-ghost-deny" onClick={handleDeny}>
                        <CrossIcon width={12} height={12} />
                        Dismiss
                    </button>
                    <button
                        className={`pill-living-allow ${isHoveringAllow ? 'rapid-pulse' : ''}`}
                        onClick={handleApprove}
                        onMouseEnter={() => setIsHoveringAllow(true)}
                        onMouseLeave={() => setIsHoveringAllow(false)}
                    >
                        <div className="allow-shimmer" />
                        <CheckIcon width={12} height={12} />
                        Allow Action
                    </button>
                </div>
            </div>
        </div>
    );
}
