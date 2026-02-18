
"use client";

import React, { useState, useEffect } from 'react';
import { Activity, Trophy, PlayCircle } from 'lucide-react';

interface SportUsage {
    used: number;
    remaining: number | null;
    limit: number;
}

interface UsageData {
    football: SportUsage;
    basketball: SportUsage;
}

export default function ApiUsageBanner() {
    const [data, setData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const res = await fetch('/api/admin/system/usage');
                const json = await res.json();
                if (json.success) {
                    setData({
                        football: json.football,
                        basketball: json.basketball
                    });
                }
            } catch (e) {
                console.error("Failed to fetch API usage", e);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, []);

    if (loading || !data) return null;

    const renderBar = (label: string, usage: SportUsage, icon: React.ReactNode, colorBase: string) => {
        const percentage = (usage.used / usage.limit) * 100;
        let colorClass = `text-${colorBase}-400`;
        let bgClass = `bg-${colorBase}-500`;

        // Warning Colors
        if (percentage > 90) {
            colorClass = "text-rose-400";
            bgClass = "bg-rose-500";
        } else if (percentage > 75) {
            colorClass = "text-amber-400";
            bgClass = "bg-amber-500";
        }

        return (
            <div className="flex-1 min-w-[140px]">
                <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1.5">
                        {icon}
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{label}</span>
                    </div>
                    <span className={`text-xs font-mono font-black ${colorClass}`}>
                        {usage.used}/{usage.limit}
                    </span>
                </div>
                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                        className={`h-full ${bgClass} transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="bg-black/20 border border-white/5 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-center">
                {/* Header Compacto */}
                <div className="flex items-center gap-3 min-w-fit">
                    <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5">
                        <Activity size={18} className="text-blue-400" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-white leading-none mb-1">CONSUMO API</h4>
                        <p className="text-[9px] text-white/40">Renueva 00:00 UTC</p>
                    </div>
                </div>

                {/* Bars Container */}
                <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
                    {renderBar("Fútbol", data.football, <Trophy size={10} className="text-emerald-400" />, "emerald")}
                    {renderBar("Basket", data.basketball, <PlayCircle size={10} className="text-orange-400" />, "orange")}
                </div>
            </div>
        </div>
    );
}
