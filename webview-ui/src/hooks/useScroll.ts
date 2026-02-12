import { useState, useEffect, useRef, useCallback } from 'react';
import type { MarieStatus, MessageType } from '../types';

/**
 * Smooth scroll strategy - respects user position, no forced snap.
 * Only auto-scrolls if user is already at bottom.
 */
export function useScroll(messages: MessageType[], marieStatus: MarieStatus) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesListRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const lastMessageCountRef = useRef(messages.length);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    // Check if user is at bottom (within 20px tolerance)
    const checkIsAtBottom = useCallback(() => {
        if (!messagesListRef.current) return true;
        const { scrollTop, scrollHeight, clientHeight } = messagesListRef.current;
        return scrollHeight - scrollTop - clientHeight < 20;
    }, []);

    // Scroll to bottom with smooth animation
    const scrollToBottom = useCallback((smooth = true) => {
        if (!messagesEndRef.current) return;

        messagesEndRef.current.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'end'
        });
        setHasUnreadMessages(false);
        isAtBottomRef.current = true;
        setShowScrollButton(false);
    }, []);

    // Handle scroll events - update button visibility (throttled)
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleScroll = useCallback(() => {
        if (scrollTimerRef.current) return;

        scrollTimerRef.current = setTimeout(() => {
            const atBottom = checkIsAtBottom();
            isAtBottomRef.current = atBottom;
            setShowScrollButton(!atBottom);

            if (atBottom) {
                setHasUnreadMessages(false);
            }
            scrollTimerRef.current = null;
        }, 100);
    }, [checkIsAtBottom]);

    // Auto-scroll logic - only if user is at bottom
    useEffect(() => {
        const messageCountChanged = messages.length !== lastMessageCountRef.current;
        lastMessageCountRef.current = messages.length;

        // Only auto-scroll if user is already at bottom
        if (isAtBottomRef.current) {
            // Small delay to let content render, then smooth scroll
            const timeout = setTimeout(() => {
                scrollToBottom(true);
            }, 50);
            return () => clearTimeout(timeout);
        }

        // User is scrolled up and new message arrived
        if (messageCountChanged) {
            setHasUnreadMessages(true);
            setShowScrollButton(true);
        }
    }, [messages, scrollToBottom]);

    // Update bottom status when marie status changes (streaming complete)
    useEffect(() => {
        if (marieStatus === 'idle' && isAtBottomRef.current) {
            scrollToBottom(true);
        }
    }, [marieStatus, scrollToBottom]);

    return {
        messagesEndRef,
        messagesListRef,
        showScrollButton,
        hasUnreadMessages,
        scrollToBottom,
        handleScroll,
        setHasUnreadMessages,
        setShowScrollButton
    };
}
