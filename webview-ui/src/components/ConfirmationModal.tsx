import { useRef, useEffect } from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }: ConfirmationModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (isOpen) {
            dialogRef.current?.showModal();
        } else {
            dialogRef.current?.close();
        }
    }, [isOpen]);

    // Close on click outside
    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            onCancel();
        }
    };

    if (!isOpen) return null;

    return (
        <dialog
            ref={dialogRef}
            className="confirmation-modal"
            onClick={handleBackdropClick}
        >
            <div className="modal-content">
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="modal-button cancel" onClick={onCancel}>Cancel</button>
                    <button className="modal-button confirm" onClick={onConfirm}>Confirm</button>
                </div>
            </div>
        </dialog>
    );
}
