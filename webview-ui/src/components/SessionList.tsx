import { useState, useMemo } from 'react'
import { TrashIcon, ClockIcon, CrossIcon, PinIcon, EditIcon, SearchIcon, CheckIcon, HeartIcon, SettingsIcon } from '../plumbing/ui/Icons'
import { useSafeCallback } from '../utils/useSafeCallback'

interface Session {
    id: string;
    title: string;
    lastModified: number;
    isPinned?: boolean;
}

interface SessionListProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: Session[];
    currentId: string | null;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onCreateSession: () => void;
    onRenameSession: (id: string, newTitle: string) => void;
    onTogglePin: (id: string) => void;
    onClear: () => void;
    onOpenSettings: () => void;
    onOpenVitality: () => void;
    hasMessages: boolean;
}

export function SessionList({
    isOpen,
    onClose,
    sessions,
    currentId,
    onSelectSession,
    onDeleteSession,
    onCreateSession,
    onRenameSession,
    onTogglePin,
    onClear,
    onOpenSettings,
    onOpenVitality,
    hasMessages
}: SessionListProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // --- Safe Handlers ---
    const handleClose = useSafeCallback(() => onClose?.(), [onClose], 'onClose');
    const handleSelect = useSafeCallback((id: string) => onSelectSession?.(id), [onSelectSession], 'onSelectSession');
    const handleTogglePin = useSafeCallback((id: string) => onTogglePin?.(id), [onTogglePin], 'onTogglePin');
    const handleDelete = useSafeCallback((id: string) => onDeleteSession?.(id), [onDeleteSession], 'onDeleteSession');
    const handleCreate = useSafeCallback(() => onCreateSession?.(), [onCreateSession], 'onCreateSession');
    const handleVitality = useSafeCallback(() => onOpenVitality?.(), [onOpenVitality], 'onOpenVitality');
    const handleSettings = useSafeCallback(() => onOpenSettings?.(), [onOpenSettings], 'onOpenSettings');
    const handleClear = useSafeCallback(() => onClear?.(), [onClear], 'onClear');

    const handleStartRename = useSafeCallback((e: React.MouseEvent, session: Session) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditValue(session.title);
    }, [], 'handleStartRename');

    const handleRenameSubmit = useSafeCallback((id: string) => {
        if (editValue.trim()) {
            onRenameSession?.(id, editValue.trim());
        }
        setEditingId(null);
    }, [editValue, onRenameSession], 'handleRenameSubmit');

    const filteredSessions = useMemo(() => {
        const safeSessions = Array.isArray(sessions) ? sessions : [];
        return safeSessions.filter(s =>
            s.title?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [sessions, searchQuery]);

    const groupedSessions = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const lastWeek = today - 86400000 * 7;

        const groups: { [key: string]: Session[] } = {
            'Pinned': [],
            'Today': [],
            'Yesterday': [],
            'Previous 7 Days': [],
            'Older': []
        };

        (filteredSessions || []).forEach(session => {
            if (session.isPinned) {
                groups['Pinned'].push(session);
                return;
            }

            const time = session.lastModified;
            if (time >= today) groups['Today'].push(session);
            else if (time >= yesterday) groups['Yesterday'].push(session);
            else if (time >= lastWeek) groups['Previous 7 Days'].push(session);
            else groups['Older'].push(session);
        });

        return groups;
    }, [filteredSessions]);

    if (!isOpen) return null;

    return (
        <div className="session-list-overlay" onClick={handleClose}>
            <div className="session-list-panel" onClick={e => e.stopPropagation()}>
                <div className="session-list-header">
                    <h2>Chat History</h2>
                    <button className="icon-button" onClick={handleClose}>
                        <CrossIcon width={20} height={20} />
                    </button>
                </div>

                <div className="session-list-actions">
                    <button className="new-chat-button" onClick={handleCreate}>
                        + New Session
                    </button>

                    <div className="search-container">
                        <SearchIcon width={14} height={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="clear-search" onClick={() => setSearchQuery('')} title="Clear search">
                                <CrossIcon width={12} height={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="sessions-scroll">
                    {Object.entries(groupedSessions).map(([groupName, groupSessions]) => {
                        if (groupSessions.length === 0) return null;

                        return (
                            <div key={groupName} className="session-group">
                                <div className="group-label">{groupName}</div>
                                {groupSessions.map(session => (
                                    <div
                                        key={session.id}
                                        className={`session-item ${session.id === currentId ? 'active' : ''}`}
                                        onClick={() => handleSelect(session.id)}
                                    >
                                        <div className="session-info">
                                            {editingId === session.id ? (
                                                <div className="rename-input-container" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameSubmit(session.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                    />
                                                    <button onClick={() => handleRenameSubmit(session.id)}>
                                                        <CheckIcon width={14} height={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <ClockIcon width={14} height={14} className="session-icon" />
                                                    <div className="session-details">
                                                        <span className="session-title">{session.title}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="session-item-actions">
                                            <button
                                                className={`action-btn ${session.isPinned ? 'active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); handleTogglePin(session.id); }}
                                                title={session.isPinned ? "Unpin Session" : "Pin Session"}
                                            >
                                                <PinIcon width={14} height={14} />
                                            </button>
                                            <button
                                                className="action-btn"
                                                onClick={(e) => handleStartRename(e, session)}
                                                title="Rename Session"
                                            >
                                                <EditIcon width={14} height={14} />
                                            </button>
                                            <button
                                                className="action-btn delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(session.id);
                                                }}
                                                title="Delete Session"
                                            >
                                                <TrashIcon width={14} height={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}

                    {filteredSessions.length === 0 && searchQuery && (
                        <div className="empty-sessions">
                            <p>No chats matching "<strong>{searchQuery}</strong>"</p>
                            <button className="link-button" onClick={() => setSearchQuery('')}>Clear search</button>
                        </div>
                    )}
                    {sessions.length === 0 && !searchQuery && (
                        <div className="empty-sessions">
                            <p>Your history is a blank canvas. ✨</p>
                            <button className="new-chat-button" onClick={handleCreate}>Start your first chat</button>
                        </div>
                    )}
                </div>
                <div className="session-list-footer compact">
                    <div className="footer-actions inline">
                        <button className="footer-icon-btn" onClick={handleVitality} title="Project Vitality Dashboard">
                            <HeartIcon width={16} height={16} style={{ color: 'var(--vscode-charts-pink)' }} />
                        </button>
                        <button className="footer-icon-btn" onClick={handleSettings} title="Marie Settings">
                            <SettingsIcon width={16} height={16} />
                        </button>
                        <div className="footer-spacer" />
                        {hasMessages && (
                            <button className="footer-icon-btn danger" onClick={handleClear} title="Wipe Current Session">
                                <TrashIcon width={16} height={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
