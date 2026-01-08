"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2, Share2, TrendingUp, X, ShieldCheck, Target, PartyPopper, Settings2, Image as ImageIcon, ChevronDown, ChevronRight, RefreshCw, Save, ScanEye } from 'lucide-react';

/* 
 * TIKTOK CONTENT FACTORY v3.0
 * - Unique backgrounds
 * - Analysis toggle
 * - Preview Modal + Downloads
 * - NO Container Box (Floating UI)
 * - Vertical Lists for Parlays (+)
 * - Re-designed Odds placement
 */

// Colors & Configs
const BET_CONFIG = {
    safe: { color: 'text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-500/20', icon: ShieldCheck },
    value: { color: 'text-violet-400', border: 'border-violet-500', bg: 'bg-violet-500/20', icon: Target },
    funbet: { color: 'text-amber-400', border: 'border-amber-500', bg: 'bg-amber-500/20', icon: PartyPopper }
};

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

    // Config State
    const [config, setConfig] = useState({
        // Slide 1: Cover
        coverTitle: "MIS 3 APUESTAS",
        coverSubtitle: "JUBILADORAS DE HOY",
        coverEmoji: "🚀",
        showProfitBadge: true,

        // Slides 2-4: Bets
        safeTitle: "🔒 LA FIJA",
        valueTitle: "🎯 DE VALOR",
        funbetTitle: "💣 BOMBAZO",
        showAnalysis: false, // Default hidden analysis

        // Slide 5: Outro
        outroTitle: "¿QUIERES VER\nMÁS PICKS?",
        outroCTA: "🔗 LINK EN BIO",
        outroSub: "Acceso GRATIS al historial",

        // Backgrounds (Indices 0-4 maps to bg-1.jpg ... bg-5.jpg)
        bgSelection: [1, 2, 3, 4, 5]
    });

    const [collapsed, setCollapsed] = useState({
        cover: false,
        bets: true,
        outro: true,
        bg: true
    });

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
            <div className="w-full md:w-1/3 border-r border-white/10 bg-black/40 flex flex-col h-full">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-fuchsia-900/20 to-purple-900/20">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings2 className="text-fuchsia-500" />
                        Configurador V3
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* SECTION 1: COVER */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('cover')} className="w-full flex justify-between items-center p-4 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">🖼️ Portada</span>
                            {collapsed.cover ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.cover && (
                            <div className="p-4 space-y-3 border-t border-white/10">
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Título</label>
                                    <input value={config.coverTitle} onChange={e => setConfig({ ...config, coverTitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Subtítulo</label>
                                    <input value={config.coverSubtitle} onChange={e => setConfig({ ...config, coverSubtitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs text-white/50 block mb-1">Emoji</label>
                                        <input value={config.coverEmoji} onChange={e => setConfig({ ...config, coverEmoji: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm text-center" />
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={config.showProfitBadge} onChange={e => setConfig({ ...config, showProfitBadge: e.target.checked })} className="rounded bg-black/50 border-white/20" />
                                            <span className="text-xs text-white font-bold">Badge Profit</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: BETS */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('bets')} className="w-full flex justify-between items-center p-4 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">📝 Títulos Apuestas</span>
                            {collapsed.bets ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.bets && (
                            <div className="p-4 space-y-3 border-t border-white/10">
                                <div>
                                    <label className="text-xs text-emerald-400 block mb-1 font-bold">Título Safe</label>
                                    <input value={config.safeTitle} onChange={e => setConfig({ ...config, safeTitle: e.target.value })} className="w-full bg-black/50 border border-emerald-500/30 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-violet-400 block mb-1 font-bold">Título Value</label>
                                    <input value={config.valueTitle} onChange={e => setConfig({ ...config, valueTitle: e.target.value })} className="w-full bg-black/50 border border-violet-500/30 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-amber-400 block mb-1 font-bold">Título Bomba</label>
                                    <input value={config.funbetTitle} onChange={e => setConfig({ ...config, funbetTitle: e.target.value })} className="w-full bg-black/50 border border-amber-500/30 rounded p-2 text-white text-sm" />
                                </div>
                                <div className="pt-2 border-t border-white/10">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={config.showAnalysis} onChange={e => setConfig({ ...config, showAnalysis: e.target.checked })} className="rounded bg-black/50 border-white/20" />
                                        <span className="text-xs text-white font-bold">Mostrar Texto de Análisis (Default: No)</span>
                                    </label>
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
                                    <RefreshCw size={14} /> Re-Mezclar Fondos (Únicos)
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
                        className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-fuchsia-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {generating ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                        {generating ? 'Renderizando...' : 'GENERAR V3 PRO 🚀'}
                    </button>
                </div>
            </div>

            {/* RIGHT: PREVIEW PANEL */}
            <div className="flex-1 bg-black/80 flex flex-col h-full overflow-hidden relative">
                {/* Rendered Images Preview */}
                {images.length > 0 ? (
                    <div className="flex-1 overflow-y-auto p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 content-start">
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
                                        className="p-3 bg-white hover:bg-fuchsia-500 text-black hover:text-white rounded-full transition-colors shadow-xl transform hover:scale-110 z-10"
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

                    <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 font-bold bg-black/50 px-4 py-1 rounded-full text-sm">
                        Click fuera para cerrar
                    </p>
                </div>
            )}

            {/* HIDDEN RENDER CONTAINER (1080x1920) */}
            <div className="fixed left-[-9999px] top-0 pointer-events-none">
                <div ref={containerRef}>

                    {/* SLIDE 1: COVER */}
                    <div className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-center bg-black font-sans overflow-hidden">
                        <img src={`/backgrounds/bg-${config.bgSelection[0]}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1920&fit=crop"} className="absolute inset-0 w-full h-full object-cover" alt="bg" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />

                        <div className="relative z-10 flex flex-col items-center w-full px-12 text-center">
                            <div className="text-[220px] leading-none mb-12 animate-pulse drop-shadow-2xl">
                                {config.coverEmoji}
                            </div>
                            <h1 className="text-9xl font-black text-white leading-tight drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] uppercase mb-6">
                                {config.coverTitle}
                            </h1>
                            <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-pink-400 mb-12 uppercase">
                                {config.coverSubtitle}
                            </h2>
                            <div className="flex items-center gap-4 text-3xl font-bold text-white/70 uppercase tracking-widest bg-black/40 px-6 py-2 rounded-full mb-16 border border-white/10">
                                <span>📅 {formattedDate}</span>
                            </div>
                            {yesterdayProfit && yesterdayProfit > 0 && config.showProfitBadge && (
                                <div className="mt-8 bg-emerald-500 text-white font-black text-5xl px-12 py-8 rounded-[40px] border-4 border-emerald-300 shadow-[0_0_80px_rgba(16,185,129,0.5)] flex items-center gap-6 transform scale-110">
                                    <TrendingUp size={80} />
                                    <span>AYER: +{yesterdayProfit.toFixed(2)}u</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SLIDES 2-4: BETS (Floating UI + Vertical Lists) */}
                    {[
                        { conf: 'safe', title: config.safeTitle, data: predictions?.safe },
                        { conf: 'value', title: config.valueTitle, data: predictions?.value },
                        { conf: 'funbet', title: config.funbetTitle, data: predictions?.funbet }
                    ].map((bet, i) => {
                        const style = BET_CONFIG[bet.conf as keyof typeof BET_CONFIG];
                        const Icon = style.icon;
                        const hasData = !!bet.data;

                        // DETECT PARLAY (Combination of bets) - Handles "+" or newlines
                        const rawPick = bet.data?.pick || "";
                        const isParlay = rawPick.includes('+') || rawPick.includes('\n');
                        const parlayPicks = isParlay
                            ? rawPick.split(/[+\n]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                            : [];

                        return (
                            <div key={i} className="w-[1080px] h-[1920px] relative flex flex-col items-center bg-black font-sans overflow-hidden">
                                <img src={`/backgrounds/bg-${config.bgSelection[i + 1]}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1920&fit=crop"} className="absolute inset-0 w-full h-full object-cover" alt="bg" />
                                <div className="absolute inset-0 bg-black/70 backdrop-blur-[4px]" />

                                {/* NO CONTAINER BOX - FLOATING ELEMENTS */}
                                <div className="relative z-10 w-full h-full flex flex-col p-12 justify-center gap-16">

                                    {/* TITLE */}
                                    <div className="flex flex-col items-center">
                                        <div className={`p-8 rounded-full ${style.bg} ${style.color} mb-6 border-2 ${style.border}`}>
                                            <Icon size={140} strokeWidth={2.5} />
                                        </div>
                                        <h2 className={`text-8xl font-black uppercase text-center ${style.color} drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]`}>
                                            {bet.title}
                                        </h2>
                                    </div>

                                    {hasData ? (
                                        <div className="space-y-12 w-full px-8">
                                            {/* MATCH */}
                                            <div className="bg-white/5 p-10 rounded-[50px] border border-white/10 backdrop-blur-md">
                                                <p className="text-3xl text-white/50 font-bold uppercase tracking-widest mb-4">Partido</p>
                                                <h3 className="text-6xl font-black text-white leading-tight">
                                                    {bet.data?.match}
                                                </h3>
                                            </div>

                                            {/* PRONOSTICO & ODDS */}
                                            <div className={`p-10 rounded-[50px] relative overflow-hidden backdrop-blur-md border border-white/10 bg-black/40`}>
                                                <div className={`absolute left-0 top-0 w-4 h-full ${style.bg.replace('/20', '')}`}></div> {/* Left Accent Line */}

                                                <p className="text-3xl text-white/50 font-bold uppercase tracking-widest mb-6 pl-6">Pronóstico</p>

                                                <div className="pl-6">
                                                    {isParlay ? (
                                                        // PARLAY LAYOUT (Vertical List)
                                                        <div className="flex flex-col gap-4 mb-8">
                                                            {parlayPicks.map((pick: string, idx: number) => {
                                                                // Enhancer: Add "Goles" to "Over" if context is missing
                                                                let displayPick = pick;
                                                                if (displayPick.includes('Over') && !displayPick.toLowerCase().includes('goles') && !displayPick.toLowerCase().includes('cards') && !displayPick.toLowerCase().includes('corners')) {
                                                                    displayPick = displayPick.replace(/Over\s+(\d+\.\d+)/, 'Más de $1 Goles');
                                                                }
                                                                // Translate Win
                                                                displayPick = displayPick.replace(' Win', ' Gana');

                                                                return (
                                                                    <div key={idx} className="flex items-start gap-4">
                                                                        <span className={`${style.color} text-4xl mt-1`}>•</span>
                                                                        <span className="text-5xl font-bold text-white leading-tight">{displayPick}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        // SIMPLE BET LAYOUT
                                                        <h3 className="text-7xl font-black text-white leading-tight mb-6">
                                                            {bet.data.pick}
                                                        </h3>
                                                    )}

                                                    {/* ODDS (New Line for readability) */}
                                                    <div className="flex items-center gap-4 mt-6 border-t border-white/10 pt-6">
                                                        <span className="text-4xl text-white/60 font-medium">Cuota Total:</span>
                                                        <span className={`text-6xl font-black ${style.color}`}>@{bet.data.odd}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ANALYSIS */}
                                            {config.showAnalysis && bet.data?.reason && (
                                                <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 backdrop-blur-sm">
                                                    <p className="text-4xl text-white/80 font-medium leading-relaxed italic">
                                                        "{bet.data.reason.length > 140 ? bet.data.reason.substring(0, 140) + '...' : bet.data.reason}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center">
                                            <p className="text-6xl text-white/20 font-bold">Sin predicción</p>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-12 text-center">
                                        <p className="text-4xl font-bold text-white/30 tracking-widest">BET AI MASTER</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* SLIDE 5: OUTRO */}
                    <div className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-center bg-black font-sans overflow-hidden">
                        <img src={`/backgrounds/bg-${config.bgSelection[4]}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=1920&fit=crop"} className="absolute inset-0 w-full h-full object-cover" alt="bg" />
                        <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-900/90 via-black/80 to-black/60" />

                        <div className="relative z-10 flex flex-col items-center gap-16 w-full px-12 text-center">
                            <h2 className="text-8xl font-black text-white leading-tight whitespace-pre-line uppercase drop-shadow-2xl">
                                {config.outroTitle}
                            </h2>
                            <div className="bg-white text-black p-12 rounded-[50px] w-full shadow-[0_0_80px_rgba(255,255,255,0.3)] transform rotate-[-2deg] mb-12">
                                <p className="text-7xl font-black uppercase mb-4 text-fuchsia-600">{config.outroCTA}</p>
                                <p className="text-4xl font-bold text-gray-800">{config.outroSub}</p>
                            </div>
                            <div className="flex flex-col gap-6 w-full mt-10">
                                <div className="flex items-center gap-8 bg-black/40 p-10 rounded-3xl backdrop-blur-md border border-white/20">
                                    <ShieldCheck size={80} className="text-emerald-400" />
                                    <span className="text-6xl font-black text-white tracking-tight">Transparencia 100%</span>
                                </div>
                                <div className="flex items-center gap-8 bg-black/40 p-10 rounded-3xl backdrop-blur-md border border-white/20">
                                    <TrendingUp size={80} className="text-fuchsia-400" />
                                    <span className="text-6xl font-black text-white tracking-tight">Alta Rentabilidad</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
