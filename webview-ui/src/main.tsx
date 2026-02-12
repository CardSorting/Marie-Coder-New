import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// STABILITY: Global error tracking for unhandled exceptions outside React
window.addEventListener('error', (event) => {
  import('./utils/vscode').then(({ vscode }) => {
    vscode.postMessage({
      type: 'error',
      value: {
        message: event.message,
        stack: event.error?.stack
      }
    });
  }).catch(() => { });
});

window.addEventListener('unhandledrejection', (event) => {
  import('./utils/vscode').then(({ vscode }) => {
    vscode.postMessage({
      type: 'error',
      value: {
        message: `Unhandled Promise Rejection: ${event.reason?.message || event.reason}`,
        stack: event.reason?.stack
      }
    });
  }).catch(() => { });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
