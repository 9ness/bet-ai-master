"use client";

import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, RefreshCw, LayoutDashboard, DownloadCloud, BrainCircuit, ClipboardCheck } from 'lucide-react';
import { verifyAdminPassword } from './actions';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';

export default function AdminGuard({
    children
}: {
    children: React.ReactNode
}) {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [loginError, setLoginError] = useState("");
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // Tab State
    const [activeTab, setActiveTab] = useState<'analysis' | 'calendar' | 'analytics' | 'settings'>('analysis');

    // Settings State
    const [settings, setSettings] = useState({
        show_daily_bets: true,
        show_calendar: true,
        show_analytics: true
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [lastRun, setLastRun] = useState<{ date: string, status: string, message: string, script: string } | null>(null);

    // Trigger States... (keep existing)
    const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [analyzeStatus, setAnalyzeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    useEffect(() => {
        const sessionAuth = sessionStorage.getItem("admin_auth");
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
                        show_analytics: data.show_analytics ?? true
                    });
                    if (data.last_run) {
                        setLastRun(data.last_run);
                    }
                }
            })
            .catch(err => console.error("Failed to fetch settings", err));
    }, []);

    // ... (keep handleLogin and triggers) ...

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");

        const isValid = await verifyAdminPassword(passwordInput);

        if (isValid) {
            setIsAuthenticated(true);
            sessionStorage.setItem("admin_auth", "true");
        } else {
            setLoginError("Contraseña incorrecta. Inténtalo de nuevo.");
            setPasswordInput("");
        }
    };

    const triggerGitHubAction = async (mode: 'fetch' | 'analyze', setStatus: React.Dispatch<any>) => {
        if (!confirm(`¿Estás seguro de ejecutar: ${mode.toUpperCase()}? \n\nEsto iniciará una acción en GitHub. Tardará unos minutos.`)) return;

        setStatus('loading');
        try {
            const res = await fetch('/api/admin/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: mode })
            });

            if (res.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 5000);
            } else {
                setStatus('error');
                const data = await res.json();
                alert(`Error: ${data.details || 'Error desconocido'}`);
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (e) {
            setStatus('error');
            console.error(e);
            alert("Error de red.");
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const handleCheckBets = () => {
        alert("⚠️ Funcionalidad integrada en backend. Revisa el calendario para ver resultados históricos.");
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            alert("Configuración guardada correctamente.");
        } catch (e) {
            alert("Error al guardar configuración.");
        } finally {
            setSavingSettings(false);
        }
    };

    if (isCheckingAuth) return null;

    // LOGIN UI (Same as before)
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
                {/* ... (Keep existing login UI structure) ... */}
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
            <div className="sticky top-0 z-[100] w-full bg-black/95 backdrop-blur-lg border-b border-white/10 text-white shadow-2xl transition-all">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

                    {/* Left Brand */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            ADMIN V2
                        </div>
                        <span className="text-xs text-gray-500 hidden md:inline-block">Control Center</span>
                    </div>

                    {/* Middle Controls (Actions) */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-2 md:gap-3">
                            <button
                                onClick={() => triggerGitHubAction('fetch', setFetchStatus)}
                                disabled={fetchStatus === 'loading'}
                                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${fetchStatus === 'loading' ? 'opacity-50' : 'bg-sky-600 border-sky-400 hover:scale-105'}`}>
                                <DownloadCloud className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Recuperar</span>
                            </button>
                            <button
                                onClick={() => triggerGitHubAction('analyze', setAnalyzeStatus)}
                                disabled={analyzeStatus === 'loading'}
                                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border transition-all ${analyzeStatus === 'loading' ? 'opacity-50' : 'bg-emerald-600 border-emerald-400 hover:scale-105'}`}>
                                <BrainCircuit className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Analizar</span>
                            </button>
                            <button
                                onClick={handleCheckBets}
                                className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border border-slate-500 bg-slate-700 hover:scale-105 transition-all">
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Comprobar</span>
                            </button>
                        </div>

                        {/* Status Log */}
                        {lastRun && (
                            <div className="flex items-center gap-1.5 text-[2px] md:text-[10px] font-mono leading-none opacity-80 mt-0.5">
                                <span className="text-gray-400">Último chequeo ({lastRun.script}): {lastRun.date}</span>
                                <span className="text-gray-600">-</span>
                                <span className={`font-bold ${lastRun.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {lastRun.status}
                                </span>
                                {lastRun.status === 'ERROR' && (
                                    <span className="text-rose-400 max-w-[100px] md:max-w-xs truncate" title={lastRun.message}>
                                        ({lastRun.message})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Logout */}
                    <div className="shrink-0">
                        <button
                            onClick={() => {
                                sessionStorage.removeItem("admin_auth");
                                setIsAuthenticated(false);
                            }}
                            className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                        >
                            <Lock className="w-4 h-4" />
                        </button>
                    </div>
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
                        <span className="md:hidden">📊 Analítica</span>
                        <span className="hidden md:block">📊 Analítica</span>
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
                    {/* Tab 4: Settings */}
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
                                </div>

                                <button
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings}
                                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-fuchsia-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingSettings ? <RefreshCw className="animate-spin w-4 h-4" /> : <DownloadCloud className="w-4 h-4 rotate-180" />}
                                    {savingSettings ? 'Guardando...' : 'Guardar Configuración'}
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
