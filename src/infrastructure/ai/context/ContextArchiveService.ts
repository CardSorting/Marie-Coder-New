import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AnchoredContext {
    id: string;
    label: string;
    content: string;
    type: 'snippet' | 'symbol' | 'file_ref';
    timestamp: number;
}

/**
 * Manages "anchored" context for Marie, providing a stable memory for critical information.
 */
export class ContextArchiveService {
    private static instance: ContextArchiveService;
    private anchors: Map<string, AnchoredContext> = new Map();
    private ready: Promise<void>;
    private saveQueue: Promise<void> = Promise.resolve();

    private static context: vscode.ExtensionContext;

    private constructor() {
        this.ready = this.loadFromDisk();
    }

    public static init(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public async awaitReady(): Promise<void> {
        return this.ready;
    }

    public static getInstance(): ContextArchiveService {
        if (!ContextArchiveService.instance) {
            ContextArchiveService.instance = new ContextArchiveService();
        }
        return ContextArchiveService.instance;
    }

    private async loadFromDisk(): Promise<void> {
        if (!ContextArchiveService.context) return;

        const storageUri = ContextArchiveService.context.storageUri;
        if (!storageUri) return;

        const memoryPath = path.join(storageUri.fsPath, 'marie_memory.json');

        try {
            // Ensure storage directory exists
            await fs.mkdir(storageUri.fsPath, { recursive: true });

            const data = await fs.readFile(memoryPath, 'utf-8');
            const parsed = JSON.parse(data);
            this.anchors = new Map(Object.entries(parsed));
        } catch (e) {
            // Check for migration from workspace root
            await this.migrateFromWorkspaceRoot(memoryPath);
        }
    }

    private async migrateFromWorkspaceRoot(newPath: string): Promise<void> {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) return;

        const oldPath = path.join(root, '.marie_memory.json');
        try {
            const data = await fs.readFile(oldPath, 'utf-8');
            const parsed = JSON.parse(data);
            this.anchors = new Map(Object.entries(parsed));

            // Save to new location immediately
            const serialized = JSON.stringify(Object.fromEntries(this.anchors.entries()), null, 2);
            await fs.writeFile(newPath, serialized);

            // Optional: delete old file? Let's leave it for now but maybe rename it to .marie_memory.json.bak
            await fs.rename(oldPath, oldPath + '.bak');
            console.log(`[ContextArchiveService] Migrated memory from ${oldPath} to ${newPath}`);
        } catch (err) {
            // No old file to migrate
        }
    }

    private async saveToDisk(): Promise<void> {
        if (!ContextArchiveService.context) return;
        const storageUri = ContextArchiveService.context.storageUri;
        if (!storageUri) return;

        const memoryPath = path.join(storageUri.fsPath, 'marie_memory.json');

        try {
            await fs.mkdir(storageUri.fsPath, { recursive: true });
            const data = JSON.stringify(Object.fromEntries(this.anchors.entries()), null, 2);
            await fs.writeFile(memoryPath, data);
        } catch (e) {
            console.error("Failed to save strategic memory", e);
        }
    }

    /**
     * Anchors a new piece of context.
     */
    /**
     * Anchors a new piece of context. Safe to call anytime; awaits initialization if needed.
     */
    public async anchor(anchor: Omit<AnchoredContext, 'timestamp'>): Promise<void> {
        await this.ready;
        this.anchors.set(anchor.id, {
            ...anchor,
            timestamp: Date.now()
        });
        this.queueSave();
    }

    private queueSave() {
        this.saveQueue = this.saveQueue.then(() => this.saveToDisk()).catch(e => console.error("Save queue error:", e));
    }

    /**
     * Retrieves all anchored context as a formatted string for the AI.
     */
    public getAllAnchors(): string {
        if (this.anchors.size === 0) {
            return "No context is currently anchored.";
        }

        const parts: string[] = ["# ⚓ Anchored Strategic Context\n\n"];
        const sortedAnchors = Array.from(this.anchors.values()).sort((a, b) => b.timestamp - a.timestamp);

        for (const anchor of sortedAnchors) {
            parts.push(`### ${anchor.label} (${anchor.type})\n`);
            parts.push(`ID: \`${anchor.id}\` | Time: ${new Date(anchor.timestamp).toLocaleTimeString()}\n`);
            parts.push(`\`\`\`\n${anchor.content}\n\`\`\`\n\n`);
        }

        return parts.join('');
    }

    /**
     * Removes an anchor by ID.
     */
    public async release(id: string): Promise<boolean> {
        await this.ready;
        const deleted = this.anchors.delete(id);
        if (deleted) this.queueSave();
        return deleted;
    }
}
