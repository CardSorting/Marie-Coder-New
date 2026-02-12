export { };

interface VSCodeAPI {
    postMessage: (message: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
}

declare global {
    const vscode: VSCodeAPI;
}
