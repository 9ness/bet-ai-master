import React from 'react';
import { Clock, Trophy } from 'lucide-react';
import BetCard from '@/components/BetCard';

interface DailyPredictionsProps {
    predictions: any;
}

export default function DailyPredictions({ predictions }: DailyPredictionsProps) {
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

    return (
        <section className="max-w-7xl mx-auto px-4 py-8">
            <h2 className="text-3xl font-black mb-8 flex items-center gap-2">
                <Trophy className="text-fuchsia-500" />
                Apuestas del Día
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BetCard type="safe" data={predictions.safe} />
                <BetCard type="value" data={predictions.value} />
                <BetCard type="funbet" data={predictions.funbet} />
            </div>
        </section>
    );
}
