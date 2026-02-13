import type { Session } from "../types.js"

function formatSessionDate(timestamp: number) {
    try {
        return new Date(timestamp).toLocaleDateString()
    } catch {
        return ""
    }
}

export function SessionList({
    sessions,
    currentSessionId,
    onLoad,
    onCreate,
    onRefresh,
}: {
    sessions: Session[]
    currentSessionId: string
    onLoad: (id: string) => void
    onCreate: () => void
    onRefresh: () => void
}) {
    const sorted = [...sessions].sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.lastModified - a.lastModified,
    )

    return (
        <aside className="left stack">
            <div className="row">
                <button onClick={onCreate}>New</button>
                <button onClick={onRefresh} className="secondary">
                    Refresh
                </button>
            </div>
            <div className="muted">Sessions</div>
            <div className="stack">
                {sorted.length === 0 && <div className="muted">No sessions</div>}
                {sorted.map((session) => (
                    <button
                        key={session.id}
                        onClick={() => onLoad(session.id)}
                        className={`session ${session.id === currentSessionId ? "active" : ""}`}>
                        <span>{session.isPinned ? "📌 " : ""}{session.title || "New Session"}</span>
                        <span className="muted">{formatSessionDate(session.lastModified)}</span>
                    </button>
                ))}
            </div>
        </aside>
    )
}
