'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Target, PartyPopper, Clock, Check, X as XIcon, RefreshCw, Save, ChevronDown, ChevronUp } from 'lucide-react';

type Selection = {
    fixture_id?: number;
    sport?: string;
    match: string;
    pick: string;
    odd?: number;
    status?: 'WON' | 'LOST' | 'PENDING' | 'GANADA' | 'PERDIDA' | 'PENDIENTE';
    result?: string;
    time?: string;
    league?: string;
    league_id?: number;
    country?: string;
};

// --- FLAG MAPPINGS (ISO Codes for FlagCDN) ---
// Using 2-letter ISO codes or specific sub-codes (e.g. gb-eng)
const LEAGUE_FLAGS: Record<number, string> = {
    // Football
    39: "gb-eng", // Premier League (England)
    40: "gb-eng", 41: "gb-eng", 42: "gb-eng",
    140: "es", 141: "es", // La Liga
    135: "it", // Serie A
    78: "de", // Bundesliga
    61: "fr", 62: "fr", // Ligue 1
    88: "nl", // Eredivisie
    94: "pt", // Primeira Liga
    144: "be", // Jupiler Pro
    71: "br", // Brasileirao
    128: "ar", // Argentina
    179: "gb-sct", // Scotland
    2: "eu", 3: "eu", 848: "eu", // UEFA
    // Basketball
    12: "us", // NBA
    120: "es", // ACB
    117: "gr", 194: "eu"
};

const COUNTRY_FLAGS: Record<string, string> = {
    "England": "gb-eng", "Germany": "de", "France": "fr",
    "Spain": "es", "Italy": "it", "Netherlands": "nl",
    "Portugal": "pt", "Belgium": "be", "Brazil": "br",
    "Argentina": "ar", "USA": "us", "Greece": "gr",
    "Turkey": "tr", "Europe": "eu", "World": "un"
};

