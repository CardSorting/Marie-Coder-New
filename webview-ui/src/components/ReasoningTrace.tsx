import { useState, useEffect, useRef } from 'react';
import { TerminalIcon, BrainCircuitIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

interface ReasoningTraceProps {
    reasoning: string;
    isStreaming?: boolean;
}

export function ReasoningTrace({ reasoning, isStreaming }: ReasoningTraceProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isStreaming && scrollRef.current && isExpanded) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [reasoning, isStreaming, isExpanded]);

    if (!reasoning && !isStreaming) return null;

    return (
        <div className={`reasoning-trace-container ${isExpanded ? 'expanded' : ''}`}>
            <button
                className="reasoning-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="toggle-label">
                    <BrainCircuitIcon size={12} className="brain-icon" />
                    <span>Reasoning Trace</span>
                    {isStreaming && <span className="streaming-pulse-dot"></span>}
                </div>
                {isExpanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
            </button>

            {isExpanded && (
                <div className="reasoning-content-wrapper" ref={scrollRef}>
                    <div className="reasoning-content monospace">
                        <div className="reasoning-header">
                            <TerminalIcon size={10} />
                            <span>INTERNAL_MONOLOGUE_v1.0.4</span>
                        </div>
                        <div className="reasoning-text">
                            {reasoning || "Observing state..."}
                            {isStreaming && <span className="reasoning-cursor">_</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
