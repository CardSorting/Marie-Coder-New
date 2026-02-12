import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { Storage } from '../../cli/storage.js';
import { marieTheme } from '../styles/theme.js';
import { Banner } from './Banner.js';

interface SetupWizardProps {
    onComplete: () => void;
}

type SetupStep = 'provider' | 'apikey' | 'model' | 'customModel' | 'complete';

const providers = [
    { label: 'Anthropic (Claude)', value: 'anthropic' },
    { label: 'OpenRouter (Multiple models)', value: 'openrouter' },
    { label: 'Cerebras', value: 'cerebras' },
];

// Just a few popular examples - users can enter any model
const anthropicExamples = [
    { label: 'Claude 3.5 Sonnet (Recommended)', value: 'claude-3-5-sonnet-20241022' },
    { label: 'Claude 3.5 Haiku (Fast)', value: 'claude-3-5-haiku-20241022' },
    { label: 'Claude 3 Opus (Powerful)', value: 'claude-3-opus-20240229' },
    { label: '✏️  Enter custom model ID...', value: 'custom' },
];

const openrouterExamples = [
    { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'GPT-4o', value: 'openai/gpt-4o' },
    { label: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
    { label: '✏️  Enter custom model ID...', value: 'custom' },
];

const cerebrasExamples = [
    { label: 'Llama 3.1 8B', value: 'llama3.1-8b' },
    { label: 'Llama 3.1 70B', value: 'llama3.1-70b' },
    { label: '✏️  Enter custom model ID...', value: 'custom' },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const { exit } = useApp();
    const [step, setStep] = useState<SetupStep>('provider');
    const [provider, setProvider] = useState<string>('anthropic');
    const [apiKey, setApiKey] = useState<string>('');
    const [model, setModel] = useState<string>('');
    const [customModelInput, setCustomModelInput] = useState<string>('');
    const [showKey, setShowKey] = useState(false);

    const handleProviderSelect = useCallback((item: { value: string }) => {
        setProvider(item.value);
        setStep('apikey');
    }, []);

    const handleApiKeySubmit = useCallback((value: string) => {
        if (value.trim()) {
            setApiKey(value.trim());
            setStep('model');
        }
    }, []);

    const handleModelSelect = useCallback((item: { value: string; label: string }) => {
        if (item.value === 'custom') {
            setStep('customModel');
        } else {
            saveConfig(item.value);
        }
    }, [provider, apiKey, onComplete]);

    const handleCustomModelSubmit = useCallback((value: string) => {
        if (value.trim()) {
            saveConfig(value.trim());
        }
    }, [provider, apiKey, onComplete]);

    const saveConfig = useCallback((selectedModel: string) => {
        setModel(selectedModel);
        // Save configuration
        const config: Record<string, string> = {
            aiProvider: provider,
            model: selectedModel,
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
        // Give user time to see the completion message
        setTimeout(() => {
            onComplete();
        }, 2000);
    }, [provider, apiKey, onComplete]);

    const getApiKeyLabel = () => {
        switch (provider) {
            case 'anthropic':
                return 'Anthropic API Key';
            case 'openrouter':
                return 'OpenRouter API Key';
            case 'cerebras':
                return 'Cerebras API Key';
            default:
                return 'API Key';
        }
    };

    const getApiKeyHelp = () => {
        switch (provider) {
            case 'anthropic':
                return 'Get your key at: console.anthropic.com';
            case 'openrouter':
                return 'Get your key at: openrouter.com/keys';
            case 'cerebras':
                return 'Get your key at: cloud.cerebras.ai';
            default:
                return '';
        }
    };

    const getModels = () => {
        switch (provider) {
            case 'openrouter':
                return openrouterExamples;
            case 'cerebras':
                return cerebrasExamples;
            default:
                return anthropicExamples;
        }
    };

    useInput((input, key) => {
        if (key.tab && step === 'apikey') {
            setShowKey(!showKey);
        }
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Banner />
            <Box marginBottom={1}>
                <Text color={marieTheme.colors.primary} bold>
                    🌸 Initial Setup
                </Text>
            </Box>

            {step === 'provider' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Select your AI provider:</Text>
                    </Box>
                    <SelectInput
                        items={providers}
                        onSelect={handleProviderSelect}
                    />
                    <Box marginTop={1}>
                        <Text dimColor>
                            This determines which API to use for AI requests.
                        </Text>
                    </Box>
                </>
            )}

            {step === 'apikey' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Enter your {getApiKeyLabel()}:</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            {getApiKeyHelp()}
                        </Text>
                    </Box>
                    <Box>
                        <TextInput
                            value={apiKey}
                            onChange={setApiKey}
                            onSubmit={handleApiKeySubmit}
                            mask={showKey ? undefined : '*'}
                            placeholder="sk-..."
                        />
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Press Tab to {showKey ? 'hide' : 'show'} • Enter to continue • Esc to quit
                        </Text>
                    </Box>
                </>
            )}

            {step === 'model' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Select your model (or enter custom):</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            Popular options for {provider}:
                        </Text>
                    </Box>
                    <SelectInput
                        items={getModels()}
                        onSelect={handleModelSelect}
                    />
                    <Box marginTop={1}>
                        <Text dimColor>
                            Models change frequently. Choose "Enter custom" for latest models.
                        </Text>
                    </Box>
                </>
            )}

            {step === 'customModel' && (
                <>
                    <Box marginBottom={1}>
                        <Text bold>Enter the model ID:</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            Example: claude-3-opus-20240229, gpt-4-turbo, etc.
                        </Text>
                    </Box>
                    <Box>
                        <TextInput
                            value={customModelInput}
                            onChange={setCustomModelInput}
                            onSubmit={handleCustomModelSubmit}
                            placeholder="model-name"
                        />
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Enter the exact model identifier from your provider's docs
                        </Text>
                    </Box>
                </>
            )}

            {step === 'complete' && (
                <Box flexDirection="column">
                    <Text color={marieTheme.colors.success}>
                        ✅ Configuration saved!
                    </Text>
                    <Box marginTop={1}>
                        <Text>
                            Provider: <Text bold>{provider}</Text>
                        </Text>
                    </Box>
                    <Box>
                        <Text>
                            Model: <Text bold>{model}</Text>
                        </Text>
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>
                            Starting Marie...
                        </Text>
                    </Box>
                </Box>
            )}
        </Box>
    );
};
