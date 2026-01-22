"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Lock, ArrowRight, RefreshCw, LayoutDashboard, DownloadCloud, BrainCircuit, ClipboardCheck, Activity as ActivityIcon, AlertTriangle, Database, ChevronDown, ChevronUp, Home } from 'lucide-react';
import { triggerTouchFeedback } from '@/utils/haptics';
import Link from 'next/link';
import { verifyAdminPassword } from './actions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';
import TelegramAdmin from '@/components/TelegramAdmin';

import TikTokFactory from '@/components/TikTokFactory';

type AdminGuardProps = {
    children: React.ReactNode;
    predictions?: any;
    formattedDate?: string;
    rawDate?: string;
};

export default function AdminGuard({ children, predictions, formattedDate, rawDate }: AdminGuardProps) {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Tab State & Swipe Logic
    const [activeTab, setActiveTab] = useState<'analysis' | 'calendar' | 'analytics' | 'telegram' | 'tiktok' | 'settings'>('analysis');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const tabOrder = ['analysis', 'calendar', 'analytics', 'telegram', 'tiktok', 'settings'];

    // Sync scroll with state
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const width = scrollContainerRef.current.clientWidth;
        const index = Math.round(scrollLeft / width);

        const newTab = tabOrder[index] as any;
        if (newTab && newTab !== activeTab) {
            setActiveTab(newTab);
        }
    };

    const scrollToTab = (tab: string) => {
        const index = tabOrder.indexOf(tab);
        if (index !== -1 && scrollContainerRef.current) {
            const width = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollTo({
                left: width * index,
                behavior: 'smooth'
            });
            setActiveTab(tab as any);
        }
    };

    // Settings State
    const [settings, setSettings] = useState({
        show_daily_bets: true,
        show_calendar: true,
        show_analytics: true,
        show_telegram: false,
        show_tiktok: false,
        show_announcement: false,
        announcement_text: "",
        announcement_type: "info"
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [lastRun, setLastRun] = useState<{ date: string, status: string, message: string, script: string } | null>(null);
    const [saveNotification, setSaveNotification] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' });

    // Trigger States
    const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [checkStatus, setCheckStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [collectStatus, setCollectStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [showControls, setShowControls] = useState(false);

    // Header Stats State (Synced with HomeTabs)
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

        fetchStats();
    }, []);

    useEffect(() => {
        const sessionAuth = localStorage.getItem("admin_auth");
        if (sessionAuth === "true") {
            setIsAuthenticated(true);
        }
        setIsCheckingAuth(false);

        // Fetch Settings and Status
        fetch('/api/admin/settings')
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setSettings({
                        show_daily_bets: data.show_daily_bets ?? true,
                        show_calendar: true,
                        show_analytics: true,
                        show_telegram: false,
                        show_tiktok: data.show_tiktok ?? false,
                        show_announcement: data.show_announcement ?? false,
                        announcement_text: data.announcement_text ?? "",
                        announcement_type: data.announcement_type ?? "info"
                    });
                    if (data.last_run) {
                        setLastRun(data.last_run);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch settings", err));
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");

        const isValid = await verifyAdminPassword(passwordInput);

        if (isValid) {
            setIsAuthenticated(true);
            localStorage.setItem("admin_auth", "true");
        } else {
            setLoginError("Contraseña incorrecta. Inténtalo de nuevo.");
            setPasswordInput("");
        }
    };

    const triggerGitHubAction = async (endpoint: string, payload: any, setStatus: React.Dispatch<any>) => {
        if (!confirm(`¿Estás seguro de ejecutar esta acción? \n\nEsto iniciará un proceso en segundo plano.`)) return;

        setStatus('loading');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 5000);
            } else {
                setStatus('error');
                const data = await res.json();
                alert(`Error: ${data.details || data.error || 'Error desconocido'}`);
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (e) {
            setStatus('error');
            console.error(e);
            alert("Error de red.");
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    // Button 1: Comprobar -> calls /api/admin/trigger-check (triggers update_results_bet.yml)
    const handleCheckBets = () => {
        triggerGitHubAction('/api/admin/trigger-check', { date: formattedDate }, setCheckStatus);
    };

    // Button 2: Recolectar -> calls /api/admin/trigger (triggers daily_bet_update.yml)
    const handleCollect = () => {
        triggerGitHubAction('/api/admin/trigger', { mode: 'all' }, setCollectStatus);
    };

    // Button 3: Analizar -> calls /api/admin/trigger-analysis (triggers ai_analysis.yml)
    const handleAnalyze = () => {
        triggerGitHubAction('/api/admin/trigger-analysis', { mode: 'all' }, setAnalyzeStatus);
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            // Success
            setSaveNotification({ show: true, type: 'success', message: 'Configuración actualizada con éxito' });
            setTimeout(() => setSaveNotification(prev => ({ ...prev, show: false })), 3000);
        } catch (e) {
            setSaveNotification({ show: true, type: 'error', message: 'Error al guardar la configuración.' });
            setTimeout(() => setSaveNotification(prev => ({ ...prev, show: false })), 3000);
        } finally {
            setSavingSettings(false);
        }
    };

    if (isCheckingAuth) return null;

    // LOGIN UI
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
                <div className="absolute inset-0 blur-xl opacity-30 pointer-events-none select-none overflow-hidden scale-105">
                    {children}
                </div>
                <div className="absolute inset-0 bg-black/60 z-10" />

                <div className="relative z-20 w-full max-w-md p-8 mx-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <div className="p-4 bg-gradient-to-tr from-fuchsia-600 to-violet-600 rounded-full mb-6 shadow-lg shadow-fuchsia-500/30">
                        <Lock className="text-white w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Acceso Restringido</h2>
                    <p className="text-white/60 text-sm mb-8 text-center">Introduce credenciales de Admin.</p>

                    <form onSubmit={handleLogin} className="w-full space-y-4">
                        <div className="relative">
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Contraseña..."
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all text-center tracking-widest"
                                autoFocus
                            />
                        </div>
                        {loginError && <p className="text-red-400 text-xs text-center font-bold animate-pulse">{loginError}</p>}
                        <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 group">
                            <span>Entrar</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // AUTHENTICATED UI
    return (
        <div className="relative min-h-screen flex flex-col">
            {/* Top Bar Admin HUD */}
            <div className="sticky top-0 z-[100] w-full bg-black/95 backdrop-blur-lg border-b border-white/10 text-white shadow-2xl transition-all h-10">
                <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">

                    {/* Left Brand */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            ADMIN
                        </div>
                        <span className="text-xs text-gray-500 hidden md:inline-block">Control Center</span>
                    </div>



                    {/* Right Logout */}
                    <div className="shrink-0 flex items-center gap-3">
                        <Link href="/" className="text-xs font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/10 uppercase tracking-wider">
                            <Home className="w-3.5 h-3.5" />
                            Normal
                        </Link>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <button
                            onClick={() => {
                                localStorage.removeItem("admin_auth");
                                setIsAuthenticated(false);
                            }}
                            className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                        >
                            <Lock className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* HERO SECTION (Mirrored from Home) */}
            <div className="relative overflow-hidden border-b border-border bg-background">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-[128px] pointer-events-none opacity-50" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] pointer-events-none opacity-50" />

                <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 text-center relative z-10">

                    {/* Toggle Trigger (Badge Style) */}
                    <button
                        onClick={() => setShowControls(!showControls)}
                        className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground text-[10px] font-bold mb-3 hover:bg-secondary/80 transition-colors cursor-pointer border border-white/5 active:scale-95 group"
                    >
                        <ActivityIcon size={10} className="text-fuchsia-500 animate-pulse" />
                        <span>VISTA DE ADMINISTRADOR</span>
                        {showControls ? <ChevronUp size={10} className="text-muted-foreground ml-1" /> : <ChevronDown size={10} className="text-muted-foreground ml-1" />}
                    </button>

                    {/* Collapsible Admin Actions */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showControls ? 'max-h-[200px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
                        <div className="flex flex-col items-center justify-center gap-2 w-full max-w-md mx-auto pt-2">
                            <div className="flex items-center justify-center gap-2 w-full">
                                <button
                                    onClick={handleCheckBets}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    disabled={checkStatus === 'loading'}
                                    className={`btn-active-effect flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold border border-slate-500/50 transition-all whitespace-nowrap shadow-lg shadow-black/20 ${checkStatus === 'loading' ? 'opacity-50' : 'bg-slate-800/80 hover:bg-slate-700 hover:scale-105'}`}>
                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                    {checkStatus === 'loading' ? '...' : 'Comprobar'}
                                </button>
                                <button
                                    onClick={handleCollect}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    disabled={collectStatus === 'loading'}
                                    className={`btn-active-effect flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold border border-blue-500/50 transition-transform whitespace-nowrap shadow-lg shadow-blue-500/10 ${collectStatus === 'loading' ? 'opacity-50' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:scale-105'}`}>
                                    <Database className="w-3.5 h-3.5" />
                                    {collectStatus === 'loading' ? '...' : 'Recolectar'}
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    disabled={analyzeStatus === 'loading'}
                                    className={`btn-active-effect flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold border border-emerald-500/50 transition-transform whitespace-nowrap shadow-lg shadow-emerald-500/10 ${analyzeStatus === 'loading' ? 'opacity-50' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:scale-105'}`}>
                                    <BrainCircuit className="w-3.5 h-3.5" />
                                    {analyzeStatus === 'loading' ? '...' : 'Analizar'}
                                </button>
                            </div>

                            {/* Status Log */}
                            {lastRun && (
                                <div className="flex items-center justify-center gap-2 text-[10px] font-mono leading-none opacity-70 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                                    <span className={`font-bold uppercase ${lastRun.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {lastRun.status}
                                    </span>
                                    <span className="text-gray-600">|</span>
                                    <span className="text-fuchsia-300/80">
                                        {lastRun.script === 'Daily Analysis' ? 'Análisis' :
                                            lastRun.script === 'Check Results' ? 'Check' :
                                                lastRun.script}
                                    </span>
                                    <span className="text-gray-600">|</span>
                                    <span className="text-gray-400">{lastRun.date.split(' ')[1] || lastRun.date}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Title COMPACT */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mb-3">
                        <h1 className="text-2xl md:text-5xl font-black tracking-tighter leading-none">
                            BET AI <span className="text-fuchsia-500">MASTER</span>
                        </h1>
                        <span className="hidden md:block text-muted-foreground/30 text-3xl font-thin">|</span>
                        <h2 className="text-lg md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient">
                            PANEL DE CONTROL
                        </h2>
                    </div>

                    {/* Date & Stats Row - SINGLE LINE LAYOUT */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-3">
                        {/* Date */}
                        <div className="flex flex-col items-center md:items-end">
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
                        </div>

                        <span className="hidden md:block text-muted-foreground/20">|</span>

                        {/* SOCIAL PROOF TICKER */}
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
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-black/80 backdrop-blur-md border-b border-white/5 sticky top-16 z-[90]">
                <div className="max-w-7xl mx-auto px-2 md:px-4 flex justify-between md:justify-start md:gap-6 overflow-x-hidden">
                    <button
                        onClick={() => scrollToTab('analysis')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'analysis' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">🎯 Análisis</span>
                        <span className="hidden md:block">🎯 Análisis</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('calendar')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'calendar' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">📅 Calendario</span>
                        <span className="hidden md:block">📅 Calendario</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('analytics')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'analytics' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">📊 Estadísticas</span>
                        <span className="hidden md:block">📊 Estadísticas</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('telegram')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'telegram' ? 'border-sky-500 text-sky-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">✈️ Telegram</span>
                        <span className="hidden md:block">✈️ Telegram</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('tiktok')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'tiktok' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">🏭 Tiktok</span>
                        <span className="hidden md:block">🏭 TikTok Factory</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('settings')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'settings' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">⚙️ Ajustes</span>
                        <span className="hidden md:block">⚙️ Ajustes</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area - SWIPEABLE */}
            <div className="flex-1 relative min-h-[calc(100vh-8rem)] bg-background/50">
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full items-start"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {/* Tab 1: Analysis */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing h-full">
                        <main className="max-w-7xl mx-auto px-4 py-8">
                            <div className="opacity-90 hover:opacity-100 transition-opacity">
                                {children}
                            </div>
                        </main>
                    </div>

                    {/* Tab 2: Calendar */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing">
                        <main className="max-w-7xl mx-auto px-4 pt-8 pb-0">
                            <ResultsCalendar />
                        </main>
                    </div>

                    {/* Tab 3: Analytics */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing h-full">
                        <main className="max-w-7xl mx-auto px-4 py-8">
                            <AdminAnalytics />
                        </main>
                    </div>

                    {/* Tab: Telegram */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing h-full">
                        <main className="max-w-7xl mx-auto px-4 py-8">
                            <TelegramAdmin />
                        </main>
                    </div>

                    {/* Tab 4: TikTok Factory */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing h-full">
                        <main className="max-w-7xl mx-auto px-4 py-8 h-full">
                            {predictions && formattedDate ? (
                                <TikTokFactory predictions={predictions} formattedDate={formattedDate} rawDate={rawDate} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-white/50">
                                    Cargando datos para TikTok Factory...
                                </div>
                            )}
                        </main>
                    </div>

                    {/* Tab 5: Settings */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing h-full">
                        <main className="max-w-7xl mx-auto px-4 py-8">
                            <div className="max-w-2xl mx-auto bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-8">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <BrainCircuit className="text-fuchsia-500" />
                                    Control de Visibilidad (Home)
                                </h3>

                                <div className="space-y-6">
                                    {/* Item 1 */}
                                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-white/5">
                                        <div>
                                            <h4 className="font-bold">Mostrar Apuestas Diarias</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Habilita las 3 tarjetas de predicción en la Home.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.show_daily_bets}
                                                onChange={(e) => setSettings({ ...settings, show_daily_bets: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                        </label>
                                    </div>

                                    {/* Item 2 */}
                                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-white/5">
                                        <div>
                                            <h4 className="font-bold">Mostrar Calendario</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Muestra el calendario de resultados históricos al público.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.show_calendar}
                                                onChange={(e) => setSettings({ ...settings, show_calendar: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                        </label>
                                    </div>

                                    {/* Item 3 */}
                                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-white/5">
                                        <div>
                                            <h4 className="font-bold">Mostrar Analítica</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Muestra las gráficas de rendimiento (Beta) al público.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.show_analytics}
                                                onChange={(e) => setSettings({ ...settings, show_analytics: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                        </label>
                                    </div>

                                    {/* Item New: Telegram */}
                                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-white/5">
                                        <div>
                                            <h4 className="font-bold">Mostrar Telegram</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Muestra la pestaña de Telegram en la Home (Pública).</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.show_telegram}
                                                onChange={(e) => setSettings({ ...settings, show_telegram: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                                        </label>
                                    </div>

                                    {/* Item 4: TikTok Factory (Admin Only Visibility) */}
                                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-white/5 border-l-4 border-l-fuchsia-500">
                                        <div>
                                            <h4 className="font-bold text-fuchsia-400">Mostrar TikTok Factory</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Habilita el generador de contenido (Solo visible en Admin).</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.show_tiktok}
                                                onChange={(e) => setSettings({ ...settings, show_tiktok: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                        </label>
                                    </div>

                                    {/* Item 5: Global Announcement */}
                                    <div className="flex flex-col p-4 bg-secondary/30 rounded-xl border border-white/5 gap-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className={`font-bold transition-colors ${settings.announcement_type === 'warning' ? 'text-rose-400' : 'text-blue-400'}`}>Mostrar Anuncio Global</h4>
                                                <p className="text-xs text-muted-foreground mt-1">Muestra un mensaje destacado arriba en la Home.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={settings.show_announcement}
                                                    onChange={(e) => setSettings({ ...settings, show_announcement: e.target.checked })}
                                                />
                                                <div className={`w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${settings.announcement_type === 'warning' ? 'peer-checked:bg-rose-500' : 'peer-checked:bg-blue-500'}`}></div>
                                            </label>
                                        </div>

                                        {/* Expanded Options */}
                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${settings.show_announcement ? 'max-h-[300px] opacity-100 pt-4 border-t border-white/5' : 'max-h-0 opacity-0'}`}>
                                            <div className="space-y-4">
                                                {/* Type Selector */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => setSettings({ ...settings, announcement_type: 'info' })}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${settings.announcement_type === 'info' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'}`}
                                                    >
                                                        <ActivityIcon size={14} />
                                                        Información
                                                    </button>
                                                    <button
                                                        onClick={() => setSettings({ ...settings, announcement_type: 'warning' })}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${settings.announcement_type === 'warning' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'}`}
                                                    >
                                                        <AlertTriangle size={14} />
                                                        Importante
                                                    </button>
                                                </div>

                                                {/* Text Input */}
                                                <div>
                                                    <label className="text-xs font-bold text-gray-400 mb-1.5 block">Mensaje del Anuncio</label>
                                                    <textarea
                                                        value={settings.announcement_text}
                                                        onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })}
                                                        placeholder="Escribe aquí el anuncio..."
                                                        rows={2}
                                                        className={`w-full bg-black/40 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors placeholder:text-white/20 resize-none ${settings.announcement_type === 'warning' ? 'border-rose-500/30 focus:border-rose-500' : 'border-white/10 focus:border-blue-500'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveSettings}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    disabled={savingSettings}
                                    className="btn-active-effect w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 rounded-xl transition-transform shadow-lg shadow-fuchsia-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingSettings ? <RefreshCw className="animate-spin w-4 h-4" /> : <DownloadCloud className="w-4 h-4 rotate-180" />}
                                    {savingSettings ? 'Guardando...' : 'Guardar Configuración'}
                                </button>

                                {/* Notification Toast */}
                                {saveNotification.show && (
                                    <div className={`fixed bottom-8 right-8 z-50 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${saveNotification.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                                        }`}>
                                        <div className={`p-2 rounded-full ${saveNotification.type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                            {saveNotification.type === 'success' ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">{saveNotification.type === 'success' ? '¡Éxito!' : 'Error'}</h4>
                                            <p className="text-xs opacity-90">{saveNotification.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </div >
        </div >
    );
}
