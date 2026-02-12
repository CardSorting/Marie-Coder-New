import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("[Marie UI] Uncaught error:", error, errorInfo);
        // STABILITY: Report error back to extension host for centralized logging
        import('../utils/vscode').then(({ vscode }) => {
            vscode.postMessage({
                type: 'error',
                value: {
                    message: error.message || 'Unknown Error',
                    stack: error.stack ?? undefined,
                    componentStack: errorInfo.componentStack ?? undefined
                }
            });
        }).catch(() => {
            // Fallback if import fails
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '20px',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    backgroundColor: 'var(--vscode-sideBar-background)',
                    color: 'var(--vscode-errorForeground)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🍂</div>
                    <h1 style={{ fontSize: '18px', marginBottom: '10px' }}>Marie is experiencing a moment of turbulence.</h1>
                    <p style={{ opacity: 0.8, fontSize: '13px', marginBottom: '20px' }}>
                        An unexpected UI error occurred. Marie is still with you, but the interface needs a refresh.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Refresh Interface ✨
                    </button>
                    <details style={{ marginTop: '20px', textAlign: 'left', width: '100%', opacity: 0.5 }}>
                        <summary style={{ fontSize: '11px', cursor: 'pointer' }}>Technical details</summary>
                        <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                            {this.state.error?.message}
                        </pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
