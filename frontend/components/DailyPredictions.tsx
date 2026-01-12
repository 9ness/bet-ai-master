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
        <section className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <h2 className="text-3xl font-black flex items-center gap-2">
                    <Trophy className="text-fuchsia-500" />
                    Apuestas del Día
                </h2>

                {/* Profit Display */}

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BetCard type="safe" data={safeBet} isAdmin={isAdmin} />
                <BetCard type="value" data={valueBet} isAdmin={isAdmin} />
                <BetCard type="funbet" data={funbetBet} isAdmin={isAdmin} />
            </div>
        </section>
    );
}
