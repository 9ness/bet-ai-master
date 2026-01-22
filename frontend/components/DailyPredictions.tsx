'use client';

import React, { useState } from 'react';
import { Clock, Trophy, ShieldCheck, TrendingUp, PartyPopper, CheckCircle2, XCircle } from 'lucide-react';
import BetCard from '@/components/BetCard';

interface DailyPredictionsProps {
    predictions: any;
    isAdmin?: boolean;
}

export default function DailyPredictions({ predictions, isAdmin }: DailyPredictionsProps) {
    const [activeTab, setActiveTab] = useState<'safe' | 'value' | 'funbet'>('safe');

    if (!predictions) {
        return (
            <div className="text-center py-12">
                <div className="inline-block p-4 rounded-full bg-secondary mb-4">
                    <Clock className="w-8 h-8 text-muted-foreground animate-spin-slow" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Esperando datos del analista...</h3>
                <p className="text-muted-foreground">Ejecuta el script de python para generar las recomendaciones.</p>
            </div>
        );
    }

    // Normalize Data
    let safeBet, valueBet, funbetBet;

    if (Array.isArray(predictions)) {
        safeBet = predictions.find((p: any) => (p.betType === 'safe' || p.type === 'safe'));
        valueBet = predictions.find((p: any) => (p.betType === 'value' || p.type === 'value'));
        funbetBet = predictions.find((p: any) => (p.betType === 'funbet' || p.type === 'funbet'));
    } else {
        safeBet = predictions?.safe;
        valueBet = predictions?.value;
        funbetBet = predictions?.funbet;
    }

    // Helper to get status color/icon for the mini-tabs
    const getStatusIndicator = (data: any) => {
        if (!data) return null;
        if (data.status === 'WON' || data.status === 'GANADA') return <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]" />;
        if (data.status === 'LOST' || data.status === 'PERDIDA') return <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_5px_rgba(244,63,94,0.5)]" />;
        return <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)]" />;
    };

    // Tab Button Component (Mobile Only)
    const MobileTab = ({ type, label, icon: Icon, data }: { type: 'safe' | 'value' | 'funbet', label: string, icon: any, data: any }) => {
        const isActive = activeTab === type;
        const colorClass =
            type === 'safe' ? 'text-cyan-400' :
                type === 'value' ? 'text-amber-400' :
                    'text-fuchsia-400';

        const borderColor =
            type === 'safe' ? 'border-cyan-500/50' :
                type === 'value' ? 'border-amber-500/50' :
                    'border-fuchsia-500/50';

        const bgActive =
            type === 'safe' ? 'bg-cyan-500/10' :
                type === 'value' ? 'bg-amber-500/10' :
                    'bg-fuchsia-500/10';

        return (
            <button
                onClick={() => setActiveTab(type)}
                className={`
                    relative flex flex-col items-center justify-center px-4 py-3 rounded-xl border transition-all w-full
                    ${isActive
                        ? `${bgActive} ${borderColor} ${colorClass} shadow-[0_0_15px_-3px_rgba(0,0,0,0.3)] scale-[1.02]`
                        : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                    }
                `}
            >
                {getStatusIndicator(data)}
                <div className="mb-1.5">
                    <Icon size={20} className={isActive ? "animate-pulse" : "opacity-50"} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                    {label}
                </span>
            </button>
        );
    };

    return (
        <section className="max-w-7xl mx-auto px-4 pt-0 pb-6">
            {/* Styled Header */}
            <div className="text-center mb-6 md:mb-12 relative z-10">
                <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tighter flex items-center justify-center gap-3">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Apuestas</span> <span className="text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">del Día</span>
                </h2>
                <div className="w-24 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mx-auto mb-2 animate-pulse" />
                <p className="text-muted-foreground/80 font-medium max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                    Selección diaria de oportunidades de alta probabilidad. Análisis detallado y transparencia total.
                </p>
            </div>

            {/* MOBILE: TABS NAVIGATION */}
            <div className="md:hidden flex gap-3 mb-10">
                <MobileTab type="safe" label="Segura" icon={ShieldCheck} data={safeBet} />
                <MobileTab type="value" label="Valor" icon={TrendingUp} data={valueBet} />
                <MobileTab type="funbet" label="Funbet" icon={PartyPopper} data={funbetBet} />
            </div>

            {/* MOBILE: ACTIVE CONTENT */}
            <div className="md:hidden min-h-[400px]">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {activeTab === 'safe' && <BetCard type="safe" data={safeBet} isAdmin={isAdmin} />}
                    {activeTab === 'value' && <BetCard type="value" data={valueBet} isAdmin={isAdmin} />}
                    {activeTab === 'funbet' && <BetCard type="funbet" data={funbetBet} isAdmin={isAdmin} />}
                </div>
            </div>

            {/* DESKTOP: GRID LAYOUT (Unchanged) */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-8">
                <BetCard type="safe" data={safeBet} isAdmin={isAdmin} />
                <BetCard type="value" data={valueBet} isAdmin={isAdmin} />
                <BetCard type="funbet" data={funbetBet} isAdmin={isAdmin} />
            </div>
        </section>
    );
}
