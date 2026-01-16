import React from 'react';
import { Clock, Trophy } from 'lucide-react';
import BetCard from '@/components/BetCard';

interface DailyPredictionsProps {
    predictions: any;
    isAdmin?: boolean;
}

export default function DailyPredictions({ predictions, isAdmin }: DailyPredictionsProps) {
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

    // Normalize Data: Handle Array input (New Format) vs Object (Old Format)
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

    // Dynamic Profit Calculation


    return (
        <section className="max-w-7xl mx-auto px-4 pt-0 pb-6">
            {/* Styled Header */}
            <div className="text-center mb-8 md:mb-16 relative z-10">
                <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tighter flex items-center justify-center gap-3">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Apuestas</span> <span className="text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">del Día</span>
                </h2>
                <div className="w-24 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mx-auto mb-2 animate-pulse" />
                <p className="text-muted-foreground/80 font-medium max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                    Selección diaria de oportunidades de alta probabilidad. Análisis detallado y transparencia total.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BetCard type="safe" data={safeBet} isAdmin={isAdmin} />
                <BetCard type="value" data={valueBet} isAdmin={isAdmin} />
                <BetCard type="funbet" data={funbetBet} isAdmin={isAdmin} />
            </div>
        </section>
    );
}
