import { ChildProcess } from 'child_process';

/**
 * ZOMBIE LIFECYCLE GUARD: ProcessRegistry
 * Tracks all active child processes and ensures they are killed when Marie is deactivated.
 */
export class ProcessRegistry {
    private static activeProcesses = new Set<ChildProcess>();

    public static register(process: ChildProcess) {
        this.activeProcesses.add(process);
        process.on('exit', () => {
            this.activeProcesses.delete(process);
        });
        process.on('error', () => {
            this.activeProcesses.delete(process);
        });
    }

    public static killAll() {
        console.log(`[MarieRegistry] Killing ${this.activeProcesses.size} active child processes...`);
        for (const process of this.activeProcesses) {
            try {
                if (!process.killed) {
                    process.kill('SIGKILL');
                }
            } catch (e) {
                console.error("[MarieRegistry] Failed to kill process:", e);
            }
        }
        this.activeProcesses.clear();
    }
}
