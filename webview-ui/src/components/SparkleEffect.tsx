import { useLayoutEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface Sparkle {
    id: string;
    x: number;
    y: number;
    color: string;
    size: number;
}

export function SparkleEffect() {
    const [sparkles, setSparkles] = useState<Sparkle[]>([]);

    useLayoutEffect(() => {
        const colors = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];
        const newSparkles = Array.from({ length: 30 }).map(() => ({
            id: Math.random().toString(),
            x: Math.random() * 100,
            y: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4
        }));

        queueMicrotask(() => setSparkles(newSparkles));
        const timer = setTimeout(() => setSparkles([]), 2000);
        return () => clearTimeout(timer);
    }, []);

    if (sparkles.length === 0) return null;

    return ReactDOM.createPortal(
        <div className="sparkle-overlay">
            {sparkles.map(s => (
                <div
                    key={s.id}
                    className="sparkle-particle"
                    style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        backgroundColor: s.color,
                        width: `${s.size}px`,
                        height: `${s.size}px`,
                        boxShadow: `0 0 ${s.size}px ${s.color}`
                    } as React.CSSProperties}
                />
            ))}
        </div>,
        document.body
    );
}
