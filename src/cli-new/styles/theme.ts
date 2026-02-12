import { Theme } from '../types/cli.js';
import chalk from 'chalk';

export const marieTheme: Theme = {
    colors: {
        primary: '#C77DAA',      // Marie pink
        secondary: '#6B8E9F',    // Soft blue
        success: '#7CB87C',      // Sage green
        warning: '#D4A574',      // Warm amber
        error: '#C97B7B',        // Soft red
        info: '#7C9CB8',         // Steel blue
        muted: '#8B8B8B',        // Gray
        background: '#1A1A1A',   // Dark background
        foreground: '#E8E8E8',   // Light text
        border: '#3A3A3A',       // Border gray
    },
    icons: {
        assistant: '🌸',
        user: '›',
        tool: '⚡',
        file: '📄',
        folder: '📁',
        git: '⎇',
        spinner: '◐',
        success: '✓',
        warning: '⚠',
        error: '✗',
        info: 'ℹ',
        checkpoint: '◈',
        council: '🏛️',
    },
};

// Chalk color helpers
export const c = {
    primary: chalk.hex(marieTheme.colors.primary),
    secondary: chalk.hex(marieTheme.colors.secondary),
    success: chalk.hex(marieTheme.colors.success),
    warning: chalk.hex(marieTheme.colors.warning),
    error: chalk.hex(marieTheme.colors.error),
    info: chalk.hex(marieTheme.colors.info),
    muted: chalk.hex(marieTheme.colors.muted),
    dim: chalk.dim,
    bold: chalk.bold,
    italic: chalk.italic,
};

export const toolIcons: Record<string, string> = {
    read_file: '📖',
    write_file: '📝',
    delete_file: '🗑️',
    replace_in_file: '✏️',
    list_dir: '📂',
    grep_search: '🔍',
    run_command: '⚡',
    get_folder_structure: '🗂️',
    get_git_context: '⎇',
    perform_strategic_planning: '🕯️',
};

export function getToolIcon(toolName: string): string {
    return toolIcons[toolName] || marieTheme.icons.tool;
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}
