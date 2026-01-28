'use client';

import React, { useState } from 'react';
import DailyPredictions from '@/components/DailyPredictions';
import { Trophy, Target } from 'lucide-react';

interface AdminPredictionsViewProps {
    predictions: any;
    stakazoPredictions: any;
}

export default function AdminPredictionsView({ predictions, stakazoPredictions }: AdminPredictionsViewProps) {
    // Default to 'standard' unless only stakazo exists (unlikely in admin)
    const [activeView, setActiveView] = useState<'standard' | 'stakazo'>('standard');

    // Calculate Dynamic Stake for Tab Label
    let stakazoStake = 10;
    if (Array.isArray(stakazoPredictions) && stakazoPredictions.length > 0) {
        stakazoStake = stakazoPredictions[0].stake || 10;
    } else if (stakazoPredictions?.stake) {
        stakazoStake = stakazoPredictions.stake || 10;
    }

    const hasStakazo = stakazoPredictions && (Array.isArray(stakazoPredictions) ? stakazoPredictions.length > 0 : true);

    return (
        <div className="space-y-6">
            {/* SUB-TABS NAVIGATION */}
            <div className="flex justify-center gap-4">
                <button
                    onClick={() => setActiveView('standard')}
                    className={`
                        flex items-center gap-2 px-6 py-2 rounded-full border transition-all
                        ${activeView === 'standard'
                            ? 'bg-fuchsia-500 text-white border-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.3)]'
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}
                    `}
                >
                    <Target size={16} />
                    <span className="font-bold text-sm tracking-wider">ESTÁNDAR</span>
                </button>

                {hasStakazo && (
                    <button
                        onClick={() => setActiveView('stakazo')}
                        className={`
                            flex items-center gap-2 px-6 py-2 rounded-full border transition-all
                            ${activeView === 'stakazo'
                                ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}
                        `}
                    >
                        <Trophy size={16} />
                        <span className="font-bold text-sm tracking-wider">STAKAZO {stakazoStake}</span>
                    </button>
                )}
            </div>

            {/* CONTENT AREA */}
            <div className="min-h-[500px]">
                {activeView === 'stakazo' && hasStakazo && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center max-w-2xl mx-auto">
                            <h3 className="text-amber-400 font-bold flex items-center justify-center gap-2 mb-1">
                                <Trophy size={18} /> SELECCIÓN PREMIUM
                            </h3>
                            <p className="text-xs text-amber-200/60">
                                Visualización modo Administrador. Stake {stakazoStake}.
                            </p>
                        </div>
                        <DailyPredictions
                            predictions={stakazoPredictions}
                            isAdmin={true}
                            hideHeader={true}
                        />
                    </div>
                )}

                {activeView === 'standard' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <DailyPredictions
                            predictions={predictions}
                            isAdmin={true}
                        // We can use the default header here
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
