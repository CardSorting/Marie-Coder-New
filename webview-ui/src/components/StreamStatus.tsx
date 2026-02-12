import { useEffect, useState, useRef } from 'react';
import type { StreamStage } from '../types';

interface StreamStatusProps {
    stage: StreamStage;
    startedAt: number | null;
    stepCount: number;
    toolCount: number;
    completionPercent?: number;
    currentStep?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        reasoningTokens?: number;
    };
    lifecycleStage?: 'sprout' | 'bloom' | 'compost';
    ritualComplete?: boolean;
    activeFilePath?: string;
    currentPass?: number;
    totalPasses?: number;
    passFocus?: string;
    isResuming?: boolean;
    passHistory?: Array<{ pass: number, summary: string, reflection: string }>;
    metrics?: { cherishedFiles: string[], releasedDebtCount: number };
    compact?: boolean;
    mode?: 'global' | 'inline';
}

const stageLabels: Record<StreamStage, string> = {
    idle: 'Ready',
    thinking: 'Thinking',
    planning: 'Planning',
    responding: 'Responding',
    calling_tool: 'Using Tool',
    editing: 'Editing',
    finalizing: 'Finalizing',
    executing: 'Executing',
    reviewing: 'Reviewing',
    optimizing: 'Optimizing',
    done: 'Complete',
    error: 'Error',
};

const stageEmojis: Record<StreamStage, string> = {
    idle: '✨',
    thinking: '🧠',
    planning: '📋',
    responding: '💬',
    calling_tool: '🔧',
    editing: '✏️',
    finalizing: '🎯',
    executing: '⚙️',
    reviewing: '👀',
    optimizing: '⚡',
    done: '✅',
    error: '❌',
};

function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

