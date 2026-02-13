import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class HealthService {
    public static async checkDependencies() {
        const diagnostics: string[] = [];

        // 1. Check ripgrep (rg)
        try {
            // Stability check: Set shell timeout to prevent hanging activation
            await execAsync('rg --version', { timeout: 5000 });
        } catch (e) {
            diagnostics.push('ripgrep (rg) is missing. Global search will be slow or disabled.');
        }

        // 2. Check fd
        try {
            await execAsync('fd --version', { timeout: 5000 });
        } catch (e) {
            diagnostics.push('fd is missing. File discovery will be slow.');
        }

        // 3. Check npm
        try {
            await execAsync('npm --version', { timeout: 5000 });
        } catch (e) {
            diagnostics.push('npm is missing. Building projects might fail.');
        }

        if (diagnostics.length > 0) {
            vscode.window.showWarningMessage(`Marie Stability Warning: ${diagnostics.join(' ')}`);
        } else {
            console.log('[MarieHealth] All planetary dependencies verified. 🌍');
        }
    }
}
