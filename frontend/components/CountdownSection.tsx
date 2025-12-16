'use client';

import { useState, useEffect } from 'react';

function TimeBox({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="bg-card border border-border text-card-foreground w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-bold shadow-lg shadow-black/5 dark:shadow-emerald-500/10 transition-all">
                {String(value).padStart(2, '0')}
            </div>
            <span className="text-xs font-medium text-muted-foreground mt-2 uppercase tracking-wider">{label}</span>
        </div>
    );
}

export function CountdownSection() {
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const calculateTime = () => {
            const now = new Date();
            const target = new Date();
            // Configurar próximo Viernes a las 21:00
            const daysUntilFriday = (5 - now.getDay() + 7) % 7;
            target.setDate(now.getDate() + daysUntilFriday);
            target.setHours(21, 0, 0, 0);

            // Si ya pasó el viernes 21:00, apuntar al siguiente viernes
            if (now > target) {
                target.setDate(target.getDate() + 7);
            }

            const diff = target.getTime() - now.getTime();

            setTimeLeft({
                d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                h: Math.floor((diff / (1000 * 60 * 60)) % 24),
                m: Math.floor((diff / 1000 / 60) % 60),
                s: Math.floor((diff / 1000) % 60),
            });
        };

        const timer = setInterval(calculateTime, 1000);
        calculateTime(); // Init
        return () => clearInterval(timer);
    }, []);

    if (!mounted) return null; // Evitar hidratación mismatch

    return (
        <div className="flex gap-4 md:gap-8 justify-center items-center py-6 animate-in fade-in zoom-in duration-500">
            <TimeBox value={timeLeft.d} label="Días" />
            <span className="text-2xl font-bold text-muted-foreground pb-4">:</span>
            <TimeBox value={timeLeft.h} label="Horas" />
            <span className="text-2xl font-bold text-muted-foreground pb-4">:</span>
            <TimeBox value={timeLeft.m} label="Min" />
            <span className="text-2xl font-bold text-muted-foreground pb-4">:</span>
            <TimeBox value={timeLeft.s} label="Seg" />
        </div>
    );
}
