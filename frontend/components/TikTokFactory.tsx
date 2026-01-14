"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2, Settings2, Image as ImageIcon, ChevronDown, ChevronRight, ChevronLeft, RefreshCw, Save, ScanEye, Link as LinkIcon, X } from 'lucide-react';

/* 
 * TIKTOK FACTORY v6.0 - SMART BACKGROUND ENGINE
 * - Backgrounds fetched from API
 * - Smart selection based on Team/Sport/Slide Type
 * - Intro: "Portada" | Outro: "Futbol" + "Comodin"
 */

type TikTokFactoryProps = {
    predictions: any;
    formattedDate: string;
};

export default function TikTokFactory({ predictions, formattedDate }: TikTokFactoryProps) {
    const [generating, setGenerating] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Dynamic date for default title
    const getDayName = () => {
        const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
        return days[new Date().getDay()];
    };

    // Helper: Calculate Total Odds for Initial State
    const calculateInitialOdds = () => {
        let total = 1;
        const rawBets = predictions?.bets || (Array.isArray(predictions) ? predictions : []);
        let found = false;

        if (rawBets.length > 0) {
            rawBets.forEach((b: any) => {
                const odd = parseFloat(b.total_odd || b.odd);
                if (!isNaN(odd) && odd > 0) {
                    total *= odd;
                    found = true;
                }
            });
        } else {
            const o1 = parseFloat(predictions?.safe?.total_odd || predictions?.safe?.odd);
            const o2 = parseFloat(predictions?.value?.total_odd || predictions?.value?.odd);
            const o3 = parseFloat(predictions?.funbet?.total_odd || predictions?.funbet?.odd);

            if (!isNaN(o1)) { total *= o1; found = true; }
            if (!isNaN(o2)) { total *= o2; found = true; }
            if (!isNaN(o3)) { total *= o3; found = true; }
        }

        if (!found || total <= 1.01) return "+??? 📈";
        return `+${Math.floor(total)} 📈`;
    };

    // Config State
    const [config, setConfig] = useState({
        // Slide 1: Intro
        introTitle: `JUBILADORA HOY\n(${getDayName()})`,
        introSubtitle: calculateInitialOdds(),
        introEmoji1: '🤫',
        introEmoji2: '✅',

        // Slide Last: Outro
        outroTitle: "LA MEJOR DE TODAS\nLA DEJAMOS EN\nNUESTRO CANAL",
        outroSub: "ACCEDE DESDE EL PERFIL 🔗",

        // Backgrounds (using strings now)
        bgSelection: ['1', '2', '3', '4', '5', '6', '7', '8'] as string[]
    });

    const [collapsed, setCollapsed] = useState({
        intro: false,
        outro: false,
        bg: true
    });
    const [currentPreviewIdx, setCurrentPreviewIdx] = useState(0);

    // Auto-collapse on mobile
    useEffect(() => {
        if (window.innerWidth < 768) {
            setCollapsed({ intro: true, outro: true, bg: true });
        }
    }, []);

    // Helper: Parse Match and Pick
    const parseBetDisplay = (match: string, pick: string) => {
        if (!match) return { match: "Evento Desconocido", pick: pick || "" };

        // Clean Match Name
        const cleanMatch = match.replace(/\s*vs\s*/i, " vs ").trim();
        const teams = cleanMatch.split(" vs ");
        const home = teams[0] ? teams[0].trim() : "Local";
        const away = teams[1] ? teams[1].trim() : "Visitante";

        const displayMatch = cleanMatch.split("(")[0].trim();

        // Process Pick
        let displayPick = pick;
        const p = pick ? pick.toLowerCase().trim() : "";

        if (p.startsWith("1 ") || p === "1" || p.includes("(local gana)")) {
            displayPick = home;
        } else if (p.startsWith("2 ") || p === "2" || p.includes("(visitante gana)")) {
            displayPick = away;
        } else if (p.startsWith("x ") || p === "x" || p.includes("empate")) {
            displayPick = `Empate`;
        } else {
            // General cleanup
            displayPick = pick
                .replace(/Apuesta/gi, "")
                .replace(/Gana/gi, "")
                .replace(/\(.*\)/g, "")
                .replace(/AH/g, "Hándicap")
                .trim();

            // Replace generic 'Local'/'Visitante' with Team Names
            const homeRegex = new RegExp(/\blocal\b/, 'gi');
            const awayRegex = new RegExp(/\bvisitante\b/, 'gi');
            displayPick = displayPick.replace(homeRegex, home).replace(awayRegex, away);

            if (displayPick === "1") displayPick = home;
            if (displayPick === "2") displayPick = away;
        }

        return {
            match: displayMatch,
            pick: displayPick
        };
    };

    // Prepare All Bets (Flatten Logic)
    const getAllSelections = () => {
        const all: any[] = [];
        const rawBets = predictions?.bets || (Array.isArray(predictions) ? predictions : []);

        if (rawBets.length === 0) {
            if (predictions?.safe) rawBets.push(predictions.safe);
            if (predictions?.value) rawBets.push(predictions.value);
            if (predictions?.funbet) rawBets.push(predictions.funbet);
        }

        rawBets.forEach((bet: any) => {
            if (!bet) return;
            const parentSport = bet.sport;

            if (bet.selections && Array.isArray(bet.selections) && bet.selections.length > 0) {
                bet.selections.forEach((sel: any) => {
                    all.push({
                        ...sel,
                        sport: (sel.sport || parentSport || 'football').toLowerCase()
                    });
                });
            }
            else if (bet.components && Array.isArray(bet.components) && bet.components.length > 0) {
                bet.components.forEach((comp: any) => {
                    all.push({
                        ...comp,
                        sport: (comp.sport || parentSport || 'football').toLowerCase()
                    });
                });
            }
            else if (bet.match && bet.pick) {
                all.push({
                    ...bet,
                    sport: (bet.sport || parentSport || 'football').toLowerCase()
                });
            }
        });

        // Sort: Football first, then others (Basketball)
        return all.sort((a, b) => {
            const sportA = (a.sport || 'football').toLowerCase();
            const sportB = (b.sport || 'football').toLowerCase();

            if (sportA === 'football' && sportB !== 'football') return -1;
            if (sportA !== 'football' && sportB === 'football') return 1;
            return 0;
        });
    };

    const allSelections = getAllSelections();

    // Chunk Logic: 3 per slide
    const slidesData: any[][] = [];
    for (let i = 0; i < allSelections.length; i += 3) {
        slidesData.push(allSelections.slice(i, i + 3));
    }

    // Balance Logic: Avoid 3-1 split, prefer 2-2
    if (slidesData.length > 1) {
        const lastIdx = slidesData.length - 1;
        // If last slide has 1 item and prev has 3, move one over
        if (slidesData[lastIdx].length === 1 && slidesData[lastIdx - 1].length === 3) {
            const itemToMove = slidesData[lastIdx - 1].pop();
            if (itemToMove) {
                slidesData[lastIdx].unshift(itemToMove);
            }
        }
    }

    const toggleSection = (section: keyof typeof collapsed) => {
        setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const [availableFiles, setAvailableFiles] = useState<string[]>([]);

    useEffect(() => {
        // Fetch available backgrounds
        fetch('/api/backgrounds')
            .then(res => res.json())
            .then(data => {
                if (data.files && Array.isArray(data.files)) {
                    setAvailableFiles(data.files);
                }
            })
            .catch(err => console.error("Error fetching backgrounds:", err));
    }, []);

    useEffect(() => {
        if (availableFiles.length > 0 && slidesData.length > 0) {
            smartSelectBackgrounds();
        } else if (availableFiles.length === 0) {
            // Fallback legacy if no API data yet
            randomizeBackgroundsLegacy();
        }
    }, [availableFiles, slidesData.length]);

    const handleBgChange = (index: number, bgId: string) => {
        const newBgs = [...config.bgSelection];
        newBgs[index] = bgId;
        setConfig(prev => ({ ...prev, bgSelection: newBgs }));
    };

    // Legacy randomizer (numeric 1-8)
    const randomizeBackgroundsLegacy = () => {
        const count = slidesData.length + 2;
        const shuffled = Array.from({ length: Math.max(count, 15) }, (_, i) => (i % 8) + 1)
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => String(value));
        setConfig(prev => ({ ...prev, bgSelection: shuffled }));
    };

    const smartSelectBackgrounds = () => {
        const newSelection: any[] = [];

        // Helper: Get random item from array
        const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

        // Helper: clean string for comparison (remove accents, spaces, lowercase)
        const cleanStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        // 1. COVER (Intro) - Must contain "portada"
        const portadas = availableFiles.filter(f => f.toLowerCase().includes('portada'));
        newSelection.push(portadas.length > 0 ? pickRandom(portadas) : '1'); // Index 0

        // 2. BET SLIDES
        slidesData.forEach((chunk) => {
            let selectedBg = null;
            const mainSport = (chunk[0]?.sport || 'football').toLowerCase();

            // Try to find Team Match (ONLY for bets matching the main sport)
            for (const bet of chunk) {
                const currentSport = (bet.sport || 'football').toLowerCase();
                if (currentSport !== mainSport) continue;

                const { match } = parseBetDisplay(bet.match, bet.pick);
                // "Home vs Away" -> ["Home", "Away"]
                // Use robust regex split for VS, vs, or hyphen
                const teams = match.split(/\s*vs\s*|\s*-\s*/i).map(t => t.trim()).filter(Boolean);

                for (const team of teams) {
                    const cleanTeam = cleanStr(team);
                    if (cleanTeam.length < 3) continue; // Skip short names

                    // Find files containing this team name
                    const matches = availableFiles.filter(f => cleanStr(f).includes(cleanTeam));

                    if (matches.length > 0) {
                        selectedBg = pickRandom(matches);
                        break; // Found high priority
                    }
                }
                if (selectedBg) break; // Found match for this slide
            }

            // Fallback: Sport + Comodin
            if (!selectedBg) {
                // Priority: Sport of the FIRST bet in the slide
                const keyword = mainSport === 'basketball' ? 'basket' : 'futbol';

                const comodines = availableFiles.filter(f =>
                    f.toLowerCase().includes(keyword) &&
                    f.toLowerCase().includes('comodin')
                );

                if (comodines.length > 0) {
                    selectedBg = pickRandom(comodines);
                }
            }

            newSelection.push(selectedBg || '2');
        });

        // 3. OUTRO (Last) - Must contain "futbol" AND "comodin"
        const outroFiles = availableFiles.filter(f =>
            f.toLowerCase().includes('futbol') &&
            f.toLowerCase().includes('comodin')
        );

        // Try to pick one different from the last used slide if possible, otherwise random
        let outroBg = outroFiles.length > 0 ? pickRandom(outroFiles) : '3';
        newSelection.push(outroBg);

        setConfig(prev => ({ ...prev, bgSelection: newSelection }));
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
                    backgroundColor: null,
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
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-emerald-900/20 to-teal-900/20">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings2 className="text-emerald-500" size={20} />
                        Editor Jubiladora
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {/* SECTION 1: INTRO */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('intro')} className="w-full flex justify-between items-center p-2 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">👋 Portada</span>
                            {collapsed.intro ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.intro && (
                            <div className="p-4 space-y-3 border-t border-white/10">
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Título Principal</label>
                                    <textarea value={config.introTitle} onChange={e => setConfig({ ...config, introTitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm h-16" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-white/50 block mb-1">Emoji 1</label>
                                        <input value={config.introEmoji1} onChange={e => setConfig({ ...config, introEmoji1: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm text-center" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-white/50 block mb-1">Emoji 2</label>
                                        <input value={config.introEmoji2} onChange={e => setConfig({ ...config, introEmoji2: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm text-center" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Cuota (Texto Editable)</label>
                                    <input value={config.introSubtitle} onChange={e => setConfig({ ...config, introSubtitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: OUTRO */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('outro')} className="w-full flex justify-between items-center p-2 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">🔚 Cierre</span>
                            {collapsed.outro ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.outro && (
                            <div className="p-4 space-y-3 border-t border-white/10">
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Mensaje Final</label>
                                    <textarea value={config.outroTitle} onChange={e => setConfig({ ...config, outroTitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm h-16" />
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 block mb-1">Call to Action</label>
                                    <input value={config.outroSub} onChange={e => setConfig({ ...config, outroSub: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: BACKGROUNDS */}
                    <div className="hidden border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('bg')} className="w-full flex justify-between items-center p-4 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">🎨 Fondos</span>
                            {collapsed.bg ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.bg && (
                            <div className="p-4 space-y-4 border-t border-white/10">

                                {Array.from({ length: slidesData.length + 2 }).map((_, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <span className="text-xs text-white/50">Slide {idx + 1}</span>
                                        <select
                                            value={config.bgSelection[idx] || '1'}
                                            onChange={(e) => handleBgChange(idx, e.target.value)}
                                            className="bg-black/50 border border-white/10 rounded text-xs p-1 text-white w-32 truncate"
                                        >
                                            {availableFiles.length > 0 ? (
                                                availableFiles.map(f => <option key={f} value={f}>{f}</option>)
                                            ) : (
                                                [1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={String(n)}>Fondo {n}</option>)
                                            )}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-black/20">
                    <div className="flex gap-2">
                        {/* GENERATE BUTTON */}
                        <button
                            onClick={generateImages}
                            disabled={generating}
                            className="flex-1 bg-white hover:bg-gray-200 text-black font-bold py-3 text-xs rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {generating ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                            {generating ? 'RENDERING...' : 'GENERAR'}
                        </button>

                        {/* DOWNLOAD ALL BUTTON */}
                        <button
                            onClick={downloadAll}
                            disabled={images.length === 0}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-xs rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Save size={16} /> BAJAR TODO
                        </button>
                    </div>
                    {allSelections.length === 0 && (
                        <p className="text-center text-red-400 text-[10px] mt-1">⚠️ No se encontraron apuestas</p>
                    )}
                    <p className="text-center text-white/30 text-[10px] mt-1">{slidesData.length} diapositivas de apuestas (+2 portada/final)</p>
                </div>
            </div>

            {/* RIGHT: PREVIEW PANEL */}
            <div className="flex-1 bg-black/80 flex flex-col min-h-[300px] md:h-full overflow-hidden relative">
                {images.length > 0 ? (
                    <div className="flex-1 overflow-y-auto p-2 md:p-8 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-4 w-full justify-center">
                            <button
                                onClick={() => setCurrentPreviewIdx(prev => Math.max(0, prev - 1))}
                                disabled={currentPreviewIdx === 0}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={32} className="text-white" />
                            </button>

                            <div className="relative aspect-[9/16] h-auto max-h-[55vh] bg-transparent rounded-lg overflow-hidden border border-white/10 shadow-2xl group">
                                <img src={images[currentPreviewIdx]} alt={`Slide ${currentPreviewIdx}`} className="w-full h-full object-contain" />

                                {/* Overlay Controls - Bottom Aligned */}
                                <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center gap-12 pb-8">
                                    <div className="flex flex-col items-center gap-2 transform hover:scale-110 transition-transform cursor-pointer" onClick={() => setPreviewImg(images[currentPreviewIdx])}>
                                        <ScanEye className="text-white" size={28} />
                                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Ver</span>
                                    </div>
                                    <button
                                        onClick={(e) => downloadImage(images[currentPreviewIdx], currentPreviewIdx, e)}
                                        className="flex flex-col items-center gap-2 transform hover:scale-110 transition-transform"
                                    >
                                        <Download className="text-white" size={28} />
                                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Bajar</span>
                                    </button>
                                </div>

                                <span className="absolute top-4 left-4 text-[10px] font-bold text-white/50 bg-black/50 px-2 py-0.5 rounded border border-white/10">
                                    {currentPreviewIdx + 1} / {images.length}
                                </span>
                            </div>

                            <button
                                onClick={() => setCurrentPreviewIdx(prev => Math.min(images.length - 1, prev + 1))}
                                disabled={currentPreviewIdx === images.length - 1}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={32} className="text-white" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-4">
                        <ImageIcon size={64} className="opacity-20" />
                        <p className="text-sm">Listo para generar</p>
                        <p className="text-xs text-white/20">Se encontraron {allSelections.length} selecciones</p>
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
                </div>
            )}

            {/* HIDDEN RENDER CONTAINER (1080x1920) */}
            <div className="fixed left-[-9999px] top-0 pointer-events-none">
                <div ref={containerRef}>

                    {/* SLIDE 1: COVER */}
                    <div className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-start pt-[100px] font-sans overflow-hidden">
                        <img src={config.bgSelection[0]?.includes('.') ? `/backgrounds/${config.bgSelection[0]}` : `/backgrounds/bg-${config.bgSelection[0] || '1'}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1920&fit=crop"} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-100" alt="bg" />

                        <div className="relative z-10 w-full flex flex-col items-center gap-14 p-8">
                            {/* TITLE SPLIT: 2 blocks, 2nd block has icons */}
                            {(() => {
                                const parts = config.introTitle.split('\n');
                                const line1 = parts[0] || "";
                                const line2 = parts[1] || "";

                                return (
                                    <div className="flex flex-col items-center gap-4 transform -rotate-2 w-full">
                                        {/* Line 1 */}
                                        <div className="bg-white px-12 py-6 rounded-2xl shadow-lg w-fit max-w-[90%]">
                                            <h1 className="text-7xl font-black text-black uppercase tracking-tighter leading-tight whitespace-nowrap text-center">
                                                {line1}
                                            </h1>
                                        </div>
                                        {/* Line 2 with Icons */}
                                        <div className="bg-white px-12 py-4 rounded-2xl shadow-lg flex items-center gap-6 w-fit max-w-[95%]">
                                            <h1 className="text-6xl font-black text-black uppercase tracking-tighter leading-tight whitespace-nowrap">
                                                {line2}
                                            </h1>
                                            <div className="flex items-center gap-4">
                                                {config.introEmoji1 && (
                                                    <span className="text-6xl filter drop-shadow hover:brightness-110">{config.introEmoji1}</span>
                                                )}
                                                {config.introEmoji2 && (
                                                    <span className="text-6xl filter drop-shadow hover:brightness-110">{config.introEmoji2}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ODDS PILL: STICKER STYLE (Editable) */}
                            <div className="bg-white px-14 py-8 rounded-2xl shadow-2xl transform rotate-2 mt-8">
                                <span className="text-7xl font-black text-black uppercase tracking-tighter leading-none">
                                    {config.introSubtitle}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SLIDES 2-N: BETS (3 per slide) */}
                    {slidesData.map((chunk, slideIdx) => (
                        <div key={slideIdx} className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-center font-sans overflow-hidden">
                            <img src={config.bgSelection[slideIdx + 1]?.includes('.') ? `/backgrounds/${config.bgSelection[slideIdx + 1]}` : `/backgrounds/bg-${config.bgSelection[slideIdx + 1] || '2'}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1920&fit=crop"} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-100" alt="bg" />

                            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 gap-16 pb-[150px]">
                                {chunk.map((bet: any, bIdx: number) => {
                                    const { match, pick } = parseBetDisplay(bet.match, bet.pick);
                                    const sportIcon = bet.sport === 'basketball' ? '🏀' : '⚽';

                                    return (
                                        <div key={bIdx} className="w-full flex flex-col items-center gap-4">
                                            {/* MATCH TITLE: Native Insta Style */}
                                            <div className="inline-block bg-white px-8 py-4 rounded-xl max-w-[95%] text-center shadow-lg transform -rotate-1">
                                                <h3 className="text-5xl font-black text-black uppercase tracking-tight leading-tight whitespace-pre-wrap break-words">
                                                    {match} {sportIcon}
                                                </h3>
                                            </div>

                                            {/* PICK + CHECK: Native Insta Style */}
                                            <div className="inline-block bg-white px-8 py-4 rounded-xl max-w-[95%] text-center shadow-lg transform rotate-1 mt-[-10px]">
                                                <span className="text-5xl font-black text-black uppercase tracking-tight leading-tight whitespace-pre-wrap break-words">
                                                    {pick} ✅
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* LAST SLIDE: OUTRO */}
                    <div className="w-[1080px] h-[1920px] relative flex flex-col items-center justify-start pt-[900px] font-sans overflow-hidden">
                        <img src={config.bgSelection[slidesData.length + 1]?.includes('.') ? `/backgrounds/${config.bgSelection[slidesData.length + 1]}` : `/backgrounds/bg-${config.bgSelection[slidesData.length + 1] || '3'}.jpg`} onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=1920&fit=crop"} crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-90" alt="bg" />

                        <div className="relative z-10 w-full flex flex-col items-center gap-16 p-12">

                            {/* MAIN TEXT - REMOVED SHADOW-2XL replaced with shadow-lg for flat look */}
                            <div className="bg-white px-10 py-10 rounded-2xl max-w-[95%] text-center transform rotate-1">
                                <h2 className="text-7xl font-black text-black uppercase tracking-tighter leading-tight whitespace-pre-line">
                                    {config.outroTitle}
                                </h2>
                            </div>

                            {/* SUBTEXT (White w/ shadow-lg) */}
                            <div className="bg-white px-12 py-6 rounded-2xl transform -rotate-1">
                                <p className="text-4xl font-black text-black uppercase tracking-tight">
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
