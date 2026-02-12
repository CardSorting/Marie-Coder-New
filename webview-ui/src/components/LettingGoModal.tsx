import React, { useLayoutEffect, useState, useRef, useCallback } from 'react';
import './LettingGoModal.css';

interface LettingGoModalProps {
    fileName: string;
    lines: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export const LettingGoModal: React.FC<LettingGoModalProps> = ({ fileName, lines, onConfirm, onCancel }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isDissolving, setIsDissolving] = useState(false);

    // Hold duration in ms
    const HOLD_DURATION = 1500;
    const requestRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);

    useLayoutEffect(() => {
        queueMicrotask(() => setIsVisible(true));
    }, []);

    const getFileTypeMessage = () => {
        if (fileName.endsWith('.css')) return "Thank you for the beauty you brought to the world.";
        if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return "Thank you for the logic and flow you handled.";
        if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) return "Thank you for the experiences you created.";
        if (fileName.endsWith('.json')) return "Thank you for holding our structure together.";
        return "Thank you for your service.";
    }

    const getSizeMessage = () => {
        if (lines < 50) return "Short, sweet, and essential.";
        if (lines < 200) return "You carried your weight with grace.";
        return "A mighty foundation, now ready to rest.";
    };

    const stopHolding = () => {
        setIsHolding(false);
        setProgress(0);
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
    };

    // Define animation function inside useCallback to avoid render-phase ref updates
    const handleMouseDown = useCallback(() => {
        setIsHolding(true);
        startTimeRef.current = Date.now();

        // Define the animation loop as a nested function
        const animate = () => {
            if (!startTimeRef.current) return;
            const elapsed = Date.now() - startTimeRef.current;
            const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);

            setProgress(newProgress);

            if (newProgress < 100) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                // Complete the action
                setIsDissolving(true);
                setTimeout(() => {
                    onConfirm();
                }, 800);
            }
        };

        requestRef.current = requestAnimationFrame(animate);
    }, [onConfirm]);

    const handleMouseUp = () => {
        stopHolding();
    };

    const handleCancel = () => {
        setIsVisible(false);
        setTimeout(onCancel, 300);
    };

    return (
        <div className={`letting-go-overlay ${isVisible ? 'visible' : ''} ${isDissolving ? 'dissolving' : ''}`}>
            <div className={`letting-go-card ${isDissolving ? 'dissolve-active' : ''}`}>
                <div className="card-glow"></div>
                <div className="icon-wrapper">
                    <span className="icon-main">{isHolding ? '✨' : '🍂'}</span>
                    <span className="icon-shadow">🍂</span>
                    {isHolding && <div className="gathering-energy"></div>}
                </div>

                <h2>The Ritual of Letting Go</h2>

                <div className="file-preview">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{fileName}</span>
                </div>

                <div className="stats-row">
                    <div className="stat-pill">
                        <span className="stat-value">{lines}</span>
                        <span className="stat-label">lines</span>
                    </div>
                </div>

                <div className="gratitude-container">
                    <p className="gratitude-main">"{getFileTypeMessage()}"</p>
                    <p className="gratitude-sub">{getSizeMessage()}</p>
                </div>

                <div className="actions">
                    <button
                        className={`joyful-btn confirm ${isHolding ? 'holding' : ''}`}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleMouseDown}
                        onTouchEnd={handleMouseUp}
                    >
                        <div className="btn-progress" style={{ width: `${progress}%` }}></div>
                        <span className="btn-content">
                            <span className="btn-icon">{progress >= 100 ? '✨' : '🙏'}</span>
                            {progress >= 100 ? 'Released' : 'Hold to Release'}
                        </span>
                    </button>

                    <button className="joyful-btn cancel" onClick={handleCancel}>
                        Not yet
                    </button>
                </div>
            </div>
        </div>
    );
};
