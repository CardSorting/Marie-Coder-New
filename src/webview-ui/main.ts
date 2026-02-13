type UiMessage = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
};

type Session = {
    id: string;
    title: string;
    lastModified: number;
    isPinned: boolean;
};

type ApprovalRequest = {
    requestId: string;
    toolName: string;
    toolInput: unknown;
};

declare function acquireVsCodeApi(): {
    postMessage: (message: unknown) => void;
};

const vscode = acquireVsCodeApi();

const state: {
    messages: UiMessage[];
    sessions: Session[];
    currentSessionId: string;
    isLoading: boolean;
    streamingBuffer: string;
    pendingApproval: ApprovalRequest | null;
    config: { provider: string; model: string; autonomyMode: string; hasAnyApiKey: boolean };
} = {
    messages: [],
    sessions: [],
    currentSessionId: "default",
    isLoading: false,
    streamingBuffer: "",
    pendingApproval: null,
    config: {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        autonomyMode: "balanced",
        hasAnyApiKey: false,
    },
};

const app = document.getElementById("app")!;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function render() {
    const sessionItems = state.sessions
        .sort((a, b) => (Number(b.isPinned) - Number(a.isPinned)) || (b.lastModified - a.lastModified))
        .map((s) => {
            const active = s.id === state.currentSessionId ? "active" : "";
            return `<button data-action="load-session" data-id="${escapeHtml(s.id)}" class="session ${active}">
                <span>${s.isPinned ? "📌 " : ""}${escapeHtml(s.title || "New Session")}</span>
                <span class="muted">${new Date(s.lastModified).toLocaleDateString()}</span>
            </button>`;
        })
        .join("");

    const chat = state.messages
        .map((m) => {
            return `<div class="msg ${m.role}">
                <div class="role">${m.role === "assistant" ? "Marie" : m.role === "user" ? "You" : "System"}</div>
                <pre>${escapeHtml(m.content)}</pre>
            </div>`;
        })
        .join("");

    const streaming = state.streamingBuffer
        ? `<div class="msg assistant stream"><div class="role">Marie</div><pre>${escapeHtml(state.streamingBuffer)}</pre></div>`
        : "";

    const approval = state.pendingApproval
        ? `<div class="approval">
            <strong>Approval required</strong>
            <div>Tool: <code>${escapeHtml(state.pendingApproval.toolName)}</code></div>
            <pre>${escapeHtml(JSON.stringify(state.pendingApproval.toolInput, null, 2))}</pre>
            <div class="row">
                <button data-action="approve" data-approved="true">Approve</button>
                <button data-action="approve" data-approved="false">Deny</button>
            </div>
        </div>`
        : "";

    app.innerHTML = `
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
      .layout { display: grid; grid-template-columns: 240px 1fr; height: 100vh; }
      .left { border-right: 1px solid var(--vscode-panel-border); padding: 10px; overflow: auto; }
      .right { display: grid; grid-template-rows: auto 1fr auto; height: 100vh; }
      .top { padding: 10px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; justify-content: space-between; gap: 8px; }
      .muted { opacity: 0.7; font-size: 12px; }
      .stack { display: flex; flex-direction: column; gap: 8px; }
      .session { display: flex; justify-content: space-between; width: 100%; padding: 6px; border: 1px solid var(--vscode-panel-border); background: transparent; color: inherit; text-align: left; }
      .session.active { background: var(--vscode-list-activeSelectionBackground); }
      .chat { overflow: auto; padding: 12px; }
      .msg { margin-bottom: 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 8px; }
      .msg pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
      .msg.user { border-color: var(--vscode-button-background); }
      .role { font-size: 12px; opacity: 0.8; margin-bottom: 4px; }
      .composer { border-top: 1px solid var(--vscode-panel-border); padding: 10px; display: grid; grid-template-columns: 1fr auto; gap: 8px; }
      textarea { width: 100%; min-height: 60px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
      button, select { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 10px; cursor: pointer; }
      .secondary { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-panel-border); }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .approval { border-top: 1px solid var(--vscode-panel-border); padding: 10px; background: var(--vscode-editor-background); }
      .approval pre { max-height: 160px; overflow: auto; }
    </style>
    <div class="layout">
      <aside class="left stack">
        <div class="row">
          <button data-action="create-session">New</button>
          <button data-action="refresh-sessions" class="secondary">Refresh</button>
        </div>
        <div class="muted">Sessions</div>
        <div class="stack">${sessionItems || '<div class="muted">No sessions</div>'}</div>
      </aside>
      <main class="right">
        <header class="top">
          <div>
            <div><strong>Marie</strong> · ${escapeHtml(state.config.provider)} · ${escapeHtml(state.config.model)}</div>
            <div class="muted">Autonomy: ${escapeHtml(state.config.autonomyMode)}${state.isLoading ? " · Running…" : ""}</div>
          </div>
          <div class="row">
            <select data-action="autonomy-mode">
              <option value="balanced" ${state.config.autonomyMode === "balanced" ? "selected" : ""}>balanced</option>
              <option value="high" ${state.config.autonomyMode === "high" ? "selected" : ""}>high</option>
              <option value="yolo" ${state.config.autonomyMode === "yolo" ? "selected" : ""}>yolo</option>
            </select>
            <button data-action="clear-session" class="secondary">Clear</button>
            <button data-action="stop" class="secondary">Stop</button>
            <button data-action="settings" class="secondary">Settings</button>
          </div>
        </header>
        <section class="chat" id="chat">${chat}${streaming}</section>
        ${approval}
        <footer class="composer">
          <textarea id="input" placeholder="Ask Marie…"></textarea>
          <div class="stack">
            <button data-action="send" ${state.isLoading ? "disabled" : ""}>Send</button>
            <button data-action="models" class="secondary">Models</button>
          </div>
        </footer>
      </main>
    </div>`;

    const chatContainer = document.getElementById("chat");
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(role: UiMessage["role"], content: string) {
    state.messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        timestamp: Date.now(),
    });
    render();
}

