import React, { useLayoutEffect, useState } from 'react';
import './LettingGoModal.css'; // Reusing some base styles for layout

interface SproutRitualProps {
    fileName: string;
    suggestedPath?: string;
    onConfirm: (intent: string, finalPath?: string) => void;
    onCancel: () => void;
}

export const SproutRitual: React.FC<SproutRitualProps> = ({ fileName, suggestedPath, onConfirm, onCancel }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [intent, setIntent] = useState('');
    const [finalPath, setFinalPath] = useState(suggestedPath || fileName);
    const [isSprouting, setIsSprouting] = useState(false);

    useLayoutEffect(() => {
        queueMicrotask(() => setIsVisible(true));
    }, []);

    const handleConfirm = () => {
        setIsSprouting(true);
        setTimeout(() => {
            onConfirm(intent || "To bring more joy and clarity to the system.", finalPath);
        }, 800);
    };

    return (
        <div className={`letting-go-overlay ${isVisible ? 'visible' : ''} ${isSprouting ? 'dissolving' : ''}`}>
            <div className={`letting-go-card sprout-card ${isSprouting ? 'dissolve-active' : ''}`}>
                <div className="card-glow" style={{ background: 'radial-gradient(circle, rgba(74, 222, 128, 0.1) 0%, transparent 60%)' }}></div>
                <div className="icon-wrapper">
                    <span className="icon-main">🌱</span>
                    <span className="icon-shadow">🌱</span>
                </div>

                <h2>The Ritual of Sprouting</h2>
                <p style={{ opacity: 0.8, marginBottom: '20px' }}>A new entity has appeared in our garden.</p>

                <div className="file-preview">
                    <span className="file-icon">🍃</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                        <span className="file-name">{fileName}</span>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.7rem', opacity: 0.5, marginRight: '8px' }}>Path:</span>
                            <input
                                type="text"
                                value={finalPath}
                                onChange={(e) => setFinalPath(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    color: 'var(--vscode-foreground)',
                                    padding: '2px 6px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="gratitude-container">
                    <p className="gratitude-main">"What is the spark that brings this file to life?"</p>
                    <textarea
                        className="sprout-intent-input"
                        placeholder="Define its primary intent..."
                        value={intent}
                        onChange={(e) => setIntent(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--vscode-widget-border)',
                            borderRadius: '8px',
                            padding: '12px',
                            color: 'var(--vscode-foreground)',
                            marginTop: '12px',
                            minHeight: '80px',
                            outline: 'none',
                            resize: 'none'
                        }}
                    />
                </div>

                <div className="actions">
                    <button className="joyful-btn confirm" onClick={handleConfirm} style={{ background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', boxShadow: '0 4px 12px rgba(74, 222, 128, 0.3)' }}>
                        <span className="btn-content">
                            <span className="btn-icon">✨</span>
                            Plant with Intent
                        </span>
                    </button>
                    <button className="joyful-btn cancel" onClick={onCancel}>
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
};
