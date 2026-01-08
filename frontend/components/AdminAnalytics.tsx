"use client";

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card/40 border border-border/50 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Profit Mensual</p>
                        <h3 className={`text-4xl font-black mt-2 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats?.total_profit > 0 ? '+' : ''}{stats?.total_profit} u
                        </h3>
                    </div>
                    <div className={`p-4 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {isPositive ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
                    </div>
                </div>

                <div className="bg-card/40 border border-border/50 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">ROI Estimado</p>
                        <h3 className="text-4xl font-black mt-2 text-violet-400">
                            {/* Fake/Simple ROI calc: Profit / (Days * ~10u betted) ? Logic needed later. Placeholder. */}
                            ~12.5%
                        </h3>
                    </div>
                    <div className="p-4 rounded-full bg-violet-500/10 text-violet-500">
                        <DollarSign size={32} />
                    </div>
                </div>

                <div className="bg-card/40 border border-border/50 p-6 rounded-3xl flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">Días Operados</p>
                        <h3 className="text-4xl font-black mt-2 text-white">
                            {data.length}
                        </h3>
                    </div>
                    <div className="p-4 rounded-full bg-blue-500/10 text-blue-500">
                        <TrendingUp size={32} />
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
        </div>
    );
}
