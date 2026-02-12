import { useState, useEffect, useRef } from 'react';
import { EyeIcon, EyeOffIcon, ExternalLinkIcon } from '../plumbing/ui/Icons';

interface Settings {
    apiKey?: string;
    openrouterApiKey?: string;
    cerebrasApiKey?: string;
    aiProvider: 'anthropic' | 'openrouter' | 'cerebras';
    model: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    initialSettings: Settings;
    onSave: (settings: Settings) => void;
    onCancel: () => void;
    availableModels: { id: string, name: string }[];
    isLoadingModels: boolean;
    onFetchModels: (provider: 'anthropic' | 'openrouter' | 'cerebras') => void;
}

export function SettingsModal({ isOpen, initialSettings, onSave, onCancel, availableModels, isLoadingModels, onFetchModels }: SettingsModalProps) {
    const [settings, setSettings] = useState<Settings>(initialSettings);
    // const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]); // Lifted
    // const [isLoadingModels, setIsLoadingModels] = useState(false); // Lifted
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [customModel, setCustomModel] = useState('');
    const dialogRef = useRef<HTMLDialogElement>(null);

    // Initial load and provider changes
    useEffect(() => {
        if (isOpen) {
            // Use microtask to avoid direct setState during render
            queueMicrotask(() => setSettings(initialSettings));
            onFetchModels(initialSettings.aiProvider);
            dialogRef.current?.showModal();
        } else {
            dialogRef.current?.close();
            queueMicrotask(() => setSaveSuccess(false));
        }
    }, [isOpen, initialSettings, onFetchModels]);

    useEffect(() => {
        // If current model isn't in newly fetched models, mark as custom
        const isPreset = availableModels.some(p => p.id === settings.model);
        if (!isPreset && settings.model) {
            // Use a microtask to avoid direct setState in render phase
            queueMicrotask(() => setCustomModel(settings.model));
        }
    }, [availableModels, settings.model]);

    const handleChange = (field: keyof Settings, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleModelChange = (id: string) => {
        if (id === 'other') {
            handleChange('model', customModel || '');
        } else {
            handleChange('model', id);
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        // Simulate a small delay for feedback
        setTimeout(() => {
            onSave(settings);
            setSaveSuccess(true);
            setIsSaving(false);

            // Auto close after showing success
            setTimeout(() => {
                onCancel();
            }, 800);
        }, 400);
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            onCancel();
        }
    };

    if (!isOpen) return null;

    const selectedPreset = availableModels.find(p => p.id === settings.model) ? settings.model : 'other';

    return (
        <dialog
            ref={dialogRef}
            className="settings-modal"
            onClick={handleBackdropClick}
        >
            <div className="modal-content settings-dashboard">
                <header className="settings-header">
                    <h3 className="shimmer-text">Settings</h3>
                    <p>Configure Marie's dynamic intelligence.</p>
                </header>

                <section className="settings-section">
                    <div className="section-header">Connectivity</div>

                    <div className="settings-group">
                        <label>AI Provider</label>
                        <select
                            value={settings.aiProvider}
                            onChange={(e) => {
                                const provider = e.target.value as 'anthropic' | 'openrouter' | 'cerebras';
                                setSettings(prev => ({ ...prev, aiProvider: provider }));
                                onFetchModels(provider);
                            }}
                        >
                            <option value="anthropic">Anthropic (Direct)</option>
                            <option value="openrouter">OpenRouter (Dynamic)</option>
                            <option value="cerebras">Cerebras (Fast Inference)</option>
                        </select>
                    </div>

                    <div className="settings-group">
                        <label>
                            {settings.aiProvider === 'anthropic' ? 'Anthropic API Key' :
                                settings.aiProvider === 'openrouter' ? 'OpenRouter API Key' :
                                    'Cerebras API Key'}
                            <a
                                href={settings.aiProvider === 'anthropic' ? 'https://console.anthropic.com/settings/keys' :
                                    settings.aiProvider === 'openrouter' ? 'https://openrouter.ai/keys' :
                                        'https://cloud.cerebras.ai/platform/'}
                                target="_blank"
                                className="external-link"
                                title="Get API Key"
                            >
                                <ExternalLinkIcon width={12} height={12} />
                            </a>
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                type={showApiKey ? "text" : "password"}
                                value={settings.aiProvider === 'anthropic' ? (settings.apiKey || '') :
                                    settings.aiProvider === 'openrouter' ? (settings.openrouterApiKey || '') :
                                        (settings.cerebrasApiKey || '')}
                                onChange={(e) => handleChange(
                                    settings.aiProvider === 'anthropic' ? 'apiKey' :
                                        settings.aiProvider === 'openrouter' ? 'openrouterApiKey' : 'cerebrasApiKey',
                                    e.target.value
                                )}
                                placeholder={settings.aiProvider === 'anthropic' ? "sk-ant-..." :
                                    settings.aiProvider === 'openrouter' ? "sk-or-..." : "csk-..."}
                            />
                            <button
                                className="visibility-toggle"
                                onClick={() => setShowApiKey(!showApiKey)}
                                title={showApiKey ? "Hide key" : "Show key"}
                            >
                                {showApiKey ? <EyeOffIcon width={14} height={14} /> : <EyeIcon width={14} height={14} />}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="settings-section">
                    <div className="section-header">Intelligence</div>

                    <div className="settings-group">
                        <label>Model Select</label>
                        <select
                            value={selectedPreset}
                            onChange={(e) => handleModelChange(e.target.value)}
                            disabled={isLoadingModels}
                        >
                            {isLoadingModels ? (
                                <option>Loading models...</option>
                            ) : (
                                <>
                                    {availableModels.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                    <option value="other">Other (Custom)...</option>
                                </>
                            )}
                        </select>
                    </div>

                    {selectedPreset === 'other' && (
                        <div className="settings-group animate-in">
                            <label>Custom Model ID</label>
                            <input
                                type="text"
                                value={settings.model}
                                onChange={(e) => {
                                    setCustomModel(e.target.value);
                                    handleChange('model', e.target.value);
                                }}
                                placeholder="Enter exact model ID..."
                            />
                        </div>
                    )}
                </section>

                <div className="modal-actions">
                    <button className="modal-button cancel" onClick={onCancel} disabled={isSaving}>Cancel</button>
                    <button
                        className={`modal-button confirm ${saveSuccess ? 'success' : ''}`}
                        onClick={handleSave}
                        disabled={isSaving || saveSuccess}
                    >
                        {saveSuccess ? 'Saved! ✅' : (isSaving ? 'Saving...' : 'Save Changes')}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
