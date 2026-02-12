import React, { useState } from 'react';
import { StreamStatus } from './StreamStatus';
import { ReasoningStream } from './ReasoningStream';
import { ApprovalRequest } from './ApprovalRequest';
import { PassHistory } from './PassHistory';
import { useActivityResize } from '../hooks/useActivityResize';
import type {
    StreamStage,
    ProgressObjective,
    CheckpointPayload,
    ApprovalRequestPayload
} from '../types';


interface LiveActivityAreaProps {
    streamStage: StreamStage;
    streamStartedAt: number | null;
    stepCount: number;
    toolCount: number;
    currentStepLabel: string;
    tokenUsage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        reasoningTokens?: number;
    } | null;
    completionPercent: number;
    lifecycleStage?: 'sprout' | 'bloom' | 'compost';
    ritualComplete: boolean;
    activeFilePath?: string;
    currentPass?: number;
    totalPasses?: number;
    passFocus?: string;
    reasoning: string;
    showProgressDetails: boolean;
    progressObjectives: ProgressObjective[];
    progressContext: string;
    approvalRequest: ApprovalRequestPayload | null;
    checkpoint: CheckpointPayload | null;
    runError: string | null;
    activeObjectiveId?: string;
    achievements: string[];
    passHistory: Array<{ pass: number, summary: string, reflection: string }>;
    gardenMetrics: { cherishedFiles: string[], releasedDebtCount: number };
    onToggleDetails: () => void;
    onApprovalRespond: (requestId: string, approved: boolean) => void;
}

