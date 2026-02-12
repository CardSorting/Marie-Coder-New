import type { WebviewToExtensionMessage } from '../types';

/**
 * Utility to manage VS Code API access.
 * Ensures acquireVsCodeApi is only called once.
 */

interface VSCodeAPI {
    postMessage(message: WebviewToExtensionMessage): void;
    getState<T = unknown>(): T | undefined;
    setState<T = unknown>(state: T): void;
}

declare global {
    interface Window {
        acquireVsCodeApi(): VSCodeAPI;
        vscode?: VSCodeAPI;
    }
}

class VSCode implements VSCodeAPI {
    private static instance: VSCode;
    private api: VSCodeAPI;

    private constructor() {
        if (typeof window.acquireVsCodeApi === 'function') {
            // Check if we already have it in window (some setups might attach it manually, or this is a reload)
            if (window.vscode) {
                this.api = window.vscode;
            } else {
                this.api = window.acquireVsCodeApi();
                window.vscode = this.api; // Cache it globally just in case
            }
        } else {
            // Mock for development in browser
            this.api = {
                postMessage: (msg: WebviewToExtensionMessage) => console.log('VSCode Mock postMessage:', msg),
                getState: <T>() => undefined as T | undefined,
                setState: (state: unknown) => console.log('VSCode Mock setState:', state)
            };
        }
    }

    public static getInstance(): VSCode {
        if (!VSCode.instance) {
            VSCode.instance = new VSCode();
        }
        return VSCode.instance;
    }

    public postMessage(message: WebviewToExtensionMessage): void {
        this.api.postMessage(message);
    }

    public getState<T = unknown>(): T | undefined {
        return this.api.getState();
    }

    public setState<T = unknown>(state: T): void {
        this.api.setState(state);
    }
}

export const vscode = VSCode.getInstance();
