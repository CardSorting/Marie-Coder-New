import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Storage } from '../../monolith/cli/storage.js';
import { marieTheme } from '../styles/theme.js';
import { Banner } from './Banner.js';

interface SetupWizardProps {
    onComplete: () => void;
}

type SetupStep = 'welcome' | 'provider' | 'apikey' | 'model' | 'customModel' | 'review' | 'complete';

const TOTAL_STEPS = 4;

const providers = [
    { label: '◈ Anthropic (Claude) - Best for coding', value: 'anthropic', description: 'Claude models, excellent code understanding' },
    { label: '◈ OpenRouter - Multi-provider access', value: 'openrouter', description: 'Access GPT, Claude, and more' },
    { label: '◈ Cerebras - Ultra-fast inference', value: 'cerebras', description: 'Llama models with fast response times' },
];

const anthropicModels = [
    { label: '★ Claude 3.5 Sonnet (Recommended)', value: 'claude-3-5-sonnet-20241022', description: 'Best balance of speed and capability' },
    { label: '○ Claude 3.5 Haiku (Fastest)', value: 'claude-3-5-haiku-20241022', description: 'Quick responses for simple tasks' },
    { label: '○ Claude 3 Opus (Most capable)', value: 'claude-3-opus-20240229', description: 'Maximum reasoning capability' },
    { label: '✏️  Enter custom model ID...', value: 'custom', description: 'Use latest or experimental models' },
];

const openrouterModels = [
    { label: '★ Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet', description: 'Via OpenRouter' },
    { label: '○ GPT-4o', value: 'openai/gpt-4o', description: 'Latest GPT-4 optimized' },
    { label: '○ GPT-4o Mini', value: 'openai/gpt-4o-mini', description: 'Fast and cost-effective' },
    { label: '✏️  Enter custom model ID...', value: 'custom', description: 'Any model available on OpenRouter' },
];

const cerebrasModels = [
    { label: '★ Llama 3.1 8B', value: 'llama3.1-8b', description: 'Fast and efficient' },
    { label: '○ Llama 3.1 70B', value: 'llama3.1-70b', description: 'More capable' },
    { label: '✏️  Enter custom model ID...', value: 'custom', description: 'Custom Cerebras model' },
];

