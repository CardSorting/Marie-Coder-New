import { useState, useEffect, useCallback } from 'react';
import { simpleGit } from 'simple-git';
import { GitStatus } from '../types/cli.js';

interface UseGitOptions {
    workingDir: string;
}

export function useGit(options: UseGitOptions) {
    const { workingDir } = options;
    const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
    const [lastCheckpoint, setLastCheckpoint] = useState<string | null>(null);

    const refreshGitStatus = useCallback(async () => {
        try {
            const git = simpleGit(workingDir);
            const status = await git.status();
            const branch = await git.branch();

            setGitStatus({
                branch: branch.current,
                isClean: status.isClean(),
                ahead: status.ahead,
                behind: status.behind,
                modified: status.modified,
                staged: status.staged,
            });
        } catch {
            // Not a git repo or error
            setGitStatus(null);
        }
    }, [workingDir]);

    useEffect(() => {
        refreshGitStatus();
        const interval = setInterval(refreshGitStatus, 5000);
        return () => clearInterval(interval);
    }, [refreshGitStatus]);

    const createCheckpoint = useCallback(async (message?: string) => {
        try {
            const git = simpleGit(workingDir);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const commitMessage = message || `marie-checkpoint-${timestamp}`;

            await git.add('.');
            const result = await git.commit(commitMessage);

            setLastCheckpoint(result.commit);
            await refreshGitStatus();

            return result.commit;
        } catch (error) {
            console.error('Checkpoint failed:', error);
            return null;
        }
    }, [workingDir, refreshGitStatus]);

    const undoLastCommit = useCallback(async () => {
        try {
            const git = simpleGit(workingDir);

            // Check if last commit was a marie checkpoint
            const log = await git.log({ maxCount: 1 });
            const lastCommit = log.latest;

            if (!lastCommit?.message.startsWith('marie-checkpoint')) {
                return { success: false, error: 'Last commit is not a Marie checkpoint' };
            }

            // Soft reset to keep changes
            await git.reset(['--soft', 'HEAD~1']);
            await refreshGitStatus();

            return { success: true, commit: lastCommit.hash };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }, [workingDir, refreshGitStatus]);

    const hasUncommittedChanges = useCallback(async () => {
        try {
            const git = simpleGit(workingDir);
            const status = await git.status();
            return !status.isClean();
        } catch {
            return false;
        }
    }, [workingDir]);

    return {
        gitStatus,
        lastCheckpoint,
        refreshGitStatus,
        createCheckpoint,
        undoLastCommit,
        hasUncommittedChanges,
    };
}
