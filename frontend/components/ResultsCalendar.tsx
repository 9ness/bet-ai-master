"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, CircleCheck, CircleX, TrendingUp, ChevronDown, Check, MonitorPlay, Clock } from 'lucide-react';

// Type definitions
type PickDetail = {
    match: string;
    pick: string;
    status: 'SUCCESS' | 'FAIL' | 'PENDING' | null;
};

type BetResult = {
    type: 'safe' | 'value' | 'funbet';
    stake: number;
    total_odd: number;
    status: 'WON' | 'LOST' | 'PENDING' | 'UNKNOWN' | 'GANADA' | 'PERDIDA' | 'PENDIENTE';
    profit: number;
    match: string;
    pick: string;
    fixture_ids?: number[];
    picks_detail?: PickDetail[];
    selections?: any[]; // Allow selections array
};

type DayHistory = {
    date: string;
    day_profit: number;
    bets: BetResult[];
};

type MonthStats = {
    total_profit: number;
    win_rate?: number;
};

// Sub-component for individual Bet Cards in Modal
// Sub-component for individual Bet Cards in Modal
const BetDetailCard = ({ bet, date, isAdmin, onUpdate }: { bet: BetResult, date: string, isAdmin: boolean, onUpdate: () => void }) => {
    const [expanded, setExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Use local state for optimistic UI updates if needed, 
    // but for now let's rely on re-fetch or just simple API call.

    // Fallback if picks_detail is empty but we have selections in bet object (if API returns it)
    // The Type definition needs 'selections' or we map 'picks_detail' to it?
    // In API/Python we save 'selections'. In this file 'BetResult' has 'picks_detail'.
    // We should probably accept 'selections' too.
    const details = bet.selections || bet.picks_detail || [];
    const hasDetails = details.length > 0;

    const handleStatusUpdate = async (type: string, id: number | undefined, newStatus: string) => {
        if (!id) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: bet.type, // 'safe', 'value', 'funbet'
                    selectionId: id,
                    newStatus
                })
            });
            if (res.ok) {
                onUpdate(); // Refresh parent
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 transition-all hover:bg-secondary/40">
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full 
                    ${bet.type === 'safe' ? 'bg-emerald-500/10 text-emerald-500' :
                        bet.type === 'value' ? 'bg-violet-500/10 text-violet-500' :
                            'bg-amber-500/10 text-amber-500'}`}>
                    {bet.type === 'safe' ? 'SEGURA' : bet.type === 'value' ? 'DE VALOR' : bet.type}
                </span>
                <span className={`font-mono font-bold ${bet.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {bet.profit > 0 ? '+' : ''}{bet.profit.toFixed(2)}u
                </span>
            </div>

            <p className="font-semibold text-sm mb-1">{bet.match}</p>
            <p className="text-xs text-muted-foreground mb-3 italic">{bet.pick}</p>

            {/* Expansion Toggle */}
            {hasDetails && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-[10px] uppercase font-bold text-primary mb-3 hover:underline"
                >
                    <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    Ver Desglose ({details.length})
                </button>
            )}

            {/* Expanded List */}
            {expanded && hasDetails && (
                <div className="mb-3 space-y-1 bg-background/50 p-2 rounded-lg border border-border/30">
                    {details.map((detail: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-1 border-b border-white/5 last:border-0">
                            <div className="flex bg-black/20 rounded px-1.5 py-0.5 max-w-[65%]">
                                <span className="truncate text-muted-foreground mr-1">{detail.match}:</span>
                                <span className="font-medium truncate text-foreground">{detail.pick}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {(detail.status === 'SUCCESS' || detail.status === 'WON' || detail.status === 'GANADA') && <CircleCheck size={14} className="text-emerald-500" />}
                                {(detail.status === 'FAIL' || detail.status === 'LOST' || detail.status === 'PERDIDA') && <CircleX size={14} className="text-rose-500" />}
                                {(detail.status === 'PENDING' || detail.status === 'PENDIENTE') && <Clock size={14} className="text-amber-500/50" />}

                                {isAdmin && (
                                    <div className="flex gap-1 ml-2">
                                        <button disabled={isSaving} onClick={() => handleStatusUpdate(bet.type, detail.fixture_id, 'WON')} className="p-0.5 hover:bg-emerald-500/20 rounded text-emerald-500"><Check size={12} /></button>
                                        <button disabled={isSaving} onClick={() => handleStatusUpdate(bet.type, detail.fixture_id, 'LOST')} className="p-0.5 hover:bg-rose-500/20 rounded text-rose-500"><X size={12} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center text-xs border-t border-border/30 pt-2">
                <div className="flex gap-4">
                    <span>Stake: <b className="text-foreground">{bet.stake}</b></span>
                    <span>Cuota: <b className="text-foreground">{bet.total_odd}</b></span>
                </div>
                <div className="flex items-center gap-1 font-bold">
                    {(bet.status === 'WON' || bet.status === 'GANADA') && <><CircleCheck size={14} className="text-emerald-500" /> GANADA</>}
                    {(bet.status === 'LOST' || bet.status === 'PERDIDA') && <><CircleX size={14} className="text-rose-500" /> PERDIDA</>}
                    {(bet.status === 'PENDING' || bet.status === 'PENDIENTE') && <span className="text-amber-500">PENDIENTE</span>}
                    {bet.status === 'UNKNOWN' && <span className="text-gray-500">? DESC.</span>}
                </div>
            </div>
        </div>
    );
};


export default function ResultsCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [stats, setStats] = useState<MonthStats | null>(null);
    const [history, setHistory] = useState<Record<string, DayHistory>>({});
    const [loading, setLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<DayHistory | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Check path for /admin
            if (window.location.pathname.startsWith('/admin')) {
                setIsAdmin(true);
            }
        }
        fetchData();
    }, [currentDate]);

    const handleTriggerCheck = async (date: string) => {
        if (!confirm(`¿Ejecutar comprobación para ${date}?`)) return;
        setIsChecking(true);
        try {
            await fetch('/api/admin/trigger-check', {
                method: 'POST',
                body: JSON.stringify({ date })
            });
            alert("Comprobación iniciada. Espera unos segundos y recarga.");
        } catch (e) {
            console.error(e);
            alert("Error al iniciar comprobación");
        } finally {
            setIsChecking(false);
        }
    };

    const handleUpdate = () => {
        // Refresh data after manual edit
        fetchData();
        // Also update selected day data locally if needed or close modal?
        // Simple approach: close modal to force refresh from main list later, or re-fetch specific day?
        // Since fetchData gets whole month, calling it refreshes history.
        // We need to update selectedDay reference too.
        // For now, let's just re-fetch and rely on user closing/reopening or update generic.
        // Better: fetchData matches selectedDay date and updates it.
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
            const res = await fetch(`/api/admin/history?month=${monthStr}`);
            const data = await res.json();

            setStats(data.stats);
            setHistory(data.days || {});
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

    // Calendar Grid Logic
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const renderDay = (day: number) => {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        // @ts-ignore - Dynamic key access
        const dayData = history[dateStr];
        const hasData = !!dayData;

        // Valid statuses from API: 'PENDING'
        // Or if we check day_profit only? No, use the status flag I added in API.
        // But Typescript might not know about it. `DayHistory` type definition needs update too?
        // Let's rely on checking property existence or implicit any.
        // In API I added `status: 'PENDING'`.
        const isPending = hasData && (dayData as any).status === 'PENDING';
        const isPositive = hasData && dayData.day_profit >= 0;

        return (
            <div
                key={day}
                onClick={() => hasData && setSelectedDay(dayData)}
                className={`
                    relative aspect-square md:aspect-auto border rounded-lg md:rounded-xl p-1 md:p-4 flex flex-col items-center justify-between transition-all group overflow-hidden
                    md:h-32 lg:h-40
                    ${hasData ? 'cursor-pointer hover:shadow-lg' : 'opacity-30 pointer-events-none border-border/40'}
                    ${selectedDay?.date === dateStr ? 'ring-2 ring-primary bg-secondary/30' : ''}
                    ${hasData && !isPending && !selectedDay ? 'hover:bg-secondary/50 hover:border-primary/50 hover:shadow-primary/5 border-border/40' : ''}
                    ${isPending ? 'bg-zinc-500/5 border-zinc-500/20 hover:border-zinc-500/40' : ''}
                `}
            >
                <div className="hidden md:block absolute top-2 right-2 md:top-3 md:right-3 opacity-50 group-hover:opacity-100 transition-opacity">
                    {hasData && (
                        isPending ? <Clock size={16} className="text-zinc-500" /> :
                            isPositive ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingUp size={16} className="text-rose-500 rotate-180" />
                    )}
                </div>

                <span className="text-[10px] md:text-xl font-bold text-muted-foreground group-hover:text-foreground transition-colors self-start md:self-auto pl-1 md:pl-0">{day}</span>

                {hasData && (
                    <div className="flex flex-col items-center justify-center h-full w-full md:gap-2">
                        {isPending ? (
                            <>
                                <Clock size={16} className="text-zinc-400 md:hidden" />
                                <span className="hidden md:block text-2xl font-black text-zinc-300">...</span>
                            </>
                        ) : (
                            <span className={`text-[9px] md:text-base lg:text-lg font-black tracking-tighter leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {dayData.day_profit > 0 ? '+' : ''}{dayData.day_profit.toFixed(2)}u
                            </span>
                        )}

                        <div className="hidden md:flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isPending ? 'bg-zinc-500 shadow-[0_0_8px_rgba(113,113,122,0.8)]' : isPositive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                {isPending ? 'Pendiente' : isPositive ? 'Profit' : 'Loss'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full max-w-7xl mx-auto bg-card/30 backdrop-blur-sm border border-border/50 rounded-3xl p-4 md:p-8 shadow-2xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                <div className="flex items-center gap-4 bg-background/50 p-2 rounded-full border border-border/50 shadow-inner">
                    <button onClick={prevMonth} className="p-2 hover:bg-secondary rounded-full transition-colors"><ChevronLeft size={20} /></button>
                    <span className="font-bold text-lg md:text-xl min-w-[160px] text-center capitalize">
                        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-secondary rounded-full transition-colors"><ChevronRight size={20} /></button>
                </div>

                <div className="flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 rounded-2xl md:ml-auto shadow-lg shadow-violet-900/10">
                    <div className="p-3 bg-violet-500/20 rounded-xl text-violet-400 border border-violet-500/30">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-0.5">Balance Mensual</p>
                        <p className={`text-3xl font-black tracking-tight ${stats && (Number(stats.total_profit) >= 0) ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.3)]'}`}>
                            {stats ? (Number(stats.total_profit) > 0 ? '+' : '') + Number(stats.total_profit).toFixed(2) : '0.00'} u
                        </p>
                    </div>
                </div>
            </div>

            {/* Grid Headers */}
            <div className="grid grid-cols-7 gap-2 md:gap-4 mb-3 border-b border-border/30 pb-2">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => (
                    <div key={d} className="text-center text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-widest hidden md:block">
                        {d}
                    </div>
                ))}
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
                    <div key={d} className="text-center text-xs font-bold text-muted-foreground md:hidden">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 gap-2 md:gap-4">
                {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square md:aspect-auto md:h-32 lg:h-40 bg-secondary/5 rounded-xl border border-transparent" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => renderDay(i + 1))}
            </div>

            {/* Detail Modal */}
            {selectedDay && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-secondary/50 to-background/50">
                            <div>
                                <h3 className="font-bold text-2xl text-white flex items-center gap-2">
                                    {new Date(selectedDay.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${selectedDay.day_profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {selectedDay.day_profit > 0 ? '+' : ''}{selectedDay.day_profit.toFixed(2)} unidades
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                                <X size={28} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-4 bg-background/95">
                            {isAdmin && (
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={() => handleTriggerCheck(selectedDay.date)}
                                        disabled={isChecking}
                                        className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <MonitorPlay size={12} />
                                        {isChecking ? 'Ejecutando...' : 'Forzar Check API'}
                                    </button>
                                </div>
                            )}
                            {selectedDay.bets.map((bet, idx) => (
                                <BetDetailCard
                                    key={idx}
                                    bet={bet}
                                    date={selectedDay.date}
                                    isAdmin={isAdmin}
                                    onUpdate={handleUpdate}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