const LEAGUE_NAME_FLAGS: Record<string, string> = {
    "Premier League": "gb-eng",
    "Bundesliga": "de",
    "Ligue 1": "fr",
    "La Liga": "es",
    "Serie A": "it",
    "Eredivisie": "nl",
    "Primeira Liga": "pt",
    "NBA": "us",
    "Liga Profesional": "ar",
    "UEFA Champions League": "eu",
    "UEFA Europa League": "eu",
    "UEFA Conference League": "eu",
    "Eurocup": "eu",
    "NCAA": "us",
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
    // Fallback for known substrings
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

type BetComponent = {
    match: string;
    pick: string;
    time?: string;
    odd?: number;
};

type BetData = {
    sport?: string;
    match: string;
    pick: string;
    odd: number;
    reason: string;
    time?: string;
    components?: BetComponent[];
    selections?: Selection[];
    status?: string;
    profit?: number;
    estimated_units?: number;
    stake?: number;
    total_odd?: number;
    date?: string; // Sometimes present in data
    startTime?: string;
    check_attempts?: number;
};

type BetCardProps = {
    type: 'safe' | 'value' | 'funbet';
    data?: BetData;
    isAdmin?: boolean;
    date?: string; // Explicit date prop
};

const SportIcon = ({ sport, className }: { sport?: string; className?: string }) => {
    // Normalization
    const s = sport?.toLowerCase().trim();
    if (s === 'football' || s === 'soccer' || s === 'futbol') return <span className={className}>⚽</span>;
    if (s === 'basketball' || s === 'basket' || s === 'baloncesto') return <span className={className}>🏀</span>;
    if (s === 'tennis' || s === 'tenis') return <span className={className}>🎾</span>;
    // Default fallback if unknown, maybe football or empty?
    return <span className={className}>⚽</span>;
};

// Helper: Group components by match name
const groupComponents = (components: BetComponent[]) => {
    const groups: { [key: string]: BetComponent[] } = {};
    components.forEach(comp => {
        if (!groups[comp.match]) {
            groups[comp.match] = [];
        }
        groups[comp.match].push(comp);
    });
    return groups;
};

// Helper: Get earliest time
const getEarliestTime = (data: BetData): string | null => {
    let times: string[] = [];
    if (data.startTime) times.push(data.startTime);
    if (data.time) times.push(data.time);

    // Check components
    if (data.components) {
        data.components.forEach(c => {
            if (c.time) times.push(c.time);
        });
    }

    // Check selections (New Format)
    if (data.selections) {
        data.selections.forEach(s => {
            // Selection might have 'time' property? Use 'any' cast if generic or check type
            // The type Selection has 'fixture_id', 'match', 'pick', 'odd', 'status', 'result', 'sport'.
            // It does NOT have 'time' in the type definition I wrote earlier!
            // BUT the JSON has 'time'. 
            // I should Update Selection type too? Or just cast to any here to be safe.
            // Let's assume the JSON has it. I will add it to the type in a separate move or here if I can.
            // I can't edit the type definition block (lines 6-13) in this replace block easily without overwriting logic.
            // I'll cast to any for now to be safe.
            const sAny = s as any;
            if (sAny.time) times.push(sAny.time);
        });
    }

    if (times.length === 0) return null;
    return times.sort()[0];
};

// Helper: Extract odd from text if not provided
const getCleanPickAndOdd = (pick: string, explicitOdd?: number | string) => {
    if (explicitOdd) {
        // If it's a number, format it. If it's a string (like a time erroneously placed there), pass it through.
        const formattedOdd = typeof explicitOdd === 'number' ? explicitOdd.toFixed(2) : String(explicitOdd);
        return { text: pick, odd: formattedOdd };
    }

    const match = pick.match(/[\(@](\d+\.\d+)[\)]?/);
    if (match) {
        const odd = match[1];
        let text = pick.replace(match[0], '').trim();
        text = text.replace(/[,\.\-\+]+$/, '').trim();
        return { text, odd };
    }
    return { text: pick, odd: null };
};

// Helper: Try to find odd in reason text for a given pick keyword
const findOddInReason = (pick: string, reason: string): string | null => {
    // Simplify pick to key terms (e.g. "AC Milan Gana" -> "Milan")
    // Remove common words: Gana, Win, Over, Under, Mas, Menos
    const keywords = pick.replace(/Gana|Win|Over|Under|Más|Menos|de|\d+\.\d+/gi, '').trim().split(' ').filter(w => w.length > 3);

    if (keywords.length === 0) return null;

    // Find the first keyword in reason
    const keyword = keywords[0]; // e.g. "Milan"
    const index = reason.indexOf(keyword);

    if (index === -1) return null;

    // Look ahead from that index for a pattern like (1.41)
    const searchWindow = reason.substring(index, index + 50); // Look in next 50 chars
    const match = searchWindow.match(/\((\d+\.\d+)\)/);

    if (match) return match[1];
    return null;
};

// Helper: Extract HH:mm from any date string
const extractTime = (dateStr?: string) => {
    if (!dateStr) return null;
    // Match HH:mm pattern (e.g., 21:00, 09:30)
    const match = dateStr.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : null;
};

// Helper: Formatted Reason 
// Helper: Formatted Reason 
const FormattedReason = ({ text }: { text?: string }) => {
    if (!text) return null;

    // Check if the text contains numbered list patterns like "1)", "2)", "1.", "2."
    // We look for a digit followed by ) or . and a space
    const hasNumberedList = /\d+[\)\.]\s/.test(text);

    let parts: string[] = [];

    if (hasNumberedList) {
        // Advanced Logic: Numbered Lists
        // 1. Insert a special delimiter before every numbered item to force a split
        //    RegEx looks for: Start of string OR whitespace + Digit + ) or . + space
        //    We maintain the list marker ($2) but precede it with our split token
        const formatted = text.replace(/(^|\s)(\d+[\)\.])\s/g, (match, prefix, num) => {
            return `|SPLIT|${num} `;
        });

        // 2. Also keep the old logic of separating introductory text if needed, 
        //    but usually the first split handles the intro.
        //    We split by our token.
        parts = formatted.split('|SPLIT|').filter(p => p.trim().length > 0);
    } else {
        // Fallback Logic: Standard Bullet Points (split by sentences)
        parts = text.split('. ').filter(p => p.trim().length > 0);
    }

    // Helper to highlight data points in text
    const highlightContent = (text: string) => {
        // 1. Check for Title Pattern at start (e.g. "Analysis:", "Market Edge (15%):")
        //    Looking for text ending in ':' at the start. 
        //    Limit length to avoid bolding entire long sentences if they happen to have a colon far away.
        //    NOTE: Removed 's' flag for compatibility. matching across lines if handled by parts split anyway.
        const titleMatch = text.match(/^(.{3,60}?):(\s+[\s\S]*)/);

        let titlePart = "";
        let bodyPart = text;

        if (titleMatch) {
            titlePart = titleMatch[1] + ":"; // Include the colon
            bodyPart = titleMatch[2]; // The rest
        }

        // 2. Highlight numbers/data in the body
        //    Regex for: Percents (15%), Decimals (1.50, 2.5), Scores (0-0, 1-2), X/Y stakes (1/10)
        //    We split by capturing group to separate plain text from highlights
        const dataRegex = /(\d+(?:[\.,]\d+)?%|\b\d+\.\d{2}\b|\b\d+-\d+\b|\b\d+\/\d+\b)/g;

        const renderBody = (body: string) => {
            return body.split(dataRegex).map((chunk, i) => {
                if (dataRegex.test(chunk)) {
                    return <span key={i} className="font-bold text-foreground/90">{chunk}</span>;
                }
                return <span key={i}>{chunk}</span>;
            });
        };

        return (
            <>
                {titlePart && (
                    <strong className="text-foreground/90 font-bold block sm:inline mb-1 sm:mb-0">
                        {titlePart}
                    </strong>
                )}
                {renderBody(bodyPart)}
            </>
        );
    };

    return (
        <ul className="text-sm text-muted-foreground space-y-2 mt-3 text-left font-normal">
            {parts.map((part, idx) => {
                let content = part.trim();

                // Check if this specific line is a numbered item
                // NOTE: removed 's' flag for compatibility. format is usually single line or we use [\s\S] if needed.
                const numberMatch = content.match(/^(\d+[\)\.])\s+([\s\S]*)/);

                if (numberMatch && hasNumberedList) {
                    const [_, num, rest] = numberMatch;

                    return (
                        <li key={idx} className="flex gap-2 items-start pl-1">
                            {/* Number formatted in Primary Color */}
                            <span className="text-primary font-bold mt-[2px] whitespace-nowrap">{num}</span>
                            <span className="leading-relaxed opacity-90 block">
                                {highlightContent(rest)}
                            </span>
                        </li>
                    );
                }

                // Standard Bullet logic
                if (!hasNumberedList && !content.endsWith('.')) content += '.';

                return (
                    <li key={idx} className="flex gap-2 items-start">
                        <span className="text-primary font-bold mt-[3px] text-[10px]">•</span>
                        <span className="leading-relaxed opacity-90 block">
                            {highlightContent(content)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
};

// Countdown Timer Component
const CountdownTimer = ({ targetTime, targetDate }: { targetTime: string, targetDate?: string }) => {
    const calculateTimeLeft = () => {
        try {
            const now = new Date();
            // Parse target time
            // Formats: "19:30" or "2024-05-12T19:30:00"
            let target = new Date();

            if (targetTime.includes('T') || targetTime.includes('-')) {
                target = new Date(targetTime);
            } else {
                // Assume HH:mm
                const [hours, minutes] = targetTime.split(':').map(Number);
                if (targetDate && targetDate.includes('-')) {
                    // Handle DD-MM-YYYY
                    if (targetDate.includes('-') && targetDate.split('-')[0].length === 2) {
                        const [d, m, y] = targetDate.split('-').map(Number);
                        target = new Date(y, m - 1, d);
                    } else {
                        target = new Date(targetDate);
                    }
                }
                target.setHours(hours, minutes, 0, 0);
            }

            const difference = target.getTime() - now.getTime();

            if (difference > 0) {
                return {
                    hours: Math.floor((difference / (1000 * 60 * 60))),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60),
                    total: difference
                };
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);
        return () => clearInterval(timer);
    }, [targetTime, targetDate]);

    if (!timeLeft) return null;

    // Color Logic
    // > 2 hours: Green
    // < 2 hours & > 30 mins: Orange
    // < 30 mins: Red
    let colorClass = "text-emerald-500";
    if (timeLeft.total < 2 * 60 * 60 * 1000) colorClass = "text-amber-500";
    if (timeLeft.total < 30 * 60 * 1000) colorClass = "text-rose-500";

    return (
        <div className={`text-[10px] font-mono font-bold ${colorClass} animate-pulse flex items-center gap-1`}>
            <Clock size={10} />
            <span>
                {String(timeLeft.hours).padStart(2, '0')}:
                {String(timeLeft.minutes).padStart(2, '0')}:
                {String(timeLeft.seconds).padStart(2, '0')}
            </span>
        </div>
    );
};

import { usePathname } from 'next/navigation';

// Helper: Replace "Local" and "Visitante" with actual team names
const replaceTeamNames = (pick: string, matchName: string) => {
    if (!pick || !matchName) return pick;
    // Check if matchName is valid (contains vs)
    if (!matchName.includes(' vs ') && !matchName.includes(' - ')) return pick;

    // Split match name
    const parts = matchName.split(/ vs | - /i);
    if (parts.length < 2) return pick;

    const homeTeam = parts[0].trim();
    const awayTeam = parts[1].trim();

    let newPick = pick;
    // Replace Local/Visitante (Case Insensitive)
    newPick = newPick.replace(/\bLocal\b/gi, homeTeam);
    newPick = newPick.replace(/\bVisitante\b/gi, awayTeam);

    return newPick;
};

export default function BetCard({ type, data, isAdmin, date }: BetCardProps) {
    const pathname = usePathname();
    const isModeAdmin = isAdmin || pathname?.startsWith('/admin');

    const [isUpdating, setIsUpdating] = useState(false);
    const [reasonOpen, setReasonOpen] = useState(false);

    if (!data) return null;

    // Normalize incoming status for default value
    let currentStatus = data.status || 'PENDING';
    if (currentStatus === 'GANADA') currentStatus = 'WON';
    if (currentStatus === 'PERDIDA') currentStatus = 'LOST';
    if (currentStatus === 'PENDIENTE') currentStatus = 'PENDING';

    const handleStatusChange = async (newStatus: string) => {
        if (!isModeAdmin) return;
        setIsUpdating(true);
        console.log(`[BetCard] Enviando a API: Type=${type}, NewStatus=${newStatus}`);

        try {
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
            const targetDate = date || data.date || today;

            const res = await fetch('/api/admin/update-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: targetDate,
                    betType: type,
                    newStatus: newStatus
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                console.error("[BetCard] Error API:", errData);
                alert(`Error al guardar: ${errData.error || 'Desconocido'}`);
            } else {
                const data = await res.json();
                if (data.success) {
                    console.log(`[BetCard] Guardado exitoso en Vercel: ${data.filtered?.status}`);
                }
            }
        } catch (e) {
            console.error("[BetCard] Exception:", e);
            alert("Error de conexión al guardar.");
        } finally {
            setIsUpdating(false);
        }
    };

    const cardConfigs = {
        safe: {
            type: 'safe',
            icon: ShieldCheck,
            color: 'cyan',
            title: 'La Segura',
            subtitle: 'Probabilidad Alta',
            cardBorder: 'hover:border-cyan-500/50',
            cardShadow: 'hover:shadow-cyan-500/10',
            headerBg: 'bg-cyan-500',
            iconBg: 'bg-cyan-500/10',
            textColor: 'text-cyan-500',
            stake: 6
        },
        value: {
            type: 'value',
            icon: Target,
            color: 'amber',
            title: 'De Valor',
            subtitle: 'Rentabilidad Alta',
            cardBorder: 'hover:border-amber-500/50',
            cardShadow: 'hover:shadow-amber-500/10',
            headerBg: 'bg-amber-500',
            iconBg: 'bg-amber-500/10',
            textColor: 'text-amber-500',
            stake: 3
        },
        funbet: {
            type: 'funbet',
            icon: PartyPopper,
            color: 'fuchsia',
            title: 'Funbet',
            subtitle: 'Arriesgada',
            cardBorder: 'hover:border-fuchsia-500/50',
            cardShadow: 'hover:shadow-fuchsia-500/10',
            headerBg: 'bg-fuchsia-500',
            iconBg: 'bg-fuchsia-500/10',
            textColor: 'text-fuchsia-500',
            stake: 1
        }
    };
    const config = cardConfigs[type];

    const Icon = config.icon;
    const startTime = getEarliestTime(data);

    // Smart Component Detection
    let componentsToRender: BetComponent[] | undefined = data.components;
    const showSelections = (data.selections && data.selections.length > 0);

    // Fallback: If no components but is 'value' combinada (contains '+')
    if (!componentsToRender && type === 'value' && data.pick.includes('+')) {
        componentsToRender = data.pick.split('+').map(p => {
            const cleanP = p.trim();
            // Try to find odd in reason
            const foundOdd = findOddInReason(cleanP, data.reason);
            return {
                match: "Combinada", // Generic header 
                pick: cleanP,
                odd: foundOdd ? parseFloat(foundOdd) : undefined
            };
        });
    }

    // Helper: Check if started
    const [hasStarted, setHasStarted] = useState(false);
    const [, setTick] = useState(0); // Force re-render every minute

    useEffect(() => {
        const checkStarted = () => {
            setTick(t => t + 1); // Force update to re-evaluate checkTimePassed for all items

            if (!startTime) return;
            try {
                const now = new Date();
                let target = new Date();

                // Reuse parsing logic (Global Start Time)
                if (startTime.includes('T') || startTime.includes('-')) {
                    target = new Date(startTime);
                } else {
                    const [hours, minutes] = startTime.split(':').map(Number);
                    // Allow explicit date prop or data.date
                    const dStr = date || data.date;
                    if (dStr && dStr.includes('-')) {
                        if (dStr.split('-')[0].length === 2 && dStr.split('-')[2].length === 4) {
                            // DD-MM-YYYY
                            const [d, m, y] = dStr.split('-').map(Number);
                            target = new Date(y, m - 1, d);
                        } else {
                            target = new Date(dStr);
                        }
                    }
                    target.setHours(hours, minutes, 0, 0);
                }

                if (now >= target) setHasStarted(true);
            } catch (e) {
                // ignore
            }
        };

        checkStarted();
        const timer = setInterval(checkStarted, 60000); // Update every minute
        return () => clearInterval(timer);
    }, [startTime, date, data.date]);


    const isListLayout = type === 'funbet' || (type === 'value' && !!componentsToRender && componentsToRender.length > 0);

    const checkTimePassed = (...candidates: (string | undefined | null)[]) => {
        try {
            const now = new Date();

            // Check each candidate
            for (const item of candidates) {
                if (!item || typeof item !== 'string') continue;

                // A. Try parsing full date "YYYY-MM-DD HH:MM" manually to FORCE LOCAL TIME
                // This avoids "new Date(string)" interpreting as UTC/Invalid
                const fullDateMatch = item.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})/);
                if (fullDateMatch) {
                    const year = parseInt(fullDateMatch[1], 10);
                    const month = parseInt(fullDateMatch[2], 10) - 1;
                    const day = parseInt(fullDateMatch[3], 10);
                    const hour = parseInt(fullDateMatch[4], 10);
                    const min = parseInt(fullDateMatch[5], 10);

                    const target = new Date(year, month, day, hour, min, 0);
                    if (now >= target) return true;
                    continue;
                }

                // B. Fallback: Just "HH:MM" (e.g. from pick text or simple time)
                // Find "16:00" and compare against "Today 16:00" (or Card Date 16:00)
                const timeMatch = item.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);

                    let target = new Date(); // Defaults to Now (Today)

                    // Try to set date from card data context if available
                    const dStr = date || data.date;
                    if (dStr) {
                        // Support DD-MM-YYYY format common in this app
                        if (dStr.includes('-') && dStr.split('-').length === 3) {
                            const parts = dStr.split('-');
                            if (parts[0].length === 2 && parts[2].length === 4) {
                                target = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                            } else {
                                // Fallback try parse
                                const parsed = new Date(dStr);
                                if (!isNaN(parsed.getTime())) target = parsed;
                            }
                        }
                    }

                    // If target became Invalid, reset to Today
                    if (isNaN(target.getTime())) target = new Date();

                    // Force Local Hours
                    target.setHours(hours, minutes, 0, 0);

                    if (now >= target) return true;
                }
            }
            return false;
        } catch { return false; }
    };

    return (
        <div className={`group relative bg-card border border-border rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl ${config.cardBorder} ${config.cardShadow} ${type === 'value' ? 'scale-105 z-10 shadow-xl' : ''}`}>
            {/* Header Line */}
            <div className={`absolute inset-x-0 top-0 h-1 ${config.headerBg} rounded-t-3xl`} />

            {/* Status & Countdown (Unified for Admin/User) */}
            <div className="absolute top-4 right-6 flex flex-col items-end gap-1 z-20">
                {/* 1. Status Badge (Only if WON/LOST) */}
                {(data.status === 'WON' || data.status === 'GANADA' || data.status === 'LOST' || data.status === 'PERDIDA') && (
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border 
                        ${(data.status === 'WON' || data.status === 'GANADA') ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' :
                            'bg-rose-500/20 text-rose-500 border-rose-500/20'}`}>
                        {(data.status === 'WON' || data.status === 'GANADA') ? <Check size={12} /> : <XIcon size={12} />}
                        <span>{(data.status === 'WON' || data.status === 'GANADA') ? 'GANADA' : 'PERDIDA'}</span>
                    </div>
                )}
                {/* 1.1 CHECK ATTEMPTS BADGE (ADMIN OR DEBUG) */}
                {data.check_attempts !== undefined && data.check_attempts >= 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border bg-secondary/50 border-border/50 text-muted-foreground opacity-60">
                        <RefreshCw size={10} />
                        <span>Checks: {data.check_attempts}</span>
                    </div>
                )}

                {/* 1.5 STARTED Badge within Status Area (Optional, but user asked for ICON next to text mostly) -> Let's keep this clean */}

                {/* 2. Start Time Badge (Always show if available) */}
                {startTime && (
                    <div className="flex flex-col items-end gap-1">
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full border border-border/50`}>
                            <Clock size={12} className="text-primary/70" />
                            <span>{extractTime(startTime)}</span>
                        </div>

                        {/* 3. Countdown (Only if PENDING/undefined AND NOT Started) */}
                        {(!data.status || data.status === 'PENDING' || data.status === 'PENDIENTE') && (
                            hasStarted ? (
                                <div className="text-[10px] font-bold text-blue-500 animate-pulse flex items-center gap-1">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    <span>EN JUEGO</span>
                                </div>
                            ) : (
                                <CountdownTimer targetTime={startTime} targetDate={date || data.date} />
                            )
                        )}
                    </div>
                )}
            </div>



            {/* Value Badge */}
            {type === 'value' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                    Recomendado
                </div>
            )}

            {/* Title Section */}
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl ${config.iconBg} ${config.textColor}`}>
                    <Icon size={28} />
                </div>
                <div>
                    <h3 className="font-bold text-xl">{config.title}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{config.subtitle}</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* MATCH INFO */}
                {(!isListLayout || (componentsToRender && componentsToRender[0]?.match === "Combinada" && type === 'value')) && !showSelections && (
                    // Show original match title above the list for Value bets if using fallback
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-muted-foreground text-sm">Partido</span>
                        <span className="font-medium text-right text-sm">{data.match || "N/A"}</span>
                    </div>
                )}

                {/* MATCH HEADER IF SELECTIONS PRESENT */}
                {showSelections && (
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-muted-foreground text-sm">Evento</span>
                        <span className="font-medium text-right text-sm">{data.match}</span>
                    </div>
                )}


                {/* PICK INFO (Standard vs List vs Selections) */}
                <div className="bg-secondary/50 p-3 rounded-xl border border-secondary">
                    {showSelections ? (
                        <div className="space-y-3">
                            {data.selections?.map((sel, idx) => (
                                <div key={idx} className="flex flex-col border-b border-border/50 last:border-0 pb-2 last:pb-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-1 mr-2 flex-1 flex-wrap">
                                            <span className="text-xs font-semibold text-foreground/80 leading-tight">{sel.match}</span>
                                            {sel.league && (() => {
                                                const flagCode = getLeagueFlagCode(sel.league, sel.league_id, sel.country);
                                                return (
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 flex items-center">
                                                        ({sel.league}
                                                        {flagCode && (
                                                            <img
                                                                src={`https://flagcdn.com/20x15/${flagCode}.png`}
                                                                alt={flagCode}
                                                                className="w-3 h-2.5 object-cover inline-block rounded-[1px] opacity-80 ml-1"
                                                            />
                                                        )}
                                                        )
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        {sel.odd && <span className="text-[10px] bg-secondary px-1 rounded text-muted-foreground whitespace-nowrap">{sel.odd}</span>}
                                    </div>
                                    <div className="flex justify-between items-start pl-2 border-l-2 border-primary/20">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                {/* Status Icon (Left side) */}
                                                {(sel.status === 'WON' || sel.status === 'GANADA') && <Check size={14} className="text-emerald-500 shrink-0" />}
                                                {(sel.status === 'LOST' || sel.status === 'PERDIDA') && <XIcon size={14} className="text-rose-500 shrink-0" />}

                                                <span className={`text-sm font-bold ${config.textColor}`}>{replaceTeamNames(sel.pick, sel.match)}</span>
                                            </div>

                                            {/* Result Text (Below Name) */}
                                            {sel.result && sel.result !== '?' && (
                                                <div className="text-[10px] text-muted-foreground ml-5 font-mono">
                                                    {sel.result}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Always Time + SportIcon */}
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-mono text-muted-foreground mr-1.5 font-bold opacity-80 decoration-0 align-middle">
                                                {extractTime(sel.time || data.startTime || data.time)}
                                            </span>
                                            <SportIcon sport={sel.sport || data.sport} className="text-base" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : isListLayout && componentsToRender ? (
                        <>
                            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block mb-3">
                                {type === 'value' ? 'Selecciones:' : 'Combinada:'}
                            </span>
                            <div className="space-y-3">
                                {Object.entries(groupComponents(componentsToRender)).map(([matchName, items], idx) => (
                                    <div key={idx} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                                        {/* Don't show header if it's the generic fallback "Combinada" OR matchName is "Combinada" */}
                                        {matchName !== "Combinada" && matchName !== "Selecciones" && (
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-semibold text-foreground/80">{matchName}</span>
                                                {items[0].time && (() => {
                                                    const isStarted = checkTimePassed(items[0].time);
                                                    return (
                                                        <span className={`text-[9px] flex items-center gap-1 ${isStarted ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                                                            <Clock size={9} /> {items[0].time}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                        {items.map((item, i) => {
                                            const { text, odd } = getCleanPickAndOdd(item.pick, item.odd);
                                            // Fallback: Check time in pick OR display odd (if data mismatch)
                                            // Pass all candidates separately so the function checks them all
                                            const isItemStarted = checkTimePassed(item.time, item.pick, (typeof odd === 'string' ? odd : String(odd)));

                                            return (
                                                <div key={i} className={`flex justify-between items-center pl-2 border-l-2 ${type === 'funbet' ? 'border-amber-500/30' : 'border-violet-500/30'} my-1`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold ${config.textColor}`}>{replaceTeamNames(text, matchName)}</span>
                                                        {isItemStarted && (!data.status || data.status === 'PENDING' || data.status === 'PENDIENTE') && (
                                                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20" title="En Juego">
                                                                <Clock size={10} className="text-amber-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {odd && (
                                                        <span className="text-xs font-mono font-bold text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded border border-border/50 whitespace-nowrap ml-2">
                                                            {odd}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm">Pick</span>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold ${config.textColor}`}>{replaceTeamNames(data.pick, data.match)}</span>
                                {(data.status === 'WON' || data.status === 'GANADA') && (
                                    <Check size={18} className="text-emerald-500 stroke-[3px]" />
                                )}
                                {(data.status === 'LOST' || data.status === 'PERDIDA') && (
                                    <XIcon size={18} className="text-rose-500 stroke-[3px]" />
                                )}
                                {/* PENDING + STARTED ICON */}
                                {(!data.status || data.status === 'PENDING' || data.status === 'PENDIENTE') && hasStarted && (
                                    <div className="relative flex items-center justify-center w-4 h-4" title="En Juego">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <Clock size={16} className="text-blue-500 relative z-10 animate-pulse" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ODD & STAKE & PROFIT */}
                <div className="flex items-end justify-between mt-4 px-1 border-t border-border pt-4">
                    <div className="flex flex-col">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-0.5">Profit Est.</span>
                        <span className="font-mono font-black text-xl text-emerald-500">
                            {data.estimated_units ? `+${data.estimated_units}u` :
                                `+${((data.stake || config.stake) * ((data.total_odd || data.odd) - 1)).toFixed(2)}u`}
                        </span>
                    </div>

                    <div className="flex flex-col items-center">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-0.5">Stake</span>
                        <span className={`font-mono font-bold text-lg ${config.textColor}`}>
                            {data.stake || config.stake}/10
                        </span>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-0.5">Cuota</span>
                        <span className="font-mono text-4xl font-black tracking-tighter leading-none">{data.total_odd || data.odd}</span>
                    </div>
                </div>

                {/* Reason */}
                <div className="pt-4 border-t border-border mt-4">
                    <button
                        onClick={() => setReasonOpen(!reasonOpen)}
                        className="md:hidden w-full flex items-center justify-between text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-2 hover:text-foreground transition-colors"
                    >
                        <span>Análisis</span>
                        {reasonOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <div className={`${reasonOpen ? 'block' : 'hidden'} md:block`}>
                        <FormattedReason text={data.reason} />
                    </div>
                </div>
            </div>
        </div>
    );
}
