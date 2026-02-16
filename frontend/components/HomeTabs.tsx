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
    // State for Calendar Deep Linking
    const [calendarCategory, setCalendarCategory] = useState<string | undefined>(undefined);

    // Layout Flash Prevention: Only show content when scroll is synced
    // If active tab is first (index 0), we are ready immediately. Otherwise wait for scroll effect.
    const [isReady, setIsReady] = useState(() => {
        if (visibleTabs.length === 0) return true;
        const initialTab = visibleTabs.find(t => t.id === 'daily_bets')?.id || visibleTabs[0].id;
        return initialTab === visibleTabs[0].id; // Ready only if first tab is target
    });

    // Header Stats State (Split)
    const [headerStats, setHeaderStats] = useState({
        daily: { profit: 0, yieldVal: 0 },
        stakazo: { profit: 0, yieldVal: 0 }
    });

    // Fetch Header Stats (Dual)
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const now = new Date();
                const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

                // Parallel Fetch
                const [resDaily, resStakazo] = await Promise.all([
                    fetch(`/api/admin/history?month=${monthStr}&category=daily_bets`),
                    fetch(`/api/admin/history?month=${monthStr}&category=daily_bets_stakazo`)
                ]);

                const [jsonDaily, jsonStakazo] = await Promise.all([
                    resDaily.json(),
                    resStakazo.json()
                ]);

                setHeaderStats({
                    daily: {
                        profit: jsonDaily?.stats?.total_profit || 0,
                        yieldVal: jsonDaily?.stats?.yield || 0
                    },
                    stakazo: {
                        profit: jsonStakazo?.stats?.total_profit || 0,
                        yieldVal: jsonStakazo?.stats?.yield || 0
                    }
                });

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
            const fallback = visibleTabs.find(t => t.id === 'daily_bets') ? 'daily_bets' : visibleTabs[0].id;
            setActiveTab(fallback);
        }
    }, [visibleTabs, activeTab]);

    // ... (Swipe Logic unchanged) ...

    // 3. Simple Swipe Logic (No Scroll Container)
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);

    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
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
        const currentIndex = visibleTabs.findIndex(t => t.id === activeTab);
        if (currentIndex === -1) return;

        if (isLeftSwipe && currentIndex < visibleTabs.length - 1) {
            const nextTab = visibleTabs[currentIndex + 1];
            triggerTouchFeedback();
            setActiveTab(nextTab.id);
        }
        if (isRightSwipe && currentIndex > 0) {
            const prevTab = visibleTabs[currentIndex - 1];
            triggerTouchFeedback();
            setActiveTab(prevTab.id);
        }
    };


    // Robust Tab Navigation with Error Handling
    const scrollToTab = (tabId: string, targetCategory?: string) => {
        const targetTab = visibleTabs.find(t => t.id === tabId);
        if (!targetTab) {
            console.warn(`Attempted to navigate to hidden/invalid tab: ${tabId}`);
            return; // ERROR HANDLING: Do nothing if tab doesn't exist/is hidden
        }

        triggerTouchFeedback();

        // If navigating to calendar with a specific category, set it
        if (tabId === 'calendar' && targetCategory) {
            setCalendarCategory(targetCategory);
        }

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

                    {/* REDESIGNED HEADER: 2-Row Layout */}

                    {/* ROW 1: Update/Banner Only (Centered) */}
                    <div className="flex justify-center w-full mb-4">
                        {settings.show_announcement && settings.announcement_text ? (
                            <div className={`px-4 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 shadow-sm ${settings.announcement_type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                                <AlertTriangle size={14} strokeWidth={2.5} />
                                <span>{settings.announcement_text}</span>
                            </div>
                        ) : (
                            <div className="bg-secondary/30 px-4 py-1.5 rounded-full border border-white/5 text-xs text-muted-foreground font-medium flex items-center gap-2">
                                <Activity size={14} className="text-violet-500" />
                                Actualización Diaria 09:00 AM
                            </div>
                        )}
                    </div>

                    {/* ROW 2: Compact Desktop Layout (Flex) / Mobile Standard (Column) */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 w-full mb-2">

                        {/* STAKAZO BANNER (Desktop: LEFT, Mobile: BOTTOM) */}
                        {settings.show_stakazo_alert && settings.show_stakazo_menu && activeTab !== 'stakazo' && (
                            <div className="w-full md:w-auto order-2 md:order-1 animate-in zoom-in fade-in duration-500">
                                <button
                                    onClick={() => scrollToTab('stakazo')}
                                    className="group relative overflow-hidden rounded-xl md:rounded-2xl bg-[#080808] border border-amber-500/40 w-full md:w-auto shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all active:scale-[0.98] hover:border-amber-500/60"
                                >
                                    {/* Animated Gradient Glow Background */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 z-10" />

                                    {/* Compact Layout for Desktop */}
                                    <div className="relative z-0 px-3 h-[52px] md:h-auto md:p-3 md:px-5 flex flex-row items-center justify-between md:justify-center gap-2 md:gap-3">

                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                                                <Trophy size={14} className="text-white fill-white/20" />
                                            </div>

                                            <div className="flex flex-col items-start leading-none">
                                                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-[0.1em] mb-0.5 animate-pulse hidden md:block">Acceso Exclusivo</span>
                                                <span className="text-xs md:text-lg font-black text-white tracking-tighter drop-shadow-md">
                                                    STAKAZO <span className="text-amber-500">{stakazoStake}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Mobile Text center spacer */}
                                        <div className="md:hidden flex-1 text-center">
                                            <span className="text-[10px] text-amber-500/60 font-medium uppercase tracking-wider block">
                                                Acceso Exclusivo
                                            </span>
                                        </div>

                                        <div className="w-px h-8 bg-gradient-to-b from-transparent via-amber-500/20 to-transparent mx-1 hidden md:block" />

                                        <span className="text-[10px] md:text-xs text-gray-400 font-medium group-hover:text-amber-400 transition-colors whitespace-nowrap flex items-center gap-1">
                                            <span className="hidden md:inline">Ver</span> &rarr;
                                        </span>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* UNITS SPLIT (Desktop: RIGHT, Mobile: TOP) */}
                        {settings.show_analytics && (
                            <div className="w-full md:w-auto order-1 md:order-2 grid grid-cols-2 gap-3 md:gap-4">
                                {/* Daily Bets Stats -> Redirects to Standard Calendar */}
                                <div className="relative bg-gradient-to-br from-secondary/40 to-secondary/10 cursor-pointer rounded-2xl p-2.5 md:p-3 md:px-5 border border-white/5 flex flex-col items-center justify-center transition-all hover:bg-secondary/30 active:scale-[0.98] group min-w-[100px]"
                                    onClick={() => scrollToTab('calendar', 'daily_bets')}
                                >
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider mb-0.5 group-hover:text-foreground transition-colors">
                                        🎯 Diarias
                                    </span>
                                    <div className={`text-xl md:text-2xl font-black tracking-tight leading-none ${headerStats.daily.profit >= 0 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.15)]' : 'text-foreground/90'}`}>
                                        {headerStats.daily.profit >= 0 ? '+' : ''}{headerStats.daily.profit.toFixed(2)}u
                                    </div>
                                </div>

                                {/* Stakazo Stats -> Redirects to Stakazo Calendar */}
                                <div className="relative bg-gradient-to-br from-amber-500/10 to-transparent cursor-pointer rounded-2xl p-2.5 md:p-3 md:px-5 border border-amber-500/20 flex flex-col items-center justify-center transition-all hover:bg-amber-500/15 active:scale-[0.98] group shadow-[0_0_20px_rgba(245,158,11,0.05)] min-w-[100px]"
                                    onClick={() => scrollToTab('calendar', 'daily_bets_stakazo')}
                                >
                                    <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors rounded-2xl" />
                                    <span className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider mb-0.5 flex items-center gap-1.5 group-hover:text-amber-400 transition-colors relative z-10">
                                        <Trophy size={10} strokeWidth={3} className="mb-0.5" /> Stakazo
                                    </span>
                                    <div className={`text-xl md:text-2xl font-black tracking-tight leading-none relative z-10 ${headerStats.stakazo.profit >= 0 ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'text-rose-400'}`}>
                                        {headerStats.stakazo.profit >= 0 ? '+' : ''}{headerStats.stakazo.profit.toFixed(2)}u
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
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
                            <ResultsCalendar
                                showStakazoToggle={settings.show_stakazo_calendar}
                                activeCategory={calendarCategory}
                            />
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
