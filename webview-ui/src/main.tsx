// Entry point - minimal
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Error handling
window.addEventListener('error', (e) => {
  console.error('[Webview Error]', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Webview Rejection]', e.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
