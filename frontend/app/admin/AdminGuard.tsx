"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Activity as ActivityIcon, AlertOctagon, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, BrainCircuit, CheckCircle2,
    ChevronDown, ChevronRight, ChevronUp, ClipboardCheck, Clock, Database, DownloadCloud,
    FileText, Globe, Home, Info, LayoutDashboard, Lock, Menu, Play, PlayCircle, RefreshCw, Save,
    Settings, Shield, Trash2, Trophy, X, Calendar
} from 'lucide-react';
import { triggerTouchFeedback } from '@/utils/haptics';
import Link from 'next/link';
import { verifyAdminPassword } from './actions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';
import TelegramAdmin from '@/components/TelegramAdmin';
import ApiUsageBanner from '@/components/ApiUsageBanner';
import ExecutionTimeline from '@/components/ExecutionTimeline';

import TikTokFactory from '@/components/TikTokFactory';

type AdminGuardProps = {
    children: React.ReactNode;
    predictions?: any;
    formattedDate?: string;
    rawDate?: string;
};

// Helper functions
const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'INFO': return 'border-blue-500/50 text-blue-400 bg-blue-500/10';
        case 'WARN': return 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10';
        case 'ERROR': return 'border-red-500/50 text-red-400 bg-red-500/10';
        case 'WON': return 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10';
        case 'LOST': return 'border-rose-500/50 text-rose-400 bg-rose-500/10';
        case 'SKIP': return 'border-gray-500/50 text-gray-400 bg-gray-500/10';
        default: return 'border-white/20 text-white/60 bg-white/5';
    }
};

