import React from 'react';
import { ShieldCheck, Target, PartyPopper, Clock } from 'lucide-react';

type BetComponent = {
    match: string;
    pick: string;
    time?: string;
    odd?: number;
};

type BetData = {
    match: string;
    pick: string;
    odd: number;
    reason: string;
    time?: string;
    components?: BetComponent[];
};

type BetCardProps = {
    type: 'safe' | 'value' | 'funbet';
    data?: BetData;
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
    if (data.time) times.push(data.time);
    if (data.components) {
        data.components.forEach(c => {
            if (c.time) times.push(c.time);
        });
    }
    if (times.length === 0) return null;
    return times.sort()[0];
};

// Helper: Extract odd from text if not provided
const getCleanPickAndOdd = (pick: string, explicitOdd?: number) => {
    if (explicitOdd) return { text: pick, odd: explicitOdd.toFixed(2) };

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

// Helper: Formatted Reason 
const FormattedReason = ({ text }: { text?: string }) => {
    if (!text) return null;
    const parts = text.split(/(?=\d\. )/g).filter(p => p.trim().length > 0);
    if (parts.length <= 1) return <p className="text-sm text-muted-foreground italic">"{text}"</p>;
    return (
        <ul className="text-sm text-muted-foreground space-y-2 mt-2 text-left">
            {parts.map((part, idx) => (
                <li key={idx} className="flex gap-2 bg-secondary/30 p-2 rounded-md border border-border/30">
                    <span className="font-bold text-primary/70 shrink-0">{part.substring(0, 2)}</span>
                    <span className="italic">{part.substring(2)}</span>
                </li>
            ))}
        </ul>
    );
};

export default function BetCard({ type, data }: BetCardProps) {
    if (!data) return null;

    const cardConfigs = {
        safe: {
            type: 'safe',
            icon: ShieldCheck,
            color: 'emerald',
            title: 'La Segura',
            subtitle: 'Probabilidad Alta',
            cardBorder: 'hover:border-emerald-500/50',
            cardShadow: 'hover:shadow-emerald-500/10',
            headerBg: 'bg-emerald-500',
            iconBg: 'bg-emerald-500/10',
            textColor: 'text-emerald-500',
            stake: 6
        },
        value: {
            type: 'value',
            icon: Target,
            color: 'violet',
            title: 'De Valor',
            subtitle: 'Rentabilidad Alta',
            cardBorder: 'hover:border-violet-500/50',
            cardShadow: 'hover:shadow-violet-500/10',
            headerBg: 'bg-violet-500',
            iconBg: 'bg-violet-500/10',
            textColor: 'text-violet-500',
            stake: 3
        },
        funbet: {
            type: 'funbet',
            icon: PartyPopper,
            color: 'amber',
            title: 'Funbet',
            subtitle: 'Arriesgada',
            cardBorder: 'hover:border-amber-500/50',
            cardShadow: 'hover:shadow-amber-500/10',
            headerBg: 'bg-amber-500',
            iconBg: 'bg-amber-500/10',
            textColor: 'text-amber-500',
            stake: 1
        }
    };
    const config = cardConfigs[type];

    const Icon = config.icon;
    const startTime = getEarliestTime(data);

    // Smart Component Detection
    let componentsToRender: BetComponent[] | undefined = data.components;

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

    const isListLayout = type === 'funbet' || (type === 'value' && !!componentsToRender && componentsToRender.length > 0);

    return (
        <div className={`group relative bg-card border border-border rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl ${config.cardBorder} ${config.cardShadow} ${type === 'value' ? 'scale-105 z-10 shadow-xl' : ''}`}>
            {/* Header Line */}
            <div className={`absolute inset-x-0 top-0 h-1 ${config.headerBg} rounded-t-3xl`} />

            {/* Start Time Badge */}
            {startTime && (
                <div className="absolute top-4 right-6 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full border border-border/50">
                    <Clock size={12} className="text-primary/70" />
                    <span>{startTime}</span>
                </div>
            )}

            {/* Value Badge */}
            {type === 'value' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
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
                {(!isListLayout || (componentsToRender && componentsToRender[0]?.match === "Combinada" && type === 'value')) && (
                    // Show original match title above the list for Value bets if using fallback
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-muted-foreground text-sm">Partido</span>
                        <span className="font-medium text-right text-sm">{data.match || "N/A"}</span>
                    </div>
                )}

                {/* MATCH INFO for Funbets or structured value bets where match name might be different per item or grouped */}
                {/* Logic handled inside list loop for groupings */}

                {/* PICK INFO (Standard vs List) */}
                <div className="bg-secondary/50 p-3 rounded-xl border border-secondary">
                    {isListLayout && componentsToRender ? (
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
                                                {items[0].time && <span className="text-[9px] text-muted-foreground flex items-center gap-1"><Clock size={9} /> {items[0].time}</span>}
                                            </div>
                                        )}
                                        {items.map((item, i) => {
                                            const { text, odd } = getCleanPickAndOdd(item.pick, item.odd);
                                            return (
                                                <div key={i} className={`flex justify-between items-center pl-2 border-l-2 ${type === 'funbet' ? 'border-amber-500/30' : 'border-violet-500/30'} my-1`}>
                                                    <span className={`text-sm font-bold ${config.textColor}`}>{text}</span>
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
                            <span className={`font-bold ${config.textColor}`}>{data.pick}</span>
                        </div>
                    )}
                </div>

                {/* ODD Info */}
                <div className="flex items-end justify-between mt-4 px-1 border-t border-border pt-4">
                    <div className="flex flex-col">
                        <span className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Stake</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg text-white shadow-lg ${config.headerBg}`}>
                                {config.stake}
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">Unidades</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-xs uppercase font-bold tracking-wider mb-1">Cuota Total</span>
                        <span className="font-mono text-4xl font-black tracking-tighter leading-none">{data.odd}</span>
                    </div>
                </div>

                {/* Reason */}
                <div className="pt-4 border-t border-border mt-4">
                    <FormattedReason text={data.reason} />
                </div>
            </div>
        </div>
    );
}
