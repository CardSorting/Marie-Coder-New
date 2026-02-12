import { ListChecks, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ProgressObjective } from '../types';

interface ObjectiveRoadmapProps {
    objectives: ProgressObjective[];
}

export function ObjectiveRoadmap({ objectives }: ObjectiveRoadmapProps) {
    const safeObjectives = Array.isArray(objectives) ? objectives : [];
    if (safeObjectives.length === 0) return null;

    const completedCount = safeObjectives.filter(o => o.status === 'completed').length;

    return (
        <div className="objective-roadmap-container">
            <div className="roadmap-header">
                <div className="header-label">
                    <ListChecks size={12} />
                    <span>Technical Roadmap</span>
                </div>
                <div className="roadmap-glance">
                    {completedCount}/{objectives.length} Goals
                </div>
            </div>

            <div className="roadmap-list">
                {objectives.map((obj) => (
                    <div key={obj.id} className={`roadmap-item ${obj.status}`}>
                        <div className="status-marker">
                            {obj.status === 'completed' ? (
                                <CheckCircle2 size={12} className="text-green" />
                            ) : obj.status === 'in_progress' ? (
                                <div className="spinner-mini"></div>
                            ) : obj.status === 'blocked' ? (
                                <AlertCircle size={12} className="text-amber" />
                            ) : (
                                <div className="circle-dot"></div>
                            )}
                        </div>
                        <div className="roadmap-item-content">
                            <span className="objective-label">{obj.label}</span>
                            {obj.status === 'in_progress' && obj.context && (
                                <span className="objective-context">{obj.context}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