export default function AdminGuard({ children, predictions, formattedDate, rawDate }: AdminGuardProps) {
    // ... existing code ...
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
    // Control Panel Sub-tabs State
    const [activeControlTab, setActiveControlTab] = useState<'visibilidad' | 'anuncio' | 'acciones' | 'blacklist'>('acciones');
    const [visibilidadMode, setVisibilidadMode] = useState<'standard' | 'stakazo'>('standard');

    const [settings, setSettings] = useState({
        show_daily_bets: true,
        show_calendar: true,
        show_analytics: true,
        show_telegram: false,
        show_tiktok: false,
        show_announcement: false,
        announcement_text: "",
        announcement_type: "info",
        // STAKAZO GRANULAR SETTINGS
        show_stakazo_menu: false,
        show_stakazo_alert: false,
        show_stakazo_calendar: false,
        show_stakazo_analytics: false
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [lastRun, setLastRun] = useState<{ date: string, status: string, message: string, script: string } | null>(null);
    const [scriptsStatus, setScriptsStatus] = useState<Record<string, any>>({});
    const [blacklist, setBlacklist] = useState<Record<string, any>>({});
    const [loadingBlacklist, setLoadingBlacklist] = useState(false);
    const [logsList, setLogsList] = useState<any[]>([]);
    const [logsDate, setLogsDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [blacklistMode, setBlacklistMode] = useState<'list' | 'logs'>('list');
    const [saveNotification, setSaveNotification] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' });
    const [executionHistory, setExecutionHistory] = useState<any[]>([]);

    // Trigger States
    const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [checkStatus, setCheckStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [stakazoStatus, setStakazoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [collectStatus, setCollectStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [socialStatus, setSocialStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [tiktokViralStatus, setTikTokViralStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [showControls, setShowControls] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [actionModal, setActionModal] = useState<{
        show: boolean;
        title: string;
        onConfirm: () => void;
    }>({ show: false, title: '', onConfirm: () => { } });


    // Header Stats State (Synced with HomeTabs)
    const [headerStats, setHeaderStats] = useState({
        profit: 0,
        yieldVal: 0,
        yesterdayProfit: 0
    });

    // --- INITIALIZATION (Auth, Settings, Stats, Blacklist) ---
    useEffect(() => {
        // 1. Auth Logic
        const sessionAuth = localStorage.getItem("admin_auth");
        if (sessionAuth === "true") {
            setIsAuthenticated(true);
        }
        setIsCheckingAuth(false);

        // 2. Fetch Settings
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
                        announcement_type: data.announcement_type ?? "info",
                        show_stakazo_menu: data.show_stakazo_menu ?? false,
                        show_stakazo_alert: data.show_stakazo_alert ?? false,
                        show_stakazo_calendar: data.show_stakazo_calendar ?? false,
                        show_stakazo_analytics: data.show_stakazo_analytics ?? false
                    });
                    if (data.last_run) setLastRun(data.last_run);
                    if (data.scripts_status) setScriptsStatus(data.scripts_status);
                }
            })
            .catch(err => console.error("Failed to fetch settings", err));

        // 3. Fetch Header Stats
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
                    let yesterdayProfitVal = 120; // Default or fallback logic below

                    if (Array.isArray(json.stats.chart_evolution)) {
                        const yesterdayEntry = json.stats.chart_evolution.find((e: any) => e.date === yesterdayStr);
                        yesterdayProfitVal = yesterdayEntry ? yesterdayEntry.daily_profit : (json.stats.yesterday_profit ?? 0);
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

        // 4. Fetch Blacklist
        setLoadingBlacklist(true);
        fetch('/api/admin/blacklist')
            .then(res => res.json())
            .then(data => {
                if (data.blacklist) {
                    setBlacklist(data.blacklist);
                    // Si hay datos en la blacklist, ésta pasa a ser la primera viewbox, 
                    // así que la activamos por defecto siguiendo la lógica de orderedIds.
                    if (Object.keys(data.blacklist).length > 0) {
                        setActiveControlTab('blacklist');
                    }
                }
            })
            .catch(err => console.error("Failed to fetch blacklist", err))
            .finally(() => setLoadingBlacklist(false));

        // 5. Fetch Execution History (Timeline)
        fetch('/api/admin/system/timeline')
            .then(res => res.json())
            .then(data => {
                if (data.history) {
                    setExecutionHistory(data.history);
                }
            })
            .catch(err => console.error("Failed to fetch timeline history", err));

    }, []);

    const checkLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch(`/api/admin/check-logs?date=${logsDate}`);
            const data = await res.json();
            if (data && data.logs) {
                setLogsList(data.logs);
            } else if (Array.isArray(data)) {
                setLogsList(data);
            } else {
                setLogsList([]);
            }
        } catch (e) {
            console.error("Failed to fetch logs", e);
            setLogsList([]);
        } finally {
            setLoadingLogs(false);
        }
    };

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

    const executeAction = async (endpoint: string, payload: any, setStatus: React.Dispatch<any>) => {
        setActionModal(prev => ({ ...prev, show: false }));
        setStatus('loading');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setStatus('success');
                setSaveNotification({ show: true, type: 'success', message: 'Acción iniciada con éxito' });
                setTimeout(() => {
                    setStatus('idle');
                    setSaveNotification(prev => ({ ...prev, show: false }));
                }, 5000);
            } else {
                setStatus('error');
                const data = await res.json();
                setSaveNotification({ show: true, type: 'error', message: data.details || data.error || 'Error al iniciar' });
                setTimeout(() => {
                    setStatus('idle');
                    setSaveNotification(prev => ({ ...prev, show: false }));
                }, 5000);
            }
        } catch (e) {
            setStatus('error');
            setSaveNotification({ show: true, type: 'error', message: 'Error de red' });
            setTimeout(() => {
                setStatus('idle');
                setSaveNotification(prev => ({ ...prev, show: false }));
            }, 5000);
        }
    };

    const triggerGitHubAction = (endpoint: string, payload: any, setStatus: React.Dispatch<any>) => {
        setActionModal({
            show: true,
            title: '¿EJECUTAR ACCIÓN?',
            onConfirm: () => executeAction(endpoint, payload, setStatus)
        });
    };

    // Button 1: Comprobar -> calls /api/admin/trigger-check (triggers update_results_bet.yml)
    const handleCheckBets = () => {
        triggerGitHubAction('/api/admin/trigger-check', {}, setCheckStatus);
    };

    // Button 2: Recolectar -> calls /api/admin/trigger (triggers daily_bet_update.yml)
    const handleCollect = () => {
        triggerGitHubAction('/api/admin/trigger', { mode: 'fetch' }, setCollectStatus);
    };

    // Button 3: Analizar -> calls /api/admin/trigger-analysis (triggers ai_analysis.yml)
    const handleAnalyze = () => {
        triggerGitHubAction('/api/admin/trigger-analysis', {}, setAnalyzeStatus);
    };

    // Button 3.5: Analizar Stakazo -> calls /api/admin/trigger-stakazo-analysis
    const handleStakazoAnalyze = () => {
        triggerGitHubAction('/api/admin/trigger-stakazo-analysis', {}, setStakazoStatus);
    };

    // Button 4: TikTok Social -> calls /api/admin/trigger-social
    const handleSocial = () => {
        triggerGitHubAction('/api/admin/trigger-social', {}, setSocialStatus);
    };

    // Button 5: TikTok Viral Automation -> calls /api/admin/trigger-tiktok-viral
    const handleTikTokViral = () => {
        triggerGitHubAction('/api/admin/trigger-tiktok-viral', {}, setTikTokViralStatus);
    };

    const getStatusBadge = (scriptName: string) => {
        const status = scriptsStatus[scriptName];
        if (!status) return null;

        // Ajustar hora y fecha relativa
        let displayTime = '';
        let dateLabel = '';

        if (status.date) {
            try {
                // Parse date "YYYY-MM-DD HH:MM:SS"
                const [yymmdd, hhmmss] = status.date.split(' ');
                if (yymmdd && hhmmss) {
                    const [year, month, day] = yymmdd.split('-').map(Number);
                    const [hours, minutes, seconds] = hhmmss.split(':').map(Number);
                    const date = new Date(year, month - 1, day, hours, minutes, seconds);

                    // Add 1 hour for Spain Time if stored as UTC (Assuming logic persisted)
                    date.setHours(date.getHours() + 1);

                    displayTime = date.getHours().toString().padStart(2, '0') + ':' +
                        date.getMinutes().toString().padStart(2, '0') + ':' +
                        date.getSeconds().toString().padStart(2, '0');

                    // Relative Date Check
                    const today = new Date();
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);

                    // Reset times for date comparison
                    const dStr = date.toDateString();
                    if (dStr === today.toDateString()) {
                        dateLabel = "HOY";
                    } else if (dStr === yesterday.toDateString()) {
                        dateLabel = "AYER";
                    } else {
                        // DD/MM
                        dateLabel = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
                    }
                } else {
                    displayTime = status.date;
                }
            } catch (e) {
                displayTime = status.date.split(' ')[1] || '';
            }
        }

        const rawStatus = status.status || '';
        const isSuccess = rawStatus === 'SUCCESS';

        // Traducir estados
        let displayStatus = rawStatus;
        if (rawStatus === 'IDLE') displayStatus = 'SIN CAMBIOS';
        else if (rawStatus === 'SUCCESS') displayStatus = 'ÉXITO';
        else if (rawStatus === 'FAILURE' || rawStatus === 'ERROR') displayStatus = 'ERROR';

        return (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isSuccess ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <span>{displayStatus}</span>
                <span className="opacity-30">|</span>
                <span className={isSuccess ? (dateLabel === 'HOY' ? 'text-emerald-400' : 'text-emerald-400/50') : 'text-red-400'}>
                    {dateLabel && <span className="mr-1 opacity-70">{dateLabel}</span>}
                    {displayTime}
                </span>
            </div>
        );
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

    // Clear Blacklist Helper (Fetch is handled in main useEffect on mount)

    const handleClearBlacklist = async () => {
        try {
            await fetch('/api/admin/blacklist', { method: 'DELETE' });
            setBlacklist({});
            setSaveNotification({ show: true, type: 'success', message: 'Lista negra borrada' });
            setTimeout(() => setSaveNotification(prev => ({ ...prev, show: false })), 3000);
            setShowDeleteConfirm(false);
        } catch (e) {
            alert("Error al borrar.");
        }
    };

    useEffect(() => {
        if (activeControlTab === 'blacklist') {
            checkLogs();
        }
    }, [activeControlTab, logsDate]);


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
                                value={passwordInput || ""}
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
            <div className="sticky top-0 z-[100] w-full bg-white/90 dark:bg-black/95 backdrop-blur-lg border-b border-border/10 dark:border-white/10 text-foreground dark:text-white shadow-sm dark:shadow-2xl transition-all h-10">
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
                        <Link href="/" className="text-xs font-bold text-muted-foreground hover:text-foreground dark:text-gray-500 dark:hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary dark:hover:bg-white/10 uppercase tracking-wider">
                            <Home className="w-3.5 h-3.5" />
                            Normal
                        </Link>
                        <div className="w-px h-4 bg-border dark:bg-white/10 mx-1" />
                        <button
                            onClick={() => {
                                localStorage.removeItem("admin_auth");
                                setIsAuthenticated(false);
                            }}
                            className="text-muted-foreground hover:text-foreground dark:text-gray-500 dark:hover:text-white transition-colors p-1 hover:bg-secondary dark:hover:bg-white/10 rounded-full"
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
                        <div className="flex flex-nowrap items-center justify-start md:justify-center gap-1.5 md:gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide px-2">
                            {/* Profit Badge */}
                            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 md:px-2.5 py-1 rounded-lg shrink-0">
                                <span className="text-[8px] md:text-[9px] text-emerald-500/70 font-bold uppercase tracking-wider">Ganancias</span>
                                <span className="text-[10px] md:text-xs font-black text-emerald-400">+{headerStats.profit.toFixed(2)} u</span>
                            </div>

                            {/* Yield Badge */}
                            <div className="flex items-center gap-1 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 md:px-2.5 py-1 rounded-lg shrink-0">
                                <span className="text-[8px] md:text-[9px] text-fuchsia-500/70 font-bold uppercase tracking-wider">Yield</span>
                                <span className="text-[10px] md:text-xs font-black text-fuchsia-400">{headerStats.yieldVal.toFixed(2)}%</span>
                            </div>

                            {/* Yesterday Result (Only if exists) */}
                            {headerStats.yesterdayProfit !== null && (
                                <div className={`flex items-center gap-1 px-2 md:px-2.5 py-1 rounded-lg border shrink-0 ${headerStats.yesterdayProfit >= 0 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                    <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-wider ${headerStats.yesterdayProfit >= 0 ? 'text-blue-500/70' : 'text-rose-500/70'}`}>Ayer</span>
                                    <span className={`text-[10px] md:text-xs font-black ${headerStats.yesterdayProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                        {headerStats.yesterdayProfit > 0 ? '+' : ''}{headerStats.yesterdayProfit.toFixed(2)} u
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-border/10 dark:border-white/5 sticky top-10 z-[90]">
                <div className="max-w-7xl mx-auto px-2 md:px-4 flex justify-start md:gap-6 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => scrollToTab('analysis')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'analysis' ? 'border-fuchsia-500 text-fuchsia-500 dark:text-fuchsia-400' : 'border-transparent text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white'}`}
                    >
                        <span className="md:hidden">🎯 Análisis</span>
                        <span className="hidden md:block">🎯 Análisis</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('calendar')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'calendar' ? 'border-fuchsia-500 text-fuchsia-500 dark:text-fuchsia-400' : 'border-transparent text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white'}`}
                    >
                        <span className="md:hidden">📅 Cal</span>
                        <span className="hidden md:block">📅 Calendario</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('analytics')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'analytics' ? 'border-fuchsia-500 text-fuchsia-500 dark:text-fuchsia-400' : 'border-transparent text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white'}`}
                    >
                        <span className="md:hidden">📊 Stats</span>
                        <span className="hidden md:block">📊 Estadísticas</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('telegram')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'telegram' ? 'border-sky-500 text-sky-500 dark:text-sky-400' : 'border-transparent text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white'}`}
                    >
                        <span className="md:hidden">✈️ Tlgrm</span>
                        <span className="hidden md:block">✈️ Telegram</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('tiktok')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'tiktok' ? 'border-fuchsia-500 text-fuchsia-500 dark:text-fuchsia-400' : 'border-transparent text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white'}`}
                    >
                        <span className="md:hidden">🏭 Tiktok</span>
                        <span className="hidden md:block">🏭 TikTok Factory</span>
                    </button>
                    <button
                        onClick={() => scrollToTab('settings')}
                        onTouchStart={() => triggerTouchFeedback()}
                        className={`btn-active-effect flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-transform flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'settings' ? 'border-fuchsia-500 text-fuchsia-500 dark:text-fuchsia-400' : 'border-transparent text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white'}`}
                    >
                        <span className="md:hidden">⚙️ Panel</span>
                        <span className="hidden md:block">⚙️ Panel de Control</span>
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
                            <ResultsCalendar showStakazoToggle={true} />
                        </main>
                    </div>

                    {/* Tab 3: Analytics */}
                    <div className="w-full shrink-0 snap-start active:cursor-grabbing h-full">
                        <main className="max-w-7xl mx-auto px-4 py-8">
                            <AdminAnalytics showStakazoToggle={true} />
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
                            <div className="max-w-3xl mx-auto space-y-8">

                                {/* SUB-TABS NAVIGATION */}
                                <div className="flex items-center justify-start md:justify-center gap-2 md:gap-4 overflow-x-auto pt-4 pb-4 scrollbar-hide px-2">
                                    {(() => {
                                        const hasBlacklistData = Object.keys(blacklist).length > 0;

                                        const tabs = [
                                            { id: 'visibilidad', label: 'Visibilidad', icon: LayoutDashboard, activeClass: 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400 shadow-[0_0_15px_-3px_rgba(217,70,239,0.3)]' },
                                            { id: 'anuncio', label: 'Anuncio', icon: ActivityIcon, activeClass: 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]' },
                                            { id: 'acciones', label: 'Acciones', icon: PlayCircle, activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]' },
                                            { id: 'blacklist', label: 'Blacklist', icon: AlertOctagon, activeClass: 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]' },
                                        ];

                                        const orderedIds = hasBlacklistData
                                            ? ['blacklist', 'acciones', 'visibilidad', 'anuncio']
                                            : ['acciones', 'blacklist', 'visibilidad', 'anuncio'];

                                        return orderedIds.map(id => {
                                            const tab = tabs.find(t => t.id === id)!;
                                            const Icon = tab.icon;
                                            return (
                                                <button
                                                    key={`${tab.id}-${activeControlTab === tab.id}`}
                                                    onClick={() => setActiveControlTab(tab.id as any)}
                                                    className={`
                                                        flex flex-col items-center justify-center px-4 md:px-6 py-2 md:py-3 rounded-xl border transition-all min-w-[85px] md:min-w-[120px] hover:scale-105 active:scale-95 duration-200
                                                        ${activeControlTab === tab.id
                                                            ? tab.activeClass
                                                            : 'bg-secondary/40 dark:bg-white/5 border-border/10 dark:border-white/10 text-muted-foreground dark:text-white/40 hover:bg-secondary dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white/80'
                                                        }
                                                    `}
                                                >
                                                    <div className="mb-1">
                                                        <Icon size={18} className="md:w-5 md:h-5" />
                                                    </div>
                                                    <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                                                        {tab.label}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>

                                {/* CONTENT: VISIBILIDAD */}
                                {activeControlTab === 'visibilidad' && (
                                    <div className="bg-card dark:bg-card border border-border/10 dark:border-white/10 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-md">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <LayoutDashboard size={64} />
                                        </div>

                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/10 dark:border-white/5 pb-4">
                                            <h3 className="text-xl font-bold flex items-center gap-2 text-foreground dark:text-white">
                                                {visibilidadMode === 'standard' ? (
                                                    <LayoutDashboard className="text-fuchsia-500" size={24} />
                                                ) : (
                                                    <Trophy className="text-amber-500" size={24} />
                                                )}
                                                Visibilidad {visibilidadMode === 'standard' ? '(Home)' : '(Stakazo)'}
                                            </h3>

                                            {/* MODE TOGGLE */}
                                            <div className="flex bg-secondary dark:bg-black/40 p-1 rounded-lg border border-border/10 dark:border-white/10">
                                                <button
                                                    onClick={() => setVisibilidadMode('standard')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${visibilidadMode === 'standard' ? 'bg-white dark:bg-white/10 text-black dark:text-white shadow-lg' : 'text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white/70'}`}
                                                >
                                                    <LayoutDashboard size={14} />
                                                    STANDARD
                                                </button>
                                                <button
                                                    onClick={() => setVisibilidadMode('stakazo')}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${visibilidadMode === 'stakazo' ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 border border-amber-500/20 shadow-lg' : 'text-muted-foreground dark:text-white/40 hover:text-foreground dark:hover:text-white/70'}`}
                                                >
                                                    <Trophy size={14} />
                                                    STAKAZO
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-6 relative z-10 transition-all duration-300">
                                            {/* STANDARD CONTENT */}
                                            {visibilidadMode === 'standard' && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                                    {/* Item 1 */}
                                                    <div className="flex items-center justify-between p-4 bg-secondary/30 dark:bg-black/20 rounded-xl border border-border/10 dark:border-white/5 hover:border-border/30 dark:hover:border-white/10 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-foreground dark:text-white">Mostrar Apuestas Diarias</h4>
                                                            <p className="text-xs text-muted-foreground dark:text-white/50 mt-1">Habilita las 3 tarjetas de predicción en la Home.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_daily_bets}
                                                                onChange={(e) => setSettings({ ...settings, show_daily_bets: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                                        </label>
                                                    </div>

                                                    {/* Item 2 */}
                                                    <div className="flex items-center justify-between p-4 bg-secondary/30 dark:bg-black/20 rounded-xl border border-border/10 dark:border-white/5 hover:border-border/30 dark:hover:border-white/10 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-foreground dark:text-white">Mostrar Calendario</h4>
                                                            <p className="text-xs text-muted-foreground dark:text-white/50 mt-1">Muestra el calendario de resultados históricos al público.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_calendar}
                                                                onChange={(e) => setSettings({ ...settings, show_calendar: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                                        </label>
                                                    </div>

                                                    {/* Item 3 */}
                                                    <div className="flex items-center justify-between p-4 bg-secondary/30 dark:bg-black/20 rounded-xl border border-border/10 dark:border-white/5 hover:border-border/30 dark:hover:border-white/10 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-foreground dark:text-white">Mostrar Analítica</h4>
                                                            <p className="text-xs text-muted-foreground dark:text-white/50 mt-1">Muestra las gráficas de rendimiento (Beta) al público.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_analytics}
                                                                onChange={(e) => setSettings({ ...settings, show_analytics: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-secondary/50 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                                        </label>
                                                    </div>

                                                    {/* Item Telegram */}
                                                    <div className="flex items-center justify-between p-4 bg-secondary/30 dark:bg-black/20 rounded-xl border border-border/10 dark:border-white/5 hover:border-border/30 dark:hover:border-white/10 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-foreground dark:text-white">Mostrar Telegram</h4>
                                                            <p className="text-xs text-muted-foreground dark:text-white/50 mt-1">Muestra la pestaña de Telegram en la Home (Pública).</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_telegram}
                                                                onChange={(e) => setSettings({ ...settings, show_telegram: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-secondary/30 dark:bg-black/20 rounded-xl border border-border/10 dark:border-white/5 border-l-4 border-l-fuchsia-500 hover:border-border/30 dark:hover:border-white/10 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-fuchsia-600 dark:text-fuchsia-400">Mostrar TikTok Factory</h4>
                                                            <p className="text-xs text-muted-foreground dark:text-white/50 mt-1">Habilita el generador de contenido (Solo visible en Admin).</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_tiktok}
                                                                onChange={(e) => setSettings({ ...settings, show_tiktok: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {/* STAKAZO CONTENT */}
                                            {visibilidadMode === 'stakazo' && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                    {/* STAKAZO MENU */}
                                                    <div className="flex items-center justify-between p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-amber-500">Pestaña "Stakazo"</h4>
                                                            <p className="text-xs text-white/50 mt-1">Muestra la pestaña dedicada de Stakazo en la Home.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_stakazo_menu}
                                                                onChange={(e) => setSettings({ ...settings, show_stakazo_menu: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                        </label>
                                                    </div>

                                                    {/* STAKAZO ALERT */}
                                                    <div className="flex items-center justify-between p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-amber-500">Alerta Global (Banner)</h4>
                                                            <p className="text-xs text-white/50 mt-1">Muestra el banner llamativo "STAKAZO DISPONIBLE".</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_stakazo_alert}
                                                                onChange={(e) => setSettings({ ...settings, show_stakazo_alert: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                        </label>
                                                    </div>

                                                    {/* STAKAZO CALENDAR */}
                                                    <div className="flex items-center justify-between p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-amber-500">Calendario Stakazo</h4>
                                                            <p className="text-xs text-white/50 mt-1">Habilita el toggle Stakazo en el Calendario Histórico.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_stakazo_calendar}
                                                                onChange={(e) => setSettings({ ...settings, show_stakazo_calendar: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                        </label>
                                                    </div>

                                                    {/* STAKAZO ANALYTICS */}
                                                    <div className="flex items-center justify-between p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                                                        <div>
                                                            <h4 className="font-bold text-sm md:text-base text-amber-500">Analítica Stakazo</h4>
                                                            <p className="text-xs text-white/50 mt-1">Habilita el toggle Stakazo en el Panel de Estadísticas.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={settings.show_stakazo_analytics}
                                                                onChange={(e) => setSettings({ ...settings, show_stakazo_analytics: e.target.checked })}
                                                            />
                                                            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* CONTENT: ANUNCIO */}
                                {activeControlTab === 'anuncio' && (
                                    <div className="bg-card border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <ActivityIcon size={64} />
                                        </div>

                                        <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/5 pb-4 text-white">
                                            <ActivityIcon className="text-blue-500" size={24} />
                                            Anuncio Global
                                        </h3>

                                        <div className="space-y-6 relative z-10">
                                            {/* Item 1: Enable Toggle */}
                                            <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                                <div>
                                                    <h4 className="font-bold text-sm md:text-base text-white">Activar Anuncio</h4>
                                                    <p className="text-xs text-white/50 mt-1">Muestra un mensaje destacado en la parte superior de la Home.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={settings.show_announcement}
                                                        onChange={(e) => setSettings({ ...settings, show_announcement: e.target.checked })}
                                                    />
                                                    <div className={`w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${settings.announcement_type === 'warning' ? 'peer-checked:bg-rose-500' : 'peer-checked:bg-blue-500'}`}></div>
                                                </label>
                                            </div>

                                            {/* Configuration Panel */}
                                            <div className={`space-y-4 transition-all duration-300 ${!settings.show_announcement ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                                {/* Type Selector */}
                                                <div>
                                                    <label className="text-xs font-bold text-white/40 mb-2 block uppercase tracking-wider">Tipo de Aviso</label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <button
                                                            onClick={() => setSettings({ ...settings, announcement_type: 'info' })}
                                                            className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-2 ${settings.announcement_type === 'info' ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]' : 'bg-black/20 border-white/10 text-white/40 hover:bg-white/5'}`}
                                                        >
                                                            <ActivityIcon size={16} />
                                                            Información
                                                        </button>
                                                        <button
                                                            onClick={() => setSettings({ ...settings, announcement_type: 'warning' })}
                                                            className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-2 ${settings.announcement_type === 'warning' ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]' : 'bg-black/20 border-white/10 text-white/40 hover:bg-white/5'}`}
                                                        >
                                                            <AlertTriangle size={16} />
                                                            Importante
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Text Input */}
                                                <div>
                                                    <label className="text-xs font-bold text-white/40 mb-2 block uppercase tracking-wider">Mensaje del Anuncio</label>
                                                    <textarea
                                                        value={settings.announcement_text || ""}
                                                        onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })}
                                                        placeholder="Escribe aquí el anuncio..."
                                                        rows={3}
                                                        className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors placeholder:text-white/20 resize-none ${settings.announcement_type === 'warning' ? 'border-rose-500/30 focus:border-rose-500' : 'border-white/10 focus:border-blue-500'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CONTENT: ACCIONES (REDISEÑADO GRID) */}
                                {activeControlTab === 'acciones' && (
                                    <div className="bg-card border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <PlayCircle size={64} />
                                        </div>

                                        <h3 className="text-xl font-bold flex items-center gap-2 border-b border-white/5 pb-4 text-white">
                                            <PlayCircle className="text-emerald-500" size={24} />
                                            Centro de Ejecución
                                        </h3>

                                        <ApiUsageBanner />

                                        <div className="bg-black/20 border border-white/5 rounded-xl p-6 mb-6">
                                            <ExecutionTimeline scriptsStatus={scriptsStatus} />
                                        </div>

                                        {/* GRID DE ACCIONES (Compacto & Desplegable) */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                            {(() => {
                                                const actions = [
                                                    {
                                                        id: 'collect',
                                                        title: '1º - Recolector API',
                                                        fullTitle: 'Recolector de datos API',
                                                        file: 'daily_bet_update.yml',
                                                        schedule: 'Todos los días a 08:00 AM',
                                                        status: collectStatus,
                                                        statusKey: 'Daily Fetch',
                                                        color: 'text-blue-400',
                                                        borderColor: 'border-blue-500/20',
                                                        bgColor: 'bg-blue-600/20',
                                                        hoverBg: 'hover:bg-blue-600/40',
                                                        icon: <Database size={18} className="text-blue-500" />,
                                                        onRun: handleCollect
                                                    },
                                                    {
                                                        id: 'analyze',
                                                        title: '2º - Analizador AI',
                                                        fullTitle: 'Analizador AI Pro',
                                                        file: 'ai_analysis.yml',
                                                        schedule: 'Automático tras Recolector',
                                                        status: analyzeStatus,
                                                        statusKey: 'Daily Analysis',
                                                        color: 'text-fuchsia-400',
                                                        borderColor: 'border-fuchsia-500/20',
                                                        bgColor: 'bg-fuchsia-600/20',
                                                        hoverBg: 'hover:bg-fuchsia-600/40',
                                                        icon: <BrainCircuit size={18} className="text-fuchsia-500" />,
                                                        onRun: handleAnalyze
                                                    },
                                                    {
                                                        id: 'stakazo',
                                                        title: '2º B - Stakazo',
                                                        fullTitle: 'Analizador STAKAZO',
                                                        file: 'ai_analysis_stakazo.yml',
                                                        schedule: 'Automático tras Analizador',
                                                        status: stakazoStatus,
                                                        statusKey: 'Stakazo Analysis',
                                                        color: 'text-amber-400',
                                                        borderColor: 'border-amber-500/20',
                                                        bgColor: 'bg-amber-600/20',
                                                        hoverBg: 'hover:bg-amber-600/40',
                                                        icon: <Trophy size={18} className="text-amber-500" />,
                                                        badge: 'PREMIUM',
                                                        onRun: handleStakazoAnalyze
                                                    },
                                                    {
                                                        id: 'social',
                                                        title: '3º - Social TikTok',
                                                        fullTitle: 'Generar Textos TikTok',
                                                        file: 'generate_social_content.yml',
                                                        schedule: 'Automático tras Analizador',
                                                        status: socialStatus,
                                                        statusKey: 'Social Generator',
                                                        color: 'text-rose-400',
                                                        borderColor: 'border-rose-500/20',
                                                        bgColor: 'bg-rose-600/20',
                                                        hoverBg: 'hover:bg-rose-600/40',
                                                        icon: <FileText size={18} className="text-rose-500" />,
                                                        onRun: handleSocial
                                                    },
                                                    {
                                                        id: 'check',
                                                        title: '4º - Comprobador',
                                                        fullTitle: 'Comprobador Automático',
                                                        file: 'check_results_cron.yml',
                                                        schedule: 'Automático (Cron)',
                                                        status: checkStatus,
                                                        statusKey: 'Check Results',
                                                        color: 'text-emerald-400',
                                                        borderColor: 'border-emerald-500/20',
                                                        bgColor: 'bg-emerald-600/20',
                                                        hoverBg: 'hover:bg-emerald-600/40',
                                                        icon: <ClipboardCheck size={18} className="text-emerald-500" />,
                                                        onRun: handleCheckBets
                                                    },
                                                    {
                                                        id: 'viral',
                                                        title: '5º - Viral Auto',
                                                        fullTitle: 'TikTok Viral Automation',
                                                        file: 'tiktok_viral_automated.yml',
                                                        schedule: 'Todos los días a 04:00 PM',
                                                        status: tiktokViralStatus,
                                                        statusKey: 'TikTok Viral Automation',
                                                        color: 'text-pink-400',
                                                        borderColor: 'border-pink-500/20',
                                                        bgColor: 'bg-pink-600/20',
                                                        hoverBg: 'hover:bg-pink-600/40',
                                                        icon: <PlayCircle size={18} className="text-pink-500" />,
                                                        onRun: handleTikTokViral
                                                    },
                                                ];

                                                return actions.map((action, idx) => {
                                                    // Hooks must be top level, but we are inside a map in render.
                                                    // IMPORTANT: We cannot use hooks here directly if we haven't extracted components.
                                                    // To solve "collapsed" state without sub-components, we can use <details> or just a simple state approach won't work easily inside map without extraction.
                                                    // BUT: We can use user interactive <details> tag for native accordion or just make a small inline component definition ABOVE is risky.
                                                    // SAFEST: Extract a small component file OR Use CSS peer-checked or <details> summary.
                                                    // Let's use <details> for native accordion behavior which is perfect for "compact and expand".
                                                    // Styling <details> to look like cards.

                                                    return (
                                                        <details key={idx} className="group bg-black/20 rounded-xl border border-white/5 overflow-hidden open:border-white/10 transition-all duration-300">
                                                            <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-transparent hover:bg-white/5 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className={`p-2 rounded-lg bg-white/5 ${action.color}`}>
                                                                        {action.icon}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-bold text-sm truncate ${action.color}`}>{action.title}</span>
                                                                            {action.badge && (
                                                                                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold hidden sm:inline-block">{action.badge}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-white/40 truncate font-mono">{action.file}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                                                    <div className="scale-75 origin-right">
                                                                        {action.status === 'loading' ? <RefreshCw className={`animate-spin ${action.color}`} size={20} /> : getStatusBadge(action.statusKey || '')}
                                                                    </div>
                                                                    <ChevronDown size={16} className="text-white/30 transition-transform duration-300 group-open:rotate-180" />
                                                                </div>
                                                            </summary>

                                                            <div className="px-4 pb-4 pt-0 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                                                                <div className="mt-3 flex items-center gap-2 text-[10px] text-white/50 bg-black/20 p-2 rounded-lg mb-3">
                                                                    <Clock size={12} className="text-white/30" />
                                                                    {action.schedule}
                                                                </div>

                                                                <button
                                                                    onClick={action.onRun}
                                                                    disabled={action.status === 'loading'}
                                                                    className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${action.borderColor} border ${action.bgColor} ${action.color} ${action.hoverBg}`}
                                                                >
                                                                    <Play size={12} fill="currentColor" />
                                                                    EJECUTAR AHORA
                                                                </button>
                                                            </div>
                                                        </details>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* CONTENT: BLACKLIST */}
                                {activeControlTab === 'blacklist' && (
                                    <div className="bg-card border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <AlertOctagon size={64} className="text-red-500" />
                                        </div>

                                        <div className="flex flex-col items-center mb-8">
                                            <div className="bg-[#0f0f11] p-1 rounded-full flex gap-1 border border-white/5">
                                                <button
                                                    onClick={() => setBlacklistMode('list')}
                                                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${blacklistMode === 'list'
                                                        ? 'bg-fuchsia-600 text-white shadow-[0_0_20px_-5px_rgba(192,38,211,0.5)]'
                                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                                        }`}
                                                >
                                                    <AlertOctagon size={14} />
                                                    BLACKLIST
                                                </button>
                                                <button
                                                    onClick={() => setBlacklistMode('logs')}
                                                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${blacklistMode === 'logs'
                                                        ? 'bg-blue-600 text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)]'
                                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                                        }`}
                                                >
                                                    <ClipboardCheck size={14} />
                                                    LOGS
                                                </button>
                                            </div>
                                        </div>

                                        {/* VIEW: BLACKLIST LIST */}
                                        {blacklistMode === 'list' && (
                                            <div className="space-y-6 relative z-10 animate-in fade-in duration-300">
                                                <div className="max-h-[400px] overflow-y-auto pr-1 scrollbar-hide bg-black/20 rounded-xl border border-white/5 p-1">
                                                    {loadingBlacklist ? (
                                                        <div className="flex justify-center py-12">
                                                            <RefreshCw className="animate-spin text-white/20" size={24} />
                                                        </div>
                                                    ) : Object.keys(blacklist).length === 0 ? (
                                                        <div className="text-center py-20 text-white/20 italic text-sm">
                                                            No hay elementos en la lista negra.
                                                        </div>
                                                    ) : (
                                                        <div className="grid gap-2">
                                                            {Object.entries(blacklist).map(([key, value]: [string, any]) => (
                                                                <div key={key} className="p-3 bg-black/40 rounded-lg border border-white/5 flex flex-col gap-1 hover:bg-black/60 transition-colors group">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-xs font-mono text-white/70 select-all group-hover:text-white transition-colors">{key}</span>
                                                                        <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Failed</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-white/40 font-mono truncate">
                                                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-2">
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(true)}
                                                        disabled={Object.keys(blacklist).length === 0}
                                                        className="w-full px-6 py-4 bg-red-900/10 hover:bg-red-900/20 border border-red-500/20 text-red-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                                                    >
                                                        <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                                                        Borrar Todo
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* VIEW: LOGS TABLE */}
                                        {blacklistMode === 'logs' && (
                                            <div className="space-y-4 md:space-y-6 relative z-10 animate-in fade-in duration-300">

                                                {/* Combined Date Controls */}
                                                <div className="flex flex-col md:flex-row justify-between items-center bg-[#0f0f11] p-3 md:p-4 rounded-xl border border-white/5 gap-4">

                                                    {/* Calendar Input */}
                                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                                        <div className="bg-white/5 p-2 rounded-lg">
                                                            <Calendar size={18} className="text-blue-400" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold leading-none mb-1">Seleccionar Fecha</span>
                                                            <input
                                                                type="date"
                                                                value={logsDate}
                                                                onChange={(e) => setLogsDate(e.target.value)}
                                                                className="bg-transparent text-white font-mono text-sm outline-none cursor-pointer w-full"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Quick Actions & Tools */}
                                                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                        {/* Quick Dates */}
                                                        <div className="flex gap-1 mr-2 bg-black/40 p-1 rounded-lg border border-white/5">
                                                            {(() => {
                                                                const today = new Date();
                                                                const yesterday = new Date();
                                                                yesterday.setDate(today.getDate() - 1);
                                                                const formatDateBtn = (date: Date) => {
                                                                    const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase();
                                                                    const dayNum = date.getDate();
                                                                    return { dayName, dayNum, iso: date.toISOString().split('T')[0] };
                                                                };
                                                                const t = formatDateBtn(today);
                                                                const y = formatDateBtn(yesterday);
                                                                return (
                                                                    <>
                                                                        <button onClick={() => setLogsDate(t.iso)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${logsDate === t.iso ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}>HOY</button>
                                                                        <button onClick={() => setLogsDate(y.iso)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${logsDate === y.iso ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}>AYER</button>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>

                                                        <button onClick={checkLogs} disabled={loadingLogs} className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-50">
                                                            <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
                                                        </button>

                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm("¿Borrar logs del día?")) return;
                                                                try { setLoadingLogs(true); await fetch(`/api/admin/check-logs?date=${logsDate}`, { method: 'DELETE' }); checkLogs(); }
                                                                catch (err) { console.error(err); } finally { setLoadingLogs(false); }
                                                            }}
                                                            disabled={loadingLogs}
                                                            className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all disabled:opacity-50"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden min-h-[300px] flex flex-col">
                                                    <div className="max-h-[500px] overflow-y-auto scrollbar-hide overflow-x-auto">
                                                        {loadingLogs ? (
                                                            <div className="flex justify-center py-12">
                                                                <RefreshCw className="animate-spin text-white/20" size={24} />
                                                            </div>
                                                        ) : logsList.length === 0 ? (
                                                            <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-2">
                                                                <ClipboardCheck size={32} opacity={0.5} />
                                                                <span className="italic text-sm">No hay logs para esta fecha.</span>
                                                            </div>
                                                        ) : (
                                                            <table className="w-full text-left border-collapse min-w-[500px] md:min-w-full">
                                                                <thead className="bg-white/5 text-[10px] uppercase font-bold text-white/40 sticky top-0 backdrop-blur-md z-10">
                                                                    <tr>
                                                                        <th className="p-3 w-20">Hora</th>
                                                                        <th className="p-3">Evento</th>
                                                                        <th className="p-3 text-center w-24">Estado</th>
                                                                        <th className="p-3 text-right hidden md:table-cell">Detalle</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-white/5 text-xs text-white/70">
                                                                    {logsList.map((log, i) => {
                                                                        // Adjust time +1 hour
                                                                        let displayTime = log.timestamp;
                                                                        try {
                                                                            // Assuming format "HH:mm:ss"
                                                                            const [h, m, s] = log.timestamp.split(':').map(Number);
                                                                            const d = new Date();
                                                                            d.setHours(h, m, s);
                                                                            d.setHours(d.getHours() + 1);
                                                                            displayTime = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                                        } catch (e) {
                                                                            // Fallback if format is different
                                                                        }

                                                                        return (
                                                                            <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                                                <td className="p-3 font-mono text-white/30 whitespace-nowrap text-[10px] align-top">{displayTime}</td>
                                                                                <td className="p-3 align-top">
                                                                                    <div className="font-bold text-white group-hover:text-blue-400 transition-colors break-words">{log.match}</div>
                                                                                    <div className="text-[10px] text-white/50 break-words mt-0.5">{log.pick}</div>
                                                                                    {/* Mobile Only Message */}
                                                                                    <div className="md:hidden text-[9px] text-white/30 mt-1 truncate">{log.message}</div>
                                                                                </td>
                                                                                <td className="p-3 text-center align-top">
                                                                                    <span className={`inline-flex items-center justify-center w-full py-0.5 rounded text-[9px] font-bold border ${log.status === 'WON' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                                                        log.status === 'LOST' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                                                            log.status === 'SKIP' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                                                                log.status === 'ERROR' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                                                                                    'bg-white/5 border-white/10 text-white/30'
                                                                                        }`}>
                                                                                        {log.status}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="p-3 text-right max-w-[200px] hidden md:table-cell align-top">
                                                                                    <span className="text-[10px] text-white/40 truncate block" title={log.message}>{log.message}</span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleSaveSettings}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    disabled={savingSettings}
                                    className="btn-active-effect w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold py-4 rounded-xl transition-transform shadow-lg shadow-fuchsia-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
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

                                {/* Beautified Confirm Modal */}
                                {showDeleteConfirm && (
                                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                                        <div
                                            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                                            onClick={() => setShowDeleteConfirm(false)}
                                        />
                                        <div className="relative bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 text-center">
                                            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
                                                <AlertOctagon size={32} className="text-red-500" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-3 tracking-tighter">¿ESTÁS SEGURO?</h3>
                                            <p className="text-white/60 text-sm mb-8 leading-relaxed">
                                                Vas a borrar <span className="text-white font-bold">TODA</span> la lista negra de este mes. Esta acción no se puede deshacer.
                                            </p>
                                            <div className="flex flex-col gap-3">
                                                <button
                                                    onClick={handleClearBlacklist}
                                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-95"
                                                >
                                                    SÍ, BORRAR TODO
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                                                >
                                                    CANCELAR
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Beautified Action Confirm Modal */}
                                {actionModal.show && (
                                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                                        <div
                                            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                                            onClick={() => setActionModal(prev => ({ ...prev, show: false }))}
                                        />
                                        <div className="relative bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 text-center">
                                            <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/30">
                                                <Play size={32} className="text-emerald-500 ml-1" fill="currentColor" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-3 tracking-tighter">{actionModal.title}</h3>
                                            <p className="text-white/60 text-sm mb-8 leading-relaxed">
                                                ¿Estás seguro de ejecutar esta acción? <br />
                                                <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest mt-2 block">Iniciará un proceso en segundo plano</span>
                                            </p>
                                            <div className="flex flex-col gap-3">
                                                <button
                                                    onClick={actionModal.onConfirm}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                                >
                                                    SÍ, EJECUTAR AHORA
                                                </button>
                                                <button
                                                    onClick={() => setActionModal(prev => ({ ...prev, show: false }))}
                                                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all active:scale-95"
                                                >
                                                    CANCELAR
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
};
