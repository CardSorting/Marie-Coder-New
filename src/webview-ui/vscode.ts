declare function acquireVsCodeApi(): {
    postMessage: (message: unknown) => void
}

export const vscode =
    typeof acquireVsCodeApi === "function"
        ? acquireVsCodeApi()
        : { postMessage: (_message: unknown) => undefined }
