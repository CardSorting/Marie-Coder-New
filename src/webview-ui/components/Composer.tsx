import { useState } from "react"

export function Composer({
    isLoading,
    onSend,
    onModels,
}: {
    isLoading: boolean
    onSend: (text: string) => void
    onModels: () => void
}) {
    const [input, setInput] = useState("")

    const submit = () => {
        const text = input.trim()
        if (!text) return
        setInput("")
        onSend(text)
    }

    return (
        <footer className="composer">
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        submit()
                    }
                }}
                placeholder="Ask Marie…"
            />
            <div className="stack">
                <button onClick={submit} disabled={isLoading}>
                    Send
                </button>
                <button onClick={onModels} className="secondary">
                    Models
                </button>
            </div>
        </footer>
    )
}
