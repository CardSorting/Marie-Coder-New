import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { vscode } from '../utils/vscode';

interface CodeBlockProps {
    language: string;
    value: string;
}

export function CodeBlock({ language, value }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    const handleInsert = () => {
        vscode.postMessage({ type: 'insertCode', value: value });
    };

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-language">{language || 'text'}</span>
                <div className="code-block-actions">
                    <button
                        className="preview-button"
                        onClick={() => {
                            vscode.postMessage({
                                type: 'showDiff',
                                value: {
                                    modified: value,
                                    fileName: "current-file" // Handled extension-side if possible
                                }
                            });
                        }}
                        title="Preview changes"
                    >
                        <span className="icon">🔍</span> Preview
                    </button>
                    {value.split('\n').length > 50 && (
                        <button
                            className="fold-button"
                            onClick={() => vscode.postMessage({ type: 'foldCode' })}
                            title="Fold clutter"
                        >
                            <span className="icon">📂</span> Fold
                        </button>
                    )}
                    <button
                        className="insert-button"
                        onClick={handleInsert}
                        title="Insert at cursor"
                    >
                        <span className="icon">📥</span> Insert
                    </button>
                    <button
                        className={`copy-button ${copied ? 'copied' : ''}`}
                        onClick={handleCopy}
                        title="Copy code"
                    >
                        {copied ? (
                            <>
                                <span className="icon">✓</span> Copied
                            </>
                        ) : (
                            <>
                                <span className="icon">📋</span> Copy
                            </>
                        )}
                    </button>
                </div>
            </div>
            <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                customStyle={{
                    margin: 0,
                    padding: '16px',
                    borderRadius: '0 0 8px 8px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    backgroundColor: '#1e1e1e', // Force dark bg
                }}
                wrapLongLines={true}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
}
