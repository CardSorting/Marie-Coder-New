import { useState, useEffect } from 'react';

const OVERSCAN_COUNT = 5;

export interface VirtualScrollState {
    startIndex: number;
    endIndex: number;
    offsetTop: number;
    totalHeight: number;
}

export function useVirtualScroll(
    containerRef: React.RefObject<HTMLDivElement | null>,
    itemCount: number,
    itemHeight: number,
    overscan: number = OVERSCAN_COUNT
): VirtualScrollState {
    const [state, setState] = useState<VirtualScrollState>({
        startIndex: 0,
        endIndex: Math.min(50, itemCount),
        offsetTop: 0,
        totalHeight: itemCount * itemHeight
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const viewportHeight = container.clientHeight;

            const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
            const visibleCount = Math.ceil(viewportHeight / itemHeight);
            const endIndex = Math.min(itemCount, startIndex + visibleCount + overscan * 2);

            setState({
                startIndex,
                endIndex,
                offsetTop: startIndex * itemHeight,
                totalHeight: itemCount * itemHeight
            });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial calculation

        return () => container.removeEventListener('scroll', handleScroll);
    }, [containerRef, itemCount, itemHeight, overscan]);

    return state;
}
