import { MessageList } from './components/MessageList'
import { ModalLayer } from './components/ModalLayer'
import { Header } from './components/Header'
import { InputArea } from './components/InputArea'
import { ScrollToBottom } from './components/ScrollToBottom'
import { SparkleEffect } from './components/SparkleEffect'
import { LiveActivityArea } from './components/LiveActivityArea'
import { SessionList } from './components/SessionList'
import './App.css'

import { useMarie } from './hooks/useMarie'
import { useScroll } from './hooks/useScroll'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  const { state, ui, stream, actions } = useMarie();

  const {
    messagesEndRef,
    messagesListRef,
    showScrollButton,
    hasUnreadMessages,
    scrollToBottom,
    handleScroll
  } = useScroll(state.messages, state.marieStatus);

  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);
  const currentSessionTitle = currentSession?.title || (state.messages.length > 0 ? 'New Chat' : null);

  return (
    <ErrorBoundary>
      <div className={`app-container ${state.marieStatus === 'thinking' ? 'marie-pulse' : ''}`}>
        {ui.showSparkles && <SparkleEffect />}

        <ModalLayer ui={ui} state={state} actions={actions} />

        {state.marieStatus === 'thinking' && (
          <div className={`marie-brain-waves ${ui.getHealthClass()}`}>
            <div className="brain-wave" />
            <div className="brain-wave" />
            <div className="brain-wave" />
          </div>
        )}

        <ErrorBoundary>
          <Header
            onNewChat={actions.createNewSession}
            onOpenHistory={() => ui.setIsSessionListOpen(true)}
            activeFile={state.activeFile}
            zone={state.currentZone}
            currentSessionTitle={currentSessionTitle}
            settings={state.settings}
            availableModels={state.availableModels}
            onOpenSettings={() => ui.setIsSettingsOpen(true)}
            marieStatus={state.marieStatus}
            isLoadingModels={state.isLoadingModels}
            streamStage={stream.streamStage}
            completionPercent={stream.completionPercent}
          />
        </ErrorBoundary>

        <SessionList
          isOpen={ui.isSessionListOpen}
          onClose={() => ui.setIsSessionListOpen(false)}
          sessions={state.sessions}
          currentId={state.currentSessionId}
          onSelectSession={actions.switchSession}
          onDeleteSession={actions.removeSession}
          onCreateSession={actions.createNewSession}
          onRenameSession={actions.renameSession}
          onTogglePin={actions.togglePinSession}
          onClear={actions.requestClearSession}
          onOpenSettings={() => ui.setIsSettingsOpen(true)}
          onOpenVitality={() => ui.setIsVitalityOpen(true)}
          hasMessages={state.messages.length > 0}
        />

        {state.activeFile && (
          <div className="context-pin-overlay">
            <div className="context-pin-chip">
              <span className="pin-icon">📍</span>
              <span className="pin-text">Focused on: {state.activeFile}</span>
            </div>
          </div>
        )}

        <ErrorBoundary>
          <MessageList
            messages={state.messages}
            marieStatus={state.marieStatus}
            stream={stream}
            messagesListRef={messagesListRef}
            messagesEndRef={messagesEndRef}
            handleScroll={handleScroll}
            hasUnreadMessages={hasUnreadMessages}
            onSendMessage={actions.sendMessage}
            onNewSession={actions.createNewSession}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <LiveActivityArea
            streamStage={stream.streamStage}
            streamStartedAt={stream.streamStartedAt}
            stepCount={stream.stepCount}
            toolCount={stream.toolCount}
            currentStepLabel={stream.currentStepLabel}
            tokenUsage={stream.tokenUsage}
            completionPercent={stream.completionPercent}
            lifecycleStage={stream.lifecycleStage}
            ritualComplete={stream.ritualComplete}
            activeFilePath={stream.activeFilePath}
            reasoning={stream.reasoning}
            showProgressDetails={stream.showProgressDetails}
            progressObjectives={stream.progressObjectives}
            progressContext={stream.progressContext}
            approvalRequest={stream.approvalRequest}
            checkpoint={stream.checkpoint}
            runError={stream.runError}
            activeObjectiveId={stream.activeObjectiveId}
            achievements={stream.achievements}
            passHistory={stream.passHistory}
            gardenMetrics={stream.gardenMetrics}
            onToggleDetails={() => stream.setShowProgressDetails(!stream.showProgressDetails)}
            onApprovalRespond={stream.handleApprovalRespond}
          />
        </ErrorBoundary>

        <ScrollToBottom
          visible={showScrollButton}
          hasUnread={hasUnreadMessages}
          onClick={() => scrollToBottom(true)}
        />

        <ErrorBoundary>
          <InputArea
            onSend={actions.sendMessage}
            onStop={actions.handleStop}
            disabled={state.marieStatus !== 'idle'}
            isLoading={state.marieStatus === 'thinking' || state.marieStatus === 'responding'}
            placeholder={
              state.marieStatus === 'thinking' ? "Marie is thinking..." :
                state.marieStatus === 'responding' ? "Marie is responding..." :
                  "Ask Marie... (/help for commands)"
            }
          />
        </ErrorBoundary>

        <div className="toast-container">
          {state.toasts.map(toast => (
            <div key={toast.id} className="toast-item">
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;