export const LiveActivityArea = React.memo<LiveActivityAreaProps>(function LiveActivityArea({
    streamStage,
    streamStartedAt,
    stepCount,
    toolCount,
    currentStepLabel,
    tokenUsage,
    completionPercent,
    lifecycleStage,
    ritualComplete,
    activeFilePath,
    currentPass,
    totalPasses,
    passFocus,
    reasoning,
    showProgressDetails,
    progressObjectives,
    progressContext,
    approvalRequest,
    checkpoint,
    runError,
    activeObjectiveId,
    achievements,
    passHistory,
    gardenMetrics,
    onToggleDetails,
    onApprovalRespond
}: LiveActivityAreaProps) {
    const { activityAreaRef } = useActivityResize();
    const [showCompleted, setShowCompleted] = useState(false);
    const [showUpcoming, setShowUpcoming] = useState(false);
    const [isProgressPanelCollapsed, setIsProgressPanelCollapsed] = useState(false);

    const isStreaming = streamStage !== 'idle' && streamStage !== 'done';
    const objectives = Array.isArray(progressObjectives) ? progressObjectives : [];
    const hasActivity = objectives.length > 0 || !!reasoning || !!checkpoint || !!runError;

    // Split objectives into three groups
    const currentObjectives = objectives.filter(o =>
        (o.status === 'in_progress') || (o.id === activeObjectiveId && o.status !== 'completed')
    );

    const upcomingObjectives = objectives.filter(o =>
        o.status === 'pending' && o.id !== activeObjectiveId
    );

    const completedObjectives = objectives.filter(o => o.status === 'completed');

    if (!isStreaming && !hasActivity) return null;

    return (
        <div className={`live-activity-area ${showProgressDetails ? 'detailed' : 'compact'}`} ref={activityAreaRef}>
            {/* Inline Status Bar - Always visible to prevent UI from getting stuck */}
            <div className={`inline-status-bar ${isStreaming ? 'active' : 'idle'}`}>
                <div className="status-compact-info">
                    <StreamStatus
                        stage={streamStage}
                        startedAt={streamStartedAt}
                        stepCount={stepCount}
                        toolCount={toolCount}
                        currentStep={currentStepLabel}
                        usage={tokenUsage ?? undefined}
                        completionPercent={completionPercent}
                        lifecycleStage={lifecycleStage}
                        ritualComplete={ritualComplete}
                        activeFilePath={activeFilePath}
                        currentPass={currentPass}
                        totalPasses={totalPasses}
                        passFocus={passFocus}
                        compact={true}
                        mode="global"
                    />
                    {isStreaming && reasoning && !showProgressDetails && (
                        <span className="inline-thinking-label">Marie is thinking...</span>
                    )}
                </div>

                {/* Progress panel collapse/expand toggle - always accessible */}
                {hasActivity && (
                    <button
                        className="panel-toggle-btn"
                        onClick={() => onToggleDetails()}
                        title={showProgressDetails ? 'Hide Details' : 'Show Details'}
                    >
                        {showProgressDetails ? '▼' : '▲'}
                    </button>
                )}
            </div>

            {/* Urgent Action Overlay - Always Visible */}
            {approvalRequest && (
                <div className="urgent-action-overlay urgent">
                    <div className="approval-overlay-wrapper">
                        <ApprovalRequest
                            requestId={approvalRequest.requestId}
                            toolName={approvalRequest.toolName}
                            toolInput={approvalRequest.toolInput}
                            reasoning={approvalRequest.reasoning}
                            activeObjective={approvalRequest.activeObjective}
                            diff={approvalRequest.diff}
                            onRespond={onApprovalRespond}
                        />
                    </div>
                </div>
            )}

            {/* Overlays - Absolute positioned to avoid pushing chat up */}
            <div className={`activity-overlay-container ${showProgressDetails ? 'visible' : 'hidden'}`}>
                {/* Progress Overlay */}
                {(progressObjectives.length > 0 || checkpoint || runError) && (
                    <div className={`progress-panel overlay ${isProgressPanelCollapsed ? 'collapsed' : ''}`}>
                        <div className="progress-panel-header">
                            <span>Objective Progress</span>
                            <div className="progress-header-right">
                                <span className="progress-percent">{completionPercent}%</span>
                                <button
                                    className="collapse-toggle-btn"
                                    onClick={() => setIsProgressPanelCollapsed(!isProgressPanelCollapsed)}
                                    title={isProgressPanelCollapsed ? 'Expand' : 'Collapse'}
                                >
                                    {isProgressPanelCollapsed ? '▼' : '▲'}
                                </button>
                            </div>
                        </div>
                        {!isProgressPanelCollapsed && (
                            <>
                                {progressContext && <div className="progress-context">{progressContext}</div>}

                                {checkpoint && (
                                    <div className={`checkpoint-banner ${checkpoint.status}`}>
                                        <strong>{checkpoint.status.replace('_', ' ').toUpperCase()}:</strong> {checkpoint.summary.what}
                                    </div>
                                )}

                                {runError && (
                                    <div className="checkpoint-banner denied">Error: {runError}</div>
                                )}

                                {currentObjectives.length > 0 && (
                                    <div className="current-objectives-section">
                                        <div className="section-label">Current Focus</div>
                                        <ul className="objective-list">
                                            {currentObjectives.map(objective => (
                                                <li key={objective.id} className={`objective-item ${objective.status} active`}>
                                                    <span className="objective-label">{objective.label}</span>
                                                    <span className="objective-state">In Progress</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {upcomingObjectives.length > 0 && (
                                    <div className="upcoming-objectives-section">
                                        <button
                                            className="toggle-completed-btn"
                                            onClick={() => setShowUpcoming(!showUpcoming)}
                                        >
                                            {showUpcoming ? 'Hide' : 'Show'} {upcomingObjectives.length} upcoming
                                        </button>

                                        {showUpcoming && (
                                            <ul className="objective-list upcoming-list">
                                                {upcomingObjectives.map(objective => (
                                                    <li key={objective.id} className={`objective-item ${objective.status}`}>
                                                        <span className="objective-label">{objective.label}</span>
                                                        <span className="objective-state">Pending</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {completedObjectives.length > 0 && (
                                    <div className="completed-objectives-section">
                                        <button
                                            className="toggle-completed-btn"
                                            onClick={() => setShowCompleted(!showCompleted)}
                                        >
                                            {showCompleted ? 'Hide' : 'Show'} {completedObjectives.length} completed
                                        </button>

                                        {showCompleted && (
                                            <ul className="objective-list completed-list">
                                                {completedObjectives.map(objective => (
                                                    <li key={objective.id} className={`objective-item ${objective.status}`}>
                                                        <span className="objective-label">{objective.label}</span>
                                                        <span className="objective-state">✓</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {Array.isArray(achievements) && achievements.length > 0 && (
                                    <div className="achievement-feed">
                                        <div className="achievement-title">Achieved</div>
                                        <ul>
                                            {achievements.slice(-4).map((achievement, idx) => (
                                                <li key={`${achievement}-${idx}`}>{achievement}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Reasoning Overlay */}
                {reasoning && (
                    <ReasoningStream
                        reasoning={reasoning}
                        isStreaming={isStreaming}
                    />
                )}

                {/* Retrospective History & Garden Growth */}
                <PassHistory
                    history={passHistory}
                    metrics={gardenMetrics}
                />
            </div>
        </div>
    );
});
