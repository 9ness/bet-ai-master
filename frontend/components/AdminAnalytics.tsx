"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Info, ChevronLeft, ChevronRight, Activity, Trophy, ChevronDown, Percent, BarChart3, AlertTriangle, LayoutDashboard, LineChart, ListTree, Calendar as CalendarIcon, X } from 'lucide-react';

// --- PREMIUM STAT CARD COMPONENT ---
const StatCard = ({ title, value, subtext, icon: Icon, colorTheme = 'gray', tooltip }: any) => {

    // Color Mappings
    const getThemeClasses = (theme: string) => {
        switch (theme) {
            case 'emerald': return 'bg-emerald-50 dark:bg-black/20 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400';
            case 'rose': return 'bg-rose-50 dark:bg-black/20 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400';
            case 'amber': return 'bg-amber-50 dark:bg-black/20 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400';
            case 'violet': return 'bg-violet-50 dark:bg-black/20 border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400';
            case 'blue': return 'bg-blue-50 dark:bg-black/20 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400';
            case 'indigo': return 'bg-indigo-50 dark:bg-black/20 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400';
            default: return 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-500/30 text-gray-700 dark:text-gray-300';
        }
    };

    const themeClass = getThemeClasses(colorTheme);

    return (
        <div className={`relative group p-4 rounded-xl border transition-all hover:border-opacity-40 hover:scale-[1.02] duration-300 ${themeClass}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full bg-current opacity-70`} />
                    <h5 className="font-bold text-muted-foreground/70 dark:text-white/50 tracking-widest text-[9px] uppercase flex items-center gap-1">
                        {title}
                        {tooltip && (
                            <div className="group/tooltip relative">
                                <Info size={10} className="hover:text-white transition-colors cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-none z-50">
                                    <p className="text-[10px] text-white/80 leading-tight text-center normal-case tracking-normal">
                                        {tooltip}
                                    </p>
                                </div>
                            </div>
                        )}
                    </h5>
                </div>
                {Icon && <Icon size={14} className="opacity-40 dark:opacity-40 text-foreground dark:text-white" />}
            </div>

            {/* Value (Main) */}
            <div className="flex items-end justify-between">
                <div>
                    <span className="text-xl md:text-2xl font-black text-foreground dark:text-white/95 tracking-tight">
                        {value}
                    </span>
                    {/* Subtext (optional smaller text below value) */}
                    {subtext && (
                        <p className="text-[10px] font-bold mt-0.5 opacity-60">
                            {subtext}
                        </p>
                    )}
                </div>
            </div>

            {/* Glossy Effect */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/50 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500" />
        </div>
    );
};


export default function AdminAnalytics({ showStakazoToggle = false }: { showStakazoToggle?: boolean }) {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Month Selection State
    const [currentDate, setCurrentDate] = useState(new Date());

    // TAB STATES ('resumen', 'evolucion', 'desglose')
    const [activeTab, setActiveTab] = useState<'resumen' | 'evolucion' | 'desglose'>('resumen');
    // STAKAZO SWITCH
    const [category, setCategory] = useState("daily_bets");

    // ANNUAL VIEW STATE
    const [isAnnualModalOpen, setIsAnnualModalOpen] = useState(false);
    const [annualStats, setAnnualStats] = useState<Record<string, any>>({});
    const [isAnnualLoading, setIsAnnualLoading] = useState(false);
    const [annualModalTab, setAnnualModalTab] = useState<'meses' | 'operativa'>('meses');

    const fetchData = async () => {
        setLoading(true); // Reset loading
        try {
            // Use selected date instead of always 'now'
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

            const res = await fetch(`/api/admin/history?month=${monthStr}&category=${category}`);
            const json = await res.json();

            if (json.stats) {
                setStats(json.stats);

                // Use Backend Chart Data if available
                if (json.stats.chart_evolution) {
                    const chartData = json.stats.chart_evolution.map((d: any) => ({
                        date: d.date.split('-')[2], // Day only
                        daily: d.daily_profit,
                        total: d.accumulated_profit
                    }));
                    setData(chartData);
                }
                // Fallback to legacy
                else if (json.days) {
                    const days = Object.keys(json.days).sort();
                    let cumulative = 0;
                    const chartData = days.map(date => {
                        const dayP = json.days[date].day_profit;
                        cumulative += dayP;
                        return {
                            date: date.split('-')[2],
                            daily: dayP,
                            total: Number(cumulative.toFixed(2))
                        };
                    });
                    setData(chartData);
                } else {
                    setData([]);
                }
            } else {
                setStats(null);
                setData([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnnualData = async () => {
        setIsAnnualLoading(true);
        setIsAnnualModalOpen(true);
        setAnnualModalTab('meses'); // Reset tab
        try {
            const year = currentDate.getFullYear();
            const res = await fetch(`/api/admin/history?year=${year}&category=${category}`);
            const json = await res.json();
            if (json.stats) {
                setAnnualStats(json.stats);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnnualLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentDate, category]);

    // Helpers
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);



    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-fuchsia-500" size={48} /></div>;

    // Helper to safely access summary
    const getSummary = (key: string) => {
        if (!stats) return 0;
        if (stats.summary && stats.summary[key] !== undefined) return stats.summary[key];
        if (stats[key] !== undefined) return stats[key];
        return 0;
    };

    const totalProfit = getSummary('total_profit');
    const yieldVal = getSummary('yield');
    const maxDrawdown = getSummary('max_drawdown');
    const profitFactor = getSummary('profit_factor');
    const totalStake = getSummary('total_stake');
    const winRateDays = getSummary('win_rate_days');

    const isPositive = totalProfit >= 0;

    // Tab Button Component
    const TabButton = ({ id, label, icon: Icon }: any) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`
                    flex flex-col items-center justify-center px-4 py-2 rounded-xl border transition-all min-w-[80px] hover:scale-105 active:scale-95 duration-200
                    ${isActive
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-500 shadow-[0_0_15px_-3px_rgba(14,165,233,0.3)]'
                        : 'bg-secondary/40 border-border/20 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    }
                `}
            >
                <div className="mb-1">
                    <Icon size={18} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                    {label}
                </span>
            </button>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-10">
            {/* Header with Selector */}
            <div className="text-center mb-4 relative z-10 pt-4">
                <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tighter">
                    <span className={`text-transparent bg-clip-text bg-gradient-to-r ${category === 'daily_bets_stakazo' ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500'}`}>Rendimiento</span> <span className="text-foreground drop-shadow-sm">Mensual</span>
                </h2>

                {/* CATEGORY SWITCH */}
                {showStakazoToggle && (
                    <div className="flex justify-center mb-6">
                        <div className="flex bg-secondary/50 p-1 rounded-full border border-border/30 scale-90 md:scale-100">
                            <button
                                onClick={() => setCategory('daily_bets')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${category === 'daily_bets' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                STANDARD
                            </button>
                            <button
                                onClick={() => setCategory('daily_bets_stakazo')}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${category === 'daily_bets_stakazo' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Trophy size={12} /> STAKAZO
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row justify-center items-center gap-4 relative mb-6">
                    {/* MONTH SELECTOR */}
                    <div className="flex items-center gap-4 bg-secondary/50 backdrop-blur-md p-1.5 rounded-full border border-border/30 relative z-10 shadow-lg">
                        <button
                            onClick={prevMonth}
                            className="p-2 hover:bg-secondary/60 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold w-40 text-center uppercase tracking-widest text-foreground/90">
                            {formattedMonth}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 hover:bg-secondary/60 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* ANNUAL VIEW BUTTON */}
                    <button
                        onClick={fetchAnnualData}
                        className="flex items-center gap-2 bg-secondary/50 backdrop-blur-md px-4 py-2.5 rounded-full border border-border/30 hover:bg-secondary/70 transition-all shadow-lg group"
                    >
                        <CalendarIcon size={16} className="text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold uppercase tracking-widest text-foreground/90">Vista Anual</span>
                    </button>
                </div>

                {/* TABS NAVIGATION */}
                <div className="flex items-center justify-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    <TabButton id="resumen" label="Resumen" icon={LayoutDashboard} />
                    <TabButton id="evolucion" label="Evolución" icon={LineChart} />
                    <TabButton id="desglose" label="Desglose" icon={ListTree} />
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[400px]">

                {/* 1. RESUMEN TAB */}
                {activeTab === 'resumen' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {/* 1. PROFIT */}
                        {/* 1. PROFIT */}
                        <StatCard
                            title="Profit"
                            value={
                                <span className="inline-flex items-center gap-2">
                                    {totalProfit > 0 ? '+' : ''}{totalProfit.toFixed(2)} u
                                    {category === 'daily_bets_stakazo' && (
                                        <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-black tracking-wider align-middle shadow-sm">
                                            PREMIUM
                                        </span>
                                    )}
                                </span>
                            }
                            colorTheme={isPositive ? 'emerald' : 'rose'}
                            icon={DollarSign}
                            tooltip="Ganancia neta total acumulada en el mes seleccionado."
                        />

                        {/* 2. RENTABILIDAD */}
                        <StatCard
                            title="Rentabilidad (Yield)"
                            value={`${yieldVal.toFixed(2)}%`}
                            colorTheme={yieldVal >= 0 ? 'violet' : 'rose'}
                            icon={Activity}
                            tooltip="Rentabilidad obtenida sobre el capital total apostado (Yield)."
                        />

                        {/* 3. PROFIT FACTOR */}
                        <StatCard
                            title="Factor (PF)"
                            value={profitFactor.toFixed(2)}
                            subtext={profitFactor >= 1.5 ? '> 1.5 Excelente' : ' < 1.5 Mejorable'}
                            colorTheme={profitFactor >= 1.5 ? 'amber' : 'gray'}
                            icon={Trophy}
                            tooltip="Relación entre ganancias brutas y pérdidas brutas."
                        />

                        {/* 4. DRAWDOWN */}
                        <StatCard
                            title="Drawdown"
                            value={`-${maxDrawdown.toFixed(2)} u`}
                            colorTheme="rose"
                            icon={TrendingDown}
                            tooltip="Máxima caída acumulada desde el punto más alto."
                        />

                        {/* 5. VOLUME */}
                        <StatCard
                            title="Vol. Apostado"
                            value={`${totalStake.toFixed(2)} u`}
                            colorTheme="indigo"
                            icon={BarChart3}
                            tooltip="Suma total de unidades arriesgadas."
                        />

                        {/* 6. WIN RATE DAYS */}
                        <StatCard
                            title="Días Ganadores"
                            value={`${winRateDays.toFixed(1)}%`}
                            colorTheme={winRateDays > 50 ? 'blue' : 'amber'}
                            icon={Percent}
                            tooltip="% de días con balance positivo."
                        />
                    </div>
                )}


                {/* 2. EVOLUCION TAB */}
                {activeTab === 'evolucion' && (
                    <div className="bg-secondary/20 rounded-2xl border border-border/20 p-4 min-h-[300px]">
                        <div className="flex items-center justify-between mb-4 border-b border-border/10 pb-2">
                            <div className="flex items-center gap-3">
                                <LineChart className="text-sky-400" size={20} />
                                <h4 className="text-lg font-bold text-foreground/90">Evolución del Beneficio</h4>
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{formattedMonth}</span>
                        </div>

                        <div className="h-[250px] w-full bg-secondary/10 rounded-xl p-2 border border-white/5">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" strokeWidth={1} stroke="var(--border)" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}u`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                        labelStyle={{ color: 'var(--muted-foreground)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="total"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorTotal)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}


                {/* 3. DESGLOSE TAB */}
                {activeTab === 'desglose' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. PERFORMANCE BY TYPE (Bar Chart OR Stakazo Summary) */}
                        <div className="bg-secondary/20 border border-border/20 rounded-2xl p-4">
                            <h3 className="text-sm font-bold mb-4 text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={14} className={category === 'daily_bets_stakazo' ? 'text-amber-400' : 'text-emerald-400'} />
                                {category === 'daily_bets_stakazo' ? 'Rendimiento Stakazo' : 'Rentabilidad por Estrategia'}
                            </h3>

                            {category === 'daily_bets_stakazo' && stats?.performance_by_type?.stakazo ? (
                                <div className="h-[200px] w-full flex flex-col justify-center items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Profit Total</p>
                                        <p className="text-4xl font-black text-amber-500">
                                            {stats.performance_by_type.stakazo.profit > 0 ? '+' : ''}{stats.performance_by_type.stakazo.profit.toFixed(2)} u
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8 w-full max-w-[200px]">
                                        <div className="text-center">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Aciertos</p>
                                            <p className="text-xl font-bold text-white">
                                                {stats.performance_by_type.stakazo.won_bets}/{stats.performance_by_type.stakazo.total_bets}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Yield</p>
                                            <p className="text-xl font-bold text-white">
                                                {stats.performance_by_type.stakazo.yield}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                stats?.performance_by_type ? (
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={[
                                                {
                                                    name: 'Safe',
                                                    profit: stats.performance_by_type.safe.profit,
                                                    fill: '#10b981',
                                                    won: stats.performance_by_type.safe.won_bets || 0,
                                                    total: stats.performance_by_type.safe.total_bets || 0
                                                },
                                                {
                                                    name: 'Value',
                                                    profit: stats.performance_by_type.value.profit,
                                                    fill: '#f59e0b',
                                                    won: stats.performance_by_type.value.won_bets || 0,
                                                    total: stats.performance_by_type.value.total_bets || 0
                                                },
                                                {
                                                    name: 'Funbet',
                                                    profit: stats.performance_by_type.funbet.profit,
                                                    fill: '#ec4899',
                                                    won: stats.performance_by_type.funbet.won_bets || 0,
                                                    total: stats.performance_by_type.funbet.total_bets || 0
                                                },
                                            ]}>
                                                <CartesianGrid strokeDasharray="3 3" strokeWidth={1} stroke="var(--border)" vertical={false} opacity={0.3} />
                                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}u`} />
                                                <Tooltip
                                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                                    content={({ active, payload, label }) => {
                                                        if (active && payload && payload.length) {
                                                            const data = payload[0].payload;
                                                            return (
                                                                <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
                                                                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{label}</p>
                                                                    <p className="text-lg font-black text-foreground mb-1">
                                                                        {Number(data.profit) > 0 ? '+' : ''}{Number(data.profit).toFixed(2)} u
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                                        <p className="text-[10px] font-medium text-foreground/80">
                                                                            {data.won}/{data.total} aciertos
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                                                    {
                                                        [{ profit: stats.performance_by_type.safe.profit }, { profit: stats.performance_by_type.value.profit }, { profit: stats.performance_by_type.funbet.profit }].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? ['#10b981', '#f59e0b', '#ec4899'][index] : '#f43f5e'} />
                                                        ))
                                                    }
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">
                                        Sin datos detallados
                                    </div>
                                )
                            )}
                        </div>

                        {/* 2. ACCURACY BY SPORT */}
                        <div className="bg-secondary/20 border border-border/20 rounded-2xl p-4">
                            <h3 className="text-sm font-bold mb-4 text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Info size={14} className="text-blue-400" />
                                Precisión (Win Rate)
                            </h3>

                            <div className="space-y-6 mt-4">
                                {stats?.accuracy_by_sport?.football && (
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-foreground/70">⚽ Fútbol</span>
                                            <span className="text-xs font-bold text-foreground">{stats.accuracy_by_sport.football.accuracy_percentage}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/10">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                style={{ width: `${stats.accuracy_by_sport.football.accuracy_percentage}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-right mt-1 text-muted-foreground/60">
                                            {stats.accuracy_by_sport.football.won_selections}/{stats.accuracy_by_sport.football.total_selections} aciertos
                                        </p>
                                    </div>
                                )}

                                {stats?.accuracy_by_sport?.basketball && (
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-foreground/70">🏀 Baloncesto</span>
                                            <span className="text-xs font-bold text-foreground">{stats.accuracy_by_sport.basketball.accuracy_percentage}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/10">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-600 to-amber-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                                style={{ width: `${stats.accuracy_by_sport.basketball.accuracy_percentage}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-right mt-1 text-muted-foreground/60">
                                            {stats.accuracy_by_sport.basketball.won_selections}/{stats.accuracy_by_sport.basketball.total_selections} aciertos
                                        </p>
                                    </div>
                                )}

                                {!stats?.accuracy_by_sport && (
                                    <div className="flex items-center justify-center h-[100px] text-muted-foreground text-xs">
                                        Sin datos de precisión
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ANNUAL STATS MODAL */}
                {isAnnualModalOpen && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-card w-full max-w-md border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                            {/* Header */}
                            <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
                                <div>
                                    <h3 className="font-bold text-2xl text-foreground flex items-center gap-2">
                                        Histórico Anual {currentDate.getFullYear()}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
                                        {category === 'daily_bets_stakazo' ? 'Rendimiento Stakazos' : 'Rendimiento Estándar'}
                                    </p>
                                </div>
                                <button onClick={() => setIsAnnualModalOpen(false)} className="p-2 hover:bg-secondary/20 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Internal Tabs */}
                            {!isAnnualLoading && Object.keys(annualStats).length > 0 && (
                                <div className="flex bg-secondary/30 p-1 mx-6 mt-4 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => setAnnualModalTab('meses')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${annualModalTab === 'meses' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Por Meses
                                    </button>
                                    <button
                                        onClick={() => setAnnualModalTab('operativa')}
                                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${annualModalTab === 'operativa' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Operativa Anual
                                    </button>
                                </div>
                            )}

                            {/* Content */}
                            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {isAnnualLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                        <p className="text-sm text-muted-foreground animate-pulse">Calculando balance anual...</p>
                                    </div>
                                ) : Object.keys(annualStats).length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8 font-medium">No hay registros para este año.</p>
                                ) : annualModalTab === 'meses' ? (
                                    Object.keys(annualStats)
                                        .sort()
                                        .map((m) => {
                                            const [y, mm] = m.split('-');
                                            const monthLabel = new Date(parseInt(y), parseInt(mm) - 1).toLocaleDateString('es-ES', { month: 'long' });
                                            const profit = Number(annualStats[m].total_profit || 0);
                                            const isPositive = profit >= 0;
                                            const mYield = Number(annualStats[m].yield || 0);

                                            return (
                                                <div
                                                    key={m}
                                                    className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-white/5 hover:bg-secondary/30 transition-all cursor-pointer group"
                                                    onClick={() => {
                                                        setCurrentDate(new Date(parseInt(y), parseInt(mm) - 1, 1));
                                                        setIsAnnualModalOpen(false);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold
                                                        ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                            <span className="text-[10px] opacity-60 leading-none mb-0.5">{mm}</span>
                                                            <span className="text-xs leading-none">M</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-bold capitalize block text-sm">{monthLabel}</span>
                                                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Rentabilidad: {mYield}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <span className={`font-mono font-black text-lg block leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {isPositive ? '+' : ''}{profit.toFixed(2)}u
                                                            </span>
                                                        </div>
                                                        <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                                                    </div>
                                                </div>
                                            );
                                        })
                                ) : (
                                    // TAB: OPERATIVA (Anual Aggregate)
                                    (() => {
                                        // Aggregate Calculations
                                        const performance: Record<string, any> = {
                                            safe: { profit: 0, won: 0, total: 0, color: 'text-emerald-400' },
                                            value: { profit: 0, won: 0, total: 0, color: 'text-amber-400' },
                                            funbet: { profit: 0, won: 0, total: 0, color: 'text-rose-400' },
                                            stakazo: { profit: 0, won: 0, total: 0, color: 'text-amber-500' }
                                        };
                                        const accuracy: Record<string, any> = {
                                            football: { won: 0, total: 0 },
                                            basketball: { won: 0, total: 0 }
                                        };

                                        Object.values(annualStats).forEach((ms: any) => {
                                            // Sum performance by type
                                            if (ms.performance_by_type) {
                                                Object.keys(ms.performance_by_type).forEach(type => {
                                                    if (performance[type]) {
                                                        performance[type].profit += (ms.performance_by_type[type].profit || 0);
                                                        performance[type].won += (ms.performance_by_type[type].won_bets || 0);
                                                        performance[type].total += (ms.performance_by_type[type].total_bets || 0);
                                                    }
                                                });
                                            }
                                            // Sum accuracy by sport
                                            if (ms.accuracy_by_sport) {
                                                Object.keys(ms.accuracy_by_sport).forEach(sport => {
                                                    if (accuracy[sport]) {
                                                        accuracy[sport].won += (ms.accuracy_by_sport[sport].won_selections || 0);
                                                        accuracy[sport].total += (ms.accuracy_by_sport[sport].total_selections || 0);
                                                    }
                                                });
                                            }
                                        });

                                        return (
                                            <div className="space-y-6">
                                                {/* 1. Rendimiento por Estrategia */}
                                                <div className="space-y-3">
                                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                                                        <TrendingUp size={12} className="text-primary" />
                                                        Rentabilidad por Estrategia Anual
                                                    </h4>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {Object.entries(performance)
                                                            .filter(([k, v]) => category === 'daily_bets_stakazo' ? k === 'stakazo' : k !== 'stakazo')
                                                            .map(([type, data]) => {
                                                                if (data.total === 0) return null;
                                                                return (
                                                                    <div key={type} className="bg-secondary/20 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                                                        <div>
                                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">{type}</span>
                                                                            <span className={`text-xl font-black ${data.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                                {data.profit > 0 ? '+' : ''}{data.profit.toFixed(2)}u
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="text-xs font-bold text-foreground block">
                                                                                {data.won}/{data.total} <span className="text-muted-foreground font-medium text-[10px]">Aciertos</span>
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-primary">
                                                                                {((data.won / data.total) * 100).toFixed(1)}% Efec.
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>

                                                {/* 2. Precisión por Deporte */}
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                                                        <Info size={12} className="text-blue-400" />
                                                        Precisión por Deporte Anual
                                                    </h4>
                                                    <div className="space-y-4 bg-secondary/20 border border-white/5 rounded-2xl p-4">
                                                        {Object.entries(accuracy).map(([sport, data]) => {
                                                            if (data.total === 0) return null;
                                                            const pct = (data.won / data.total) * 100;
                                                            return (
                                                                <div key={sport}>
                                                                    <div className="flex justify-between mb-2 items-center">
                                                                        <span className="text-xs font-bold text-foreground opacity-80 uppercase tracking-tighter">
                                                                            {sport === 'football' ? '⚽ Fútbol' : '🏀 Baloncesto'}
                                                                        </span>
                                                                        <span className="text-xs font-black text-foreground">{pct.toFixed(1)}%</span>
                                                                    </div>
                                                                    <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden border border-border/10">
                                                                        <div
                                                                            className={`h-full bg-gradient-to-r ${sport === 'football' ? 'from-blue-600 to-cyan-400' : 'from-orange-600 to-amber-400'}`}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                    <p className="text-[9px] text-right mt-1 text-muted-foreground/60 font-medium">
                                                                        {data.won}/{data.total} aciertos totales del año
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            {/* Footer (Total Year Aggregate) */}
                            {!isAnnualLoading && Object.keys(annualStats).length > 0 && (() => {
                                const totalProfitYear = Object.values(annualStats).reduce((acc, curr) => acc + (curr.total_profit || 0), 0);
                                const totalStakeYear = Object.values(annualStats).reduce((acc, curr) => acc + (curr.total_stake || 0), 0);
                                const avgYieldYear = totalStakeYear > 0 ? (totalProfitYear / totalStakeYear) * 100 : 0;
                                const isPositiveYear = totalProfitYear >= 0;

                                return (
                                    <div className="p-6 bg-secondary/40 border-t border-border mt-auto">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Total Anual ({currentDate.getFullYear()})</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-2xl font-black ${isPositiveYear ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {isPositiveYear ? '+' : ''}{totalProfitYear.toFixed(2)}u
                                                    </span>
                                                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${avgYieldYear >= 0 ? 'bg-violet-500/20 text-violet-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        {avgYieldYear.toFixed(2)}% Rentabilidad
                                                    </div>
                                                </div>
                                            </div>
                                            <Trophy size={32} className={isPositiveYear ? 'text-amber-500/20' : 'text-rose-500/10'} />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
}
