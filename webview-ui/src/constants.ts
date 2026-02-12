export const QUICK_ACTIONS = {
    newSession: {
        prompt: "Start a fresh new session",
        icon: 'PlusIcon',
        title: "New Session"
    },
    explainCode: {
        prompt: "Explain the current code context",
        icon: 'MarieMascot',
        title: "Explain Code"
    },
    tidyFile: {
        prompt: "Help me tidy this file",
        icon: 'FoldIcon',
        title: "Tidy This"
    }
} as const;

export type QuickActionKey = keyof typeof QUICK_ACTIONS;
