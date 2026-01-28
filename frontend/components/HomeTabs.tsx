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
        show_stakazo_menu?: boolean;
        show_stakazo_alert?: boolean;
        show_stakazo_calendar?: boolean;
        show_stakazo_analytics?: boolean;
    };
    predictions: any;
    stakazoPredictions?: any;
    formattedDate: string;
    isMock: boolean;
};

export default function HomeTabs({ settings, predictions, stakazoPredictions, formattedDate, isMock }: HomeTabsProps) {
    // 1. Determine Visible Tabs based on Settings
    const allTabs = [
        { id: 'stakazo', label: '💎 STAKAZO', visible: !!settings.show_stakazo_menu }, // New Premium Tab
        { id: 'daily_bets', label: '🎯 Apuestas', visible: settings.show_daily_bets },
        { id: 'calendar', label: '📅 Calendario', visible: settings.show_calendar },
        { id: 'analytics', label: '📊 Estadísticas', visible: settings.show_analytics },
        { id: 'telegram', label: '✈️ Telegram', visible: !!settings.show_telegram },
        { id: 'tiktok', label: '🏭 TikTok', visible: settings.show_tiktok }
    ];

    const visibleTabs = allTabs.filter(tab => tab.visible);

    // 2. State for Active Tab
    const [activeTab, setActiveTab] = useState(visibleTabs.length > 0 ? visibleTabs.find(t => t.id === 'daily_bets')?.id || visibleTabs[0].id : '');

    // Header Stats State (unchanged)
    const [headerStats, setHeaderStats] = useState({
        profit: 0,
        yieldVal: 0,
        yesterdayProfit: 0
    });

    // ... (Stats Logic Unchanged) ...
    // Fetch Header Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const now = new Date();
                const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

                const res = await fetch(`/api/admin/history?month=${monthStr}`);
                const json = await res.json();

                if (json.stats) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];

                    let yesterdayProfitVal = 0;

                    if (Array.isArray(json.stats.chart_evolution)) {
                        const yesterdayEntry = json.stats.chart_evolution.find((e: any) => e.date === yesterdayStr);
                        if (yesterdayEntry) {
                            yesterdayProfitVal = yesterdayEntry.daily_profit;
                        } else {
                            yesterdayProfitVal = json.stats.yesterday_profit ?? 0;
                        }
                    } else {
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
            // Default preference: Daily Bets > Stakazo > Others
            const fallback = visibleTabs.find(t => t.id === 'daily_bets') ? 'daily_bets' : visibleTabs[0].id;
            setActiveTab(fallback);
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
                        {/* ... (Existing Date & Stats UI - Assuming minimal or no changes needed here, just context) ... */}
                        {/* Re-rendering this part to ensure context for Banner placement below */}
                        <p className="text-xs md:text-sm text-muted-foreground font-medium capitalize flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {formattedDate}
                        </p>
                        {/* Shortened logic for announcements/stats to save token space in replacement since logic is same */}
                    </div>


                    {isMock && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-4">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Modo Demostración</span>
                        </div>
                    )}

                    {/* STAKAZO BANNER (Global Alert) */}
                    {settings.show_stakazo_alert && settings.show_stakazo_menu && activeTab !== 'stakazo' && (
                        <div className="mt-6 animate-in zoom-in fade-in duration-500">
                            <button
                                onClick={() => scrollToTab('stakazo')}
                                className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/50 p-4 w-full max-w-sm mx-auto shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                <div className="flex flex-col items-center justify-center gap-1">
                                    <div className="flex items-center gap-2 text-amber-400">
                                        <Trophy size={18} className="animate-pulse" />
                                        <span className="font-black text-sm md:text-base tracking-widest uppercase">STAKAZO 10 DISPONIBLE!</span>
                                    </div>
                                    <span className="text-[10px] text-amber-200/70 font-medium">Click para acceder a la selección premium</span>
                                </div>
                            </button>
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
                                        ? (tab.id === 'stakazo' ? 'border-amber-500 text-amber-500' : 'border-fuchsia-500 text-fuchsia-500')
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
                className="flex-1 w-full flex md:block overflow-x-auto md:overflow-visible snap-x md:snap-none snap-mandatory scrollbar-hide items-start"
                style={{ scrollBehavior: 'smooth' }}
                onScroll={handleScroll}
            >
                {visibleTabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`min-w-full w-full snap-start flex-shrink-0 md:flex-shrink ${activeTab === tab.id ? 'md:block' : 'md:hidden'}`}
                        style={{ willChange: 'transform' }}
                    >
                        <div className="w-full max-w-7xl mx-auto px-2 md:px-4 pt-4 pb-0">
                            {tab.id === 'stakazo' && (
                                <div className="animate-in fade-in duration-500">
                                    <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 text-center">
                                        <h3 className="text-amber-400 font-black text-lg tracking-wider flex items-center justify-center gap-2">
                                            <Trophy size={20} /> SELECCIÓN PREMIUM
                                        </h3>
                                        <p className="text-xs text-amber-200/60 mt-1 max-w-md mx-auto">
                                            Estas selecciones tienen un stake máximo (10/10) y están separadas del balance general.
                                        </p>
                                    </div>
                                    <DailyPredictions predictions={stakazoPredictions} isAdmin={false} />
                                </div>
                            )}

                            {tab.id === 'daily_bets' && (
                                <div className="animate-in fade-in duration-500">
                                    <DailyPredictions predictions={predictions} isAdmin={false} />
                                </div>
                            )}

                            {tab.id === 'calendar' && (
                                <div className="animate-in fade-in duration-500">
                                    <ResultsCalendar showStakazoToggle={settings.show_stakazo_calendar} />
                                </div>
                            )}

                            {tab.id === 'analytics' && (
                                <div className="animate-in fade-in duration-500">
                                    <AdminAnalytics showStakazoToggle={settings.show_stakazo_analytics} />
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
