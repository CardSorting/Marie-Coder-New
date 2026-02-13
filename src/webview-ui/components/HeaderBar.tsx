import type { UiConfig } from "../types.js"

export function HeaderBar({
    config,
    isLoading,
    onAutonomyMode,
    onClear,
    onStop,
    onSettings,
}: {
    config: UiConfig
    isLoading: boolean
    onAutonomyMode: (mode: string) => void
    onClear: () => void
    onStop: () => void
    onSettings: () => void
}) {
    return (
        <header className="top">
            <div>
                <div>
                    <strong>Marie</strong> · {config.provider} · {config.model}
                </div>
                <div className="muted">Autonomy: {config.autonomyMode}{isLoading ? " · Running…" : ""}</div>
            </div>
            <div className="row">
                <select value={config.autonomyMode} onChange={(e) => onAutonomyMode(e.target.value)}>
                    <option value="balanced">balanced</option>
                    <option value="high">high</option>
                    <option value="yolo">yolo</option>
                </select>
                <button onClick={onClear} className="secondary">
                    Clear
                </button>
                <button onClick={onStop} className="secondary">
                    Stop
                </button>
                <button onClick={onSettings} className="secondary">
                    Settings
                </button>
            </div>
        </header>
    )
}
