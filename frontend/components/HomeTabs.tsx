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

    // Header Stats State
    const [headerStats, setHeaderStats] = useState({
        profit: 0,
        yieldVal: 0,
        yesterdayProfit: null as number | null
    });

    // Fetch Header Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const now = new Date();
                const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

                const res = await fetch(`/api/admin/history?month=${monthStr}`);
                const json = await res.json();

                if (json.stats) {
                    // Calculate Yesterday's Profit
                    let yesterProfit = null;
                    if (json.days) {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yStr = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;

                        if (json.days[yStr]) {
                            yesterProfit = json.days[yStr].day_profit;
                        }
                    }

                    setHeaderStats({
                        profit: json.stats.total_profit || 0,
                        yieldVal: json.stats.yield || 0,
                        yesterdayProfit: yesterProfit
                    });
                }
            } catch (e) {
                console.error("Failed to fetch header stats", e);
            }
        };

        if (settings.show_analytics) {
            fetchStats();
        }
    }, [settings.show_analytics]);

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
            {/* COMPACT HERO SECTION */}
            <div className="relative overflow-hidden border-b border-border bg-background/50">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-[128px] pointer-events-none opacity-30" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px] pointer-events-none opacity-30" />

                <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 text-center relative z-10">
                    {/* Top Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground text-[10px] font-bold mb-3 hover:bg-secondary/80 transition-colors cursor-default border border-white/5">
                        <Activity size={10} className="text-fuchsia-500 animate-pulse" />
                        <span>ANÁLISIS Pro con IA</span>
                    </div>

                    {/* Main Title COMPACT */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mb-3">
                        <h1 className="text-2xl md:text-5xl font-black tracking-tighter leading-none">
                            BET AI <span className="text-fuchsia-500">MASTER</span>
                        </h1>
                        <span className="hidden md:block text-muted-foreground/30 text-3xl font-thin">|</span>
                        <h2 className="text-lg md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient">
                            PREDICCIONES DIARIAS
                        </h2>
                    </div>

                    {/* Date & Stats Row - SINGLE LINE LAYOUT */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-3">
                        {/* Date */}
                        <p className="text-xs md:text-sm text-muted-foreground font-medium capitalize flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {formattedDate}
                        </p>

                        <span className="hidden md:block text-muted-foreground/20">|</span>

                        {/* SOCIAL PROOF TICKER */}
                        {settings.show_analytics && (
                            <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-hide">
                                {/* Profit Badge */}
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0">
                                    <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-wider">Ganancias</span>
                                    <span className="text-xs font-black text-emerald-400">+{headerStats.profit.toFixed(2)} u</span>
                                </div>

                                {/* Yield Badge */}
                                <div className="flex items-center gap-1.5 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-1 rounded-lg shrink-0">
                                    <span className="text-[9px] text-fuchsia-500/70 font-bold uppercase tracking-wider">Yield</span>
                                    <span className="text-xs font-black text-fuchsia-400">{headerStats.yieldVal.toFixed(2)}%</span>
                                </div>

                                {/* Yesterday Result (Only if exists) */}
                                {headerStats.yesterdayProfit !== null && (
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shrink-0 ${headerStats.yesterdayProfit >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${headerStats.yesterdayProfit >= 0 ? 'text-blue-500/70' : 'text-rose-500/70'}`}>Ayer</span>
                                        <span className={`text-xs font-black ${headerStats.yesterdayProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                            {headerStats.yesterdayProfit > 0 ? '+' : ''}{headerStats.yesterdayProfit.toFixed(2)} u
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>


                    {isMock && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-4">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Modo Demostración</span>
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
