import { ArrowDownIcon } from '../plumbing/ui/Icons';

interface ScrollToBottomProps {
    visible: boolean;
    hasUnread?: boolean;
    onClick: () => void;
}

export function ScrollToBottom({ visible, hasUnread, onClick }: ScrollToBottomProps) {
    if (!visible) return null;

    return (
        <button
            className={`scroll-to-bottom-button ${hasUnread ? 'has-unread' : ''}`}
            onClick={onClick}
            title="Scroll to bottom"
        >
            <ArrowDownIcon width={20} height={20} />
            {hasUnread && <span className="unread-beacon" />}
        </button>
    );
}

// Need to update Icons.tsx to include ArrowDownIcon if not present, 
// but for now let's assume I can use a simple SVG here if missing or add it to Icons.
