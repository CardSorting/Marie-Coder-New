import { QUICK_ACTIONS, type QuickActionKey } from '../constants';
import { PlusIcon, SparkleIcon, FoldIcon, MarieMascot } from '../plumbing/ui/Icons';

interface WelcomeScreenProps {
    onAction: (text: string) => void;
    onNewSession: () => void;
}

export function WelcomeScreen({ onAction, onNewSession }: WelcomeScreenProps) {
    const getSoulfulGreeting = () => {
        return "Welcome back. Ready to bring clarity to this project?";
    };

    const getIconComponent = (iconName: string) => {
        switch (iconName) {
            case 'MarieMascot': return <MarieMascot width={24} height={24} />;
            case 'PlusIcon': return <PlusIcon width={24} height={24} />;
            case 'FoldIcon': return <FoldIcon width={24} height={24} />;
            default: return <SparkleIcon width={24} height={24} />;
        }
    }

    return (
        <div className="welcome-screen">
            <div className="welcome-content staggered-reveal">
                <div className="welcome-logo reveal-item-1">
                    <MarieMascot width={64} height={64} />
                </div>
                <h1 className="reveal-item-2">{getSoulfulGreeting()}</h1>
                <p className="reveal-item-3">I am Marie, your partner in building a joyful codebase.</p>

                <div className="quick-action-cards reveal-item-4">
                    {(Object.keys(QUICK_ACTIONS) as QuickActionKey[]).map((key) => (
                        <button
                            key={key}
                            className="action-card"
                            onClick={() => {
                                if (key === 'newSession') {
                                    onNewSession();
                                } else {
                                    onAction(QUICK_ACTIONS[key].prompt);
                                }
                            }}
                        >
                            <div className="action-card-icon">
                                {getIconComponent(QUICK_ACTIONS[key].icon)}
                            </div>
                            <div className="action-card-content">
                                <h3>{QUICK_ACTIONS[key].title}</h3>
                                <span>{QUICK_ACTIONS[key].prompt}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
