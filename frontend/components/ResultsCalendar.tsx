"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Check, X, CircleCheck, CircleX, Clock, ChevronDown, Save, Loader2, TrendingUp, MonitorPlay } from 'lucide-react';

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
// Sub-component for individual Bet Cards in Modal
const BetDetailCard = ({ bet, date, isAdmin, onUpdate }: { bet: BetResult, date: string, isAdmin: boolean, onUpdate: () => void }) => {
    const [expanded, setExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<number, string>>({});
    // Key: selectionId, Value: newStatus

    // Reset pending changes when bet prop updates (e.g. after save/refresh)
    useEffect(() => {
        setPendingChanges({});
    }, [bet]);

    const details = bet.selections || bet.picks_detail || bet.components || [];
    const hasDetails = details.length > 0;
    const hasChanges = Object.keys(pendingChanges).length > 0;

    // Helper to get unique ID for selection (legacy compatibility)
    const getSelId = (detail: any) => detail.fixture_id ? detail.fixture_id.toString() : detail.match;

    const handleLocalStatusChange = (id: string, newStatus: string) => {
        setPendingChanges(prev => ({
            ...prev,
            [id]: newStatus
        }));
    };

    const handleSaveBatch = async () => {
        setIsSaving(true);
        try {
            // Convert pendingChanges to array
            // Format: { selectionId, newStatus } 
            // We verify if mapped ID is numeric-ish or string
            const updates = Object.entries(pendingChanges).map(([idStr, status]) => ({
                selectionId: idStr,
                newStatus: status
            }));

            if (updates.length === 0) return;

            await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: bet.type,
                    updates // Send batch
                })
            });

            setPendingChanges({});
            onUpdate(); // Refresh Parent
        } catch (e) {
            console.error(e);
            alert("Error saving updates");
        } finally {
            setIsSaving(false);
        }
    };

    // Global override
    const handleGlobalStatusUpdate = async (newStatus: string) => {
        setIsSaving(true);
        try {
            await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: bet.type,
                    selectionId: null, // Explicit global update
                    newStatus
                })
            });
            console.log("Global status updated, refreshing data...");
            onUpdate(); // Mutate/Refresh parent data
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 transition-all hover:bg-secondary/40 relative">
            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full 
                    ${bet.type === 'safe' ? 'bg-emerald-500/10 text-emerald-500' :
                        bet.type === 'value' ? 'bg-violet-500/10 text-violet-500' :
                            'bg-amber-500/10 text-amber-500'}`}>
                    {bet.type === 'safe' ? 'SEGURA' : bet.type === 'value' ? 'DE VALOR' : bet.type}
                </span>
                <span className={`font-mono font-bold ${bet.profit > 0 ? 'text-emerald-500' : bet.profit < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                    {bet.profit > 0 ? '+' : ''}{bet.profit.toFixed(2)}u
                </span>
            </div>

            <p className="font-semibold text-sm mb-1">{bet.match}</p>
            <p className="text-xs text-muted-foreground mb-3 italic">{bet.pick}</p>

            {/* Expansion Toggle & Save Bar */}
            {hasDetails && (
                <div className="flex justify-between items-center mb-3">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-[10px] uppercase font-bold text-primary hover:underline"
                    >
                        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        Ver Desglose ({details.length})
                    </button>

                    {/* Batch Save Button - Inline */}
                    {hasChanges && (
                        <button
                            onClick={handleSaveBatch}
                            disabled={isSaving}
                            className="bg-primary/90 hover:bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded shadow flex items-center gap-1 animate-in fade-in zoom-in duration-200"
                        >
                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                            Guardar ({Object.keys(pendingChanges).length})
                        </button>
                    )}
                </div>
            )}

            {/* Expanded List */}
            {
                expanded && hasDetails && (
                    <div className="mb-3 space-y-1 bg-background/50 p-2 rounded-lg border border-border/30">
                        {details.map((detail: any, idx: number) => {
                            const uniqueId = getSelId(detail);
                            // Determine value: pending > current > default
                            const currentStatus = pendingChanges[uniqueId] || detail.status || "PENDING";

                            return (
                                <div key={idx} className="flex justify-between items-center text-xs p-1 border-b border-white/5 last:border-0 gap-2">
                                    <div className="flex bg-black/20 rounded px-1.5 py-0.5 flex-1 min-w-0">
                                        <span className="text-muted-foreground mr-1 shrink-0">{detail.match}:</span>
                                        <span className="font-medium truncate text-foreground">{detail.pick}</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isAdmin ? (
                                            <select
                                                className={`border text-[10px] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary transition-colors
                                                ${pendingChanges[uniqueId] ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-white/10 text-foreground'}`}
                                                value={currentStatus}
                                                onChange={(e) => handleLocalStatusChange(uniqueId, e.target.value)}
                                                disabled={isSaving}
                                            >
                                                <option value="PENDING">PEND</option>
                                                <option value="WON">WON</option>
                                                <option value="LOST">LOST</option>
                                                <option value="VOID">VOID</option>
                                            </select>
                                        ) : (
                                            <>
                                                {(detail.status === 'SUCCESS' || detail.status === 'WON' || detail.status === 'GANADA') && <CircleCheck size={14} className="text-emerald-500" />}
                                                {(detail.status === 'FAIL' || detail.status === 'LOST' || detail.status === 'PERDIDA') && <CircleX size={14} className="text-rose-500" />}
                                                {(!detail.status || detail.status === 'PENDING' || detail.status === 'PENDIENTE') && <Clock size={14} className="text-amber-500" />}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }

            <div className="flex justify-between items-center text-xs border-t border-border/30 pt-2">
                <div className="flex gap-4">
                    <span>Stake: <b className="text-foreground">{bet.stake}</b></span>
                    <span>Cuota: <b className="text-foreground">{bet.total_odd}</b></span>
                </div>
                <div className="flex items-center gap-1 font-bold">
                    {isAdmin ? (
                        <select
                            className="bg-secondary text-xs rounded px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                            value={bet.status}
                            onChange={(e) => handleGlobalStatusUpdate(e.target.value)}
                            disabled={isSaving}
                        >
                            <option value="PENDING">PENDIENTE</option>
                            <option value="WON">GANADA</option>
                            <option value="LOST">PERDIDA</option>
                        </select>
                    ) : (
                        <>
                            {(bet.status === 'WON' || bet.status === 'GANADA') && <><CircleCheck size={14} className="text-emerald-500" /> GANADA</>}
                            {(bet.status === 'LOST' || bet.status === 'PERDIDA') && <><CircleX size={14} className="text-rose-500" /> PERDIDA</>}
                            {(bet.status === 'PENDING' || bet.status === 'PENDIENTE') && <span className="text-amber-500">PENDIENTE</span>}
                            {bet.status === 'UNKNOWN' && <span className="text-gray-500">? DESC.</span>}
                        </>
                    )}
                </div>
            </div>
        </div >
    );
};


export default function ResultsCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [stats, setStats] = useState<MonthStats | null>(null);
    const [history, setHistory] = useState<Record<string, DayHistory>>({});
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Derived state for live updates
    const selectedDayData = selectedDate ? history[selectedDate] : null;

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
        // @ts-ignore
        const dayData = history[dateStr];
        const hasData = !!dayData;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        // Valid statuses from API: 'PENDING'
        const isPending = hasData && (dayData as any).status === 'PENDING';

        const profitClass = hasData ? (dayData.day_profit > 0 ? 'text-emerald-400' : dayData.day_profit < 0 ? 'text-rose-400' : 'text-muted-foreground') : '';
        const profitBg = hasData ? (dayData.day_profit > 0 ? 'bg-emerald-500/10' : dayData.day_profit < 0 ? 'bg-rose-500/10' : 'bg-secondary/20') : 'bg-secondary/5';

        if (!hasData) {
            return (
                <div key={day} className={`aspect-square md:aspect-auto md:h-32 lg:h-40 bg-secondary/5 rounded-xl border border-white/5 p-2 transition-all hover:bg-secondary/10 group relative`}>
                    <div className="flex justify-between items-start">
                        <span className={`text-sm font-bold ${isToday ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center' : 'text-muted-foreground'}`}>
                            {day}
                        </span>
                    </div>
                </div>
            );
        }

        return (
            <div
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                    relative aspect-square md:aspect-auto border rounded-xl p-3 flex flex-col justify-between transition-all group overflow-hidden cursor-pointer hover:shadow-lg hover:scale-[1.02]
                    md:h-32 lg:h-40
                    ${profitBg}
                    border-white/5
                    ${selectedDate === dateStr ? 'ring-2 ring-primary' : ''}
                `}
            >
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <span className={`text-lg font-bold ${isToday ? 'bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center shadow-lg' : 'text-foreground'}`}>
                        {day}
                    </span>
                    {isPending && <Clock size={16} className="text-amber-500 animate-pulse" />}
                </div>

                <div className="flex flex-col gap-1 relative z-10">
                    <div className="text-xs font-medium text-muted-foreground">Profit</div>
                    <div className={`text-xl font-bold ${profitClass}`}>
                        {dayData.day_profit > 0 ? '+' : ''}{dayData.day_profit.toFixed(2)}u
                    </div>
                </div>

                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-background/80 backdrop-blur-sm p-1.5 rounded-full shadow-lg">
                        <ChevronRight size={16} className="text-primary" />
                    </div>
                </div>
            </div>
        );
    };



    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8">
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

            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-2 md:gap-4 mb-2">
                {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, i) => (
                    <div key={d} className="text-center text-xs font-bold text-muted-foreground hidden md:block">
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
            {selectedDate && selectedDayData && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-secondary/50 to-background/50">
                            <div>
                                <h3 className="font-bold text-2xl text-white flex items-center gap-2">
                                    {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${selectedDayData.day_profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {selectedDayData.day_profit > 0 ? '+' : ''}{selectedDayData.day_profit.toFixed(2)} unidades
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                                <X size={28} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-4 bg-background/95">
                            {isAdmin && (
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={() => handleTriggerCheck(selectedDate)}
                                        disabled={isChecking}
                                        className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <MonitorPlay size={12} />
                                        {isChecking ? 'Ejecutando...' : 'Forzar Check API'}
                                    </button>
                                </div>
                            )}

                            {selectedDayData.bets.map((bet: any, idx: number) => (
                                <BetDetailCard
                                    key={idx}
                                    bet={bet}
                                    date={selectedDate}
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
