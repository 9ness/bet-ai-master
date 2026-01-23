"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2, Settings2, Image as ImageIcon, ChevronRight, ChevronLeft, RefreshCw, Save, ScanEye, X, Copy, Check, LayoutTemplate, Type, Megaphone, Palette, MonitorPlay } from 'lucide-react';
import { triggerTouchFeedback } from '@/utils/haptics';

/* 
 * TIKTOK FACTORY v9.0 - RESPONSIVE BIFURCATION
 * - Mobile: Tabbed Navigation (v8)
 * - Desktop: Split Pane (Settings Left, Preview Right) (Restored v6 style)
 */

type TikTokFactoryProps = {
    predictions: any;
    formattedDate: string;
    rawDate?: string;
};

// --- TAB BUTTON COMPONENT (Mobile Only) ---
const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }: any) => {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                flex flex-col items-center justify-center px-4 py-3 rounded-xl border transition-all min-w-[85px] hover:scale-105 active:scale-95 duration-200 snap-center
                ${isActive
                    ? 'bg-gradient-to-br from-white/10 to-white/5 border-white/20 text-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)]'
                    : 'bg-black/20 border-white/5 text-white/40 hover:bg-white/5 hover:text-white/70'
                }
            `}
        >
            <div className={`mb-1.5 ${isActive ? 'text-emerald-400' : ''}`}>
                <Icon size={20} />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                {label}
            </span>
        </button>
    );
};

export default function TikTokFactory({ predictions, formattedDate, rawDate }: TikTokFactoryProps) {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'editor' | 'portada' | 'bets' | 'outro' | 'bg'>('editor');

    const [generating, setGenerating] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showSocialModal, setShowSocialModal] = useState(false);
    const [socialContent, setSocialContent] = useState<any>(null);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    // --- CONFIG & DATA ---
    const getDayName = () => ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][new Date().getDay()];

    const [config, setConfig] = useState({
        introTitle: `JUBILADORA HOY\n(${getDayName()})`,
        introSubtitle: "",
        introEmoji1: '🤫',
        introEmoji2: '✅',
        outroTitle: "LA MEJOR DE TODAS\nLA DEJAMOS EN\nNUESTRO CANAL",
        outroSub: "ACCEDE DESDE EL PERFIL 🔗",
        bgSelection: [] as string[],
        addHundred: true,
        useFullDate: true
    });

    const [slideGroups, setSlideGroups] = useState<any[]>([]);
    const [currentPreviewIdx, setCurrentPreviewIdx] = useState(0);
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);

    useEffect(() => {
        fetch('/api/social/tiktok').then(res => res.ok ? res.json() : null).then(data => data?.title && setSocialContent(data));
        fetch('/api/backgrounds').then(res => res.json()).then(data => data.files && setAvailableFiles(data.files));
    }, []);

    const handleCopyText = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedStates(prev => ({ ...prev, [key]: true }));
            setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
        });
    };

    const getFormattedDateLong = () => {
        try {
            const dateStr = rawDate || formattedDate;
            const date = new Date(dateStr);
            const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
            const dayNum = date.getDate();
            const monthName = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);
            return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
        } catch (e) { return formattedDate; }
    };

    useEffect(() => {
        if (config.useFullDate) {
            setConfig(prev => ({ ...prev, introTitle: `JUBILADORA HOY\n${getFormattedDateLong()}`, introEmoji1: '⚽', introEmoji2: '📅' }));
        } else {
            setConfig(prev => ({ ...prev, introTitle: `JUBILADORA HOY\n(${getDayName()})`, introEmoji1: '🤫', introEmoji2: '✅' }));
        }
    }, [config.useFullDate]);

    const calculateInitialOdds = (addHundred: boolean) => {
        let totalOdd = 1;
        const rawBets = predictions?.bets || (Array.isArray(predictions) ? predictions : []);
        let found = false;
        if (rawBets.length > 0) {
            rawBets.forEach((b: any) => { const odd = parseFloat(b.total_odd || b.odd); if (!isNaN(odd) && odd > 0) { totalOdd *= odd; found = true; } });
        } else {
            const o1 = parseFloat(predictions?.safe?.total_odd); if (!isNaN(o1)) { totalOdd *= o1; found = true; }
            const o2 = parseFloat(predictions?.value?.total_odd); if (!isNaN(o2)) { totalOdd *= o2; found = true; }
            const o3 = parseFloat(predictions?.funbet?.total_odd); if (!isNaN(o3)) { totalOdd *= o3; found = true; }
        }
        if (!found || totalOdd <= 1.01) return "+??? 📈";
        let oddValue = Math.round(totalOdd * (totalOdd < 10 ? 10 : 1));
        if (addHundred) oddValue *= 10;
        return `+${oddValue} 📈`;
    };

    useEffect(() => setConfig(prev => ({ ...prev, introSubtitle: calculateInitialOdds(prev.addHundred) })), [predictions]);

    const parseBetDisplay = (match: string, pick: string) => {
        if (!match) return { match: "Evento Desconocido", pick: pick || "" };
        const cleanMatch = match.replace(/\s*vs\s*/i, " vs ").trim();
        const teams = cleanMatch.split(" vs ");
        const displayMatch = cleanMatch.split("(")[0].trim();
        let displayPick = pick ? pick.toLowerCase().trim() : "";
        if (displayPick.startsWith("1 ") || displayPick === "1") displayPick = teams[0] || "Local";
        else if (displayPick.startsWith("2 ") || displayPick === "2") displayPick = teams[1] || "Visitante";
        else if (displayPick.startsWith("x ") || displayPick === "x") displayPick = "Empate";
        else {
            displayPick = displayPick.replace(/Apuesta/gi, "").replace(/Gana/gi, "").replace(/\(.*\)/g, "").replace(/\bAH\b/gi, "Hándicap").trim();
            displayPick = displayPick.replace(/\blocal\b/gi, teams[0] || "Local").replace(/\bvisitante\b/gi, teams[1] || "Visitante");

            // Capitalize first letter
            displayPick = displayPick.charAt(0).toUpperCase() + displayPick.slice(1);
        }
        return { match: displayMatch, pick: displayPick };
    };

    const getAllSelections = () => {
        const flatBets: any[] = [];
        const rawBets = predictions?.bets || (Array.isArray(predictions) ? predictions : []);
        if (rawBets.length === 0) {
            if (predictions?.safe) rawBets.push(predictions.safe);
            if (predictions?.value) rawBets.push(predictions.value);
            if (predictions?.funbet) rawBets.push(predictions.funbet);
        }
        rawBets.forEach((bet: any) => {
            if (!bet) return;
            const add = (item: any) => flatBets.push({ ...item, sport: (item.sport || bet.sport || 'football').toLowerCase() });
            if (bet.selections?.length) bet.selections.forEach(add);
            else if (bet.components?.length) bet.components.forEach(add);
            else if (bet.match) add(bet);
        });

        const groups: Record<string, any> = {};
        flatBets.forEach(bet => {
            const { match, pick } = parseBetDisplay(bet.match, bet.pick);
            const key = match.toLowerCase().replace(/\s+/g, '');
            if (!groups[key]) groups[key] = { matchDisplay: match, sport: bet.sport, picks: [], originalBets: [] };
            groups[key].picks.push(pick);
        });

        const groupedList = Object.values(groups);
        const teamsWithBg: any = { football: new Set(), basketball: new Set() };
        availableFiles.forEach(f => {
            if (f.includes('bg-')) {
                const p = f.toLowerCase().split('-');
                if (p.length >= 3) teamsWithBg[f.includes('basket') ? 'basketball' : 'football'].add(p[2]);
            }
        });

        return groupedList.map(g => {
            const sportIcon = (g.sport || '').includes('basket') ? '🏀' : '⚽';
            const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            const mt = clean(g.matchDisplay);
            let isFeatured = false;
            const relevant = teamsWithBg[(g.sport || '').includes('basket') ? 'basketball' : 'football'];
            for (let t of Array.from(relevant) as string[]) if (t !== 'comodin' && mt.includes(clean(t))) isFeatured = true;

            return {
                ...g,
                matchDisplay: `${g.matchDisplay} ${sportIcon}`,
                picks: g.picks.map((p: string) => {
                    const { pick } = parseBetDisplay(g.matchDisplay, p);
                    return `${pick.charAt(0).toUpperCase() + pick.slice(1)} ✅`;
                }),
                isFeatured
            };
        });
    };

    useEffect(() => setSlideGroups(getAllSelections()), [predictions, availableFiles]);

    const slidesData: any[][] = [];
    let currentChunk: any[] = [];
    slideGroups.forEach((item: any) => {
        if (item.isFeatured) {
            if (currentChunk.length > 0) { slidesData.push(currentChunk); currentChunk = []; }
            slidesData.push([item]);
        } else {
            currentChunk.push(item);
            if (currentChunk.length >= 3) { slidesData.push(currentChunk); currentChunk = []; }
        }
    });
    if (currentChunk.length > 0) slidesData.push(currentChunk);

    useEffect(() => {
        if (availableFiles.length && slidesData.length) {
            const newBgs: string[] = [];
            const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
            const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            const portadas = availableFiles.filter(f => f.includes('portada'));
            newBgs.push(portadas.length ? pick(portadas) : 'bg-portada-1.png');
            let last = newBgs[0];
            slidesData.forEach(chunk => {
                let sel = null;
                const mainSport = (chunk[0]?.sport || 'football').toLowerCase();
                for (let g of chunk) {
                    if ((g.sport || '').toLowerCase() !== mainSport) continue;
                    const mts = g.matchDisplay.split(/vs|-/);
                    for (let t of mts) {
                        const ct = clean(t);
                        if (ct.length < 3) continue;
                        const ms = availableFiles.filter(f => !f.includes('comodin') && f.includes(mainSport.includes('basket') ? 'basket' : 'futbol') && clean(f).includes(ct));
                        if (ms.length) { sel = pick(ms); break; }
                    }
                    if (sel) break;
                }
                if (!sel) {
                    const coms = availableFiles.filter(f => f.includes('comodin') && f.includes(mainSport.includes('basket') ? 'basket' : 'futbol'));
                    const av = coms.filter(c => c !== last);
                    sel = av.length ? pick(av) : (pick(coms) || 'bg-comodin.png');
                }
                newBgs.push(sel);
                last = sel;
            });
            const outros = availableFiles.filter(f => f.includes('futbol') && f.includes('comodin'));
            newBgs.push(outros.length ? pick(outros) : 'bg-outro.png');
            setConfig(p => ({ ...p, bgSelection: newBgs }));
        }
    }, [availableFiles, slidesData.length]);

    const handleBgChange = (i: number, bg: string) => { const n = [...config.bgSelection]; n[i] = bg; setConfig(p => ({ ...p, bgSelection: n })); };
    const generate = async () => {
        if (!containerRef.current) return;
        setGenerating(true); setImages([]);
        await new Promise(r => setTimeout(r, 800));
        const imgs = [];
        for (let c of Array.from(containerRef.current.children) as HTMLElement[]) {
            try { const cvs = await html2canvas(c, { scale: 1, useCORS: true, width: 1080, height: 1350 }); imgs.push(cvs.toDataURL('image/png')); } catch (e) { }
        }
        setImages(imgs); setGenerating(false);
    }
    const download = (url: string, i: number) => { const a = document.createElement('a'); a.href = url; a.download = `slide-${i + 1}.png`; a.click(); };
    const downloadAll = () => images.forEach((img, i) => download(img, i));
    const smartSelectBackgrounds = () => setAvailableFiles([...availableFiles]); // Toggle for effect re-run


    // --- RENDER ---
    return (
        <div className="max-w-[1600px] mx-auto pb-10 space-y-6">

            {/* === MOBILE LAYOUT (Tabs) === */}
            <div className="md:hidden space-y-6">
                {/* 1. TOP NAVIGATION */}
                <div className="flex items-center justify-start gap-3 overflow-x-auto pb-2 scrollbar-hide px-2 snap-x">
                    <TabButton id="editor" label="Editor" icon={MonitorPlay} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="portada" label="Portada" icon={LayoutTemplate} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="bets" label="Apuestas" icon={Type} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="outro" label="Cierre" icon={Megaphone} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="bg" label="Fondos" icon={Palette} activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>

                {/* 2. CONTENT AREA */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-[500px]">
                    {/* TAB 1: EDITOR */}
                    {activeTab === 'editor' && (
                        <div className="w-full max-w-lg mx-auto flex flex-row items-center justify-center gap-4 px-2">
                            <div className="relative aspect-[9/16] w-full max-w-[200px] bg-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden group shrink-0">
                                {images.length > 0 ? (
                                    <div className="w-full h-full relative group">
                                        <img src={images[currentPreviewIdx]} alt="Slide" className="w-full h-full object-contain" />
                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                            <button onClick={() => setCurrentPreviewIdx(Math.max(0, currentPreviewIdx - 1))} className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur"><ChevronLeft className="text-white" size={16} /></button>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPreviewImg(images[currentPreviewIdx])} className="p-2 bg-white text-black rounded-lg hover:scale-110 transition"><ScanEye size={16} /></button>
                                                <button onClick={() => download(images[currentPreviewIdx], currentPreviewIdx)} className="p-2 bg-emerald-500 text-white rounded-lg hover:scale-110 transition"><Download size={16} /></button>
                                            </div>
                                            <button onClick={() => setCurrentPreviewIdx(Math.min(images.length - 1, currentPreviewIdx + 1))} className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur"><ChevronRight className="text-white" size={16} /></button>
                                        </div>
                                        <div className="absolute top-4 right-4 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white/50 border border-white/5">{currentPreviewIdx + 1}/{images.length}</div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4 bg-[#0a0a0a]">
                                        <div className="p-6 rounded-full bg-white/5 animate-pulse"><ImageIcon size={32} /></div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-center">Vista<br />Previa</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 w-[100px] shrink-0">
                                <button onClick={() => setShowSocialModal(true)} disabled={!socialContent} className="btn-active-effect bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 font-bold py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 h-[70px]"><ScanEye size={18} /><span className="text-[9px] uppercase">Viral</span></button>
                                <button onClick={generate} disabled={generating} className="btn-active-effect bg-white hover:bg-gray-200 text-black font-black py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-white/10 h-[70px]">{generating ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />} <span className="text-[9px] uppercase">{generating ? '...' : 'Generar'}</span></button>
                                <button onClick={() => images.forEach((img, i) => download(img, i))} disabled={!images.length} className="btn-active-effect bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/20 disabled:opacity-50 h-[70px]"><Save size={18} /><span className="text-[9px] uppercase">Bajar</span></button>
                            </div>
                        </div>
                    )}
                    {/* TAB 2: PORTADA */}
                    {activeTab === 'portada' && (
                        <div className="w-full max-w-lg mx-auto bg-[#121212] border border-white/10 rounded-2xl p-6 space-y-6">
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">Título Principal</label><textarea value={config.introTitle} onChange={e => setConfig({ ...config, introTitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[80px] focus:border-emerald-500/50 outline-none" /><div className="mt-2 flex items-center gap-2"><input type="checkbox" checked={config.useFullDate} onChange={(e) => setConfig({ ...config, useFullDate: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><label className="text-[10px] text-white/50">Fecha Larga + Iconos</label></div></div>
                                <div className="grid grid-cols-2 gap-3"><div><label className="text-[9px] text-white/30 uppercase mb-1 block">Emoji 1</label><input value={config.introEmoji1} onChange={e => setConfig({ ...config, introEmoji1: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-center text-white" /></div><div><label className="text-[9px] text-white/30 uppercase mb-1 block">Emoji 2</label><input value={config.introEmoji2} onChange={e => setConfig({ ...config, introEmoji2: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-center text-white" /></div></div>
                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-emerald-400 uppercase">Cuota Sticker</label><div className="flex items-center gap-1"><input type="checkbox" checked={config.addHundred} onChange={(e) => { const c = e.target.checked; let val = parseInt(config.introSubtitle.replace(/\D/g, '')) || 0; setConfig({ ...config, addHundred: c, introSubtitle: `+${c ? val * 10 : Math.round(val / 10)} 📈` }) }} className="accent-emerald-500 w-3 h-3" /><span className="text-[9px] text-white/50">x10</span></div></div><input value={config.introSubtitle} onChange={e => setConfig({ ...config, introSubtitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50" /></div>
                            </div>
                        </div>
                    )}
                    {/* TAB 3: APUESTAS */}
                    {activeTab === 'bets' && (
                        <div className="w-full max-w-lg mx-auto bg-[#121212] border border-white/10 rounded-2xl p-4">
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                {!slideGroups.length && <p className="text-center text-xs text-white/30 py-8">No hay apuestas cargadas</p>}
                                {slideGroups.map((group: any, gIdx: number) => (<div key={gIdx} className="bg-black/30 rounded-xl p-3 border border-white/5 hover:border-sky-500/30 transition-colors"><div className="flex items-center gap-2 mb-2"><input value={group.matchDisplay} onChange={(e) => { const n = [...slideGroups]; n[gIdx].matchDisplay = e.target.value; setSlideGroups(n); }} className="bg-transparent border-b border-white/10 w-full text-xs font-bold text-sky-400 focus:border-sky-500 outline-none pb-1" /><button onClick={() => { const n = [...slideGroups]; n[gIdx].isFeatured = !n[gIdx].isFeatured; setSlideGroups(n); }} className={`p-1.5 rounded-lg border ${group.isFeatured ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white/5 border-white/5 text-white/20'}`}><ScanEye size={12} /></button></div><div className="space-y-1 pl-2 border-l border-white/10">{group.picks.map((pick: string, pIdx: number) => (<input key={pIdx} value={pick} onChange={(e) => { const n = [...slideGroups]; n[gIdx].picks[pIdx] = e.target.value; setSlideGroups(n); }} className="bg-transparent w-full text-[10px] text-white/60 focus:text-white outline-none" />))}</div></div>))}
                            </div>
                        </div>
                    )}
                    {/* TAB 4: CIERRE */}
                    {activeTab === 'outro' && (
                        <div className="w-full max-w-lg mx-auto bg-[#121212] border border-white/10 rounded-2xl p-6 space-y-6">
                            <div><label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-2">Título Cierre</label><textarea value={config.outroTitle} onChange={e => setConfig({ ...config, outroTitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[60px] focus:border-purple-500/50 outline-none" /></div>
                            <div><label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-2">Subtítulo</label><textarea value={config.outroSub} onChange={e => setConfig({ ...config, outroSub: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[50px] focus:border-purple-500/50 outline-none" /></div>
                        </div>
                    )}
                    {/* TAB 5: FONDOS */}
                    {activeTab === 'bg' && (
                        <div className="w-full max-w-lg mx-auto bg-[#121212] border border-white/10 rounded-2xl p-6">
                            <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar p-1 mb-4">
                                {config.bgSelection.map((bg, i) => (<div key={i} className="group relative"><div className="aspect-[9/16] rounded-lg overflow-hidden border border-white/10 relative"><img src={`/backgrounds/${bg}`} className="w-full h-full object-cover" alt="bg" /><div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><button onClick={() => handleBgChange(i, availableFiles[Math.floor(Math.random() * availableFiles.length)])} className="p-1.5 bg-amber-500 rounded-full text-black hover:scale-110"><RefreshCw size={12} /></button></div></div><p className="text-[8px] text-center text-white/30 mt-1">Slide {i + 1}</p></div>))}
                            </div>
                            <button onClick={() => { setAvailableFiles([...availableFiles]); }} className="w-full py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition flex items-center justify-center gap-2"><RefreshCw size={14} /> REGENERAR TODOS</button>
                        </div>
                    )}
                </div>
            </div>

            {/* === DESKTOP LAYOUT (SPLIT PANE) === */}
            <div className="hidden md:flex w-full max-w-full min-h-[85vh] gap-6 p-6 bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl items-start overflow-visible">
                {/* LEFT: SETTINGS (Full Height, No Scroll) */}
                <div className="w-[35%] shrink-0 flex flex-col gap-6">
                    <div className="flex items-center gap-2 text-white/50 border-b border-white/10 pb-4"><Settings2 size={20} /><h2 className="text-xl font-bold text-white">Configuración</h2></div>

                    {/* GROUP 1: PORTADA */}
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><LayoutTemplate size={16} /> Portada</h3>
                        <div><label className="text-[10px] text-white/40 font-bold uppercase block mb-1">Título</label><textarea value={config.introTitle} onChange={e => setConfig({ ...config, introTitle: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[70px] focus:border-emerald-500/50 outline-none" /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.useFullDate} onChange={(e) => setConfig({ ...config, useFullDate: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Fecha Larga</span></div>
                            <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.addHundred} onChange={(e) => { const c = e.target.checked; let val = parseInt(config.introSubtitle.replace(/\D/g, '')) || 0; setConfig({ ...config, addHundred: c, introSubtitle: `+${c ? val * 10 : Math.round(val / 10)} 📈` }) }} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Cuota x10</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input value={config.introEmoji1} onChange={e => setConfig({ ...config, introEmoji1: e.target.value })} className="bg-black/40 border border-white/10 rounded-lg p-2 text-center text-white" placeholder="Emoji 1" />
                            <input value={config.introEmoji2} onChange={e => setConfig({ ...config, introEmoji2: e.target.value })} className="bg-black/40 border border-white/10 rounded-lg p-2 text-center text-white" placeholder="Emoji 2" />
                        </div>
                        <input value={config.introSubtitle} onChange={e => setConfig({ ...config, introSubtitle: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50" placeholder="Texto Cuota" />
                    </div>

                    {/* GROUP 2: APUESTAS */}
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2"><Type size={16} /> Apuestas ({slideGroups.length})</h3>
                        <div className="space-y-3">
                            {slideGroups.map((group, idx) => (
                                <div key={idx} className="bg-black/30 p-3 rounded-xl border border-white/5 hover:border-sky-500/20">
                                    <div className="flex gap-2 mb-2"><input value={group.matchDisplay} onChange={e => { const n = [...slideGroups]; n[idx].matchDisplay = e.target.value; setSlideGroups(n) }} className="bg-transparent border-b border-white/10 w-full text-xs font-bold text-sky-300 focus:border-sky-500 outline-none" /><button onClick={() => { const n = [...slideGroups]; n[idx].isFeatured = !n[idx].isFeatured; setSlideGroups(n) }} className={`p-1 rounded ${group.isFeatured ? 'bg-sky-500 text-white' : 'text-white/20'}`}><ScanEye size={12} /></button></div>
                                    <div className="pl-2 border-l border-white/10 space-y-1">{group.picks.map((p: string, i: number) => <input key={i} value={p} onChange={e => { const n = [...slideGroups]; n[idx].picks[i] = e.target.value; setSlideGroups(n) }} className="bg-transparent w-full text-[10px] text-white/50 focus:text-white outline-none" />)}</div>
                                </div>
                            ))}
                            {!slideGroups.length && <p className="text-xs text-center text-white/20 py-4">Sin datos</p>}
                        </div>
                    </div>

                    {/* GROUP 3: CIERRE */}
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-4">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2"><Megaphone size={16} /> Cierre</h3>
                        <textarea value={config.outroTitle} onChange={e => setConfig({ ...config, outroTitle: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[60px] focus:border-purple-500/50 outline-none" placeholder="Título Cierre" />
                        <textarea value={config.outroSub} onChange={e => setConfig({ ...config, outroSub: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[50px] focus:border-purple-500/50 outline-none" placeholder="Subtítulo" />
                    </div>

                    {/* GROUP 4: FONDOS */}
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2"><Palette size={16} /> Fondos</h3><button onClick={() => smartSelectBackgrounds()} className="text-[10px] font-bold text-amber-500 hover:underline">Regenerar</button></div>
                        <div className="grid grid-cols-4 gap-2 p-1">
                            {config.bgSelection.map((bg, i) => (
                                <div key={i} className="group relative aspect-[9/16] rounded overflow-hidden border border-white/10 cursor-pointer" onClick={() => handleBgChange(i, availableFiles[Math.floor(Math.random() * availableFiles.length)])}>
                                    <img src={`/backgrounds/${bg}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"><RefreshCw size={12} className="text-white" /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: PREVIEW (Sticky) */}
                <div className="flex-1 min-w-0 bg-[#121212] rounded-2xl border border-white/5 flex flex-col relative overflow-hidden sticky top-6 h-[85vh]">
                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />

                    {/* PREVIEW IMAGE AREA */}
                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100">
                        {images.length > 0 ? (
                            <div className="relative h-full max-h-[700px] aspect-[9/16] shadow-2xl rounded-xl overflow-hidden group">
                                <img src={images[currentPreviewIdx]} className="w-full h-full object-contain bg-black" />
                                <div className="absolute inset-x-0 bottom-0 p-8 flex border-t border-white/10 justify-center gap-8 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => setCurrentPreviewIdx(Math.max(0, currentPreviewIdx - 1))} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition"><ChevronLeft className="text-white" size={24} /></button>
                                    <button onClick={() => setCurrentPreviewIdx(Math.min(images.length - 1, currentPreviewIdx + 1))} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition"><ChevronRight className="text-white" size={24} /></button>
                                </div>
                                <div className="absolute top-6 right-6 px-3 py-1 bg-black/60 rounded-full border border-white/10 text-xs font-bold text-white/70">{currentPreviewIdx + 1} / {images.length}</div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 opacity-30"><ImageIcon size={64} /><p className="text-xl font-bold uppercase tracking-widest">Listo para Generar</p></div>
                        )}
                    </div>

                    {/* BOTTOM BAR ACTION AREA */}
                    <div className="h-20 bg-black/40 border-t border-white/5 backdrop-blur flex items-center justify-between px-8">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowSocialModal(true)} disabled={!socialContent} className="px-6 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-xs uppercase tracking-wider hover:bg-purple-500/20 transition flex items-center gap-2"><ScanEye size={16} /> Ver Viral Content</button>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={generate} disabled={generating} className="px-8 py-3 rounded-xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition shadow-lg shadow-white/10 flex items-center gap-2">{generating ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />} {generating ? 'Generando...' : 'Generar Slides'}</button>
                            <button onClick={downloadAll} disabled={!images.length} className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50"><Save size={16} /> Bajar Todo</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL & RENDERER (Cleaned up) */}
            {showSocialModal && socialContent && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur p-4 text-left">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-white flex gap-2 items-center">📱 Viral Content</h3><button onClick={() => setShowSocialModal(false)} className="text-white/50"><X size={24} /></button></div>
                        <div className="space-y-2"><label className="text-[10px] text-emerald-400 font-bold uppercase">Título</label><div className="flex gap-2"><div className="flex-1 bg-black/50 p-2 rounded text-white text-sm">{socialContent.title}</div><button onClick={() => handleCopyText(socialContent.title, 't')} className="p-2 bg-white/10 rounded hover:bg-white/20 text-white">{copiedStates['t'] ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
                        <div className="space-y-2"><label className="text-[10px] text-purple-400 font-bold uppercase">Caption</label><div className="flex gap-2"><div className="flex-1 bg-black/50 p-2 rounded text-white/80 text-xs max-h-32 overflow-y-auto">{socialContent.description || socialContent.caption}</div><button onClick={() => handleCopyText(socialContent.description || socialContent.caption, 'c')} className="p-2 bg-white/10 rounded hover:bg-white/20 text-white h-fit">{copiedStates['c'] ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
                    </div>
                </div>
            )}

            {previewImg && <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}><img src={previewImg} className="h-full object-contain rounded-xl shadow-2xl" /></div>}

            {/* HIDDEN RENDERER */}
            <div className="fixed top-0 left-0 z-[-9999] opacity-0 pointer-events-none">
                <div ref={containerRef} style={{ width: 1080, height: 1350 }}>
                    {/* 
                       RENDER LOGIC (Identical Structure as before) 
                     */}
                    <div className="w-[1080px] relative flex flex-col items-center justify-center font-sans overflow-hidden bg-black" style={{ height: 1350 }}>
                        <img src={getImageSrc(config.bgSelection[0])} onError={(e) => e.currentTarget.src = "https://placehold.co/1080x1350/1a1a1a/FFF?text=Error+BG"} width={1080} height={1350} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" alt="bg" />
                        <div className="absolute inset-0 z-0 bg-black/5" />
                        <div className="relative z-10 w-full flex flex-col items-center gap-14 p-8">
                            {/* TITLE */}
                            <div className="flex flex-col items-center gap-4 w-full">
                                <div className="bg-white px-12 pt-2 pb-6 rounded-2xl w-fit max-w-[90%] flex items-center justify-center"><h1 className="text-6xl font-black text-black tracking-tighter leading-tight whitespace-nowrap text-center pb-5">{config.introTitle.split('\n')[0]}</h1></div>
                                <div className="bg-white px-12 pt-2 pb-4 rounded-2xl flex items-center justify-center gap-6 w-fit max-w-[95%]"><h1 className="text-5xl font-black text-black tracking-tighter leading-tight whitespace-nowrap pb-5">{config.introTitle.split('\n')[1] || ''}</h1><div className="flex items-center gap-4 pb-5">{config.introEmoji1 && <span className="text-5xl filter drop-shadow">{config.introEmoji1}</span>}{config.introEmoji2 && <span className="text-5xl filter drop-shadow">{config.introEmoji2}</span>}</div></div>
                            </div>
                            {config.introSubtitle && <div className="bg-white px-14 pt-4 pb-8 rounded-2xl mt-8 flex items-center justify-center"><span className="text-6xl font-black text-black uppercase tracking-tighter leading-none pb-5">{config.introSubtitle}</span></div>}
                        </div>
                    </div>

                    {slidesData.map((chunk, slideIdx) => (
                        <div key={slideIdx} className="w-[1080px] relative flex flex-col items-center justify-center font-sans overflow-hidden bg-black" style={{ height: 1350 }}>
                            <img src={getImageSrc(config.bgSelection[slideIdx + 1])} width={1080} height={1350} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" alt="bg" />
                            <div className="absolute inset-0 z-0 bg-black/5" />
                            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 gap-16 pb-[80px]">
                                {chunk.map((group: any, bIdx: number) => (
                                    <div key={bIdx} className="w-full flex flex-col items-center gap-4">
                                        <div className="bg-black px-8 pt-2 pb-4 rounded-xl max-w-[95%] border-2 border-black flex items-center justify-center text-center"><h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight whitespace-pre-wrap break-words pb-5">{group.matchDisplay}</h3></div>
                                        {group.picks.map((pick: string, pIdx: number) => (
                                            <div key={pIdx} className="bg-white px-8 pt-2 pb-4 rounded-xl max-w-[95%] flex items-center justify-center text-center mt-[-10px]"><span className="text-3xl font-black text-black tracking-tight leading-tight whitespace-pre-wrap break-words pb-5">{pick}</span></div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="w-[1080px] relative flex flex-col items-center justify-center gap-16 font-sans overflow-hidden bg-black" style={{ height: 1350 }}>
                        <img src={getImageSrc(config.bgSelection[slidesData.length + 1])} width={1080} height={1350} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" alt="bg" />
                        <div className="absolute inset-0 z-0 bg-black/5" />
                        <div className="relative z-10 w-full flex flex-col items-center gap-16 p-12">
                            <div className="bg-white px-10 py-10 rounded-2xl max-w-[95%] text-center"><h2 className="text-6xl font-black text-black uppercase tracking-tighter leading-tight whitespace-pre-line">{config.outroTitle}</h2></div>
                            <div className="bg-white px-12 py-6 rounded-2xl"><p className="text-3xl font-black text-black uppercase tracking-tight">{config.outroSub}</p></div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

function getImageSrc(bg: string | undefined) {
    if (!bg) return "/backgrounds/bg-portada-1.png";
    return bg.includes('.') ? `/backgrounds/${bg}` : `/backgrounds/${bg}`;
}
