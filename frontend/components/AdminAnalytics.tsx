"use client";

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Info, ChevronLeft, ChevronRight, Activity, Trophy, ChevronDown, Percent, BarChart3, AlertTriangle, LayoutDashboard, LineChart, ListTree } from 'lucide-react';

// --- PREMIUM STAT CARD COMPONENT ---
const StatCard = ({ title, value, subtext, icon: Icon, colorTheme = 'gray', tooltip }: any) => {

    // Color Mappings
    const getThemeClasses = (theme: string) => {
        switch (theme) {
            case 'emerald': return 'from-emerald-950/40 to-emerald-900/10 border-emerald-500/20 text-emerald-400';
            case 'rose': return 'from-rose-950/40 to-rose-900/10 border-rose-500/20 text-rose-400';
            case 'amber': return 'from-amber-950/40 to-amber-900/10 border-amber-500/20 text-amber-400';
            case 'violet': return 'from-violet-950/40 to-violet-900/10 border-violet-500/20 text-violet-400';
            case 'blue': return 'from-blue-950/40 to-blue-900/10 border-blue-500/20 text-blue-400';
            case 'indigo': return 'from-indigo-950/40 to-indigo-900/10 border-indigo-500/20 text-indigo-400';
            default: return 'from-gray-900/40 to-gray-800/20 border-gray-500/30 text-gray-300';
        }
    };

    const themeClass = getThemeClasses(colorTheme);

    return (
        <div className={`relative group p-4 rounded-xl border bg-gradient-to-br transition-all hover:border-opacity-40 hover:scale-[1.02] duration-300 ${themeClass}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full bg-current opacity-70`} />
                    <h5 className="font-bold text-white/50 tracking-widest text-[9px] uppercase flex items-center gap-1">
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
                {Icon && <Icon size={14} className="opacity-40" />}
            </div>

            {/* Value (Main) */}
            <div className="flex items-end justify-between">
                <div>
                    <span className="text-xl md:text-2xl font-black text-white/95 tracking-tight">
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
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500" />
        </div>
    );
};


export default function AdminAnalytics() {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Month Selection State
    const [currentDate, setCurrentDate] = useState(new Date());

    // TAB STATES ('resumen', 'evolucion', 'desglose')
    const [activeTab, setActiveTab] = useState<'resumen' | 'evolucion' | 'desglose'>('resumen');

    const fetchData = async () => {
        setLoading(true); // Reset loading
        try {
            // Use selected date instead of always 'now'
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

            const res = await fetch(`/api/admin/history?month=${monthStr}`);
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

    useEffect(() => {
        fetchData();
    }, [currentDate]);

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
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 shadow-[0_0_15px_-3px_rgba(14,165,233,0.3)]'
                        : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
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
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Rendimiento</span> <span className="text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">Mensual</span>
                </h2>

                <div className="flex flex-col md:flex-row justify-center items-center gap-4 relative mb-6">
                    {/* MONTH SELECTOR */}
                    <div className="flex items-center gap-4 bg-black/30 backdrop-blur-md p-1.5 rounded-full border border-white/10 relative z-10 shadow-xl">
                        <button
                            onClick={prevMonth}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold w-40 text-center uppercase tracking-widest text-white/90">
                            {formattedMonth}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>


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
                        <StatCard
                            title="Profit"
                            value={`${totalProfit > 0 ? '+' : ''}${totalProfit.toFixed(2)} u`}
                            colorTheme={isPositive ? 'emerald' : 'rose'}
                            icon={DollarSign}
                            tooltip="Ganancia neta total acumulada en el mes seleccionado."
                        />

                        {/* 2. YIELD */}
                        <StatCard
                            title="Yield"
                            value={`${yieldVal.toFixed(2)}%`}
                            colorTheme={yieldVal >= 0 ? 'violet' : 'rose'}
                            icon={Activity}
                            tooltip="Rentabilidad obtenida sobre el capital total apostado."
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
                    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 min-h-[300px]">
                        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                            <div className="flex items-center gap-3">
                                <LineChart className="text-sky-400" size={20} />
                                <h4 className="text-lg font-bold text-white/90">Evolución del Beneficio</h4>
                            </div>
                            <span className="text-[10px] font-bold text-white/50 uppercase">{formattedMonth}</span>
                        </div>

                        <div className="h-[250px] w-full bg-black/20 rounded-xl p-2 border border-white/5">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}u`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: '8px', fontSize: '12px' }}
                                        itemStyle={{ color: '#fff' }}
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
                        {/* 1. PERFORMANCE BY TYPE (Bar Chart) */}
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                            <h3 className="text-sm font-bold mb-4 text-white/50 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={14} className="text-emerald-400" />
                                Rentabilidad por Estrategia
                            </h3>

                            {stats?.performance_by_type ? (
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: 'Safe', profit: stats.performance_by_type.safe.profit, fill: '#10b981' }, // Emerald
                                            { name: 'Value', profit: stats.performance_by_type.value.profit, fill: '#f59e0b' }, // Amber
                                            { name: 'Funbet', profit: stats.performance_by_type.funbet.profit, fill: '#ec4899' }, // Pink
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <XAxis dataKey="name" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}u`} />
                                            <Tooltip
                                                cursor={{ fill: '#ffffff05' }}
                                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                                                itemStyle={{ color: '#fff' }}
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
                            )}
                        </div>

                        {/* 2. ACCURACY BY SPORT */}
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                            <h3 className="text-sm font-bold mb-4 text-white/50 uppercase tracking-widest flex items-center gap-2">
                                <Info size={14} className="text-blue-400" />
                                Precisión (Win Rate)
                            </h3>

                            <div className="space-y-6 mt-4">
                                {stats?.accuracy_by_sport?.football && (
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-white/70">⚽ Fútbol</span>
                                            <span className="text-xs font-bold text-white">{stats.accuracy_by_sport.football.accuracy_percentage}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                style={{ width: `${stats.accuracy_by_sport.football.accuracy_percentage}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-right mt-1 text-white/30">
                                            {stats.accuracy_by_sport.football.won_selections}/{stats.accuracy_by_sport.football.total_selections} aciertos
                                        </p>
                                    </div>
                                )}

                                {stats?.accuracy_by_sport?.basketball && (
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-xs font-bold text-white/70">🏀 Baloncesto</span>
                                            <span className="text-xs font-bold text-white">{stats.accuracy_by_sport.basketball.accuracy_percentage}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-600 to-amber-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                                style={{ width: `${stats.accuracy_by_sport.basketball.accuracy_percentage}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-right mt-1 text-white/30">
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

            </div>
        </div >
    );
}
