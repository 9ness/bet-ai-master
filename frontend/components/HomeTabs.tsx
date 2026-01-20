"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, Activity, AlertTriangle } from 'lucide-react';
import { triggerTouchFeedback } from '@/utils/haptics';
import DailyPredictions from '@/components/DailyPredictions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';
import TikTokFactory from '@/components/TikTokFactory';
import TelegramAdmin from '@/components/TelegramAdmin';

type HomeTabsProps = {
    settings: {
        show_daily_bets: boolean;
        show_calendar: boolean;
        show_analytics: boolean;
        show_telegram?: boolean;
        show_tiktok?: boolean;
        show_announcement?: boolean;
        announcement_text?: string;
        announcement_type?: 'info' | 'warning';
    };
    predictions: any;
    formattedDate: string;
    isMock: boolean;
};

export default function HomeTabs({ settings, predictions, formattedDate, isMock }: HomeTabsProps) {
    // 1. Determine Visible Tabs based on Settings
    const allTabs = [
        { id: 'daily_bets', label: '🎯 Apuestas', visible: settings.show_daily_bets },
        { id: 'calendar', label: '📅 Calendario', visible: settings.show_calendar },
        { id: 'analytics', label: '📊 Estadísticas', visible: settings.show_analytics },
        { id: 'telegram', label: '✈️ Telegram', visible: !!settings.show_telegram },
        { id: 'tiktok', label: '🏭 TikTok', visible: settings.show_tiktok }
    ];

    const visibleTabs = allTabs.filter(tab => tab.visible);

    // 2. State for Active Tab
    // Default to the first visible tab, or empty string if none
    const [activeTab, setActiveTab] = useState(visibleTabs.length > 0 ? visibleTabs[0].id : '');

    // Header Stats State
    const [headerStats, setHeaderStats] = useState({
        profit: 0,
        yieldVal: 0,
        yesterdayProfit: 0
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
                    // Dynamic Lookup for Yesterday's Profit from Chart Evolution
                    // This is more robust than relying on the single summary field
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];

                    let yesterdayProfitVal = 0;

                    // Try to find in chart_evolution first (User Preferred Source)
                    if (Array.isArray(json.stats.chart_evolution)) {
                        const yesterdayEntry = json.stats.chart_evolution.find((e: any) => e.date === yesterdayStr);
                        if (yesterdayEntry) {
                            yesterdayProfitVal = yesterdayEntry.daily_profit;
                        } else {
                            // usage fallback if not in array
                            yesterdayProfitVal = json.stats.yesterday_profit ?? 0;
                        }
                    } else {
                        // Fallback to summary property
                        yesterdayProfitVal = json.stats.yesterday_profit ?? 0;
                    }

                    setHeaderStats({
                        profit: json.stats.total_profit || 0,
                        yieldVal: json.stats.yield || 0,
                        yesterdayProfit: yesterdayProfitVal
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

    // 3. Scroll & Swipe Logic (Replaced manual touch handlers)
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Sync Scroll to Active Tab (Bidirectional Sync)
    const handleScroll = () => {
        if (!scrollRef.current) return;
        const scrollLeft = scrollRef.current.scrollLeft;
        const width = scrollRef.current.clientWidth;

        // Find visible index
        const index = Math.round(scrollLeft / width);

        // Update active tab if changed
        if (visibleTabs[index] && visibleTabs[index].id !== activeTab) {
            triggerTouchFeedback(); // Haptic on swipe change
            setActiveTab(visibleTabs[index].id);
        }
    };

    const scrollToTab = (tabId: string) => {
        triggerTouchFeedback(); // Haptic on click
        setActiveTab(tabId);
        const index = visibleTabs.findIndex(t => t.id === tabId);
        if (scrollRef.current && index >= 0) {
            scrollRef.current.scrollTo({
                left: index * scrollRef.current.clientWidth,
                behavior: 'smooth'
            });
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
        <div className="w-full">
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
                        {settings.show_announcement && settings.announcement_text ? (
                            <p className={`uppercase tracking-widest font-bold mt-0.5 animate-pulse ${settings.announcement_type === 'warning' ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)] text-[11px]' : 'text-blue-400 text-[10px]'}`}>
                                {settings.announcement_text}
                            </p>
                        ) : (
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold mt-0.5">
                                Actualización Diaria 10:00 AM
                            </p>
                        )}

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
                                onClick={() => scrollToTab(tab.id)}
                                onTouchStart={() => triggerTouchFeedback()}
                                className={`
                                    btn-active-effect
                                    flex-1 md:flex-none py-3 px-4 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform 
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

            {/* HORIZONTAL SCROLL SNAP CONTAINER */}
            <div
                ref={scrollRef}
                className="flex-1 w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                style={{ scrollBehavior: 'smooth' }}
                onScroll={handleScroll}
            >
                {visibleTabs.map(tab => (
                    <div
                        key={tab.id}
                        className="min-w-full w-full snap-start flex-shrink-0"
                        style={{ willChange: 'transform' }}
                    >
                        <div className="w-full max-w-7xl mx-auto px-2 md:px-4 pt-4 pb-4 md:pb-8 min-h-[50vh]">
                            {tab.id === 'daily_bets' && (
                                <div className="animate-in fade-in duration-500">
                                    <DailyPredictions predictions={predictions} isAdmin={false} />
                                </div>
                            )}

                            {tab.id === 'calendar' && (
                                <div className="animate-in fade-in duration-500">
                                    <ResultsCalendar />
                                </div>
                            )}

                            {tab.id === 'analytics' && (
                                <div className="animate-in fade-in duration-500">
                                    <AdminAnalytics />
                                </div>
                            )}

                            {tab.id === 'telegram' && (
                                <div className="animate-in fade-in duration-500">
                                    <TelegramAdmin />
                                </div>
                            )}

                            {tab.id === 'tiktok' && (
                                <div className="animate-in fade-in duration-500">
                                    <TikTokFactory formattedDate={formattedDate} predictions={predictions} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
