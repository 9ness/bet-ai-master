"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, Activity, AlertTriangle } from 'lucide-react';
import DailyPredictions from '@/components/DailyPredictions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';
import TikTokFactory from '@/components/TikTokFactory';

type HomeTabsProps = {
    settings: {
        show_daily_bets: boolean;
        show_calendar: boolean;
        show_analytics: boolean;
        show_tiktok?: boolean;
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
        { id: 'analytics', label: '📊 Estadísticas', visible: settings.show_analytics },
        { id: 'tiktok', label: '🏭 TikTok Factory', visible: settings.show_tiktok }
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

    // 3. Swipe Logic
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Minimum swipe distance (in px) 
    const minSwipeDistance = 75;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // Reset
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe || isRightSwipe) {
            const currentIndex = visibleTabs.findIndex(t => t.id === activeTab);

            if (isLeftSwipe) {
                // Next Tab (Limit to last index)
                if (currentIndex < visibleTabs.length - 1) {
                    setActiveTab(visibleTabs[currentIndex + 1].id);
                }
            } else {
                // Prev Tab (Limit to 0)
                if (currentIndex > 0) {
                    setActiveTab(visibleTabs[currentIndex - 1].id);
                }
            }
        }
    };

    if (visibleTabs.length === 0) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
                <p>No hay contenido disponible públicamente.</p>
            </div>
        );
    }

    return (
        <div
            className="w-full"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
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
                        <div className="mb-2 text-center md:text-left relative">
                            <div className="absolute top-0 left-0 w-24 h-24 bg-fuchsia-500/10 rounded-full blur-[40px] pointer-events-none" />
                            <h2 className="text-3xl md:text-4xl font-black mb-3 flex items-center justify-center md:justify-start gap-3 tracking-tight">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">Resultados</span>
                                <span className="text-foreground">Históricos</span>
                            </h2>
                            <p className="text-muted-foreground text-base md:text-lg max-w-2xl text-center md:text-left leading-relaxed">
                                Transparencia total. Revisa cada día, cada apuesta y cada resultado. Sin filtros.
                            </p>
                            <div className="h-1 w-24 bg-gradient-to-r from-fuchsia-500 to-violet-500 rounded-full mt-4 mx-auto md:mx-0 opacity-50" />
                        </div>
                        <ResultsCalendar />
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <AdminAnalytics />
                    </div>
                )}

                {activeTab === 'tiktok' && (
                    <div className="animate-in zoom-in-95 duration-300">
                        <TikTokFactory predictions={predictions} formattedDate={formattedDate} />
                    </div>
                )}
            </main>
        </div>
    );
}
