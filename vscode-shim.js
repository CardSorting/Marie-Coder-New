// VS Code API shim for CLI usage
// This provides minimal stub implementations for VS Code APIs used by the codebase

export const workspace = {
    workspaceFolders: null,
    getConfiguration: () => ({
        get: (key, defaultValue) => defaultValue,
        update: () => Promise.resolve()
    }),
    onDidChangeConfiguration: () => ({ dispose: () => { } }),
    onDidSaveTextDocument: () => ({ dispose: () => { } }),
    onDidOpenTextDocument: () => ({ dispose: () => { } }),
    onDidCloseTextDocument: () => ({ dispose: () => { } }),
    findFiles: () => Promise.resolve([]),
    openTextDocument: (uri) => Promise.resolve({
        getText: () => '',
        lineCount: 0,
        uri: typeof uri === 'string' ? { fsPath: uri } : uri,
        languageId: 'typescript'
    }),
    applyEdit: () => Promise.resolve(true),
    saveAll: () => Promise.resolve(true),
    fs: {
        readFile: () => Promise.resolve(Buffer.from('')),
        writeFile: () => Promise.resolve(),
        createDirectory: () => Promise.resolve(),
        stat: () => Promise.resolve({ type: 1 }),
        readDirectory: () => Promise.resolve([])
    }
};

export const window = {
    showInformationMessage: (...args) => {
        console.log('[INFO]', ...args.filter(a => typeof a === 'string'));
        return Promise.resolve(undefined);
    },
    showWarningMessage: (...args) => {
        console.warn('[WARN]', ...args.filter(a => typeof a === 'string'));
        return Promise.resolve(undefined);
    },
    showErrorMessage: (...args) => {
        console.error('[ERROR]', ...args.filter(a => typeof a === 'string'));
        return Promise.resolve(undefined);
    },
    showInputBox: () => Promise.resolve(undefined),
    showQuickPick: () => Promise.resolve(undefined),
    showOpenDialog: () => Promise.resolve(undefined),
    showSaveDialog: () => Promise.resolve(undefined),
    createOutputChannel: (name) => ({
        name,
        append: (value) => process.stdout.write(String(value)),
        appendLine: (value) => console.log(String(value)),
        clear: () => { },
        show: () => { },
        hide: () => { },
        dispose: () => { }
    }),
    createTerminal: (name) => ({
        name,
        sendText: (text) => console.log(`[Terminal ${name}] ${text}`),
        show: () => { },
        hide: () => { },
        dispose: () => { }
    }),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    onDidChangeActiveTextEditor: () => ({ dispose: () => { } }),
    onDidChangeVisibleTextEditors: () => ({ dispose: () => { } }),
    setStatusBarMessage: (text) => {
        console.log(`[Status] ${text}`);
        return { dispose: () => { } };
    },
    withProgress: async (options, task) => {
        return await task({
            report: (increment) => { }
        });
    }
};

export const commands = {
    registerCommand: (command, callback) => {
        return { dispose: () => { } };
    },
    executeCommand: () => Promise.resolve(),
    getCommands: () => Promise.resolve([])
};

export const extensions = {
    getExtension: () => undefined,
    all: []
};

export const Uri = {
    file: (path) => ({ scheme: 'file', fsPath: path, path }),
    parse: (uriString) => ({ scheme: 'file', fsPath: uriString, path: uriString })
};

export const Position = class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
};

export const Range = class Range {
    constructor(startLine, startChar, endLine, endChar) {
        this.start = new Position(startLine, startChar);
        this.end = new Position(endLine, endChar);
    }
};

export const Selection = class Selection extends Range {
    constructor(startLine, startChar, endLine, endChar) {
        super(startLine, startChar, endLine, endChar);
        this.anchor = this.start;
        this.active = this.end;
    }
};

export const TextEdit = class TextEdit {
    constructor(range, newText) {
        this.range = range;
        this.newText = newText;
    }
    static replace(range, newText) {
        return new TextEdit(range, newText);
    }
    static insert(position, newText) {
        return new TextEdit(new Range(position.line, position.character, position.line, position.character), newText);
    }
    static delete(range) {
        return new TextEdit(range, '');
    }
};

export const WorkspaceEdit = class WorkspaceEdit {
    constructor() {
        this._edits = [];
    }
    replace(uri, range, newText) {
        this._edits.push({ type: 'replace', uri, range, newText });
    }
    insert(uri, position, newText) {
        this._edits.push({ type: 'insert', uri, position, newText });
    }
    delete(uri, range) {
        this._edits.push({ type: 'delete', uri, range });
    }
    set(uri, edits) {
        this._edits.push({ type: 'set', uri, edits });
    }
    entries() {
        return this._edits;
    }
};

export const ProgressLocation = {
    Notification: 15,
    Window: 10
};

export const FileType = {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
};

export const FileSystemError = class FileSystemError extends Error {
    static FileNotFound(message) {
        return new FileSystemError(message || 'File not found');
    }
    static FileExists(message) {
        return new FileSystemError(message || 'File exists');
    }
    static FileNotADirectory(message) {
        return new FileSystemError(message || 'Not a directory');
    }
    static FileIsADirectory(message) {
        return new FileSystemError(message || 'Is a directory');
    }
    static NoPermissions(message) {
        return new FileSystemError(message || 'No permissions');
    }
    static Unavailable(message) {
        return new FileSystemError(message || 'Unavailable');
    }
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const ViewColumn = {
    One: 1,
    Two: 2,
    Three: 3,
    Beside: -2
};

export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
};

export const EndOfLine = {
    LF: 1,
    CRLF: 2
};

export const version = '1.85.0';

// Default export
export default {
    workspace,
    window,
    commands,
    extensions,
    Uri,
    Position,
    Range,
    Selection,
    TextEdit,
    WorkspaceEdit,
    ProgressLocation,
    FileType,
    FileSystemError,
    StatusBarAlignment,
    ViewColumn,
    ConfigurationTarget,
    EndOfLine,
    version
};
