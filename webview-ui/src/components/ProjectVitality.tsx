import React, { useState, useLayoutEffect } from 'react';
import './ProjectVitality.css';

interface ProjectVitalityProps {
    health: {
        average: number;
        log: { id: string; description: string; timestamp: number }[];
        clutterCount: number;
        joyfulFiles: number;
        plumbingFiles: number;
        zoningViolations: number;
        migrationAlerts?: { file: string, reason: string }[];
        clusteringAlerts?: { zone: string, fileCount: number, suggestedClusters: string[], reason: string }[];
        isJoyful?: boolean;
    };
    onClose: () => void;
    onRestore: () => void;
    onSynthesize: () => void;
}

export const ProjectVitality: React.FC<ProjectVitalityProps> = ({ health, onClose, onRestore, onSynthesize }) => {
    const [isVisible, setIsVisible] = useState(false);

    useLayoutEffect(() => {
        queueMicrotask(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 500);
    };

    return (
        <div className={`vitality-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
            <div className="vitality-card staggered-reveal" onClick={(e) => e.stopPropagation()}>
                <div className="card-glass-glow"></div>
                <div className="vitality-header">
                    <h2 className="reveal-item-1">Project Vitality</h2>
                    <button className="close-dashboard" onClick={handleClose}>×</button>
                </div>

                {!health?.isJoyful && (
                    <div className="genesis-banner reveal-item-1" style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        padding: '15px',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        color: 'white',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.5rem' }}>🌊</span>
                            <div>
                                <h4 style={{ margin: 0 }}>Project Rebirth is Possible</h4>
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.9 }}>This project hasn't yet embraced the JOY structure. Use the Genesis Ritual to organize everything in one go.</p>
                            </div>
                        </div>
                        <button
                            className="vitality-action"
                            style={{ width: '100%', marginTop: '10px', background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(5px)' }}
                            onClick={() => {
                                if (confirm("Proceed with the Genesis Ritual? This will move files into designated JOY zones. It is a powerful restoration effort.")) {
                                    vscode.postMessage({ command: 'executeTool', tool: 'execute_genesis_ritual', args: {} });
                                }
                            }}
                        >
                            Perform Genesis Ritual ✨
                        </button>
                    </div>
                )}

                <div className="vitality-main-grid">
                    <div className="vitality-stat-main reveal-item-2">
                        <div className="stat-circle">
                            <svg viewBox="0 0 36 36" className="circular-chart">
                                <path className="circle-bg"
                                    d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path className="circle"
                                    strokeDasharray={`${health.average}, 100`}
                                    d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <text x="18" y="20.35" className="percentage">{health.average}%</text>
                            </svg>
                        </div>
                        <span className="stat-label">Collective Joy</span>
                    </div>

                    <div className="vitality-secondary-stats reveal-item-3">
                        <div className="v-stat-item">
                            <span className="v-stat-value">{health.clutterCount}</span>
                            <span className="v-stat-label">Clutter Items</span>
                        </div>
                        <div className="v-stat-item">
                            <span className="v-stat-value">{health.joyfulFiles}</span>
                            <span className="v-stat-label">Joyful Files</span>
                        </div>
                        <div className="v-stat-item">
                            <span className="v-stat-value">{health.plumbingFiles}</span>
                            <span className="v-stat-label">Plumbing Files</span>
                        </div>
                        <div className="v-stat-item" style={{ color: health.zoningViolations > 0 ? '#fb7185' : 'inherit' }}>
                            <span className="v-stat-value">{health.zoningViolations}</span>
                            <span className="v-stat-label">Zoning Violations</span>
                        </div>
                    </div>
                </div>

                <div className="gratitude-log-section reveal-item-4">
                    <h3>Marie's Whispers</h3>
                    <div className="v-log-list" style={{ marginBottom: '20px' }}>
                        {((health?.migrationAlerts && health.migrationAlerts.length > 0) || (health?.clusteringAlerts && health.clusteringAlerts.length > 0) || !health?.isJoyful) ? (
                            <>
                                {!health?.isJoyful && (
                                    <div className="v-log-item" style={{ borderLeft: '2px solid #ef4444' }}>
                                        <span className="v-log-icon">❗</span>
                                        <div className="v-log-content">
                                            <p><strong>Architectural Void</strong>: Your project structure is fragmented. Genesis will bring harmony.</p>
                                        </div>
                                    </div>
                                )}
                                {health.migrationAlerts?.map((alert, i) => (
                                    <div key={`mig-${i}`} className="v-log-item" style={{ borderLeft: '2px solid #fbbf24' }}>
                                        <span className="v-log-icon">🦉</span>
                                        <div className="v-log-content">
                                            <p><strong>{alert.file}</strong>: {alert.reason}</p>
                                        </div>
                                    </div>
                                ))}
                                {health.clusteringAlerts?.map((alert, i) => (
                                    <div key={`cluster-${i}`} className="v-log-item" style={{ borderLeft: '2px solid #3b82f6' }}>
                                        <span className="v-log-icon">📦</span>
                                        <div className="v-log-content">
                                            <p><strong>{alert.zone} zone scaling</strong>: {alert.reason}</p>
                                            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                                {(alert.suggestedClusters || []).map(c => <span key={c} style={{ fontSize: '0.6rem', background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '10px' }}>/{c}</span>)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <p style={{ fontSize: '0.8rem', opacity: 0.5, paddingLeft: '10px' }}>The garden's soul is at rest. ✨</p>
                        )}
                    </div>

                    <h3>Recent Tidying Rituals</h3>
                    <div className="v-log-list">
                        {(health?.log || []).map((item) => (
                            <div key={item.id} className="v-log-item">
                                <span className="v-log-icon">✨</span>
                                <div className="v-log-content">
                                    <p>{item.description}</p>
                                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                        className="vitality-action reveal-item-4"
                        style={{ flex: 1, background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' }}
                        onClick={onRestore}
                    >
                        Restore Order
                    </button>
                    <button
                        className="vitality-action reveal-item-4"
                        style={{ flex: 1, background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                        onClick={onSynthesize}
                    >
                        Synthesize Manuals
                    </button>
                </div>

                <button
                    className="vitality-action reveal-item-4"
                    style={{ marginTop: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    onClick={() => {
                        const name = prompt("Name your new feature (e.g., 'auth'):");
                        const intent = prompt("What is the architectural intent of this feature?");
                        if (name && intent) {
                            window.parent.postMessage({ command: 'executeTool', tool: 'sow_joy_feature', args: { name, intent } }, '*');
                        }
                    }}
                >
                    Sow Joy Feature 🌱
                </button>

                <button className="vitality-action reveal-item-4" style={{ marginTop: '10px', opacity: 0.6 }} onClick={handleClose}>Return to Garden</button>
            </div>
        </div>
    );
};
