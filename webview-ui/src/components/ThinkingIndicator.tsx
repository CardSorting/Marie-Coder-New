import { useState, useEffect } from 'react';
import type { StreamStage } from '../types';

const stageLabels: Record<string, string> = {
    thinking: 'Thinking',
    planning: 'Planning',
    calling_tool: 'Using Tool',
    editing: 'Editing',
    finalizing: 'Finalizing',
    executing: 'Executing',
    reviewing: 'Reviewing',
    optimizing: 'Optimizing',
};

const thinkingLabels = [
    "Gathering context...",
    "Analyzing requirements...",
    "Drafting a thoughtful plan...",
    "Consulting inner magic...",
    "Mapping dependencies...",
    "Verifying structural health...",
    "Polishing ideas...",
    "Preparing to sprout...",
];

interface ThinkingIndicatorProps {
    stage?: StreamStage;
    context?: string;
}

export function ThinkingIndicator({ stage, context }: ThinkingIndicatorProps) {
    const [labelIndex, setLabelIndex] = useState(0);

    useEffect(() => {
        if (!stage || stage === 'thinking') {
            const interval = setInterval(() => {
                setLabelIndex((prev) => (prev + 1) % thinkingLabels.length);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [stage]);

    const displayLabel = stage && stageLabels[stage]
        ? context
            ? `Marie is ${stageLabels[stage].toLowerCase()} ${context}...`
            : `Marie is ${stageLabels[stage].toLowerCase()}...`
        : context
            ? `Marie is focused on ${context}...`
            : thinkingLabels[labelIndex];

    const isHighEnergy = stage === 'optimizing' || stage === 'executing' || stage === 'editing';

    return (
        <div className={`thinking-container ${isHighEnergy ? 'high-energy' : ''}`}>
            <div className="thinking-indicator-wrapper">
                <div className="thinking-indicator-glow"></div>
                <div className="thinking-brain-wave"></div>
                <div className="thinking-indicator-inner">
                    <ThinkingDots energy={isHighEnergy} />
                </div>
            </div>
            <span key={stage || 'idle'} className="thinking-text fade-in-out">{displayLabel}</span>
        </div>
    );
}

function ThinkingDots({ energy }: { energy?: boolean }) {
    return (
        <div className={`thinking-dots ${energy ? 'energized' : ''}`}>
            <div className="thinking-dot"></div>
            <div className="thinking-dot"></div>
            <div className="thinking-dot"></div>
        </div>
    );
}
