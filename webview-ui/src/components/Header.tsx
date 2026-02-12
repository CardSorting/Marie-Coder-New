import React from 'react';
import { ClockIcon, ChevronDownIcon, SparkleIcon } from '../plumbing/ui/Icons'
import type { Settings, MarieStatus, StreamStage } from '../types';
import { useSafeCallback } from '../utils/useSafeCallback';

interface HeaderProps {
    onNewChat: () => void;
    onOpenHistory: () => void;
    activeFile?: string;
    zone?: 'joyful' | 'infrastructure' | 'plumbing' | null;
    currentSessionTitle?: string | null;
    settings: Settings;
    availableModels: { id: string, name: string }[];
    onOpenSettings?: () => void;
    marieStatus: MarieStatus;
    streamStage?: StreamStage;
    completionPercent?: number;
    isLoadingModels: boolean;
}

export const Header = React.memo(function Header({
    onNewChat,
    onOpenHistory,
    activeFile,
    zone,
    currentSessionTitle,
    settings,
    availableModels,
    onOpenSettings,
    marieStatus,
    streamStage,
    completionPercent,
    isLoadingModels
}: HeaderProps) {

    // --- Safe Handlers ---
    const handleNewChat = useSafeCallback(() => onNewChat?.(), [onNewChat], 'onNewChat');
    const handleHistory = useSafeCallback(() => onOpenHistory?.(), [onOpenHistory], 'onOpenHistory');
    const handleSettings = useSafeCallback(() => onOpenSettings?.(), [onOpenSettings], 'onOpenSettings');

    const getStatusClass = () => {
        if (isLoadingModels) return 'loading';
        if (marieStatus === 'responding' && streamStage) {
            return `responding ${streamStage}`;
        }
        return marieStatus;
    };

    const getStatusTitle = () => {
        if (isLoadingModels) return 'Loading models...';
        if (marieStatus === 'responding' && streamStage) {
            const percent = completionPercent ? ` (${Math.round(completionPercent)}%)` : '';
            return `Marie is ${streamStage.replace('_', ' ')}${percent}`;
        }
        switch (marieStatus) {
            case 'thinking': return 'Marie is thinking...';
            case 'error': return 'An error occurred';
            default: return 'Marie is ready';
        }
    };

    // Calculate progress circle properties
    const radius = 9;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - ((completionPercent || 0) / 100) * circumference;
    const showProgress = marieStatus === 'responding' && (completionPercent || 0) > 0;

    // Defensive check for settings/models
    const safeProvider = settings?.aiProvider || 'Unknown';
    const safeModelName = (availableModels || []).find(m => m.id === settings?.model)?.name || settings?.model || 'Unknown';

    return (
        <header className="app-header">
            <div className="header-title-container">
                <div className="header-breadcrumbs">
                    <h1 onClick={handleNewChat} title="Start New Session">Marie</h1>
                    {currentSessionTitle && <span className="breadcrumb-separator">/</span>}
                    {currentSessionTitle && (
                        <div className="header-session-title" title={currentSessionTitle}>
                            {currentSessionTitle}
                        </div>
                    )}
                    {activeFile && activeFile !== 'No active file' && (
                        <>
                            <span className="breadcrumb-separator">/</span>
                            <div className="header-file-breadcrumb" title={`Active context: ${activeFile}`}>
                                <span className="file-icon">📄</span>
                                <span className="file-name">{activeFile}</span>
                                {zone && (
                                    <span className={`zone-chip-mini ${zone}`}>
                                        {zone === 'joyful' && 'Joy'}
                                        {zone === 'infrastructure' && 'Infra'}
                                        {zone === 'plumbing' && 'Plumbing'}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="header-actions">
                <button className="icon-button" onClick={handleHistory} title="View Session History">
                    <ClockIcon width={18} height={18} />
                </button>
                <div
                    className="provider-badge"
                    onClick={handleSettings}
                    title="Click to change Provider/Model"
                >
                    <div className="provider-icon-container">
                        {showProgress && (
                            <svg className="progress-ring" width="20" height="20">
                                <circle
                                    className="progress-ring-circle"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    fill="transparent"
                                    r={radius}
                                    cx="10"
                                    cy="10"
                                    style={{
                                        strokeDasharray: `${circumference} ${circumference}`,
                                        strokeDashoffset: progressOffset
                                    }}
                                />
                            </svg>
                        )}
                        <SparkleIcon width={14} height={14} className={showProgress ? 'icon-pulse' : ''} />
                        <span className={`status-dot ${getStatusClass()}`} title={getStatusTitle()}></span>
                    </div>
                    <div className="provider-info">
                        <span className="provider-name">{safeProvider}</span>
                        <span className="model-name">{safeModelName}</span>
                    </div>
                    <ChevronDownIcon width={12} height={12} className="provider-chevron" />
                </div>
            </div>
        </header>
    )
});
