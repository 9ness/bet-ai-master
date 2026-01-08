"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, Activity, AlertTriangle } from 'lucide-react';
import DailyPredictions from '@/components/DailyPredictions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';

type HomeTabsProps = {
    settings: {
        show_daily_bets: boolean;
        show_calendar: boolean;
        show_analytics: boolean;
    };
    predictions: any;
    formattedDate: string;
    isMock: boolean;
};

export default function HomeTabs({ settings, predictions, formattedDate, isMock }: HomeTabsProps) {
    // 1. Determine Visible Tabs based on Settings
    const allTabs = [
        { id: 'daily_bets', label: '🎯 Análisis del Día', visible: settings.show_daily_bets },
        { id: 'calendar', label: '📅 Calendario 2026', visible: settings.show_calendar },
        { id: 'analytics', label: '📊 Estadísticas', visible: settings.show_analytics }
    ];

    const visibleTabs = allTabs.filter(tab => tab.visible);

    // 2. State for Active Tab
    // Default to the first visible tab, or empty string if none
    const [activeTab, setActiveTab] = useState(visibleTabs.length > 0 ? visibleTabs[0].id : '');

    // Reset active tab if visibility changes
    useEffect(() => {
        if (!visibleTabs.find(t => t.id === activeTab) && visibleTabs.length > 0) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [visibleTabs, activeTab]);

    if (visibleTabs.length === 0) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
                <p>No hay contenido disponible públicamente.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* HER HERO SECTION (Moved from page.tsx) */}
            <div className="relative overflow-hidden border-b border-border">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-[128px] pointer-events-none opacity-50" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] pointer-events-none opacity-50" />

                <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-6 hover:bg-secondary/80 transition-colors cursor-default">
                        <Activity size={14} className="text-fuchsia-500 animate-pulse" />
                        <span>Análisis Pro con IA</span>
                    </div>

                    <h1 className="text-3xl md:text-7xl font-black mb-6 tracking-tight leading-tight">
                        BET AI MASTER <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient block md:inline mt-2 md:mt-0">
                            PREDICCIONES DIARIAS
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed capitalize">
                        Predicciones para el día: <br className="md:hidden" />
                        <span className="font-bold text-foreground">{formattedDate}</span>
                    </p>

                    {isMock && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-4">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Modo Demostración (Datos de Ejemplo)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* TAB NAVIGATION */}
            {visibleTabs.length > 1 && (
                <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
                    <div className="max-w-7xl mx-auto px-2 md:px-4 flex justify-center md:justify-start">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex-1 md:flex-none py-3 px-4 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-all 
                                    ${activeTab === tab.id
                                        ? 'border-fuchsia-500 text-fuchsia-500'
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/20'}
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* CONTENT AREA */}
            <main className="max-w-7xl mx-auto px-4 py-8 min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'daily_bets' && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <DailyPredictions predictions={predictions} />
                    </div>
                )}

                {activeTab === 'calendar' && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Resultados Históricos</h2>
                            <p className="text-muted-foreground text-sm">Transparencia total en nuestros resultados pasados.</p>
                        </div>
                        <ResultsCalendar />
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <div className="mb-8">
                            <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Rendimiento Mensual</h2>
                            <p className="text-muted-foreground text-sm">Análisis detallado de rentabilidad y evolución.</p>
                        </div>
                        <AdminAnalytics />
                    </div>
                )}
            </main>
        </div>
    );
}
