import { createRoot } from "react-dom/client"
import App from "./App.js"
import "./styles.css"

function getRootElement(): HTMLElement {
    const existing = document.getElementById("app")
    if (existing) return existing

    const element = document.createElement("div")
    element.id = "app"
    document.body.appendChild(element)
    return element
}

function showFatalError(error: unknown): void {
    const app = getRootElement()
    const message = error instanceof Error ? `${error.message}\n\n${error.stack || ""}` : String(error)
    app.innerHTML = `<pre style="padding:12px;white-space:pre-wrap;color:var(--vscode-errorForeground);">Webview failed to render:\n${message}</pre>`
}

try {
    createRoot(getRootElement()).render(<App />)
} catch (error) {
    showFatalError(error)
}
