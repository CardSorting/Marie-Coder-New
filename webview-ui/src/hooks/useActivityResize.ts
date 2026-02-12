import { useEffect, useRef } from 'react';

export function useActivityResize() {
    const activityAreaRef = useRef<HTMLDivElement>(null);

    // ResizeObserver for dynamic activity area padding
    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const height = entry.contentRect.height;
                document.documentElement.style.setProperty('--activity-area-height', `${height + 20}px`);
            }
        });

        if (activityAreaRef.current) {
            resizeObserver.observe(activityAreaRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return { activityAreaRef };
}
