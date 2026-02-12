import { History, Sparkles, Trash2 } from 'lucide-react';

interface PassHistoryProps {
    history: Array<{ pass: number, summary: string, reflection: string }>;
    metrics?: { cherishedFiles: string[], releasedDebtCount: number };
}

export function PassHistory({ history: rawHistory, metrics }: PassHistoryProps) {
    const history = Array.isArray(rawHistory) ? rawHistory : [];
    const hasHistory = history.length > 0;
    const hasMetrics = !!metrics && (Array.isArray(metrics.cherishedFiles) && metrics.cherishedFiles.length > 0 || metrics.releasedDebtCount > 0);

    if (!hasHistory && !hasMetrics) {
        return null;
    }

    return (
        <div className="retrospective-wisdom-container">
            {hasMetrics && metrics && (
                <div className="garden-impact-grid">
                    <div className="impact-card cherished">
                        <div className="impact-header">
                            <Sparkles size={14} />
                            <span>Cherished Improvements</span>
                        </div>
                        <div className="impact-value">+{metrics.cherishedFiles?.length || 0}</div>
                        <div className="impact-subtitle">Joyful files grew</div>
                    </div>
                    <div className="impact-card released">
                        <div className="impact-header">
                            <Trash2 size={14} />
                            <span>Released Debt</span>
                        </div>
                        <div className="impact-value">{metrics.releasedDebtCount || 0}</div>
                        <div className="impact-subtitle">Debt points cleared</div>
                    </div>
                </div>
            )}

            {hasHistory && (
                <div className="pass-timeline">
                    <div className="timeline-header">
                        <History size={14} />
                        <span>Marie's Reflections</span>
                    </div>
                    <div className="timeline-items">
                        {[...history].reverse().map((item, idx) => (
                            <div key={item.pass || idx} className="timeline-item">
                                <div className="timeline-marker">
                                    <div className="marker-dot"></div>
                                    {idx < history.length - 1 && <div className="marker-line"></div>}
                                </div>
                                <div className="timeline-content">
                                    <div className="pass-meta">Pass #{item.pass || (history.length - idx)}</div>
                                    <div className="pass-summary">{item.summary}</div>
                                    <div className="pass-reflection italic">"{item.reflection}"</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