function formatTokens(n: number | undefined): string {
    if (n === undefined) return '—';
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

export function StreamStatus({
    stage,
    startedAt,
    stepCount,
    toolCount,
    currentStep,
    usage,
    completionPercent = 0,
    lifecycleStage,
    ritualComplete,
    activeFilePath,
    currentPass,
    totalPasses,
    passFocus,
    isResuming,
    passHistory,
    metrics,
    compact = false,
    mode = 'global'
}: StreamStatusProps) {
    const [elapsed, setElapsed] = useState(0);
    const [stepHistory, setStepHistory] = useState<string[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Track step history and reset when starting fresh
    useEffect(() => {
        if (stage === 'thinking' && stepCount === 0) {
            // Use microtask to avoid direct setState during render
            queueMicrotask(() => setStepHistory([]));
        } else if (currentStep && currentStep !== stepHistory[0]) {
            queueMicrotask(() => setStepHistory(prev => [currentStep, ...prev].slice(0, 3)));
        }
    }, [currentStep, stage, stepCount, stepHistory]);

    useEffect(() => {
        if (startedAt && stage !== 'idle' && stage !== 'done' && stage !== 'error') {
            // Start timer - use microtask for initial setState
            const updateElapsed = () => {
                if (startedAt) {
                    setElapsed(Date.now() - startedAt);
                }
            };
            queueMicrotask(updateElapsed);
            intervalRef.current = setInterval(updateElapsed, 100);
        } else {
            // Stop timer
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [startedAt, stage]);

    // Show minimal status when idle (prevents UI from disappearing)
    if (stage === 'idle') {
        return (
            <div className="stream-status compact idle">
                <div className="status-inline-row">
                    <div className="stage-indicator mini idle">
                        <span className="stage-emoji">✨</span>
                        <span className="stage-label">Ready</span>
                    </div>
                    <div className="mini-stats">
                        <span className="mini-timer">--</span>
                    </div>
                </div>
            </div>
        );
    }

    const isActive = stage !== 'done' && stage !== 'error';

    if (compact) {
        return (
            <div className={`stream-status compact ${isActive ? 'active' : 'completed'}`}>
                <div className="status-inline-row">
                    {completionPercent > 0 && completionPercent < 100 && (
                        <div
                            className="mini-progress-line"
                            style={{ width: `${completionPercent}%` }}
                        />
                    )}
                    <div className={`stage-indicator mini ${stage} ${isActive ? 'pulse-active' : ''}`}>
                        <div className="activity-dot-wrapper">
                            <span className="stage-emoji">{stageEmojis[stage]}</span>
                            {isActive && <div className="activity-pulse-dot"></div>}
                        </div>
                        <span className="stage-label">{stageLabels[stage]}</span>
                    </div>
                    {activeFilePath && stage === 'editing' && (
                        <div className="mini-active-file">
                            <span className="file-icon">📄</span>
                            <span className="file-path">{activeFilePath.split('/').pop()}</span>
                        </div>
                    )}
                    <div className="mini-stats">
                        {mode === 'global' && metrics && (Array.isArray(metrics.cherishedFiles) && metrics.cherishedFiles.length > 0 || (metrics.releasedDebtCount || 0) > 0) && (
                            <div className="mini-garden-growth">
                                {Array.isArray(metrics.cherishedFiles) && metrics.cherishedFiles.length > 0 && (
                                    <span className="mini-stat cherished" title={`Cherished: ${metrics.cherishedFiles.length}`}>🌱{metrics.cherishedFiles.length}</span>
                                )}
                                {(metrics.releasedDebtCount || 0) > 0 && (
                                    <span className="mini-stat released" title="Released Debt">🍂{metrics.releasedDebtCount}</span>
                                )}
                            </div>
                        )}
                        {mode === 'global' && currentPass && totalPasses && (
                            <span className="mini-stat pass" title={passFocus}>P:{currentPass}/{totalPasses}</span>
                        )}
                        {mode === 'global' && stepCount > 0 && <span className="mini-stat">S:{stepCount}</span>}
                        {mode === 'global' && toolCount > 0 && <span className="mini-stat">T:{toolCount}</span>}
                        {mode === 'global' && <span className="mini-timer">{formatElapsed(elapsed)}</span>}
                        {completionPercent > 0 && completionPercent < 100 && (
                            <span className="mini-percent">{completionPercent}%</span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`stream-status ${isActive ? 'active' : 'completed'} mode-${mode}`}>
            <div className="stream-status-header">
                <div className={`stage-indicator ${stage}`}>
                    <span className="stage-emoji">{stageEmojis[stage]}</span>
                    <span className="stage-label">{stageLabels[stage]}</span>
                    {isActive && <span className="stage-pulse" />}
                </div>
                {mode === 'global' && (
                    <div className="stream-timer">
                        <span className="timer-icon">⏱️</span>
                        <span className="timer-value">{formatElapsed(elapsed)}</span>
                    </div>
                )}
                {mode === 'global' && ritualComplete && (
                    <div className="ritual-badge" title="Mindfulness Ritual Complete">
                        <span className="ritual-icon">🧘‍♂️</span>
                        <span className="ritual-text">Aligned</span>
                    </div>
                )}
                {lifecycleStage && (
                    <div className={`lifecycle-badge ${lifecycleStage}`}>
                        <span className="lifecycle-icon">
                            {lifecycleStage === 'sprout' ? '🌱' : lifecycleStage === 'bloom' ? '🌸' : '🍂'}
                        </span>
                        <span className="lifecycle-label">
                            {lifecycleStage.charAt(0).toUpperCase() + lifecycleStage.slice(1)}
                        </span>
                    </div>
                )}
            </div>

            {currentPass && totalPasses && (
                <div className="stream-pass-indicator">
                    <div className="pass-pipeline">
                        {Array.from({ length: totalPasses }).map((_, i) => {
                            const historyItem = passHistory?.find(h => h.pass === i + 1);
                            const pipTitle = historyItem
                                ? `Pass ${i + 1}: ${historyItem.summary}\nReflection: ${historyItem.reflection}`
                                : `Pass ${i + 1}`;

                            return (
                                <div
                                    key={i}
                                    className={`pass-pip ${i + 1 < currentPass ? 'completed' : i + 1 === currentPass ? 'active' : ''}`}
                                    title={pipTitle}
                                />
                            );
                        })}
                    </div>
                    <div className="pass-pill">
                        {isResuming && <span className="resuming-badge">RESUMING</span>}
                        <span className="pass-label">PASS {currentPass} OF {totalPasses}</span>
                        {passFocus && <span className="pass-focus">: {passFocus}</span>}
                    </div>
                </div>
            )}

            {mode === 'global' && (
                <div className="stream-step-history">
                    {stepHistory.map((step, i) => (
                        <div key={`${step}-${i}`} className={`step-history-item i-${i}`}>
                            <span className="step-arrow">{i === 0 ? '→' : '·'}</span>
                            <span className="step-text">{step}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="stream-stats">
                {mode === 'global' && metrics && (Array.isArray(metrics.cherishedFiles) && metrics.cherishedFiles.length > 0 || (metrics.releasedDebtCount || 0) > 0) && (
                    <div className="garden-growth-stats">
                        {Array.isArray(metrics.cherishedFiles) && metrics.cherishedFiles.length > 0 && (
                            <div className="stat-chip cherished" title={`Cherished: ${metrics.cherishedFiles.join(', ')}`}>
                                <span className="stat-label">🌱 Cherished</span>
                                <span className="stat-value">{metrics.cherishedFiles.length}</span>
                            </div>
                        )}
                        {(metrics.releasedDebtCount || 0) > 0 && (
                            <div className="stat-chip released" title="Technical debt released">
                                <span className="stat-label">🍂 Released</span>
                                <span className="stat-value">{metrics.releasedDebtCount}</span>
                            </div>
                        )}
                    </div>
                )}
                {mode === 'global' && stepCount > 0 && (
                    <div className="stat-chip">
                        <span className="stat-label">Steps</span>
                        <span className="stat-value">{stepCount}</span>
                    </div>
                )}
                {mode === 'global' && toolCount > 0 && (
                    <div className="stat-chip">
                        <span className="stat-label">Tools</span>
                        <span className="stat-value">{toolCount}</span>
                    </div>
                )}
                {mode === 'global' && usage?.totalTokens && (
                    <div className="stat-chip tokens">
                        <span className="stat-label">Tokens</span>
                        <span className="stat-value">{formatTokens(usage.totalTokens)}</span>
                    </div>
                )}
                {mode === 'global' && usage?.reasoningTokens && (
                    <div className="stat-chip reasoning">
                        <span className="stat-label">Reasoning</span>
                        <span className="stat-value">{formatTokens(usage.reasoningTokens)}</span>
                    </div>
                )}
            </div>

            <div className="stream-progress-bar-container">
                <div
                    className="stream-progress-bar"
                    style={{ width: `${completionPercent}%` }}
                />
            </div>
        </div >
    );
}
