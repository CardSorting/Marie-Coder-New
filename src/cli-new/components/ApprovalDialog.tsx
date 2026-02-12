import React from 'react';
import { Box, Text, useInput } from 'ink';
import { marieTheme } from '../styles/theme.js';
import { ApprovalRequest } from '../types/cli.js';

interface ApprovalDialogProps {
    request: ApprovalRequest;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({ request }) => {
    const isDestructive = ['write_file', 'delete_file', 'replace_in_file', 'run_command'].includes(request.toolName);

    useInput((input) => {
        if (input === 'y' || input === 'Y') {
            request.resolve(true);
        } else if (input === 'n' || input === 'N' || input === '\u0003') {
            request.resolve(false);
        }
    });

    const formatToolInput = () => {
        const input = request.toolInput;
        if (input.path || input.file) {
            return `Path: ${input.path || input.file}`;
        }
        if (input.command) {
            return `Command: ${input.command}`;
        }
        return JSON.stringify(input, null, 2).slice(0, 200);
    };

    return (
        <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={isDestructive ? marieTheme.colors.warning : marieTheme.colors.info}
            paddingX={2}
            paddingY={1}
            marginY={1}
        >
            <Box marginBottom={1}>
                <Text
                    bold
                    color={isDestructive ? marieTheme.colors.warning : marieTheme.colors.info}
                >
                    {isDestructive ? marieTheme.icons.warning : marieTheme.icons.info}
                    {' '}Approval Required
                </Text>
            </Box>

            <Box marginBottom={1}>
                <Text color={marieTheme.colors.foreground}>
                    Tool: <Text bold>{request.toolName}</Text>
                </Text>
            </Box>

            <Box
                borderStyle="single"
                borderColor={marieTheme.colors.border}
                paddingX={1}
                marginBottom={1}
            >
                <Text color={marieTheme.colors.muted}>{formatToolInput()}</Text>
            </Box>

            {request.diff && (
                <Box
                    flexDirection="column"
                    borderStyle="single"
                    borderColor={marieTheme.colors.secondary}
                    paddingX={1}
                    marginBottom={1}
                >
                    <Text color={marieTheme.colors.secondary} bold>Preview:</Text>
                    <Text color={marieTheme.colors.muted}>
                        {request.diff.old.slice(0, 100)}...
                    </Text>
                    <Text color={marieTheme.colors.success}>
                        → {request.diff.new.slice(0, 100)}...
                    </Text>
                </Box>
            )}

            <Box marginTop={1} gap={3}>
                <Text color={marieTheme.colors.success}>
                    Y - Approve
                </Text>
                <Text color={marieTheme.colors.error}>
                    N - Reject
                </Text>
            </Box>
        </Box>
    );
};
