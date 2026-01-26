"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Check, X, CircleCheck, CircleX, Clock, ChevronDown, Save, Loader2, TrendingUp, MinusCircle } from 'lucide-react';

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
    "Liga Profesional Argentina": "ar",
    "UEFA Champions League": "eu", "UEFA Europa League": "eu",
    "UEFA Conference League": "eu", "Eurocup": "eu", "NCAA": "us",
    "Indonesia Liga 1": "id",
    "Camp. Primavera 1": "it",
    "Myanmar National League": "mm",
    "Champions League": "eu",
    "Premiership": "gb-sct",
    "Euroleague": "eu",
    "Championship": "gb-eng",
    "Jupiler Pro League": "be",
    "Basket League": "gr",
    "Super Ligi": "tr",
    "ACB": "es",
    "Lega A": "it",
    "Pro League": "be",
    "League Two": "gb-eng",
    "League One": "gb-eng",
    "Eerste Divisie": "nl",
    "ABA League": "eu"
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
    if (leagueName?.includes("Championship")) return "gb-eng";
    if (leagueName?.includes("Pro League")) return "be";
    if (leagueName?.includes("Basket League")) return "gr";
    if (leagueName?.includes("Super Ligi")) return "tr";
    if (leagueName?.includes("Lega A")) return "it";
    if (leagueName?.includes("ACB")) return "es";
    if (leagueName?.includes("Argentina")) return "ar";
    if (leagueName?.includes("League Two") || leagueName?.includes("League One")) return "gb-eng";
    if (leagueName?.includes("Eerste Divisie")) return "nl";
    if (leagueName?.includes("ABA League")) return "eu";
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
    // Normalize Type (support 'type' or 'betType') - Define early for usage in Header
    const finalType = bet.type || (bet as any).betType || 'safe';

    const [expanded, setExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<string>(bet.status === 'GANADA' ? 'WON' : bet.status === 'PERDIDA' ? 'LOST' : bet.status);
    const [pendingChanges, setPendingChanges] = useState<Record<string | number, string>>({});

    // State for Editing Text (Admin)
    const [editedPick, setEditedPick] = useState(bet.pick);
    const [editedResults, setEditedResults] = useState<Record<string, string>>({});

    useEffect(() => {
        setEditedPick(bet.pick);
    }, [bet.pick]);

    // Sync state when prop changes (e.g. after full refresh)
    // Sync state when prop changes (e.g. after full refresh)
    useEffect(() => {
        let norm = bet.status || 'PENDING';
        if (norm === 'GANADA') norm = 'WON';
        if (norm === 'PERDIDA') norm = 'LOST';
        if (norm === 'PENDIENTE') norm = 'PENDING';

        // Auto-Check Children Consistency (Self-Healing)
        const details = bet.selections || bet.picks_detail || (bet as any).components || [];
        // Create stable signature for dependencies
        const detailsSig = JSON.stringify(details.map((d: any) => d.status));

        if (details.length > 0) {
            const childrenStatus = details.map((d: any) => {
                let s = (d.status || 'PENDING').toUpperCase();
                return s === 'GANADA' ? 'WON' : s === 'PERDIDA' ? 'LOST' : s === 'PENDIENTE' ? 'PENDING' : s === 'NULA' ? 'VOID' : s;
            });
            const hasLost = childrenStatus.some((s: string) => s === 'LOST');
            const allWon = childrenStatus.every((s: string) => s === 'WON');

            if (hasLost) norm = 'LOST';
            else if (allWon) norm = 'WON';
        }

        // Update local status UI
        setStatus(prev => prev !== norm ? norm : prev);

        // Intelligent Auto-Update (Prevents Loops)
        // Only inform parent if:
        // 1. We are moving from PENDING -> WON/LOST (Auto-resolve)
        // 2. We are moving from WON -> LOST (Strict enforcement: If a child is lost, parent MUST be lost)
        // 3. IGNORE moving from LOST -> WON (User might have manually set LOST despite children being WON)
        const current = (bet.status || 'PENDING').toUpperCase();

        if (norm !== current) {
            const canUpdate = (current === 'PENDING' && (norm === 'WON' || norm === 'LOST')) ||
                (current === 'WON' && norm === 'LOST'); // Enforce loss

            if (canUpdate) {
                // Use timeout to avoid update-during-render
                setTimeout(() => onLocalChange(bet.type, norm), 0);
            }
        }
    }, [bet.status, bet.selections, bet.picks_detail]); // Reduced dependencies to avoid loop

    const details = bet.selections || bet.picks_detail || (bet as any).components || [];
    const hasDetails = details.length > 0;
    const hasChanges = Object.keys(pendingChanges).length > 0;

    // Helper to get unique ID for selection (legacy compatibility)
    const getSelId = (detail: any) => detail.fixture_id ? detail.fixture_id.toString() : detail.match;

    const handleLocalResultChange = (id: string, val: string) => {
        setEditedResults(prev => ({ ...prev, [id]: val }));
    };

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
            return s === 'GANADA' ? 'WON' : s === 'PERDIDA' ? 'LOST' : s === 'PENDIENTE' ? 'PENDING' : s === 'NULA' ? 'VOID' : s;
        });

        const hasLost = mergedDetails.some((s: string) => s === 'LOST');
        const allWon = mergedDetails.every((s: string) => s === 'WON');

        let computedStatus = status;
        if (hasLost) computedStatus = 'LOST';
        else if (allWon) computedStatus = 'WON';

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
                newStatus: s,
                newResult: editedResults[idStr] // Include result update if any
            }));

            // Also include result-only updates (no status change)
            Object.entries(editedResults).forEach(([idStr, res]) => {
                if (!pendingChanges[idStr]) {
                    updates.push({
                        selectionId: idStr,
                        newStatus: null as any, // Backend handles null
                        newResult: res
                    });
                }
            });

            if (updates.length === 0 && editedPick === bet.pick) return;

            await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: finalType, // Use normalized type
                    updates,
                    newStatus: status, // Send the derived status too
                    newPick: editedPick !== bet.pick ? editedPick : undefined
                })
            });

            setPendingChanges({});
            setEditedResults({});
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
        // ... (existing validation) ...

        setStatus(newStatus); // Immediate UI update
        onLocalChange(bet.type, newStatus); // Notify parent for profit calc

        setIsSaving(true);
        try {
            const res = await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date,
                    betType: finalType,
                    selectionId: null,
                    newStatus,
                    newPick: editedPick !== bet.pick ? editedPick : undefined
                })
            });
            // ... (existing error handling) ...
            if (res.ok) {
                const data = await res.json();
                if (data.success) onUpdate();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    // Derived state for changes (including text)
    const hasTextChanges = editedPick !== bet.pick || Object.keys(editedResults).length > 0;
    const showSave = hasChanges || hasTextChanges;


    return (
        <div className={`bg-secondary/30 rounded-xl p-4 border transition-all hover:bg-secondary/40 relative
            ${status === 'WON' ? 'border-emerald-500/30 bg-emerald-500/5' : status === 'LOST' ? 'border-rose-500/30 bg-rose-500/5' : 'border-border/50'}`}>

            {/* ... (Header) ... */}
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

            {/* ... (League Flags) ... */}

            <h4 className="font-bold text-sm leading-tight mb-1 flex items-center flex-wrap gap-1">
                {bet.match}
                {(!hasDetails || details.length === 1) && details[0]?.league && (() => {
                    const sel = details[0];
                    const flagCode = getLeagueFlagCode(sel.league, sel.league_id, sel.country);
                    return (
                        <span className="text-[10px] text-muted-foreground/70 ml-1 inline-flex items-center font-normal">
                            ({sel.league}{flagCode && (
                                <img
                                    src={`https://flagcdn.com/20x15/${flagCode}.png`}
                                    alt={flagCode}
                                    className="w-3 h-2 object-cover rounded-[1px] opacity-80 ml-1"
                                />
                            )})
                        </span>
                    );
                })()}
            </h4>

            {/* ... (Desktop Flag) ... */}

            {/* EDITABLE PICK DESCRIPTION */}
            {isAdmin ? (
                <input
                    type="text"
                    value={editedPick}
                    onChange={(e) => setEditedPick(e.target.value)}
                    className="w-full bg-black/20 border border-white/5 rounded px-2 py-1 text-xs text-muted-foreground mb-2 focus:ring-1 focus:ring-primary outline-none"
                    placeholder="Descripción de la apuesta..."
                />
            ) : (
                <p className="text-xs text-muted-foreground mb-1 italic">{bet.pick}</p>
            )}

            {/* Single Bet Result Display */}
            {(!hasDetails || details.length === 1) && (() => {
                const single = details[0] || {};
                const r = editedResults[getSelId(single)] !== undefined ? editedResults[getSelId(single)] : single.result;

                return ( // Simplified Return
                    <div className="mb-3">
                        {single.result && single.result !== 'N/A' && !isAdmin && (
                            <p className={`text-[10px] font-bold ${(status === 'WON') ? 'text-emerald-500' : (status === 'LOST') ? 'text-rose-500' : 'text-muted-foreground'}`}>{single.result}</p>
                        )}
                        {isAdmin && (
                            <input
                                type="text"
                                value={r === 'N/A' ? '' : r}
                                onChange={(e) => handleLocalResultChange(getSelId(single), e.target.value)}
                                className="w-full bg-black/20 border border-white/5 rounded px-2 py-0.5 text-[10px] font-bold mb-1 focus:ring-1 focus:ring-primary outline-none"
                                placeholder="Resultado Manual (ej: 2 Shots)"
                            />
                        )}
                    </div>
                );
            })()}

            {/* Expansion Toggle & Save Bar */}
            {(hasDetails && details.length > 1 || showSave) && (
                <div className="flex justify-between items-center mb-3">
                    {hasDetails && details.length > 1 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1 text-[10px] uppercase font-bold text-primary hover:underline"
                        >
                            <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            Ver Desglose ({details.length})
                        </button>
                    )}

                    {/* Batch Save Button - Show if ANY changes (Text or Status) */}
                    {showSave && (
                        <button
                            onClick={handleSaveBatch}
                            disabled={isSaving}
                            className="bg-primary/90 hover:bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded shadow flex items-center gap-1 animate-in fade-in zoom-in duration-200 ml-auto"
                        >
                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                            Guardar Cambios
                        </button>
                    )}
                </div>
            )}

            {/* Expanded List */}
            {
                (expanded || (showSave && hasDetails)) && hasDetails && (
                    <div className="mb-3 space-y-1 bg-background/50 p-2 rounded-lg border border-border/30">
                        {details.map((detail: any, idx: number) => {
                            const uniqueId = getSelId(detail);
                            const r = editedResults[uniqueId] !== undefined ? editedResults[uniqueId] : detail.result;

                            // ... (status calculations) ...
                            let rawStatus = pendingChanges[uniqueId] || detail.status || "PENDING";
                            if (typeof rawStatus !== 'string') rawStatus = String(rawStatus);
                            rawStatus = rawStatus.toUpperCase();
                            let currentStatus = rawStatus;
                            if (currentStatus === 'GANADA') currentStatus = 'WON';
                            if (currentStatus === 'PERDIDA') currentStatus = 'LOST';
                            if (currentStatus === 'PENDIENTE') currentStatus = 'PENDING';
                            if (currentStatus === 'NULA') currentStatus = 'VOID';


                            return (
                                <div key={idx} className="flex justify-between items-center text-xs p-1 border-b border-white/5 last:border-0 gap-2">
                                    <div className="flex flex-col bg-black/20 rounded px-1.5 py-1 flex-1 min-w-0">
                                        {/* ... (Line 1/2) ... */}
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-start gap-2">
                                                <span className="text-muted-foreground text-[10px] flex items-center gap-1 flex-wrap leading-tight">
                                                    <span className="opacity-80 grayscale-[0.3]">
                                                        {(detail.sport?.toLowerCase().includes('basket') ? '🏀' : (detail.sport?.toLowerCase().includes('tenn') ? '🎾' : '⚽'))}
                                                    </span>
                                                    <span className="font-medium text-foreground/80">{detail.match}</span>
                                                    {detail.league && (() => {
                                                        const flagCode = getLeagueFlagCode(detail.league, detail.league_id, detail.country);
                                                        return (
                                                            <span className="text-[9px] text-muted-foreground/60 flex items-center">
                                                                ({detail.league}{flagCode && (
                                                                    <img
                                                                        src={`https://flagcdn.com/20x15/${flagCode}.png`}
                                                                        alt={flagCode}
                                                                        className="w-2.5 h-2 object-cover rounded-[1px] opacity-70 ml-1"
                                                                    />
                                                                )})</span>
                                                        );
                                                    })()}
                                                </span>
                                                {detail.odd && (
                                                    <span className="shrink-0 bg-white/5 text-[10px] px-1.5 py-px rounded text-muted-foreground/90 font-mono border border-white/5 shadow-sm">
                                                        {Number(detail.odd).toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-bold text-foreground text-xs mt-0.5 leading-tight block">{detail.pick}</span>
                                            {/* RESULT LINE OR INPUT */}
                                            {isAdmin ? (
                                                <input
                                                    type="text"
                                                    value={r === 'N/A' || !r ? '' : r}
                                                    onChange={(e) => handleLocalResultChange(uniqueId, e.target.value)}
                                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded px-1 py-0.5 text-[10px] focus:ring-1 focus:ring-primary outline-none"
                                                    placeholder="Resultado..."
                                                />
                                            ) : (
                                                detail.result && detail.result !== 'N/A' && (
                                                    <div className={`text-[10px] font-bold mt-0.5 ${(rawStatus === 'WON') ? 'text-emerald-500' : (rawStatus === 'LOST') ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                                        {detail.result}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* ... (Status Select) ... */}
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
                                                {(currentStatus === 'WON') && <CircleCheck size={14} className="text-emerald-500" />}
                                                {(currentStatus === 'LOST') && <CircleX size={14} className="text-rose-500" />}
                                                {(currentStatus === 'VOID') && <MinusCircle size={14} className="text-gray-400" />}
                                                {(currentStatus === 'PENDING') && <Clock size={14} className="text-amber-500" />}
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
                            <option value="VOID">VOID</option>
                        </select>
                    ) : (
                        <>
                            {(status === 'WON' || status === 'GANADA') && <><CircleCheck size={14} className="text-emerald-500" /> GANADA</>}
                            {(status === 'LOST' || status === 'PERDIDA') && <><CircleX size={14} className="text-rose-500" /> PERDIDA</>}
                            {(status === 'VOID' || status === 'NULA') && <><MinusCircle size={14} className="text-gray-400" /> NULA</>}
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
            if (s === 'NULA') s = 'VOID';

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
        <div className="w-full max-w-7xl mx-auto px-4 pt-0 md:px-8 space-y-4 mb-4">
            {/* Header */}
            <div className="text-center mb-6 relative z-10">
                <h2 className="text-3xl md:text-4xl font-black mb-3 tracking-tighter">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Resultados</span> <span className="text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">Históricos</span>
                </h2>
                <div className="w-24 h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full mx-auto mb-2 animate-pulse" />
                <p className="text-muted-foreground/80 font-medium max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                    Transparencia total. Sin filtros.
                </p>
            </div>

            {/* COMPACT ROW: Month Selector + Balance */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                {/* MONTH SELECTOR */}
                <div className="flex-1 w-full md:w-auto flex items-center justify-between md:justify-center gap-4 bg-secondary/20 p-1.5 rounded-full border border-white/5 relative z-10 h-14">
                    <button
                        onClick={prevMonth}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-center uppercase tracking-wider flex-1">
                        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* BALANCE CARD (Compact) */}
                <div className="flex-1 w-full md:w-auto flex items-center justify-center gap-4 px-6 py-1.5 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 rounded-2xl shadow-lg shadow-violet-900/10 h-14">
                    <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400 border border-violet-500/30">
                        <TrendingUp size={20} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Balance:</span>
                        <p className={`text-2xl font-black tracking-tight ${stats && (Number(stats.total_profit) >= 0) ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.3)]'}`}>
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

            {/* Detail Modal - PORTALED TO BODY TO FIX BLUR/Z-INDEX */}
            {selectedDate && displayData && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
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

                                    {/* ADMIN RESET BUTTON (Conditional) */}
                                    {isAdmin && (() => {
                                        // Check if any bet needs reset
                                        const bets = Array.isArray(displayData.bets) ? displayData.bets : Object.values(displayData.bets || {});
                                        const hasStuckBets = bets.some((b: any) => {
                                            const status = (b.status || 'PENDING');
                                            const attempts = b.check_attempts || 0;
                                            // Condition: Pending/Manual Check AND Attempts >= 3
                                            return (status === 'PENDING' || status === 'MANUAL_CHECK') && attempts >= 3;
                                        });

                                        if (!hasStuckBets) return null;

                                        return (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm("¿Resetear contador de intentos para TODOS los pendientes de este día?")) return;
                                                    try {
                                                        const res = await fetch('/api/admin/reset-attempts', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ date: selectedDate })
                                                        });
                                                        const d = await res.json();
                                                        if (d.success) {
                                                            alert(`Reseteados ${d.count} partidos.`);
                                                            fetchData(); // Refresh
                                                        } else {
                                                            alert("Error: " + d.error);
                                                        }
                                                    } catch (e) {
                                                        alert("Error de conexión");
                                                    }
                                                }}
                                                className="ml-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-500 border border-amber-500/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors animate-pulse"
                                            >
                                                <RefreshCw size={12} /> Reset Stuck ({bets.filter((b: any) => (b.status === 'PENDING' || b.status === 'MANUAL_CHECK') && (b.check_attempts || 0) >= 3).length})
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                                <X size={28} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-4 bg-background/95">


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
                </div>,
                document.body
            )}
        </div>
    );
}
