"use client";

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Info, ChevronLeft, ChevronRight, Activity, Trophy, ChevronDown, RefreshCw } from 'lucide-react';

export default function AdminAnalytics() {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Month Selection State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isUpdating, setIsUpdating] = useState(false);

    // ACCORDION STATES (Strict Independence)
    const [isResumenOpen, setIsResumenOpen] = useState(true);
    const [isEvolucionOpen, setIsEvolucionOpen] = useState(false);
    const [isDesgloseOpen, setIsDesgloseOpen] = useState(false);

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

                // Use Backend Chart Data if available (New System)
                if (json.stats.chart_evolution) {
                    const chartData = json.stats.chart_evolution.map((d: any) => ({
                        date: d.date.split('-')[2], // Day only
                        daily: d.daily_profit,
                        total: d.accumulated_profit
                    }));
                    setData(chartData);
                }
                // Fallback to legacy client-side calc if simple 'days' provided
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

    const handleUpdateStats = async () => {
        if (confirm("¿Forzar recálculo de estadísticas para este mes?")) {
            setIsUpdating(true);
            try {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth();
                const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;

                const res = await fetch('/api/admin/recalculate-stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: monthStr })
                });

                if (res.ok) {
                    await fetchData(); // Helper needed? currently useEffect triggers data load. 
                    // To force reload, we can toggle something or just manually call the logic extracted?
                    // fetchData is inside useEffect scope. We should extract it or just toggle date ref/reload page.
                    // Easiest here: window.location.reload() or extract fetchData.
                    // Given the structure, extracting fetchData is better but it's inside useEffect. 
                    // Let's toggle a 'refreshKey' or similar. 
                    // Hack: Toggle date back and forth? No.
                    // Let's just create a refresh trigger state.
                    window.location.reload(); // Simplest admin update feedback
                } else {
                    alert("Error al actualizar");
                }
            } catch (e) {
                alert("Error de red");
            } finally {
                setIsUpdating(false);
            }
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-fuchsia-500" size={48} /></div>;

    // Helper to safely access summary - support both new (nested) and legacy (flat) keys
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

    // Tooltip Helper
    const InfoTooltip = ({ text }: { text: string }) => (
        <div className="group/tooltip relative inline-flex items-center ml-1 z-50">
            <Info size={9} className="text-muted-foreground/50 cursor-help hover:text-emerald-400 transition-colors" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-none z-[60]">
                <p className="text-[10px] text-white/90 leading-tight font-medium text-center normal-case tracking-normal">
                    {text}
                </p>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1a1a1a]" />
            </div>
        </div>
    );

    // Collapsible Section Helper - Compact Style
    // Collapsible Section Helper - Controlled Component
    const CollapsibleSection = ({ title, children, isOpen, onToggle }: { title: string, children: React.ReactNode, isOpen: boolean, onToggle: (e: React.MouseEvent) => void }) => {
        return (
            <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5 my-2 relative z-30">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(e);
                    }}
                    className="w-full flex items-center justify-between p-2 cursor-pointer hover:bg-white/5 transition-colors select-none"
                    type="button"
                >
                    <span className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2 pl-2">
                        {title}
                    </span>
                    <div className="pr-2 text-muted-foreground">
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {isOpen && (
                    <div className="p-2 border-t border-white/10 animate-in slide-in-from-top-1 duration-200">
                        {children}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header with Selector */}
            {/* Header with Selector */}
            <div className="text-center mb-8 relative z-10">
                <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tighter">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">Rendimiento</span> <span className="text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">Mensual</span>
                </h2>
                <div className="w-24 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mx-auto mb-4 animate-pulse" />
                <p className="text-muted-foreground/80 font-medium max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                    Visualiza tus métricas clave. Detecta tendencias, optimiza tu estrategia y maximiza tus beneficios.
                </p>
                <button
                    onClick={handleUpdateStats}
                    disabled={isUpdating}
                    className="mt-4 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold text-white/60 transition flex items-center gap-2 mx-auto"
                >
                    <RefreshCw size={12} className={isUpdating ? "animate-spin" : ""} />
                    {isUpdating ? "Actualizando..." : "Actualizar Estadísticas"}
                </button>
            </div>

            <div className="flex flex-col md:flex-row justify-center items-center gap-4 relative mb-6">

                {/* MONTH SELECTOR */}
                <div className="flex items-center gap-2 bg-secondary/20 p-1 rounded-full border border-white/5 relative z-10">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold w-32 text-center uppercase tracking-wider">
                        {formattedMonth}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* SECTION 1: RESUMEN FINANCIERO (Open by Default) */}
            <CollapsibleSection
                title="Resumen Financiero"
                isOpen={isResumenOpen}
                onToggle={() => setIsResumenOpen(!isResumenOpen)}
            >
                {/* Top Metrics Cards - GRID 3x2 on MD - COMPACT MODE */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {/* 1. PROFIT */}
                    <div className="group relative bg-card/40 border border-border/50 p-3 rounded-xl flex flex-col justify-between h-20 hover:bg-card/60 transition-colors cursor-default overflow-visible">
                        <div className="overflow-visible">
                            <div className="text-muted-foreground text-[8px] uppercase font-bold tracking-widest flex items-center">
                                Profit <InfoTooltip text="Ganancia neta total acumulada en el mes seleccionado." />
                            </div>
                            <h3 className={`text-lg md:text-xl font-black mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {totalProfit > 0 ? '+' : ''}{totalProfit.toFixed(2)} u
                            </h3>
                        </div>
                        <div className="self-end p-1 rounded-full bg-secondary/20">
                            <DollarSign className="w-3.5 h-3.5 text-foreground/70" />
                        </div>
                    </div>

                    {/* 2. YIELD */}
                    <div className="group relative bg-card/40 border border-border/50 p-3 rounded-xl flex flex-col justify-between h-20 hover:bg-card/60 transition-colors overflow-visible">
                        <div className="overflow-visible">
                            <div className="text-muted-foreground text-[8px] uppercase font-bold tracking-widest flex items-center">
                                Yield <InfoTooltip text="Rentabilidad obtenida sobre el capital total apostado." />
                            </div>
                            <h3 className={`text-lg md:text-xl font-black mt-0.5 ${yieldVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {yieldVal.toFixed(2)}%
                            </h3>
                        </div>
                        <div className="self-end p-1 rounded-full bg-secondary/20">
                            <Activity className="w-3.5 h-3.5 text-foreground/70" />
                        </div>
                    </div>

                    {/* 3. PROFIT FACTOR */}
                    <div className="group relative bg-card/40 border border-border/50 p-3 rounded-xl flex flex-col justify-between h-20 hover:bg-card/60 transition-colors overflow-visible">
                        <div className="overflow-visible">
                            <div className="text-muted-foreground text-[8px] uppercase font-bold tracking-widest flex items-center">
                                Factor (PF) <InfoTooltip text="Relación entre ganancias brutas y pérdidas brutas. >1.5 es excelente." />
                            </div>
                            <h3 className={`text-lg md:text-xl font-black mt-0.5 ${profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {profitFactor.toFixed(2)}
                            </h3>
                        </div>
                        <div className="self-end text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                            <span className="text-emerald-400 font-bold">&gt;1.5</span>
                        </div>
                    </div>

                    {/* 4. MAX DRAWDOWN */}
                    <div className="group relative bg-card/40 border border-border/50 p-3 rounded-xl flex flex-col justify-between h-20 hover:bg-card/60 transition-colors overflow-visible">
                        <div className="overflow-visible">
                            <div className="text-muted-foreground text-[8px] uppercase font-bold tracking-widest flex items-center">
                                Drawdown <InfoTooltip text="Máxima caída acumulada desde el punto más alto de beneficios." />
                            </div>
                            <h3 className="text-lg md:text-xl font-black mt-0.5 text-rose-400">
                                -{maxDrawdown.toFixed(2)} u
                            </h3>
                        </div>
                        <div className="self-end p-1 rounded-full bg-rose-500/10">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                        </div>
                    </div>

                    {/* 5. TOTAL STAKE */}
                    <div className="group relative bg-card/40 border border-border/50 p-3 rounded-xl flex flex-col justify-between h-20 hover:bg-card/60 transition-colors overflow-visible">
                        <div className="overflow-visible">
                            <div className="text-muted-foreground text-[8px] uppercase font-bold tracking-widest flex items-center">
                                Vol. Apostado <InfoTooltip text="Suma total de unidades arriesgadas en todas las apuestas." />
                            </div>
                            <h3 className="text-lg md:text-xl font-black mt-0.5 text-foreground/80">
                                {totalStake.toFixed(2)} u
                            </h3>
                        </div>
                        <div className="self-end p-1 rounded-full bg-secondary/20">
                            <Trophy className="w-3.5 h-3.5 text-foreground/70" />
                        </div>
                    </div>

                    {/* 6. WIN RATE DAYS */}
                    <div className="group relative bg-card/40 border border-border/50 p-3 rounded-xl flex flex-col justify-between h-20 hover:bg-card/60 transition-colors overflow-visible">
                        <div className="overflow-visible">
                            <div className="text-muted-foreground text-[8px] uppercase font-bold tracking-widest flex items-center">
                                Días Ganadores <InfoTooltip text="Porcentaje de días que terminaron con balance positivo." />
                            </div>
                            <h3 className={`text-lg md:text-xl font-black mt-0.5 ${winRateDays > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {winRateDays.toFixed(1)}%
                            </h3>
                        </div>
                        <div className="self-end p-1 rounded-full bg-secondary/20">
                            <div className="w-3.5 h-3.5 rounded-full border border-foreground/30 flex items-center justify-center text-[8px] font-bold">
                                %
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Main Chart: Profit Evolution (Closed by Default) */}
            <CollapsibleSection
                title={`Evolución (${formattedMonth})`}
                isOpen={isEvolucionOpen}
                onToggle={() => setIsEvolucionOpen(!isEvolucionOpen)}
            >
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#d946ef" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#d946ef" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis dataKey="date" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}u`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#d946ef"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorTotal)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CollapsibleSection>

            {/* DETAILED STATS GRID */}
            {/* DETAILED STATS GRID */}
            {/* DETAILED STATS GRID */}
            <CollapsibleSection
                title="Desglose Detallado"
                isOpen={isDesgloseOpen}
                onToggle={() => setIsDesgloseOpen(!isDesgloseOpen)}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* 1. PERFORMANCE BY TYPE (Bar Chart) */}
                    <div className="bg-card/30 border border-border/50 rounded-3xl p-4">
                        <h3 className="text-lg font-bold mb-4 text-white/80 flex items-center gap-2">
                            <TrendingUp size={18} className="text-emerald-400" />
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
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}u`} />
                                        <Tooltip
                                            cursor={{ fill: '#ffffff10' }}
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                                            {
                                                // Dynamic coloring for positive/negative? 
                                                // Recharts handles dataKeys, but to color conditionally needs Cell mapping
                                                [{ profit: stats.performance_by_type.safe.profit }, { profit: stats.performance_by_type.value.profit }, { profit: stats.performance_by_type.funbet.profit }].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? ['#10b981', '#f59e0b', '#ec4899'][index] : '#f43f5e'} />
                                                ))
                                            }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                                Sin datos detallados
                            </div>
                        )}
                    </div>

                    {/* 2. ACCURACY BY SPORT */}
                    <div className="bg-card/30 border border-border/50 rounded-3xl p-4">
                        <h3 className="text-lg font-bold mb-4 text-white/80 flex items-center gap-2">
                            <Info size={18} className="text-blue-400" />
                            Precisión (Win Rate)
                        </h3>

                        <div className="space-y-6 mt-4">
                            {stats?.accuracy_by_sport?.football && (
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-white/70">⚽ Fútbol</span>
                                        <span className="text-sm font-bold text-white">{stats.accuracy_by_sport.football.accuracy_percentage}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                                            style={{ width: `${stats.accuracy_by_sport.football.accuracy_percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-right mt-1 text-muted-foreground">
                                        {stats.accuracy_by_sport.football.won_selections}/{stats.accuracy_by_sport.football.total_selections} aciertos
                                    </p>
                                </div>
                            )}

                            {stats?.accuracy_by_sport?.basketball && (
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-white/70">🏀 Baloncesto</span>
                                        <span className="text-sm font-bold text-white">{stats.accuracy_by_sport.basketball.accuracy_percentage}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-orange-600 to-amber-400"
                                            style={{ width: `${stats.accuracy_by_sport.basketball.accuracy_percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-right mt-1 text-muted-foreground">
                                        {stats.accuracy_by_sport.basketball.won_selections}/{stats.accuracy_by_sport.basketball.total_selections} aciertos
                                    </p>
                                </div>
                            )}

                            {!stats?.accuracy_by_sport && (
                                <div className="flex items-center justify-center h-[100px] text-muted-foreground text-sm">
                                    Sin datos de precisión
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CollapsibleSection>
        </div >
    );
}
