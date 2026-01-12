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

    // Dynamic Profit Calculation
    const calculateProfit = () => {
        let total = 0;
        const stake = 10; // Base stake assumption

        const bets = [predictions.safe, predictions.value, predictions.funbet];

        bets.forEach(bet => {
            if (!bet) return;

            // Normalize Status
            let status = bet.status;
            if (status === 'GANADA') status = 'WON';
            if (status === 'PERDIDA') status = 'LOST';
            if (status === 'PENDIENTE') status = 'PENDING';

            if (status === 'WON') {
                total += stake * (bet.odd - 1);
            } else if (status === 'LOST') {
                total -= stake;
            }
        });

        return total.toFixed(2);
    };

    const profit = calculateProfit();
    const isPositive = parseFloat(profit) >= 0;

    return (
        <section className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <h2 className="text-3xl font-black flex items-center gap-2">
                    <Trophy className="text-fuchsia-500" />
                    Apuestas del Día
                </h2>

                {/* Profit Display */}
                <div className={`mt-4 md:mt-0 inline-flex items-center gap-2 px-6 py-3 rounded-2xl border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    <span className="text-sm font-bold uppercase tracking-wider opacity-80">Profit del Día:</span>
                    <span className="text-2xl font-black tracking-tight">{isPositive ? '+' : ''}{profit}u</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BetCard type="safe" data={predictions.safe} isAdmin={isAdmin} />
                <BetCard type="value" data={predictions.value} isAdmin={isAdmin} />
                <BetCard type="funbet" data={predictions.funbet} isAdmin={isAdmin} />
            </div>
        </section>
    );
}
