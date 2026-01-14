"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Check, X, CircleCheck, CircleX, Clock, ChevronDown, Save, Loader2, TrendingUp, MonitorPlay } from 'lucide-react';

// --- FLAG MAPPINGS (Mirrored from BetCard.tsx) ---
const LEAGUE_FLAGS: Record<number, string> = {
    39: "gb-eng", 40: "gb-eng", 41: "gb-eng", 42: "gb-eng",
    140: "es", 141: "es", 135: "it", 78: "de",
    61: "fr", 62: "fr", 88: "nl", 94: "pt",
    144: "be", 71: "br", 128: "ar", 179: "gb-sct",
    2: "eu", 3: "eu", 848: "eu",
    12: "us", 120: "es", 117: "gr", 194: "eu"
};

const COUNTRY_FLAGS: Record<string, string> = {
    "England": "gb-eng", "Germany": "de", "France": "fr",
    "Spain": "es", "Italy": "it", "Netherlands": "nl",
    "Portugal": "pt", "Belgium": "be", "Brazil": "br",
    "Argentina": "ar", "USA": "us", "Greece": "gr",
    "Turkey": "tr", "Europe": "eu", "World": "un"
};

const LEAGUE_NAME_FLAGS: Record<string, string> = {
    "Premier League": "gb-eng", "Bundesliga": "de", "Ligue 1": "fr",
    "La Liga": "es", "Serie A": "it", "Eredivisie": "nl",
    "Primeira Liga": "pt", "NBA": "us", "Liga Profesional": "ar",
    "UEFA Champions League": "eu", "UEFA Europa League": "eu",
    "UEFA Conference League": "eu", "Eurocup": "eu", "NCAA": "us",
    "Indonesia Liga 1": "id",
    "Camp. Primavera 1": "it",
    "Myanmar National League": "mm",
    "Champions League": "eu",
    "Premiership": "gb-sct",
    "Euroleague": "eu"
};

