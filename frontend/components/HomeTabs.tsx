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

    // Get Dynamic Stake for Banner
    let stakazoStake = 10;
    if (Array.isArray(stakazoPredictions) && stakazoPredictions.length > 0) {
        stakazoStake = stakazoPredictions[0].stake || 10;
    } else if (stakazoPredictions?.stake) {
        stakazoStake = stakazoPredictions.stake || 10;
    }

    // 2. State for Active Tab
    const [activeTab, setActiveTab] = useState(visibleTabs.length > 0 ? visibleTabs.find(t => t.id === 'daily_bets')?.id || visibleTabs[0].id : '');

    // Layout Flash Prevention: Only show content when scroll is synced
    // If active tab is first (index 0), we are ready immediately. Otherwise wait for scroll effect.
    const [isReady, setIsReady] = useState(() => {
        if (visibleTabs.length === 0) return true;
        const initialTab = visibleTabs.find(t => t.id === 'daily_bets')?.id || visibleTabs[0].id;
        return initialTab === visibleTabs[0].id; // Ready only if first tab is target
    });

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

    // 3. Simple Swipe Logic (No Scroll Container)
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null); // To detect vertical scroll

    // Minimum swipe distance (px)
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null); // Reset
        setTouchStart(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd || !touchStartY) return;

        const distanceX = touchStart - touchEnd;
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;

        // Use a generic valid y distance or check relative X vs Y to ensure horizontal intent
        // Here we can check if horizontal distance is significantly larger than vertical movement
        // However, we don't track TouchMove Y here properly without state update which might be laggy.
        // Simplified: simple X distance check is usually okay if we don't preventDefault.

        // Find current index
        const currentIndex = visibleTabs.findIndex(t => t.id === activeTab);
        if (currentIndex === -1) return;

        if (isLeftSwipe) {
            // Next Tab
            if (currentIndex < visibleTabs.length - 1) {
                const nextTab = visibleTabs[currentIndex + 1];
                triggerTouchFeedback();
                setActiveTab(nextTab.id);
            }
        }

        if (isRightSwipe) {
            // Prev Tab
            if (currentIndex > 0) {
                const prevTab = visibleTabs[currentIndex - 1];
                triggerTouchFeedback();
                setActiveTab(prevTab.id);
            }
        }
    };

    // Simplified Tab Click Handler
    const scrollToTab = (tabId: string) => {
        triggerTouchFeedback();
        setActiveTab(tabId);
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

                <div className="max-w-4xl mx-auto px-4 py-2 md:py-6 text-center relative z-10">

                    {/* Main Title COMPACT & SPACIOUS (Single Line) */}
                    <div className="flex flex-row items-baseline justify-center gap-2 mb-2 md:mb-3">
                        <h1 className="text-base md:text-5xl font-black tracking-tighter leading-none whitespace-nowrap">
                            BET AI <span className="text-fuchsia-500">MASTER</span>
                        </h1>
                        <span className="text-muted-foreground/30 text-sm md:text-3xl font-thin">|</span>
                        <h2 className="text-sm md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient whitespace-nowrap">
                            PREDICCIONES
                        </h2>
                    </div>

                    {/* Date & Stats Row - FLEXIBLE (Priority Center) */}
                    <div className="flex flex-row items-center justify-between gap-2 w-full pb-1 mb-1 md:mb-2 px-1">
                        {/* LEFT: Date (Auto Width) */}
                        <div className="flex-none flex justify-start">
                            <p className="text-xs md:text-sm text-muted-foreground font-medium capitalize flex items-center gap-1 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {formattedDate.split(',')[0]} {formattedDate.split(',')[1]?.split(' ')[1]}
                            </p>
                        </div>

                        {/* CENTER: Info / Update Time (Flex Grow) */}
                        <div className="flex-1 flex justify-center min-w-0">
                            {settings.show_announcement && settings.announcement_text ? (
                                <div className={`w-full px-1.5 py-0.5 rounded-full border text-[10px] md:text-xs font-medium flex items-center justify-center gap-1 ${settings.announcement_type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-500'}`}>
                                    <AlertTriangle size={10} className="shrink-0" />
                                    <span className="whitespace-nowrap">{settings.announcement_text}</span>
                                </div>
                            ) : (
                                <div className="text-[10px] text-muted-foreground whitespace-nowrap">Actualizado 09:00 AM</div>
                            )}
                        </div>

                        {/* RIGHT: Balance (Auto Width) */}
                        <div className="flex-none flex justify-end">
                            {settings.show_analytics && (
                                <div className={`flex items-center gap-1 text-xs font-bold ${headerStats.profit >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                                    <Activity size={12} />
                                    <span>{headerStats.profit >= 0 ? '+' : ''}{headerStats.profit}u</span>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* STAKAZO BANNER (Balanced Mobile) */}
                    {settings.show_stakazo_alert && settings.show_stakazo_menu && activeTab !== 'stakazo' && (
                        <div className="mt-2 md:mt-6 animate-in zoom-in fade-in duration-500">
                            <button
                                onClick={() => scrollToTab('stakazo')}
                                className="group relative overflow-hidden rounded-xl md:rounded-3xl bg-[#080808] border border-amber-500/40 w-full md:max-w-sm mx-auto shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all active:scale-[0.98] hover:border-amber-500/60"
                            >
                                {/* Animated Gradient Glow Background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 z-10" />

                                {/* Balanced Layout (h-[52px]) */}
                                <div className="relative z-0 px-3 h-[52px] md:h-auto md:p-5 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 md:gap-0">

                                    {/* START: Icon + Label */}
                                    <div className="flex items-center gap-2 md:mb-2">
                                        <div className="p-1.5 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)] md:p-2">
                                            <Trophy size={14} className="text-white fill-white/20 md:w-5 md:h-5" />
                                        </div>

                                        {/* Mobile Text */}
                                        <span className="text-xs font-black text-white tracking-tighter md:hidden">
                                            💎 STAKAZO <span className="text-amber-500">{stakazoStake}</span>
                                        </span>

                                        {/* Desktop Text */}
                                        <div className="hidden md:flex flex-col items-start leading-none">
                                            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-[0.2em] mb-1 animate-pulse">Acceso Exclusivo</span>
                                            <span className="text-3xl font-black text-white tracking-tighter drop-shadow-md">
                                                STAKAZO <span className="text-amber-500">{stakazoStake}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* CENTER: Text (Mobile Only) */}
                                    <div className="md:hidden flex-1 text-center">
                                        <span className="text-[10px] text-amber-500/60 font-medium uppercase tracking-wider block">
                                            Acceso Exclusivo
                                        </span>
                                    </div>

                                    {/* Desktop Divider */}
                                    <div className="hidden md:block h-px w-32 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent my-1" />

                                    {/* END: CTA */}
                                    <span className="text-[10px] text-gray-400 font-medium group-hover:text-amber-400 transition-colors whitespace-nowrap flex items-center gap-1">
                                        <span className="hidden md:inline">Click para revelar</span> Ver &rarr;
                                    </span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* TAB NAVIGATION */}
            {
                visibleTabs.length > 1 && (
                    <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-border/50">
                        <div className="max-w-7xl mx-auto px-2 md:px-4 flex justify-center md:justify-start">
                            {visibleTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => scrollToTab(tab.id)}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    className={`
                                    btn-active-effect
                                    flex-1 md:flex-none py-3 px-3 md:py-4 md:px-4 text-xs md:text-sm font-bold border-b-2 transition-transform 
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
                )
            }

            {/* CONTENT CONTAINER - DIRECT RENDERING WITH SWIPE */}
            <div
                className="flex-1 w-full animate-in fade-in duration-300 min-h-[50vh]"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className="w-full max-w-7xl mx-auto px-2 md:px-4 pt-4 pb-0">
                    {activeTab === 'stakazo' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <div className="mb-4 p-5 rounded-3xl bg-gradient-to-br from-[#080808] to-[#1a1a1a] border border-amber-500/20 text-center relative overflow-hidden shadow-lg group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 opacity-80" />
                                <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all duration-500" />

                                <h3 className="text-white font-black text-xl md:text-2xl tracking-tighter flex items-center justify-center gap-2 mb-2 drop-shadow-md">
                                    <Trophy size={22} className="text-amber-400 fill-amber-400/20 animate-pulse" />
                                    <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                                        INVERSIÓN DE ALTA FIDELIDAD
                                    </span>
                                </h3>
                                <p className="text-sm text-gray-400 font-medium max-w-lg mx-auto leading-relaxed">
                                    Selección de máxima confianza basada en la explotación de ineficiencias críticas del mercado.
                                </p>
                                <p className="text-xs text-amber-400/90 font-serif italic mt-3 tracking-wide animate-pulse">
                                    ✨ Acceso Premium gratuito por tiempo limitado ✨
                                </p>
                            </div>
                            <DailyPredictions predictions={stakazoPredictions} isAdmin={false} hideHeader={true} />
                        </div>
                    )}

                    {activeTab === 'daily_bets' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <DailyPredictions predictions={predictions} isAdmin={false} />
                        </div>
                    )}

                    {activeTab === 'calendar' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <ResultsCalendar showStakazoToggle={settings.show_stakazo_calendar} />
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <AdminAnalytics showStakazoToggle={settings.show_stakazo_analytics} />
                        </div>
                    )}

                    {activeTab === 'telegram' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <TelegramAdmin />
                        </div>
                    )}

                    {activeTab === 'tiktok' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <TikTokFactory formattedDate={formattedDate} predictions={predictions} />
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
