import type { ApprovalRequest } from "../types.js"

export function ApprovalPanel({
    pendingApproval,
    onApprove,
}: {
    pendingApproval: ApprovalRequest | null
    onApprove: (approved: boolean) => void
}) {
    if (!pendingApproval) {
        return null
    }

    return (
        <div className="approval">
            <strong>Approval required</strong>
            <div>
                Tool: <code>{pendingApproval.toolName}</code>
            </div>
            <pre>{JSON.stringify(pendingApproval.toolInput, null, 2)}</pre>
            <div className="row">
                <button onClick={() => onApprove(true)}>Approve</button>
                <button onClick={() => onApprove(false)}>Deny</button>
            </div>
        </div>
    )
}
