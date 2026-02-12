import { useState, useRef, useEffect } from 'react';

interface ReasoningStreamProps {
    reasoning: string;
    isStreaming: boolean;
    rawMode?: boolean;
}

export function ReasoningStream({ reasoning, isStreaming, rawMode = false }: ReasoningStreamProps) {
    const [isExpanded, setIsExpanded] = useState(true); // Always visible while streaming
    const contentRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom while streaming
    useEffect(() => {
        if (isStreaming && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [reasoning, isStreaming]);

    // Auto-collapse when streaming ends (after brief delay)
    useEffect(() => {
        if (!isStreaming && reasoning.length > 0) {
            const timer = setTimeout(() => {
                setIsExpanded(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isStreaming, reasoning.length]);

    if (!reasoning) {
        return null;
    }

    return (
        <div className={`reasoning-stream ${isStreaming ? 'streaming' : 'complete'}`}>
            <div
                className="reasoning-header"
                onClick={() => setIsExpanded(!isExpanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
            >
                <div className="reasoning-header-left">
                    <span className="reasoning-icon">💭</span>
                    <span className="reasoning-title">Thinking</span>
                    {isStreaming && <span className="streaming-dot" />}
                </div>
                <div className="reasoning-header-right">
                    {rawMode && <span className="raw-badge">RAW</span>}
                    <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                        ▼
                    </span>
                </div>
            </div>

            <div className={`reasoning-content ${isExpanded ? 'expanded' : 'collapsed'}`}>
                <div
                    ref={contentRef}
                    className={`reasoning-text ${rawMode ? 'raw' : ''}`}
                >
                    {reasoning}
                    {isStreaming && <span className="reasoning-cursor">▌</span>}
                </div>
            </div>
        </div>
    );
}
