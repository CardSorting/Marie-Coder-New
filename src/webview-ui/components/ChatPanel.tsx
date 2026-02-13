import { useEffect, useRef } from "react"
import type { UiMessage } from "../types.js"

function roleLabel(role: UiMessage["role"]) {
    if (role === "assistant") return "Marie"
    if (role === "user") return "You"
    return "System"
}

export function ChatPanel({
    messages,
    streamingBuffer,
}: {
    messages: UiMessage[]
    streamingBuffer: string
}) {
    const chatRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight
        }
    }, [messages, streamingBuffer])

    return (
        <section className="chat" ref={chatRef}>
            {messages.map((message) => (
                <div className={`msg ${message.role}`} key={message.id}>
                    <div className="role">{roleLabel(message.role)}</div>
                    <pre>{message.content}</pre>
                </div>
            ))}
            {streamingBuffer && (
                <div className="msg assistant stream">
                    <div className="role">Marie</div>
                    <pre>{streamingBuffer}</pre>
                </div>
            )}
        </section>
    )
}
