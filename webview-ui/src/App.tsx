// Minimal App component - replaces 27 component files

import { useState, useRef, useEffect } from 'react';
import { useMarie } from './useMarie';
import {
  Mascot, SendIcon, PlusIcon, HistoryIcon, SettingsIcon,
  CloseIcon, TrashIcon, EditIcon, PinIcon, StopIcon, UserIcon
} from './Icons';
import type { Settings } from './types';
import './styles.css';

// Simple markdown parser
const formatText = (text: string) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
};

export default function App() {
  const { state, actions } = useMarie();
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.marieStatus]);

  const handleSend = () => {
    if (!input.trim()) return;
    actions.sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <Mascot />
          <span className="header-title">
            {currentSession?.title || 'Marie Chat'}
            {state.activeFile && state.activeFile !== 'No active file' && (
              <small style={{ opacity: 0.6 }}>• {state.activeFile}</small>
            )}
          </span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={actions.createNewSession} title="New Chat">
            <PlusIcon />
          </button>
          <button className="icon-btn" onClick={() => actions.setIsSessionListOpen(true)} title="History">
            <HistoryIcon />
          </button>
          <button className="icon-btn" onClick={() => actions.setIsSettingsOpen(true)} title="Settings">
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="messages">
        {state.messages.length === 0 ? (
          <div className="welcome">
            <Mascot />
            <h2>How can I help you?</h2>
            <p>Type a message or use /help for commands</p>
          </div>
        ) : (
          state.messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role} ${msg.variant || ''}`}>
              <div className={`avatar ${msg.role}`}>
                {msg.role === 'marie' ? <Mascot /> : <UserIcon />}
              </div>
              <div>
                <div
                  className="bubble"
                  dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                />
                <div className="timestamp">{msg.timestamp}</div>
              </div>
            </div>
          ))
        )}
        {state.marieStatus === 'thinking' && (
          <div className="message marie thinking">
            <div className="avatar"><Mascot /></div>
            <div className="bubble">Thinking...</div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <div className={`status-indicator ${state.marieStatus}`} />
          <span>
            {state.marieStatus === 'idle' && 'Ready'}
            {state.marieStatus === 'thinking' && 'Thinking...'}
            {state.marieStatus === 'responding' && 'Responding...'}
            {state.marieStatus === 'error' && 'Error'}
          </span>
        </div>
        {state.streamStage !== 'idle' && state.completionPercent > 0 && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${state.completionPercent}%` }} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="input-area">
        <div className="input-container">
          <textarea
            ref={inputRef}
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Marie... (/help for commands)"
            rows={1}
          />
          {state.marieStatus !== 'idle' ? (
            <button className="send-btn" onClick={actions.handleStop} title="Stop">
              <StopIcon />
            </button>
          ) : (
            <button className="send-btn" onClick={handleSend} disabled={!input.trim()}>
              <SendIcon />
            </button>
          )}
        </div>
      </div>

      {/* Sidebar */}
      {state.isSessionListOpen && (
        <>
          <div className="sidebar-overlay" onClick={() => actions.setIsSessionListOpen(false)} />
          <aside className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">Sessions</span>
              <button className="icon-btn" onClick={() => actions.setIsSessionListOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <button className="new-chat-btn" onClick={actions.createNewSession}>
              <PlusIcon /> New Chat
            </button>
            <div className="session-list">
              {state.sessions.length === 0 ? (
                <div className="empty">No sessions</div>
              ) : (
                state.sessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${session.id === state.currentSessionId ? 'active' : ''}`}
                    onClick={() => actions.switchSession(session.id)}
                  >
                    {editingId === session.id ? (
                      <input
                        className="form-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => {
                          if (editTitle.trim()) actions.renameSession(session.id, editTitle);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editTitle.trim()) actions.renameSession(session.id, editTitle);
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span className="session-title">{session.isPinned ? '📌 ' : ''}{session.title}</span>
                        <div className="session-actions">
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.togglePinSession(session.id);
                            }}
                            title="Pin"
                          >
                            <PinIcon />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(session.id);
                              setEditTitle(session.title);
                            }}
                            title="Rename"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              actions.removeSession(session.id);
                            }}
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </>
      )}

      {/* Settings Modal */}
      {state.isSettingsOpen && (
        <div className="modal-overlay" onClick={() => actions.setIsSettingsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Settings</h3>
            </div>
            <div className="modal-body">
              <SettingsForm
                settings={state.settings}
                availableModels={state.availableModels}
                isLoadingModels={state.isLoadingModels}
                onSave={actions.saveSettings}
                onFetchModels={actions.fetchModels}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => actions.setIsSettingsOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {state.toasts.length > 0 && (
        <div className="toast-container">
          <div className="toast">{state.toasts[0].message}</div>
        </div>
      )}
    </div>
  );
}

// Settings Form Component
function SettingsForm({
  settings,
  availableModels,
  isLoadingModels,
  onSave,
  onFetchModels
}: {
  settings: Settings;
  availableModels: { id: string; name: string }[];
  isLoadingModels: boolean;
  onSave: (s: Settings) => void;
  onFetchModels: (p: 'anthropic' | 'openrouter' | 'cerebras') => void;
}) {
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    onFetchModels(local.aiProvider);
  }, [local.aiProvider]);

  return (
    <>
      <div className="form-group">
        <label className="form-label">AI Provider</label>
        <select
          className="form-select"
          value={local.aiProvider}
          onChange={(e) => setLocal({ ...local, aiProvider: e.target.value as any })}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openrouter">OpenRouter</option>
          <option value="cerebras">Cerebras</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">
          Model {isLoadingModels && '(loading...)'}
        </label>
        <select
          className="form-select"
          value={local.model}
          onChange={(e) => setLocal({ ...local, model: e.target.value })}
        >
          {availableModels.length === 0 ? (
            <option value={local.model}>{local.model}</option>
          ) : (
            availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))
          )}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">API Key</label>
        <input
          type="password"
          className="form-input"
          value={local.apiKey || ''}
          onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
          placeholder={`${local.aiProvider} API key`}
        />
      </div>

      <button className="btn btn-primary" onClick={() => onSave(local)}>
        Save Settings
      </button>
    </>
  );
}
