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

type SetupStep = 'provider' | 'apikey' | 'model' | 'complete';

const providers = [
    { label: 'Anthropic (Claude)', value: 'anthropic' },
    { label: 'OpenRouter (Multiple models)', value: 'openrouter' },
    { label: 'Cerebras', value: 'cerebras' },
];

const anthropicModels = [
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
];

const openrouterModels = [
    { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'GPT-4o', value: 'openai/gpt-4o' },
    { label: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const { exit } = useApp();
    const [step, setStep] = useState<SetupStep>('provider');
    const [provider, setProvider] = useState<string>('anthropic');
    const [apiKey, setApiKey] = useState<string>('');
    const [model, setModel] = useState<string>('claude-3-5-sonnet-20241022');
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

    const handleModelSelect = useCallback((item: { value: string }) => {
        setModel(item.value);
        // Save configuration
        const config: Record<string, string> = {
            aiProvider: provider,
            model: item.value,
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

    const getApiKeyEnvVar = () => {
        switch (provider) {
            case 'anthropic':
                return 'ANTHROPIC_API_KEY';
            case 'openrouter':
                return 'OPENROUTER_API_KEY';
            case 'cerebras':
                return 'CEREBRAS_API_KEY';
            default:
                return 'API_KEY';
        }
    };

    const getModels = () => {
        switch (provider) {
            case 'openrouter':
                return openrouterModels;
            default:
                return anthropicModels;
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
            <Box marginBottom={1}>
                <Text color={marieTheme.colors.primary} bold>
                    🌸 Marie CLI Setup
                </Text>
            </Box>

            {step === 'provider' && (
                <>
                    <Box marginBottom={1}>
                        <Text>Select your AI provider:</Text>
                    </Box>
                    <SelectInput
                        items={providers}
                        onSelect={handleProviderSelect}
                    />
                </>
            )}

            {step === 'apikey' && (
                <>
                    <Box marginBottom={1}>
                        <Text>Enter your {getApiKeyLabel()}:</Text>
                    </Box>
                    <Box marginBottom={1}>
                        <Text dimColor>
                            (Get your key from the provider's website)
                        </Text>
                    </Box>
                    <Box>
                        <TextInput
                            value={apiKey}
                            onChange={setApiKey}
                            onSubmit={handleApiKeySubmit}
                            mask={showKey ? undefined : '*'}
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
                        <Text>Select your default model:</Text>
                    </Box>
                    <SelectInput
                        items={getModels()}
                        onSelect={handleModelSelect}
                    />
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
