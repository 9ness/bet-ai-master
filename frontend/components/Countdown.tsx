'use client';

import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

export default function Countdown({ targetDate }: { targetDate: string }) {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    function calculateTimeLeft() {
        const difference = +new Date(targetDate) - +new Date();
        let timeLeft = {
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0
        };

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60)
            };
        }
        return timeLeft;
    }

    if (!isClient) return null; // Evitar hidratación mismatch

    return (
        <div className="flex flex-col items-center justify-center p-8 bg-black/40 rounded-3xl border border-white/10 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-6 text-emerald-400">
                <Timer className="w-8 h-8 animate-pulse" />
                <h3 className="text-xl font-bold uppercase tracking-widest">Próximo Cierre</h3>
            </div>

            <div className="grid grid-cols-4 gap-4 md:gap-8 text-center">
                <div className="flex flex-col">
                    <span className="text-4xl md:text-6xl font-black text-white tabular-nums">
                        {String(timeLeft.days).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-widest mt-2">Días</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-4xl md:text-6xl font-black text-white tabular-nums">
                        {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-widest mt-2">Horas</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-4xl md:text-6xl font-black text-white tabular-nums">
                        {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-widest mt-2">Min</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-4xl md:text-6xl font-black text-emerald-400 tabular-nums">
                        {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-widest mt-2">Seg</span>
                </div>
            </div>
        </div>
    );
}