const getLeagueFlagCode = (leagueName?: string, leagueId?: number, country?: string) => {
    if (leagueId && LEAGUE_FLAGS[leagueId]) return LEAGUE_FLAGS[leagueId];
    if (country && COUNTRY_FLAGS[country]) return COUNTRY_FLAGS[country];
    if (leagueName && LEAGUE_NAME_FLAGS[leagueName]) return LEAGUE_NAME_FLAGS[leagueName];
    if (leagueName?.includes("Bundesliga")) return "de";
    if (leagueName?.includes("Eurocup")) return "eu";
    if (leagueName?.includes("NCAA")) return "us";
    if (leagueName?.includes("Primavera")) return "it";
    if (leagueName?.includes("Myanmar")) return "mm";
    if (leagueName?.includes("Indonesia")) return "id";
    if (leagueName?.includes("Premiership")) return "gb-sct";
    if (leagueName?.includes("Euroleague")) return "eu";
    if (leagueName?.includes("Champions League")) return "eu";
    return null;
};

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
const BetDetailCard = ({ bet, date, isAdmin, onUpdate, onLocalChange }: { bet: BetResult, date: string, isAdmin: boolean, onUpdate: () => void, onLocalChange: (betType: string, newStatus: string) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<string>(bet.status === 'GANADA' ? 'WON' : bet.status === 'PERDIDA' ? 'LOST' : bet.status);
    const [pendingChanges, setPendingChanges] = useState<Record<string | number, string>>({});

    // Sync state when prop changes (e.g. after full refresh)
    // Sync state when prop changes (e.g. after full refresh)
    useEffect(() => {
        let norm = bet.status || 'PENDING';
        if (norm === 'GANADA') norm = 'WON';
        if (norm === 'PERDIDA') norm = 'LOST';
        if (norm === 'PENDIENTE') norm = 'PENDING';

        // Auto-Check Children Consistency (Self-Healing)
        const details = bet.selections || bet.picks_detail || (bet as any).components || [];
        if (details.length > 0) {
            const childrenStatus = details.map((d: any) => {
                let s = (d.status || 'PENDING').toUpperCase();
                return s === 'GANADA' ? 'WON' : s === 'PERDIDA' ? 'LOST' : s === 'PENDIENTE' ? 'PENDING' : s;
            });

            const hasLost = childrenStatus.some((s: string) => s === 'LOST');
            const allWon = childrenStatus.every((s: string) => s === 'WON');

            if (hasLost) norm = 'LOST';
            else if (allWon) norm = 'WON';
        }

        // Only update if different to avoid loop
        setStatus(prev => prev !== norm ? norm : prev);

        // Also inform parent if we "healed" the status from PENDING to WON/LOST
        if (norm !== bet.status && (norm === 'WON' || norm === 'LOST')) {
            // Use timeout to avoid update-during-render
            setTimeout(() => onLocalChange(bet.type, norm), 0);
        }
    }, [bet.status, bet]);

    const details = bet.selections || bet.picks_detail || (bet as any).components || [];
    const hasDetails = details.length > 0;
    const hasChanges = Object.keys(pendingChanges).length > 0;

    // Helper to get unique ID for selection (legacy compatibility)
    const getSelId = (detail: any) => detail.fixture_id ? detail.fixture_id.toString() : detail.match;

    const handleLocalDetailChange = (id: string, selNewStatus: string) => {
        // 1. Update selection change map
        const updatedPending = {
            ...pendingChanges,
            [id]: selNewStatus
        };
        setPendingChanges(updatedPending);

        // 2. Derive Parent Status
        // Merge current details with pending changes
        const mergedDetails = details.map((d: any) => {
            const uid = getSelId(d);
            const s = updatedPending[uid] || d.status || 'PENDING';
            // Normalize
            return s === 'GANADA' ? 'WON' : s === 'PERDIDA' ? 'LOST' : s === 'PENDIENTE' ? 'PENDING' : s;
        });

        const hasLost = mergedDetails.some((s: string) => s === 'LOST');
        const allWon = mergedDetails.every((s: string) => s === 'WON');

        let computedStatus = status;
        if (hasLost) computedStatus = 'LOST';
        else if (allWon) computedStatus = 'WON';
        // Else keep current? Or set PENDING? Usually keep current unless explicit override.
        // If transitioning from WON back to Pending (e.g. undoing a WON selection), we might want to revert?
        // For now, adhere to rule: Any Lost -> Lost, All Won -> Won.

        if (computedStatus !== status) {
            setStatus(computedStatus);
            onLocalChange(bet.type, computedStatus); // Triggers Parent + Header Refresh
        }
    };

    const handleSaveBatch = async () => {
        setIsSaving(true);
        try {
            const updates = Object.entries(pendingChanges).map(([idStr, s]) => ({
                selectionId: idStr,
                newStatus: s
            }));

            if (updates.length === 0) return;

            // Include current (derived) status to ensure backend sync if needed, 
            // though backend should also auto-derive.
            await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: bet.type,
                    updates,
                    newStatus: status // Send the derived status too
                })
            });

            setPendingChanges({});
            onUpdate(); // Full refresh
        } catch (e) {
            console.error(e);
            alert("Error saving updates");
        } finally {
            setIsSaving(false);
        }
    };

    // Global override
    const handleGlobalStatusUpdate = async (newStatus: string) => {
        // STRICT VALIDATION
        if (!bet.type) {
            console.error("CRITICAL: Bet Type is undefined in Component. Bet Data:", bet);
            alert("Error Crítico: No se encuentra el 'betType'. No se puede guardar. Revisa la consola.");
            return;
        }

        setStatus(newStatus); // Immediate UI update
        onLocalChange(bet.type, newStatus); // Notify parent for profit calc

        setIsSaving(true);
        console.log(`[Admin] Saving Check: Date=${date}, Type=${bet.type}, Status=${newStatus}`);

        try {
            const res = await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: bet.type,
                    selectionId: null,
                    newStatus
                })
            });

            if (!res.ok) {
                const err = await res.json();
                console.error("API Error:", err);
                alert("Error al guardar en el servidor");
            } else {
                const data = await res.json();
                if (data.success) {
                    console.log(`[Admin] Saved ${bet.type} -> ${newStatus} (Confirmed by Vercel)`);
                    onUpdate(); // CRITICAL: Trigger calendar refresh
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    // Normalize Type (support 'type' or 'betType')
    const finalType = bet.type || (bet as any).betType || 'safe';

    return (
        <div className={`bg-secondary/30 rounded-xl p-4 border transition-all hover:bg-secondary/40 relative
            ${status === 'WON' ? 'border-emerald-500/30 bg-emerald-500/5' : status === 'LOST' ? 'border-rose-500/30 bg-rose-500/5' : 'border-border/50'}`}>

            <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full 
                    ${finalType === 'safe' ? 'bg-emerald-500/10 text-emerald-500' :
                        finalType === 'value' ? 'bg-violet-500/10 text-violet-500' :
                            'bg-amber-500/10 text-amber-500'}`}>
                    {finalType === 'safe' ? 'SEGURA' : finalType === 'value' ? 'DE VALOR' : finalType}
                </span>
                <span className={`font-mono font-bold ${bet.profit > 0 ? 'text-emerald-500' : bet.profit < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                    {(bet.profit || 0) > 0 ? '+' : ''}{(bet.profit || 0).toFixed(2)}u
                </span>
            </div>

            {/* Simple Bet League/Flag Display - MOBILE (Above Title) */}
            {(!hasDetails || details.length <= 1) && (() => {
                const fallback = (bet as any).selections?.[0] || {};
                const league = (bet as any).league || fallback.league;
                const leagueId = (bet as any).league_id || fallback.league_id;
                const country = (bet as any).country || fallback.country;

                if (!league) return null;

                const flag = getLeagueFlagCode(league, leagueId, country);
                return (
                    <div className="block md:hidden text-[10px] text-muted-foreground mb-1 font-normal">
                        <span className="inline-flex items-center">
                            ({league}
                            {flag && <img src={`https://flagcdn.com/20x15/${flag}.png`} alt={flag} className="w-3 h-2.5 rounded-[1px] ml-1 opacity-80" />}
                            )
                        </span>
                    </div>
                );
            })()}

            {bet.match}

            {/* Simple Bet League/Flag Display - DESKTOP (Inline) */}
            {(!hasDetails || details.length <= 1) && (() => {
                const fallback = (bet as any).selections?.[0] || {};
                const league = (bet as any).league || fallback.league;
                const leagueId = (bet as any).league_id || fallback.league_id;
                const country = (bet as any).country || fallback.country;

                if (!league) return null;

                const flag = getLeagueFlagCode(league, leagueId, country);
                return (
                    <span className="hidden md:inline-flex text-[10px] text-muted-foreground ml-2 font-normal items-center">
                        ({league}
                        {flag && <img src={`https://flagcdn.com/20x15/${flag}.png`} alt={flag} className="w-3 h-2.5 rounded-[1px] ml-1 opacity-80" />}
                        )
                    </span>
                );
            })()}
            <p className="text-xs text-muted-foreground mb-3 italic">{bet.pick}</p>

            {/* Expansion Toggle & Save Bar - Only show if > 1 selection (Combinada) */}
            {hasDetails && details.length > 1 && (
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
                            let rawStatus = pendingChanges[uniqueId] || detail.status || "PENDING";
                            // Ensure string and uppercase
                            if (typeof rawStatus !== 'string') rawStatus = String(rawStatus);
                            rawStatus = rawStatus.toUpperCase();

                            let currentStatus = rawStatus;

                            // Normalization for UI Select
                            if (currentStatus === 'GANADA') currentStatus = 'WON';
                            if (currentStatus === 'PERDIDA') currentStatus = 'LOST';
                            if (currentStatus === 'PENDIENTE') currentStatus = 'PENDING';

                            return (
                                <div key={idx} className="flex justify-between items-center text-xs p-1 border-b border-white/5 last:border-0 gap-2">
                                    <div className="flex flex-col bg-black/20 rounded px-1.5 py-1 flex-1 min-w-0">
                                        {/* Line 1: League + Flag (Optional) */}
                                        {detail.league && (
                                            <div className="text-[10px] text-muted-foreground mb-0.5 flex items-center">
                                                {detail.league}
                                                {(() => {
                                                    const flag = getLeagueFlagCode(detail.league, detail.league_id, detail.country);
                                                    return flag ? <img src={`https://flagcdn.com/20x15/${flag}.png`} alt={flag} className="w-3 h-2.5 rounded-[1px] ml-1 opacity-80" /> : null;
                                                })()}
                                            </div>
                                        )}
                                        {/* Line 2: Match: Pick */}
                                        <div className="flex flex-wrap items-center leading-tight">
                                            <span className="text-muted-foreground mr-1 shrink-0 text-xs">{detail.match}:</span>
                                            <span className="font-medium text-foreground text-xs">{detail.pick}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {isAdmin ? (
                                            <select
                                                className={`border text-[10px] rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary transition-colors
                                                ${pendingChanges[uniqueId] ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-white/10 text-foreground'}`}
                                                value={currentStatus}
                                                onChange={(e) => handleLocalDetailChange(uniqueId, e.target.value)}
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
                    <span>Stake: <b className="text-foreground">{bet.stake || (bet.type === 'safe' ? 6 : bet.type === 'value' ? 3 : 1)}</b></span>
                    <span>Cuota: <b className="text-foreground">{bet.total_odd || (bet as any).odd || 0}</b></span>
                </div>
                <div className="flex items-center gap-1 font-bold">
                    {isAdmin ? (
                        <select
                            className={`text-xs rounded px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer text-center
                                ${status === 'WON' ? 'bg-emerald-500 text-white' : status === 'LOST' ? 'bg-rose-500 text-white' : 'bg-secondary text-foreground'}`}
                            value={status}
                            onChange={(e) => handleGlobalStatusUpdate(e.target.value)}
                            disabled={isSaving}
                        >
                            <option value="PENDING">PENDIENTE</option>
                            <option value="WON">WON</option>
                            <option value="LOST">LOST</option>
                        </select>
                    ) : (
                        <>
                            {(status === 'WON' || status === 'GANADA') && <><CircleCheck size={14} className="text-emerald-500" /> GANADA</>}
                            {(status === 'LOST' || status === 'PERDIDA') && <><CircleX size={14} className="text-rose-500" /> PERDIDA</>}
                            {(status === 'PENDING' || status === 'PENDIENTE') && <span className="text-amber-500">PENDIENTE</span>}
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

    // LOCAL MUTABLE STATE FOR MODAL
    const [localDayData, setLocalDayData] = useState<DayHistory | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Init local day data when selectedDate changes
    useEffect(() => {
        if (selectedDate && history[selectedDate]) {
            setLocalDayData(history[selectedDate]); // Initial copy
        } else {
            setLocalDayData(null);
        }
    }, [selectedDate, history]);

    // Dynamic Profit Recalculation
    useEffect(() => {
        if (!localDayData) return;

        const bets = Array.isArray(localDayData.bets)
            ? localDayData.bets
            : Object.entries(localDayData.bets || {}).map(([k, v]) => ({ ...(v as any), type: (v as any).type || k }));

        let total = 0;
        bets.forEach((b: any) => {
            let s = b.status;
            if (s === 'GANADA') s = 'WON';
            if (s === 'PERDIDA') s = 'LOST';

            const stake = Number(b.stake) || 0; // Use real stake

            if (s === 'WON') {
                total += (stake * (b.total_odd - 1));
            } else if (s === 'LOST') {
                total -= stake;
            }
        });

        // Loop issue, we don't need to do anything here if we calculate on event/render
    }, [localDayData]);

    // Handle Local Status Change (Updates the Copy)
    const handleLocalBetUpdate = (betType: string, newStatus: any) => {
        if (!localDayData) return;

        // Ensure bets is array for processing, PRESERVING TYPE from keys if needed
        const currentBets = Array.isArray(localDayData.bets)
            ? localDayData.bets
            : Object.entries(localDayData.bets || {}).map(([k, v]) => ({ ...(v as any), type: (v as any).type || k }));

        const newBets = currentBets.map((b: any) => {
            if (b.type === betType) {
                // Update specific bet
                let profit = 0;
                // Use robust formula from route.ts: Stake * (Odd - 1)
                const stake = Number(b.stake) || 0; // Don't invent default here either, just use what's there. 
                // Visual defaults are handled in render.

                if (newStatus === 'WON') profit = stake * (b.total_odd - 1);
                if (newStatus === 'LOST') profit = -stake;

                return { ...b, status: newStatus, profit };
            }
            return b;
        });

        // Recalculate Day Profit
        let newDayProfit = 0;
        newBets.forEach((b: any) => {
            let s = b.status;
            if (s === 'GANADA') s = 'WON';
            if (s === 'PERDIDA') s = 'LOST';
            if (s === 'PENDIENTE') s = 'PENDING';

            const stake = Number(b.stake) || 0;

            if (s === 'WON') newDayProfit += (stake * (b.total_odd - 1));
            else if (s === 'LOST') newDayProfit -= stake;
        });

        setLocalDayData({
            ...localDayData,
            bets: newBets, // This will turn it into an array locally, which is fine for UI
            day_profit: newDayProfit
        });
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Check path for /admin
            if (window.location.pathname.startsWith('/admin')) {
                setIsAdmin(true);
            }
        }
        fetchData();
    }, [currentDate]);

    // ... (keep handleTriggerCheck, fetchData, nextMonth, prevMonth, renderDay)

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

        // Stronger colors for mobile visibility
        const profitClass = hasData ? (dayData.day_profit > 0 ? 'text-emerald-400' : dayData.day_profit < 0 ? 'text-rose-400' : 'text-amber-400') : '';
        const profitBg = hasData ?
            (dayData.day_profit > 0 ? 'bg-emerald-500/25 border-emerald-500/20' :
                dayData.day_profit < 0 ? 'bg-rose-500/25 border-rose-500/20' :
                    'bg-amber-500/25 border-amber-500/20')
            : 'bg-secondary/5';

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
                {/* Day Number Container: Centered on Mobile, Top-Left on Desktop */}
                <div className="flex flex-col justify-center items-center md:flex-row md:justify-between md:items-start relative z-10 w-full h-full md:h-auto md:mb-2 md:w-full">
                    <span className={`text-base md:text-xl font-bold flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full transition-all relative
                        ${isToday ? 'text-primary scale-110 md:bg-primary md:text-primary-foreground md:shadow-lg' : 'text-foreground/80 md:text-foreground'}`}>
                        {day}

                        {/* Mobile Today Dot */}
                        {isToday && (
                            <div className="md:hidden absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                        )}
                    </span>
                </div>

                {/* Profit Details - Hidden on Mobile, Large on Desktop */}
                <div className="hidden md:flex flex-col gap-1 relative z-10 items-center text-center w-full mt-auto mb-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Profit</div>
                    <div className={`text-xl lg:text-2xl font-black tracking-tight ${profitClass}`}>
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

    // Use localDayData if available and matches selectedDate, else use history fallback (safeguard)
    // Actually best to rely on localDayData while modal is open to see live changes.
    // Sync issues: If history updates, localDayData might be stale. But modal interaction is short lived.
    const displayData = localDayData && (localDayData.date === selectedDate) ? localDayData : (selectedDate ? history[selectedDate] : null);

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
            {selectedDate && displayData && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-card w-full max-w-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center bg-gradient-to-r from-secondary/50 to-background/50">
                            <div>
                                <h3 className="font-bold text-2xl text-white flex items-center gap-2">
                                    {new Date(selectedDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded transition-all duration-300 ${displayData.day_profit >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {displayData.day_profit > 0 ? '+' : ''}{displayData.day_profit.toFixed(2)} unidades
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

                            {(Array.isArray(displayData.bets) ? displayData.bets : Object.entries(displayData.bets || {}).map(([k, v]) => ({ ...(v as any), type: (v as any).type || k }))).map((bet: any, idx: number) => (
                                <BetDetailCard
                                    key={idx}
                                    bet={bet}
                                    date={selectedDate}
                                    isAdmin={isAdmin}
                                    onUpdate={handleUpdate}
                                    onLocalChange={handleLocalBetUpdate}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
