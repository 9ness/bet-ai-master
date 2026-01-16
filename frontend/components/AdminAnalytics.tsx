"use client";

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Info } from 'lucide-react';

export default function AdminAnalytics() {
    const [data, setData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const now = new Date();
                const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

                const res = await fetch(`/api/admin/history?month=${monthStr}`);
                const json = await res.json();

                if (json.days) {
                    // Process for Chart: Evolution of Profit (Cumulative)
                    const days = Object.keys(json.days).sort();
                    let cumulative = 0;
                    const chartData = days.map(date => {
                        const dayP = json.days[date].day_profit;
                        cumulative += dayP;
                        return {
                            date: date.split('-')[2], // Day only
                            daily: dayP,
                            total: Number(cumulative.toFixed(2))
                        };
                    });

                    // Fill gaps for smooth line? Or just plot existing days?
                    // Better to just plot existing days for now.
                    setData(chartData);
                }
                setStats(json.stats);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-fuchsia-500" size={48} /></div>;

    const isPositive = stats && stats.total_profit >= 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Top Metrics Cards */}
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* 1. PROFIT */}
                <div className="group relative bg-card/40 border border-border/50 p-4 rounded-3xl flex flex-col justify-between h-32 md:h-auto hover:bg-card/60 transition-colors">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/90 text-white text-[10px] p-2 rounded border border-white/10 w-40 absolute right-0 -top-8 z-10 pointer-events-none">
                            Ganancia neta total acumulada en unidades (u) este mes.
                        </div>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                            Profit Mensual <Info size={10} className="text-muted-foreground/50" />
                        </p>
                        <h3 className={`text-2xl md:text-3xl font-black mt-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats?.total_profit > 0 ? '+' : ''}{stats?.total_profit?.toFixed(2)} u
                        </h3>
                    </div>
                    <div className="self-end p-2 rounded-full bg-secondary/20">
                        <DollarSign className="w-5 h-5 text-foreground/70" />
                    </div>
                </div>

                {/* 2. ROI */}
                <div className="group relative bg-card/40 border border-border/50 p-4 rounded-3xl flex flex-col justify-between h-32 md:h-auto hover:bg-card/60 transition-colors">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/90 text-white text-[10px] p-2 rounded border border-white/10 w-40 absolute right-0 -top-8 z-10 pointer-events-none">
                            Rentabilidad obtenida respecto al bankroll inicial (base 100u).
                        </div>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                            ROI (Retorno) <Info size={10} className="text-muted-foreground/50" />
                        </p>
                        <h3 className={`text-2xl md:text-3xl font-black mt-1 ${stats?.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats?.roi?.toFixed(2)}%
                        </h3>
                    </div>
                    <div className="self-end p-2 rounded-full bg-secondary/20">
                        <TrendingUp className="w-5 h-5 text-foreground/70" />
                    </div>
                </div>

                {/* 3. MAX DRAWDOWN */}
                <div className="group relative bg-card/40 border border-border/50 p-4 rounded-3xl flex flex-col justify-between h-32 md:h-auto hover:bg-card/60 transition-colors">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/90 text-white text-[10px] p-2 rounded border border-white/10 w-40 absolute right-0 -top-8 z-10 pointer-events-none">
                            La mayor "mala racha" o caída acumulada desde un máximo.
                        </div>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                            Máxima Caída <Info size={10} className="text-muted-foreground/50" />
                        </p>
                        <h3 className="text-2xl md:text-3xl font-black mt-1 text-rose-400">
                            -{stats?.max_drawdown?.toFixed(2)} u
                        </h3>
                    </div>
                    <div className="self-end p-2 rounded-full bg-rose-500/10">
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                    </div>
                </div>

                {/* 4. PROFIT FACTOR */}
                <div className="group relative bg-card/40 border border-border/50 p-4 rounded-3xl flex flex-col justify-between h-32 md:h-auto hover:bg-card/60 transition-colors">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/90 text-white text-[10px] p-2 rounded border border-white/10 w-40 absolute right-0 -top-8 z-10 pointer-events-none">
                            Relación entre ganancias brutas y pérdidas brutas. {'>'} 1 es rentable.
                        </div>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                            Factor Beneficio <Info size={10} className="text-muted-foreground/50" />
                        </p>
                        <h3 className={`text-2xl md:text-3xl font-black mt-1 ${stats?.profit_factor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {stats?.profit_factor?.toFixed(2)}
                        </h3>
                    </div>
                    <div className="self-end text-xs text-muted-foreground font-medium flex items-center gap-1">
                        Meta: <span className="text-emerald-400 font-bold">&gt;1.5</span>
                    </div>
                </div>
            </div>

            {/* Main Chart: Profit Evolution */}
            <div className="bg-card/30 border border-border/50 rounded-3xl p-6 md:p-8">
                <h3 className="text-xl font-bold mb-6 text-white/80">Evolución de Unidades (Enero)</h3>
                <div className="h-[300px] w-full">
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
            </div>
        </div >
    );
}
