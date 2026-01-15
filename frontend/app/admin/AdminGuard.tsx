"use client";

import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, RefreshCw, LayoutDashboard, DownloadCloud, BrainCircuit, ClipboardCheck, Activity as ActivityIcon, AlertTriangle, Database, ChevronDown, ChevronUp, Home } from 'lucide-react';
import Link from 'next/link';
import { verifyAdminPassword } from './actions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';

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

    // Tab State
    const [activeTab, setActiveTab] = useState<'analysis' | 'calendar' | 'analytics' | 'settings' | 'tiktok'>('analysis');

    // Settings State
    const [settings, setSettings] = useState({
        show_daily_bets: true,
        show_calendar: true,
        show_analytics: true,
        show_tiktok: false
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
                        show_calendar: data.show_calendar ?? true,
                        show_analytics: data.show_analytics ?? true,
                        show_tiktok: data.show_tiktok ?? false
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

                <div className="max-w-4xl mx-auto px-4 pt-2 pb-4 md:py-8 text-center relative z-10 flex flex-col items-center">

                    {/* Toggle Trigger */}
                    <button
                        onClick={() => setShowControls(!showControls)}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/50 backdrop-blur-sm text-secondary-foreground text-xs font-medium mb-4 hover:bg-secondary/80 transition-all cursor-pointer border border-white/5 active:scale-95 group">
                        <ActivityIcon size={14} className="text-fuchsia-500 animate-pulse" />
                        <span>Vista de Administrador</span>
                        {showControls ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </button>

                    {/* Collapsible Admin Actions */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showControls ? 'max-h-[200px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
                        <div className="flex flex-col items-center justify-center gap-2 w-full max-w-md mx-auto pt-2">
                            <div className="flex items-center justify-center gap-2 w-full">
                                <button
                                    onClick={handleCheckBets}
                                    disabled={checkStatus === 'loading'}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold border border-slate-500/50 transition-all whitespace-nowrap shadow-lg shadow-black/20 ${checkStatus === 'loading' ? 'opacity-50' : 'bg-slate-800/80 hover:bg-slate-700 hover:scale-105'}`}>
                                    <ClipboardCheck className="w-3.5 h-3.5" />
                                    {checkStatus === 'loading' ? '...' : 'Comprobar'}
                                </button>
                                <button
                                    onClick={handleCollect}
                                    disabled={collectStatus === 'loading'}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold border border-blue-500/50 transition-all whitespace-nowrap shadow-lg shadow-blue-500/10 ${collectStatus === 'loading' ? 'opacity-50' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:scale-105'}`}>
                                    <Database className="w-3.5 h-3.5" />
                                    {collectStatus === 'loading' ? '...' : 'Recolectar'}
                                </button>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={analyzeStatus === 'loading'}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold border border-emerald-500/50 transition-all whitespace-nowrap shadow-lg shadow-emerald-500/10 ${analyzeStatus === 'loading' ? 'opacity-50' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:scale-105'}`}>
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

                    <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
                        BET AI MASTER <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient block md:inline mt-2 md:mt-0">
                            PANEL DE CONTROL
                        </span>
                    </h1>

                    <p className="text-sm md:text-lg text-muted-foreground/80 max-w-xl mx-auto mb-4 leading-relaxed capitalize">
                        Predicciones para: <span className="font-bold text-foreground">{formattedDate}</span>
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            {/* Navigation Tabs */}
            <div className="bg-black/80 backdrop-blur-md border-b border-white/5 sticky top-16 z-[90]">
                <div className="max-w-7xl mx-auto px-2 md:px-4 flex justify-between md:justify-start md:gap-6 overflow-x-hidden">
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-colors flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'analysis' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">🎯 Análisis</span>
                        <span className="hidden md:block">🎯 Análisis del Día</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-colors flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'calendar' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">📅 Calendario</span>
                        <span className="hidden md:block">📅 Calendario 2026</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-colors flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'analytics' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">📊 Estadísticas</span>
                        <span className="hidden md:block">📊 Estadísticas</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('tiktok')}
                        className={`flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-colors flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'tiktok' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">🏭 Factory</span>
                        <span className="hidden md:block">🏭 TikTok Factory</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 md:flex-none py-3 md:py-4 text-xs md:text-sm font-bold border-b-2 transition-colors flex justify-center md:justify-start items-center gap-1.5 md:gap-2
                        ${activeTab === 'settings' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-gray-400 hover:text-white'}`}
                    >
                        <span className="md:hidden">⚙️ Ajustes</span>
                        <span className="hidden md:block">⚙️ Ajustes</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative min-h-[calc(100vh-8rem)] bg-background/50">
                <main className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Tab 1: Analysis (Children = Page Preview) */}
                    <div className={activeTab === 'analysis' ? 'block' : 'hidden'}>
                        <div className="opacity-90 hover:opacity-100 transition-opacity">
                            {children}
                        </div>
                    </div>

                    {/* Tab 2: Calendar */}
                    {activeTab === 'calendar' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <ResultsCalendar />
                        </div>
                    )}

                    {/* Tab 3: Analytics */}
                    {activeTab === 'analytics' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200">
                            <AdminAnalytics />
                        </div>
                    )}

                    {/* Tab 4: TikTok Factory */}
                    {activeTab === 'tiktok' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200 h-[calc(100vh-12rem)]">
                            {/* Pass props if available */}
                            {predictions && formattedDate ? (
                                <TikTokFactory predictions={predictions} formattedDate={formattedDate} rawDate={rawDate} />
                            ) : (
                                <div className="flex items-center justify-center h-full text-white/50">
                                    Cargando datos para TikTok Factory...
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 5: Settings */}
                    {activeTab === 'settings' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200 max-w-2xl mx-auto">
                            <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 space-y-8">
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
                                </div>

                                <button
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings}
                                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-fuchsia-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
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
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
