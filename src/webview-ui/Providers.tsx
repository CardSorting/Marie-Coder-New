import type { ReactNode } from "react"
import { WebviewStateProvider } from "./context/WebviewStateContext.js"

export function Providers({ children }: { children: ReactNode }) {
    return <WebviewStateProvider>{children}</WebviewStateProvider>
}
