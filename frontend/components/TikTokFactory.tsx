"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2, Settings2, Image as ImageIcon, ChevronDown, ChevronRight, RefreshCw, Save, ScanEye, CheckCircle2, Link as LinkIcon, ShieldCheck, Target, PartyPopper, X } from 'lucide-react';

/* 
 * TIKTOK FACTORY v4.0 - STABLE RESTORED
 * - Font: System Sans (font-black)
 * - Design: Flat, Bold, No Shadows
 * - Features: Web-Like Grouping, Graph Icon Restored
 */

type TikTokFactoryProps = {
    predictions: any;
    formattedDate: string;
};

export default function TikTokFactory({ predictions, formattedDate }: TikTokFactoryProps) {
    const [generating, setGenerating] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [yesterdayProfit, setYesterdayProfit] = useState<number | null>(null);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Config State - defaults with emojis adaptable by user
    const [config, setConfig] = useState({
        // Slide 1: Cover
        coverTitle: "EL MOVIMIENTO\nPREMIUM DE HOY 🚀",
        coverSubtitle: "Análisis con IA (Gemini Pro)",
        coverEmoji: "",
        showProfitBadge: true,

        // Slides 2-4: Bets
        safeTitle: "NIVEL 1: LA BASE SEGURA 🔒",
        valueTitle: "NIVEL 2: EL MULTIPLICADOR 💎",
        funbetTitle: "NIVEL 3: EL BOMBAZO FINAL 💣",

        // Slide 5: Outro
        outroTitle: "ÚNETE AL\nEQUIPO 🔗",
        outroSub: "Análisis diarios gratuitos en el link del perfil",

        // Backgrounds (Indices 0-4 maps to bg-1.jpg ... bg-5.jpg)
        bgSelection: [1, 2, 3, 4, 5]
    });

    const [collapsed, setCollapsed] = useState({
        cover: false,
        bets: true,
        outro: true,
        bg: true
    });

    // Helper: Anti-Ban Text Sanitizer
    const sanitizeText = (text: string) => {
        if (!text) return "";
        let clean = text
            .replace(/Apuesta/gi, "Selección")
            .replace(/Cuota/gi, "X")
            .replace(/Win/gi, "Vence")
            .replace(/Gana/gi, "Vence");
        return clean;
    };

    // Helper: Calculate Total Probability (Odds)
    const calculateTotalOdds = () => {
        const o1 = parseFloat(predictions?.safe?.odd || "1");
        const o2 = parseFloat(predictions?.value?.odd || "1");
        const o3 = parseFloat(predictions?.funbet?.odd || "1");
        return (o1 * o2 * o3).toFixed(2);
    };

    // Fetch Yesterday's Profit
    useEffect(() => {
        const fetchYesterday = async () => {
            const now = new Date();
            now.setDate(now.getDate() - 1);
            const yStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
            try {
                const res = await fetch(`/api/admin/history?month=${monthStr}`);
                const data = await res.json();
                if (data.days && data.days[yStr]) {
                    setYesterdayProfit(data.days[yStr].day_profit);
                }
            } catch (e) {
                console.error("Failed to fetch profit", e);
            }
        };
        fetchYesterday();
        randomizeBackgrounds();
    }, []);

    const toggleSection = (section: keyof typeof collapsed) => {
        setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleBgChange = (index: number, bgId: number) => {
        const newBgs = [...config.bgSelection];
        newBgs[index] = bgId;
        setConfig({ ...config, bgSelection: newBgs });
    };

    const randomizeBackgrounds = () => {
        const shuffled = [1, 2, 3, 4, 5]
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);
        setConfig(prev => ({ ...prev, bgSelection: shuffled }));
    };

    const generateImages = async () => {
        if (!containerRef.current) return;
        setGenerating(true);
        setImages([]);
        await new Promise(r => setTimeout(r, 500));

        const generated: string[] = [];
        const slides = containerRef.current.children;

        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i] as HTMLElement;
            try {
                const canvas = await html2canvas(slide, {
                    scale: 1,
                    useCORS: true,
                    width: 1080,
                    height: 1920,
                    backgroundColor: '#000',
                    logging: false,
                });
                generated.push(canvas.toDataURL('image/png'));
            } catch (err) {
                console.error("Slide gen error", err);
            }
        }
        setImages(generated);
        setGenerating(false);
    };

    const downloadAll = () => {
        images.forEach((img, idx) => downloadImage(img, idx));
    };

    const downloadImage = (img: string, idx: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const a = document.createElement('a');
        a.href = img;
        a.download = `tiktok-slide-${idx + 1}.png`;
        a.click();
    };

    return (
        <div className="w-full h-full flex flex-col md:flex-row bg-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300">

            {/* LEFT: SETTINGS PANEL */}
            <div className="w-full md:w-1/3 border-r border-white/10 bg-black/40 flex flex-col h-auto md:h-full shrink-0">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-emerald-900/20 to-teal-900/20">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings2 className="text-emerald-500" />
                        Editor Editorial V4
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* SECTION 1: COVER */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('cover')} className="w-full flex justify-between items-center p-4 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">🖼️ Portada & Gancho</span>
                            {collapsed.cover ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.cover && (
                            <div className="p-4 space-y-3 border-t border-white/10">
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Título Principal</label>
                                    <textarea value={config.coverTitle} onChange={e => setConfig({ ...config, coverTitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm h-16" />
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Subtítulo</label>
                                    <input value={config.coverSubtitle} onChange={e => setConfig({ ...config, coverSubtitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm" />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input type="checkbox" checked={config.showProfitBadge} onChange={e => setConfig({ ...config, showProfitBadge: e.target.checked })} className="rounded bg-black/50 border-white/20" />
                                    <span className="text-xs text-white font-bold">Badge 'Ayer Cumplimos'</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: BETS */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('bets')} className="w-full flex justify-between items-center p-4 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">📝 Títulos Niveles</span>
                            {collapsed.bets ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.bets && (
                            <div className="p-4 space-y-3 border-t border-white/10">
                                <div>
                                    <label className="text-xs text-emerald-400 block mb-1 font-bold">Nivel 1 (Safe)</label>
                                    <input value={config.safeTitle} onChange={e => setConfig({ ...config, safeTitle: e.target.value })} className="w-full bg-black/50 border border-emerald-500/30 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-violet-400 block mb-1 font-bold">Nivel 2 (Value)</label>
                                    <input value={config.valueTitle} onChange={e => setConfig({ ...config, valueTitle: e.target.value })} className="w-full bg-black/50 border border-violet-500/30 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-amber-400 block mb-1 font-bold">Nivel 3 (Bomba)</label>
                                    <input value={config.funbetTitle} onChange={e => setConfig({ ...config, funbetTitle: e.target.value })} className="w-full bg-black/50 border border-amber-500/30 rounded p-2 text-white text-sm" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: BACKGROUNDS */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('bg')} className="w-full flex justify-between items-center p-4 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">🎨 Fondos</span>
                            {collapsed.bg ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.bg && (
                            <div className="p-4 space-y-4 border-t border-white/10">
                                <button onClick={randomizeBackgrounds} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded text-xs font-bold mb-2 flex items-center justify-center gap-2">
                                    <RefreshCw size={14} /> Re-Mezclar Fondos
                                </button>
                                {config.bgSelection.map((bgId, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <span className="text-xs text-white/50">Slide {idx + 1}</span>
                                        <select
                                            value={bgId}
                                            onChange={(e) => handleBgChange(idx, Number(e.target.value))}
                                            className="bg-black/50 border border-white/10 rounded text-xs p-1 text-white w-24"
                                        >
                                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Fondo {n}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-black/20">
                    <button
                        onClick={generateImages}
                        disabled={generating}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {generating ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                        {generating ? 'Renderizando...' : 'GENERAR V4 PREMIUM 🚀'}
                    </button>
                </div>
            </div>

            {/* RIGHT: PREVIEW PANEL */}
            <div className="flex-1 bg-black/80 flex flex-col min-h-[600px] md:h-full overflow-hidden relative">
                {images.length > 0 ? (
                    <div className="flex-1 overflow-y-auto p-8">
                        <h3 className="block md:hidden text-xl font-bold text-white mb-4">Resultados Generados:</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 content-start">
                            {images.map((img, idx) => (
                                <div key={idx} className="group relative aspect-[9/16] bg-zinc-900 rounded-lg overflow-hidden border border-white/10 shadow-2xl cursor-pointer" onClick={() => setPreviewImg(img)}>
                                    <img src={img} alt={`Slide ${idx}`} className="w-full h-full object-contain" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                        <div className="flex flex-col items-center gap-2">
                                            <ScanEye className="text-white" size={32} />
                                            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Ver</span>
                                        </div>
                                        <button
                                            onClick={(e) => downloadImage(img, idx, e)}
                                            className="p-3 bg-white hover:bg-emerald-500 text-black hover:text-white rounded-full transition-colors shadow-xl transform hover:scale-110 z-10"
                                            title="Descargar esta imagen"
                                        >
                                            <Download size={20} />
                                        </button>
                                    </div>
                                    <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white/50 bg-black/50 px-2 py-0.5 rounded">
                                        #{idx + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-4">
                        <ImageIcon size={64} className="opacity-20" />
                        <p className="text-sm">Configura y pulsa "Generar"</p>
                    </div>
                )}
                {images.length > 0 && (
                    <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end">
                        <button onClick={downloadAll} className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2">
                            <Save size={18} /> Descargar Todo
                        </button>
                    </div>
                )}
            </div>

            {/* FULL SCREEN PREVIEW MODAL */}
            {previewImg && (
                <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur flex items-center justify-center p-8 cursor-pointer" onClick={() => setPreviewImg(null)}>
                    <img src={previewImg} alt="Preview" className="h-full w-auto object-contain rounded-xl shadow-2xl border border-white/20" />
                    <button className="absolute top-8 right-8 text-white/50 hover:text-white p-2">
                        <X size={40} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const idx = images.indexOf(previewImg);
                            downloadImage(previewImg, idx);
                        }}
                        className="absolute bottom-12 right-12 px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2 shadow-2xl z-50"
                    >
                        <Download size={20} /> Descargar
                    </button>
                </div>
            )}

            {/* HIDDEN RENDER CONTAINER (1080x1920) */}
            <div className="fixed left-[-9999px] top-0 pointer-events-none">
                <div ref={containerRef}>

                    {/* SLIDE 1: COVER - SYSTEM FONT FLAT STYLE */}
                    <div className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-center bg-black font-sans overflow-hidden">
                        <img src={`/backgrounds/bg-${config.bgSelection[0]}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1920&fit=crop"} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover object-center z-0" alt="bg" />
                        <div className="absolute inset-0 bg-black/30 z-0" />

                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-14 p-8 pb-[500px]">

                            {/* TITLE: YELLOW PILL */}
                            <div className="bg-yellow-400 px-16 py-12 rounded-full w-fit max-w-[95%] flex items-center justify-center text-center">
                                <h1 className="text-7xl font-black text-black uppercase tracking-tighter leading-none">
                                    {config.coverTitle}
                                </h1>
                            </div>

                            {/* SUBTITLE: GREEN PILL */}
                            <div className="bg-green-500 px-20 py-12 rounded-full border-[8px] border-white flex items-center justify-center">
                                <span className="text-8xl font-black text-white uppercase tracking-tighter leading-none">
                                    Cuota {calculateTotalOdds()} 📈
                                </span>
                            </div>

                            {/* EXTRA: "AYER CUMPLIMOS" */}
                            {yesterdayProfit && yesterdayProfit > 0 && config.showProfitBadge && (
                                <div className="mt-10 bg-white px-16 py-10 rounded-full flex items-center justify-center gap-6">
                                    <CheckCircle2 size={55} className="text-green-600" strokeWidth={5} />
                                    <span className="text-6xl font-black text-black uppercase tracking-tighter leading-none">AYER CUMPLIMOS ✅</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SLIDES 2-4: BETS - FLAT GROUPED SYSTEM FONT */}
                    {[
                        { conf: 'safe', title: config.safeTitle, data: predictions?.safe },
                        { conf: 'value', title: config.valueTitle, data: predictions?.value },
                        { conf: 'funbet', title: config.funbetTitle, data: predictions?.funbet }
                    ].map((bet, i) => {
                        const hasData = !!bet.data;
                        const oddText = hasData ? bet.data.odd : "1.00";

                        // --- SMART GROUPING LOGIC (Web Mirror) ---
                        let matchGroups: { [key: string]: string[] } = {};
                        let matchOrder: string[] = [];

                        if (hasData) {
                            if (bet.data.components && bet.data.components.length > 0) {
                                // CASE A: Structured Components
                                bet.data.components.forEach((comp: any) => {
                                    const mName = comp.match ? comp.match.trim().toUpperCase() : "GENERAL";
                                    const pText = sanitizeText(comp.pick).trim();
                                    if (!matchGroups[mName]) {
                                        matchGroups[mName] = [];
                                        matchOrder.push(mName);
                                    }
                                    matchGroups[mName].push(pText);
                                });
                            } else {
                                // CASE B: Plain Text Fallback
                                const mainMatch = sanitizeText(bet.data.match).trim().toUpperCase();
                                const rawPick = sanitizeText(bet.data.pick);
                                // Heuristic: Split by newlines or +
                                const lines = rawPick.split(/[\n\+]/).map(s => s.trim()).filter(s => s.length > 0);

                                const isGeneric = /acumulada|combinada|funbet|bombazo/i.test(mainMatch);

                                if (!isGeneric && mainMatch.length > 2) {
                                    // Single Match
                                    matchGroups[mainMatch] = lines;
                                    matchOrder.push(mainMatch);
                                } else {
                                    // Generic - try parsing "Match: Pick"
                                    lines.forEach((line, idx) => {
                                        const colon = line.indexOf(':');
                                        if (colon > 3) {
                                            const m = line.substring(0, colon).trim().toUpperCase();
                                            const p = line.substring(colon + 1).trim();
                                            if (!matchGroups[m]) {
                                                matchGroups[m] = [];
                                                matchOrder.push(m);
                                            }
                                            matchGroups[m].push(p);
                                        } else {
                                            const k = `PICK-${idx}`;
                                            matchGroups[k] = [line];
                                            matchOrder.push(k);
                                        }
                                    });
                                }
                            }
                        }

                        return (
                            <div key={i} className="w-[1080px] h-[1920px] relative flex flex-col items-center bg-black font-sans overflow-hidden">
                                <img src={`/backgrounds/bg-${config.bgSelection[i + 1]}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1920&fit=crop"} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover object-center z-0" alt="bg" />
                                <div className="absolute inset-0 bg-black/20 z-0" />

                                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 gap-14 pb-[450px]">

                                    {/* 1. LEVEL TITLE (Yellow Pill) */}
                                    <div className="bg-yellow-400 px-16 py-8 rounded-full flex items-center justify-center shadow-none mb-4 max-w-[95%] text-center">
                                        <h2 className="text-6xl font-black text-black uppercase tracking-tighter leading-none">
                                            {bet.title}
                                        </h2>
                                    </div>

                                    {/* 2. GROUPED PICKS (White Pills) */}
                                    <div className="flex flex-col items-center w-full px-4 gap-6 space-y-4">
                                        {matchOrder.length > 0 ? (
                                            matchOrder.map((matchName, idx) => {
                                                const picks = matchGroups[matchName];
                                                const joinedPicks = picks.join(" + ");

                                                // Clean Display Logic
                                                const isRealMatch = matchName.length > 3 && !matchName.startsWith("PICK-") && matchName !== "GENERAL";
                                                const displayText = isRealMatch
                                                    ? `${matchName}: ${joinedPicks}`
                                                    : joinedPicks;

                                                // Dynamic Sizing for System Font
                                                const len = displayText.length;
                                                const sizeClass = len > 50 ? 'text-4xl' : len > 30 ? 'text-5xl' : 'text-6xl';

                                                return (
                                                    <div key={idx} className="bg-white px-12 py-8 rounded-full w-fit max-w-[95%] text-center flex items-center justify-center gap-5 min-h-[120px]">
                                                        <span className={`${sizeClass} font-black text-black uppercase tracking-tighter leading-none`}>
                                                            {displayText}
                                                        </span>
                                                        <div className="bg-green-500 rounded-full p-2 shrink-0 flex items-center justify-center border-none">
                                                            <CheckCircle2 size={40} className="text-white" strokeWidth={5} />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="bg-white px-14 py-10 rounded-full flex items-center justify-center text-center">
                                                <span className="text-6xl font-black text-black uppercase tracking-tighter leading-none">SIN SELECCIÓN</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. ODDS BADGE (Green Pill) */}
                                    <div className="mt-10 bg-green-500 px-20 py-10 rounded-full border-[8px] border-white flex items-center justify-center">
                                        <span className="text-8xl font-black text-white uppercase tracking-tighter leading-none">
                                            Cuota {oddText} 📈
                                        </span>
                                    </div>

                                </div>
                            </div>
                        );
                    })}

                    {/* SLIDE 5: OUTRO - FLAT SYSTEM FONT */}
                    <div className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-center bg-black font-sans overflow-hidden">
                        <img src={`/backgrounds/bg-${config.bgSelection[4]}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=1920&fit=crop"} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover object-center z-0" alt="bg" />
                        <div className="absolute inset-0 bg-black/40 z-0" />

                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-12 gap-16 pb-[400px]">

                            {/* ICON */}
                            <div className="bg-white/10 p-12 rounded-full backdrop-blur-md border border-white/20">
                                <LinkIcon size={120} className="text-white" />
                            </div>

                            {/* TITLE */}
                            <div className="bg-yellow-400 px-24 py-16 rounded-full text-center">
                                <h2 className="text-8xl font-black text-black uppercase tracking-tighter leading-none whitespace-pre-line">
                                    {config.outroTitle}
                                </h2>
                            </div>

                            {/* SUBTITLE */}
                            <div className="bg-black/60 px-16 py-8 rounded-full border border-white/20 backdrop-blur-sm">
                                <p className="text-4xl text-white font-bold uppercase tracking-tight text-center">
                                    {config.outroSub}
                                </p>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