window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message?.type) {
        case "init_state":
            state.messages = Array.isArray(message.state?.messages) ? message.state.messages : [];
            state.config = message.state?.config || state.config;
            state.currentSessionId = message.state?.currentSessionId || state.currentSessionId;
            state.streamingBuffer = "";
            render();
            return;
        case "sessions":
            state.sessions = Array.isArray(message.sessions) ? message.sessions : [];
            state.currentSessionId = message.currentSessionId || state.currentSessionId;
            render();
            return;
        case "status":
            state.isLoading = Boolean(message.isLoading);
            if (!state.isLoading && state.streamingBuffer) {
                addMessage("assistant", state.streamingBuffer);
                state.streamingBuffer = "";
            }
            render();
            return;
        case "user_echo":
            addMessage("user", String(message.text || ""));
            return;
        case "message_stream":
            state.streamingBuffer += String(message.chunk || "");
            render();
            return;
        case "assistant_response":
            if (!state.streamingBuffer) {
                addMessage("assistant", String(message.text || ""));
            }
            return;
        case "runtime_event": {
            const runtimeEvent = message.event;
            if (runtimeEvent?.type === "approval_request") {
                state.pendingApproval = {
                    requestId: runtimeEvent.requestId,
                    toolName: runtimeEvent.toolName,
                    toolInput: runtimeEvent.toolInput,
                };
                render();
                return;
            }
            if (runtimeEvent?.type === "run_error") {
                addMessage("system", `Error: ${runtimeEvent.message || "Unknown error"}`);
                return;
            }
            return;
        }
        case "tool_event":
            addMessage("system", `Tool: ${message.tool?.name || "unknown"}`);
            return;
        case "models":
            addMessage(
                "system",
                `Available models:\n${(message.models || []).map((m: any) => `- ${m.id || m.name || String(m)}`).join("\n")}`
            );
            return;
        case "config":
            state.config = message.config || state.config;
            render();
            return;
        case "error":
            addMessage("system", String(message.message || "Unknown error"));
            return;
        default:
            return;
    }
});

app.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute("data-action");
    if (!action) return;

    if (action === "send") {
        const input = document.getElementById("input") as HTMLTextAreaElement | null;
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        vscode.postMessage({ type: "send_message", text });
        return;
    }

    if (action === "create-session") {
        vscode.postMessage({ type: "create_session" });
        return;
    }

    if (action === "refresh-sessions") {
        vscode.postMessage({ type: "list_sessions" });
        return;
    }

    if (action === "load-session") {
        const id = target.getAttribute("data-id");
        if (id) vscode.postMessage({ type: "load_session", id });
        return;
    }

    if (action === "clear-session") {
        vscode.postMessage({ type: "clear_session" });
        return;
    }

    if (action === "stop") {
        vscode.postMessage({ type: "stop_generation" });
        return;
    }

    if (action === "settings") {
        vscode.postMessage({ type: "open_settings" });
        return;
    }

    if (action === "models") {
        vscode.postMessage({ type: "get_models" });
        return;
    }

    if (action === "approve") {
        if (state.pendingApproval) {
            const approved = target.getAttribute("data-approved") === "true";
            vscode.postMessage({
                type: "approve_tool",
                requestId: state.pendingApproval.requestId,
                approved,
            });
            state.pendingApproval = null;
            render();
        }
        return;
    }
});

app.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    const action = target.getAttribute("data-action");
    if (action === "autonomy-mode") {
        vscode.postMessage({ type: "set_autonomy_mode", mode: target.value });
    }
});

app.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLTextAreaElement && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const text = event.target.value.trim();
        if (!text) return;
        event.target.value = "";
        vscode.postMessage({ type: "send_message", text });
    }
});

render();
vscode.postMessage({ type: "ready" });
vscode.postMessage({ type: "list_sessions" });