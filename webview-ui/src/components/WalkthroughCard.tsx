import { FileText, ChevronRight, Sparkles } from 'lucide-react';
import { vscode } from '../utils/vscode';

interface WalkthroughCardProps {
    title: string;
    description: string;
    filePath: string;
}

export function WalkthroughCard({ title, description, filePath }: WalkthroughCardProps) {
    const handleOpen = () => {
        vscode.postMessage({ type: 'openFile', value: filePath });
    };

    return (
        <div className="walkthrough-card-container">
            <div className="walkthrough-card-glow"></div>
            <div className="walkthrough-card-content">
                <div className="walkthrough-icon-section">
                    <div className="icon-pulse">
                        <FileText size={18} className="text-purple-400" />
                    </div>
                </div>
                <div className="walkthrough-details">
                    <div className="walkthrough-header">
                        <span className="walkthrough-label">COMPLETED PHASE</span>
                        <Sparkles size={10} className="text-amber-400" />
                    </div>
                    <h3 className="walkthrough-title">{title}</h3>
                    <p className="walkthrough-description">{description}</p>
                    <button className="walkthrough-open-button" onClick={handleOpen}>
                        <span>Open Walkthrough</span>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
