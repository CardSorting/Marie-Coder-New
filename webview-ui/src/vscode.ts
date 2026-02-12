// VS Code API wrapper - minimal singleton

interface VSCodeAPI {
    postMessage(message: any): void;
    getState<T = unknown>(): T | undefined;
    setState<T = unknown>(state: T): void;
}

declare global {
    interface Window {
        acquireVsCodeApi(): VSCodeAPI;
        vscode?: VSCodeAPI;
    }
}

const getVSCode = (): VSCodeAPI => {
    if (window.vscode) return window.vscode;
    if (typeof window.acquireVsCodeApi === 'function') {
        window.vscode = window.acquireVsCodeApi();
        return window.vscode;
    }
    // Mock for browser dev
    return {
        postMessage: (msg) => console.log('VSCode:', msg),
        getState: () => undefined,
        setState: (state) => console.log('State:', state)
    };
};

export const vscode = getVSCode();