function validateApiKey(key: string, provider: string): { valid: boolean; message?: string } {
    if (!key || key.length < 10) {
        return { valid: false, message: 'API key is too short (min 10 characters)' };
    }
    if (provider === 'anthropic' && !key.startsWith('sk-ant')) {
        return { valid: true }; // Allow various Anthropic key formats
    }
    if (provider === 'openrouter' && !key.startsWith('sk-or')) {
        return { valid: true }; // Allow various OpenRouter key formats
    }
    return { valid: true };
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const { exit } = useApp();
    const [step, setStep] = useState<SetupStep>('welcome');
    const [provider, setProvider] = useState<string>('');
    const [apiKey, setApiKey] = useState<string>('');
    const [model, setModel] = useState<string>('');
    const [customModelInput, setCustomModelInput] = useState<string>('');
    const [showKey, setShowKey] = useState(false);
    const [autonomyMode, setAutonomyMode] = useState<'balanced' | 'high' | 'yolo'>('yolo');
    const [validationError, setValidationError] = useState<string>('');
    const [currentStepNum, setCurrentStepNum] = useState(0);
    const [showHelp, setShowHelp] = useState(false);

    const goBack = useCallback(() => {
        setValidationError('');
        setShowHelp(false);
        if (step === 'provider') {
            setStep('welcome');
            setCurrentStepNum(0);
        } else if (step === 'apikey') {
            setStep('provider');
            setCurrentStepNum(1);
        } else if (step === 'model') {
            setStep('apikey');
            setCurrentStepNum(2);
        } else if (step === 'customModel') {
            setStep('model');
            setCurrentStepNum(3);
        } else if (step === 'review') {
            setStep('model');
            setCurrentStepNum(3);
        }
    }, [step]);

    const handleProviderSelect = useCallback((item: typeof providers[0]) => {
        setProvider(item.value);
        setStep('apikey');
        setCurrentStepNum(2);
    }, []);

    const handleApiKeySubmit = useCallback((value: string) => {
        const trimmed = value.trim();
        const validation = validateApiKey(trimmed, provider);
        if (!validation.valid) {
            setValidationError(validation.message || 'Invalid API key');
            return;
        }
        setApiKey(trimmed);
        setValidationError('');
        if (model && provider) {
            setStep('review');
            setCurrentStepNum(4);
        } else {
            setStep('model');
            setCurrentStepNum(3);
        }
    }, [provider, model]);

    const handleModelSelect = useCallback((item: typeof anthropicModels[0]) => {
        if (item.value === 'custom') {
            setStep('customModel');
        } else {
            setModel(item.value);
            setStep('review');
            setCurrentStepNum(4);
        }
    }, []);

    const handleCustomModelSubmit = useCallback((value: string) => {
        if (value.trim()) {
            setModel(value.trim());
            setStep('review');
            setCurrentStepNum(4);
        }
    }, []);

    const saveConfig = useCallback(() => {
        const config: Record<string, string> = {
            aiProvider: provider,
            model: model,
            autonomyMode,
        };
        if (provider === 'anthropic') {
            config.apiKey = apiKey;
        } else if (provider === 'openrouter') {
            config.openrouterApiKey = apiKey;
        } else if (provider === 'cerebras') {
            config.cerebrasApiKey = apiKey;
        }
        Storage.saveConfig(config);
        setStep('complete');
        setTimeout(() => {
            onComplete();
        }, 2000);
    }, [provider, apiKey, model, autonomyMode, onComplete]);

    const getApiKeyLabel = () => {
        switch (provider) {
            case 'anthropic': return 'Anthropic API Key';
            case 'openrouter': return 'OpenRouter API Key';
            case 'cerebras': return 'Cerebras API Key';
            default: return 'API Key';
        }
    };

    const getApiKeyHelp = () => {
        switch (provider) {
            case 'anthropic': return 'console.anthropic.com/settings/keys';
            case 'openrouter': return 'openrouter.com/keys';
            case 'cerebras': return 'cloud.cerebras.ai';
            default: return '';
        }
    };

    const getModels = () => {
        switch (provider) {
            case 'openrouter': return openrouterModels;
            case 'cerebras': return cerebrasModels;
            default: return anthropicModels;
        }
    };

    useInput((input, key) => {
        if (key.tab && step === 'apikey') {
            setShowKey(!showKey);
        }
        if (key.escape) {
            exit();
        }
        if (key.leftArrow && step !== 'welcome' && step !== 'complete') {
            goBack();
        }
        if (input === '?' && step !== 'welcome' && step !== 'complete') {
            setShowHelp(!showHelp);
        }
    });

    const progressBar = currentStepNum > 0 ? `[${'█'.repeat(currentStepNum)}${'░'.repeat(TOTAL_STEPS - currentStepNum)}]` : '';

    const HelpBox = () => (
        <Box flexDirection="column" marginTop={1} padding={1} borderStyle="single" borderColor={marieTheme.colors.info}>
            <Text color={marieTheme.colors.info} bold>Keyboard Shortcuts:</Text>
            <Text dimColor>• Enter/Return - Confirm selection</Text>
            <Text dimColor>• ↑/↓ - Navigate options</Text>
            <Text dimColor>• ← - Go back to previous step</Text>
            <Text dimColor>• Tab - Show/hide API key</Text>
            <Text dimColor>• ? - Toggle this help</Text>
            <Text dimColor>• Esc - Exit setup</Text>
        </Box>
    );

    return (
        <Box flexDirection="column" padding={1}>
            <Banner />

            {step !== 'welcome' && step !== 'complete' && (
                <Box marginBottom={1} justifyContent="space-between">
                    <Text color={marieTheme.colors.muted}>
                        Step {currentStepNum} of {TOTAL_STEPS} {progressBar}
                    </Text>
                    <Text color={marieTheme.colors.muted} dimColor>
                        Press ? for help
                    </Text>
                </Box>
            )}

            {step === 'welcome' && (
                <>
                    <Box marginBottom={1}>
                        <Text color={marieTheme.colors.primary} bold>
                            🌸 Welcome to Marie CLI
                        </Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text>
                            Your AI coding assistant is ready to set up.
                        </Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            Choose your AI provider to get started:
                        </Text>
                    </Box>
                    <SelectInput
                        items={providers.map(p => ({ label: p.label, value: p.value }))}
                        onSelect={(item) => {
                            const prov = providers.find(p => p.value === item.value)!;
                            handleProviderSelect(prov);
                        }}
                    />
                    <Box marginTop={1}>
                        <Text dimColor>
                            Tip: Anthropic (Claude) is recommended for coding tasks
                        </Text>
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            (Press Esc to quit, ? for help)
                        </Text>
                    </Box>
                    {showHelp && <HelpBox />}
                </>
            )}

            {step === 'provider' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Step 1: Choose your AI provider</Text>
                    </Box>
                    <SelectInput
                        items={providers.map(p => ({ label: p.label, value: p.value }))}
                        onSelect={(item) => {
                            const prov = providers.find(p => p.value === item.value)!;
                            handleProviderSelect(prov);
                        }}
                    />
                    <Box marginTop={1}>
                        <Text dimColor>
                            Tip: Anthropic (Claude) is recommended for coding tasks
                        </Text>
                    </Box>
                    {showHelp && <HelpBox />}
                </>
            )}

            {step === 'apikey' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Step 2: Enter your {getApiKeyLabel()}</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            Get your API key from: {getApiKeyHelp()}
                        </Text>
                    </Box>
                    {validationError && (
                        <Box marginBottom={1}>
                            <Text color={marieTheme.colors.error}>
                                ⚠️  {validationError}
                            </Text>
                        </Box>
                    )}
                    <Box>
                        <TextInput
                            value={apiKey}
                            onChange={(val) => { setApiKey(val); setValidationError(''); }}
                            onSubmit={handleApiKeySubmit}
                            mask={showKey ? undefined : '*'}
                            placeholder="Paste your API key here..."
                        />
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Tab to {showKey ? 'hide' : 'show'} • Enter to continue • ← Back • ? Help • Esc Quit
                        </Text>
                    </Box>
                    {showHelp && <HelpBox />}
                </>
            )}

            {step === 'model' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Step 3: Select your model</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            Choose a model for {provider}:
                        </Text>
                    </Box>
                    <SelectInput
                        items={getModels().map(m => ({ label: m.label, value: m.value }))}
                        onSelect={handleModelSelect}
                    />
                    <Box marginTop={1}>
                        <Text dimColor>
                            ★ Recommended • ○ Alternative • ✏️ Custom
                        </Text>
                    </Box>
                    {showHelp && <HelpBox />}
                </>
            )}

            {step === 'customModel' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Step 3: Enter custom model ID</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            Enter the exact model identifier from your provider's documentation.
                        </Text>
                    </Box>
                    <Box marginBottom={1} flexDirection="column">
                        <Text color={marieTheme.colors.info}>Examples:</Text>
                        <Text dimColor>  • claude-3-opus-20240229</Text>
                        <Text dimColor>  • gpt-4-turbo-preview</Text>
                        <Text dimColor>  • anthropic/claude-3.5-sonnet</Text>
                    </Box>
                    <Box>
                        <TextInput
                            value={customModelInput}
                            onChange={setCustomModelInput}
                            onSubmit={handleCustomModelSubmit}
                            placeholder="model-identifier"
                        />
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Enter to confirm • ← Back • ? Help • Esc Quit
                        </Text>
                    </Box>
                    {showHelp && <HelpBox />}
                </>
            )}

            {step === 'review' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Step 4: Review your settings</Text>
                    </Box>
                    <Box flexDirection="column" marginY={1} padding={1} borderStyle="round" borderColor={marieTheme.colors.secondary}>
                        <Text><Text bold>Provider:</Text> {provider}</Text>
                        <Text><Text bold>Model:</Text> {model}</Text>
                        <Text><Text bold>API Key:</Text> {apiKey ? '••••••••' + apiKey.slice(-4) : 'Not set'}</Text>
                        <Text><Text bold>Autonomy:</Text> {autonomyMode.toUpperCase()}</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>Agent Autonomy:</Text>
                    </Box>
                    <SelectInput
                        items={[
                            { label: 'Balanced (ask before risky actions)', value: 'balanced' },
                            { label: 'High (auto-approve most actions)', value: 'high' },
                            { label: 'Full YOLO (auto-approve all actions)', value: 'yolo' },
                        ]}
                        onSelect={(item) => setAutonomyMode(item.value as 'balanced' | 'high' | 'yolo')}
                    />
                    <Box marginTop={1}>
                        <Text>Is this correct?</Text>
                    </Box>
                    <SelectInput
                        items={[
                            { label: '✅ Yes, save and continue', value: 'save' },
                            { label: '✏️  No, go back and edit', value: 'back' },
                        ]}
                        onSelect={(item) => {
                            if (item.value === 'save') {
                                saveConfig();
                            } else {
                                goBack();
                            }
                        }}
                    />
                    {showHelp && <HelpBox />}
                </>
            )}

            {step === 'complete' && (
                <Box flexDirection="column" alignItems="center">
                    <Text color={marieTheme.colors.success} bold>
                        ✅ Setup Complete!
                    </Text>
                    <Box marginTop={1} flexDirection="column" alignItems="center">
                        <Text>
                            Provider: <Text bold color={marieTheme.colors.primary}>{provider}</Text>
                        </Text>
                        <Text>
                            Model: <Text bold color={marieTheme.colors.primary}>{model}</Text>
                        </Text>
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Settings saved to ~/.marie/config.json
                        </Text>
                    </Box>
                    <Box marginTop={2}>
                        <Text color={marieTheme.colors.secondary}>
                            Starting Marie CLI...
                        </Text>
                    </Box>
                </Box>
            )}
        </Box>
    );
};
