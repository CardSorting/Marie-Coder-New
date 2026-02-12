import React from 'react';
import { Box, Text } from 'ink';
import { marieTheme } from '../styles/theme.js';

interface BannerProps {
    show?: boolean;
}

export const Banner: React.FC<BannerProps> = ({ show = true }) => {
    if (!show) return null;

    return (
        <Box flexDirection="column" alignItems="center" marginY={1}>
            {/* Claude Code inspired artistic banner */}
            <Box flexDirection="column" alignItems="center">
                <Text color={marieTheme.colors.primary}>
                    {'    ╭──────────────────────────────────────────────╮'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │                                              │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │   ███╗   ███╗ █████╗ ██████╗ ██╗███████╗   │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │   ████╗ ████║██╔══██╗██╔══██╗██║██╔════╝   │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │   ██╔████╔██║███████║██████╔╝██║█████╗     │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │   ██║╚██╔╝██║██╔══██║██╔══██╗██║██╔══╝     │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │   ██║ ╚═╝ ██║██║  ██║██║  ██║██║███████╗   │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │   ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝   │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │                                              │'}
                </Text>
                <Text color={marieTheme.colors.secondary}>
                    {'    │      ✦  AI Coding Assistant  ✦              │'}
                </Text>
                <Text color={marieTheme.colors.muted}>
                    {'    │         v0.2.0 · Ready to help              │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    │                                              │'}
                </Text>
                <Text color={marieTheme.colors.primary}>
                    {'    ╰──────────────────────────────────────────────╯'}
                </Text>
            </Box>

            {/* Decorative elements */}
            <Box marginTop={1}>
                <Text color={marieTheme.colors.muted}>
                    {'  ════════════════════════════════════════════════════  '}
                </Text>
            </Box>
        </Box>
    );
};

// Alternative compact banner for smaller screens
export const CompactBanner: React.FC = () => {
    return (
        <Box flexDirection="column" alignItems="center" marginY={1}>
            <Text color={marieTheme.colors.primary} bold>
                {'╔══════════════════════════════════════════╗'}
            </Text>
            <Text color={marieTheme.colors.primary} bold>
                {'║  🌸  Marie  ·  AI Coding Assistant  🌸  ║'}
            </Text>
            <Text color={marieTheme.colors.muted}>
                {'╚══════════════════════════════════════════╝'}
            </Text>
        </Box>
    );
};

// Welcome banner with tips
export const WelcomeBanner: React.FC = () => {
    return (
        <Box flexDirection="column" alignItems="center" marginY={1}>
            <Banner />
            <Box flexDirection="column" alignItems="center" marginTop={1}>
                <Text color={marieTheme.colors.secondary}>
                    {'  Welcome! Type your message to start coding with AI.'}
                </Text>
                <Text color={marieTheme.colors.muted} dimColor>
                    {'  Tip: Use /help for commands, /config to change settings'}
                </Text>
            </Box>
        </Box>
    );
};
