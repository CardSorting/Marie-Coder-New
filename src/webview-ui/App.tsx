import { Providers } from "./Providers.js"
import { ApprovalPanel } from "./components/ApprovalPanel.js"
import { ChatPanel } from "./components/ChatPanel.js"
import { Composer } from "./components/Composer.js"
import { HeaderBar } from "./components/HeaderBar.js"
import { SessionList } from "./components/SessionList.js"
import { useWebviewState } from "./context/WebviewStateContext.js"

function AppContent() {
    const { state, actions } = useWebviewState()

    return (
        <div className="layout">
            <SessionList
                sessions={state.sessions}
                currentSessionId={state.currentSessionId}
                onLoad={actions.loadSession}
                onCreate={actions.createSession}
                onRefresh={actions.refreshSessions}
            />

            <main className="right">
                <HeaderBar
                    config={state.config}
                    isLoading={state.isLoading}
                    onAutonomyMode={actions.setAutonomyMode}
                    onClear={actions.clearSession}
                    onStop={actions.stopGeneration}
                    onSettings={actions.openSettings}
                />

                <ChatPanel messages={state.messages} streamingBuffer={state.streamingBuffer} />

                <ApprovalPanel pendingApproval={state.pendingApproval} onApprove={actions.approveTool} />

                <Composer isLoading={state.isLoading} onSend={actions.sendMessage} onModels={actions.getModels} />
            </main>
        </div>
    )
}

export default function App() {
    return (
        <Providers>
            <AppContent />
        </Providers>
    )
}
