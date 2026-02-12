import { useState, useRef, useEffect, useLayoutEffect, type KeyboardEvent } from 'react';
import { SendIcon, StopIcon } from '../plumbing/ui/Icons';

interface InputAreaProps {
    onSend: (text: string) => void;
    onStop: () => void;
    disabled: boolean;
    isLoading: boolean;
    placeholder?: string;
}

export function InputArea({ onSend, onStop, disabled, isLoading, placeholder }: InputAreaProps) {
    const [input, setInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevInputRef = useRef(input);

    const commands = [
        { name: '/clear', description: 'Clear the current chat history' },
        { name: '/help', description: 'Show available commands' }
    ];

    const MAX_INPUT_LENGTH = 50000; // 50k chars is plenty for most requests, prevents UI lockup
    const filteredCommands = commands.filter(c => c.name.startsWith(input.toLowerCase()));

    // Auto-resize textarea
    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleInput = (val: string) => {
        if (val.length > MAX_INPUT_LENGTH) {
            setInput(val.substring(0, MAX_INPUT_LENGTH));
            // Trigger a minor "warning" pulse or similar if we had a dedicated toast/status
        } else {
            setInput(val);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const paste = e.clipboardData.getData('text');
        if (paste.length > MAX_INPUT_LENGTH) {
            // If they paste something massive, truncate it and notify
            e.preventDefault();
            const truncated = paste.substring(0, MAX_INPUT_LENGTH);
            setInput(prev => prev + truncated);
            // We could show a toast here if we had access to the toast system, 
            // but for now truncation is at least a safety guard.
        }
    };

    useEffect(() => {
        // Check if input changed from previous render
        if (input !== prevInputRef.current) {
            prevInputRef.current = input;
            // Use microtask to avoid direct setState during render
            if (input === '/') {
                queueMicrotask(() => {
                    setShowSuggestions(true);
                    setSelectedIndex(0);
                });
            } else if (showSuggestions && !input.startsWith('/')) {
                queueMicrotask(() => setShowSuggestions(false));
            }
        }
    }, [input, showSuggestions]);

    const handleSend = (textOverride?: string) => {
        const textToSend = textOverride || input;
        if (isLoading) {
            onStop();
            return;
        }
        if (!textToSend.trim() || disabled) return;
        onSend(textToSend);
        setInput('');
        setShowSuggestions(false);

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (showSuggestions && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleSend(filteredCommands[selectedIndex].name);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isNearLimit = input.length > MAX_INPUT_LENGTH * 0.8;

    return (
        <div className="input-area">
            {showSuggestions && filteredCommands.length > 0 && (
                <div className="command-suggestions">
                    {filteredCommands.map((cmd, i) => (
                        <div
                            key={cmd.name}
                            className={`suggestion-item ${i === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSend(cmd.name)}
                        >
                            <span className="command-name">{cmd.name}</span>
                            <span className="command-desc">{cmd.description}</span>
                        </div>
                    ))}
                </div>
            )}
            <div className={`input-wrapper ${isLoading ? 'loading' : ''} ${isNearLimit ? 'near-limit' : ''}`}>
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => handleInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || "Ask Marie..."}
                    disabled={disabled || isLoading}
                    rows={1}
                />
                {isNearLimit && (
                    <div className="char-limit-indicator">
                        {input.length} / {MAX_INPUT_LENGTH}
                    </div>
                )}
                <button
                    className={`send-button ${isLoading ? 'stop-button' : ''}`}
                    onClick={() => handleSend()}
                    disabled={disabled && !isLoading}
                    title={isLoading ? "Stop generating" : "Send message"}
                >
                    {isLoading ? <StopIcon width={16} height={16} /> : <SendIcon width={18} height={18} />}
                </button>
            </div>
        </div>
    );
}
