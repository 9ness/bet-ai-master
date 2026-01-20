"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2, Settings2, Image as ImageIcon, ChevronDown, ChevronRight, ChevronLeft, RefreshCw, Save, ScanEye, Link as LinkIcon, X, Copy, Check } from 'lucide-react';
import { triggerTouchFeedback } from '@/utils/haptics';

/* 
 * TIKTOK FACTORY v6.0 - SMART BACKGROUND ENGINE
 * - Backgrounds fetched from API
 * - Smart selection based on Team/Sport/Slide Type
 * - Intro: "Portada" | Outro: "Futbol" + "Comodin"
 */

type TikTokFactoryProps = {
    predictions: any;
    formattedDate: string;
    rawDate?: string;
};

export default function TikTokFactory({ predictions, formattedDate, rawDate }: TikTokFactoryProps) {
    const [generating, setGenerating] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [copiedCaption, setCopiedCaption] = useState(false);

    // Social Content State
    const [socialContent, setSocialContent] = useState<any>(null);
    const [showSocialModal, setShowSocialModal] = useState(false);

    // Fetch Social Content on Mount
    useEffect(() => {
        const fetchSocial = async () => {
            try {
                const res = await fetch('/api/social/tiktok');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.title) {
                        setSocialContent(data);
                    }
                }
            } catch (err) {
                console.error("Error fetching social content", err);
            }
        };
        fetchSocial();
    }, []);

    // Helper: Generate TikTok Caption (Fallback)
    const generateCaption = () => {
        // ... (Keep existing logic as fallback if APi content missing)
        const allSelections = slideGroups;
        let text = `${config.introTitle} ${config.introEmoji1}\n\n`;

        allSelections.forEach((group: any) => {
            // Since icons are baked in, we strip them for the caption or keep them?
            // User likely wants clean list or with icons. Let's keep them as is since they are in the 'matchDisplay'.
            // But verify: group.matchDisplay now has "Real vs Barca ⚽". 
            // The caption builder was manually adding emojis.
            // Let's rely on the baked strings.
            text += `${group.matchDisplay}\n`;

            group.picks.forEach((pick: string, i: number) => {
                const betRef = group.originalBets[i];
                const odd = betRef.total_odd || betRef.odd || "";
                const reason = betRef.reason || "";

                // pick already has "Over 2.5 ✅"
                text += `${pick} ${odd ? `(@${parseFloat(odd).toFixed(2)})` : ''}\n`;
                if (reason) {
                    // Clean up reason: remove italics markers or markdown if any
                    const cleanReason = reason.replace(/\*/g, "").trim();
                    text += `📝 ${cleanReason}\n`;
                }
                text += `\n`;
            });
        });

        text += `\n${config.outroTitle}\n${config.outroSub}\n`;
        text += `\n#apuestas #parlay #futbol #nba #betting #deportes`;

        return text;
    };

    const handleCopyCaption = () => {
        const text = generateCaption();
        navigator.clipboard.writeText(text).then(() => {
            setCopiedCaption(true);
            setTimeout(() => setCopiedCaption(false), 2000);
        });
    };

    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    const handleCopyText = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedStates(prev => ({ ...prev, [key]: true }));
            setTimeout(() => {
                setCopiedStates(prev => ({ ...prev, [key]: false }));
            }, 2000);
        });
    };

    // Dynamic date for default title
    const getDayName = () => {
        const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
        return days[new Date().getDay()];
    };

    // Config State
    const [config, setConfig] = useState({
        // Slide 1: Intro
        introTitle: `JUBILADORA HOY\n(${getDayName()})`,
        introSubtitle: "", // Will be set by useEffect after initial config is ready
        introEmoji1: '🤫',
        introEmoji2: '✅',

        // Slide Last: Outro
        outroTitle: "LA MEJOR DE TODAS\nLA DEJAMOS EN\nNUESTRO CANAL",
        outroSub: "ACCEDE DESDE EL PERFIL 🔗",

        // Backgrounds (using strings now)
        // Backgrounds
        // Backgrounds
        bgSelection: [] as string[],

        // Options
        addHundred: true,
        useFullDate: true
    });

    // Helper: Format Date like "Jueves 15 ene"
    const getFormattedDateLong = () => {
        try {
            // Prefer rawDate (ISO) if available, otherwise fall back to formattedDate (which might fail)
            const dateStr = rawDate || formattedDate;
            const date = new Date(dateStr);
            const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
            const dayNum = date.getDate();
            const monthName = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date);
            const monthCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            // Capitalize first letter of day
            return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthCap}`;
        } catch (e) {
            return formattedDate;
        }
    };

    // Helper: Calculate Total Odds for Initial State
    const calculateInitialOdds = (addHundred: boolean) => {
        let totalOdd = 1;
        const rawBets = predictions?.bets || (Array.isArray(predictions) ? predictions : []);
        let found = false;

        if (rawBets.length > 0) {
            rawBets.forEach((b: any) => {
                const odd = parseFloat(b.total_odd || b.odd);
                if (!isNaN(odd) && odd > 0) {
                    totalOdd *= odd;
                    found = true;
                }
            });
        } else {
            const o1 = parseFloat(predictions?.safe?.total_odd || predictions?.safe?.odd);
            const o2 = parseFloat(predictions?.value?.total_odd || predictions?.value?.odd);
            const o3 = parseFloat(predictions?.funbet?.total_odd || predictions?.funbet?.odd);

            if (!isNaN(o1)) { totalOdd *= o1; found = true; }
            if (!isNaN(o2)) { totalOdd *= o2; found = true; }
            if (!isNaN(o3)) { totalOdd *= o3; found = true; }
        }

        if (!found || totalOdd <= 1.01) return "+??? 📈";

        // Logic: 
        // If odds are small (e.g. 5.3), we show 53 (x10)
        // If odds are large (e.g. 53.9), we show 53 (x1) - User request to truncate decimals for large odds
        let oddValue = 0;
        if (totalOdd < 10) {
            oddValue = Math.round(totalOdd * 10);
        } else {
            oddValue = Math.round(totalOdd);
        }

        if (addHundred) {
            oddValue *= 10; // 53 -> 530
        }

        return `+${oddValue} 📈`;
    };

    // Effect: Handle Date Format Toggle
    useEffect(() => {
        if (config.useFullDate) {
            const longDate = getFormattedDateLong();
            setConfig(prev => ({
                ...prev,
                introTitle: `JUBILADORA HOY\n${longDate}`,
                introEmoji1: '⚽',
                introEmoji2: '📅'
            }));
        } else {
            // Revert to simple day name, but keep current title text if modified? 
            // Better to reset to default pattern to match user expectation of "toggle"
            setConfig(prev => ({
                ...prev,
                introTitle: `JUBILADORA HOY\n(${getDayName()})`,
                // Don't necessarily revert emojis, or revert to default? 
                // User didn't specify revert behavior, but implied specific emojis for specific format.
                // Let's keep them as is if un-checked, or maybe reset to default?
                // Let's leave them, or reset to default '🤫' '✅' if that was the state.
                introEmoji1: '🤫',
                introEmoji2: '✅'
            }));
        }
    }, [config.useFullDate]);

    // Set initial introSubtitle after config is defined
    useEffect(() => {
        setConfig(prev => ({
            ...prev,
            introSubtitle: calculateInitialOdds(prev.addHundred)
        }));
    }, [predictions]); // Recalculate if predictions change

    const [collapsed, setCollapsed] = useState({
        intro: false,
        bets: false,
        outro: false,
        bg: true
    });

    // Editable Groups State
    const [slideGroups, setSlideGroups] = useState<any[]>([]);
    const [currentPreviewIdx, setCurrentPreviewIdx] = useState(0);
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);

    // Auto-collapse on mobile
    useEffect(() => {
        if (window.innerWidth < 768) {
            setCollapsed({ intro: true, bets: true, outro: true, bg: true });
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

    // Prepare All Bets (Grouped by Match)
    const getAllSelections = () => {
        const flatBets: any[] = [];
        const rawBets = predictions?.bets || (Array.isArray(predictions) ? predictions : []);

        if (rawBets.length === 0) {
            if (predictions?.safe) rawBets.push(predictions.safe);
            if (predictions?.value) rawBets.push(predictions.value);
            if (predictions?.funbet) rawBets.push(predictions.funbet);
        }

        // 1. Flatten
        rawBets.forEach((bet: any) => {
            if (!bet) return;
            const parentSport = bet.sport;

            const addBet = (item: any) => {
                flatBets.push({
                    ...item,
                    sport: (item.sport || parentSport || 'football').toLowerCase()
                });
            };

            if (bet.selections && Array.isArray(bet.selections) && bet.selections.length > 0) {
                bet.selections.forEach((sel: any) => addBet(sel));
            }
            else if (bet.components && Array.isArray(bet.components) && bet.components.length > 0) {
                bet.components.forEach((comp: any) => addBet(comp));
            }
            else if (bet.match && bet.pick) {
                addBet(bet);
            }
        });

        // 2. Group by Normalized Match Name
        const groups: Record<string, any> = {};

        flatBets.forEach(bet => {
            const { match, pick } = parseBetDisplay(bet.match, bet.pick);
            // Normalize match key: remove spaces, lowercase
            const matchKey = match.toLowerCase().replace(/\s+/g, '');

            if (!groups[matchKey]) {
                groups[matchKey] = {
                    matchDisplay: match, // Keep the first display name found
                    sport: bet.sport,
                    picks: [],
                    originalBets: []
                };
            }

            // Add Pick
            groups[matchKey].picks.push(pick);
            groups[matchKey].originalBets.push(bet);
        });

        const groupedList = Object.values(groups);

        // 3. Identify teams that have specific backgrounds (BY SPORT)
        const teamsWithBg: Record<string, Set<string>> = {
            football: new Set(),
            basketball: new Set(),
            tennis: new Set()
        };

        availableFiles.forEach(file => {
            const lower = file.toLowerCase();
            let sport = 'football';
            if (lower.includes('basket')) sport = 'basketball';
            else if (lower.includes('tenis') || lower.includes('tennis')) sport = 'tennis';

            if (lower.includes('bg-')) {
                // Extract team name roughly: bg-futbol-INTER-1.png
                const parts = lower.split('-');
                if (parts.length >= 3) {
                    teamsWithBg[sport].add(parts[2]);
                }
            }
        });

        const cleanForMatch = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

        const hasTeamBg = (group: any) => {
            const matchText = cleanForMatch(group.matchDisplay || "");
            const sport = (group.sport || 'football').toLowerCase();

            // Get relevant set of teams for this sport
            const relevantTeams = teamsWithBg[sport] || teamsWithBg['football']; // Fallback only if unknown sport

            // Check if any team in our set is present in match name
            for (const team of Array.from(relevantTeams)) {
                const cleanTeam = cleanForMatch(team);

                if (team !== 'comodin' && matchText.includes(cleanTeam)) {
                    return true;
                }
            }
            return false;
        };

        // 4. Sort: Strict Priority
        // Tier 1: Football (Featured > Regular)
        // Tier 2: Others (Featured > Regular)
        const footballFeatured: any[] = [];
        const footballRegular: any[] = [];
        const otherFeatured: any[] = [];
        const otherRegular: any[] = [];

        groupedList.forEach(group => {
            const sport = (group.sport || 'football').toLowerCase();
            const isFeatured = hasTeamBg(group);
            const sportIcon = sport === 'basketball' ? '🏀' : '⚽';

            // BAKE ICONS INTO TEXTS FOR EDITABILITY
            // 1. Match Title
            group.matchDisplay = `${group.matchDisplay} ${sportIcon}`;

            // 2. Picks
            group.picks = group.picks.map((pick: string) => {
                const { pick: displayPick } = parseBetDisplay(group.matchDisplay, pick);

                // Intelligent Casing Logic (Directly here to bake it in)
                let formattedPick = displayPick;
                const lowerPick = displayPick.toLowerCase();
                // We need 'teams' array here? reusing logic from render?
                // No, let's just use the cleanMatch logic again or pass it.
                // Actually easier to do generic casing:
                formattedPick = lowerPick.charAt(0).toUpperCase() + lowerPick.slice(1);

                return `${formattedPick} ✅`;
            });

            if (sport === 'football') {
                if (isFeatured) footballFeatured.push(group);
                else footballRegular.push(group);
            } else {
                if (isFeatured) otherFeatured.push(group);
                else otherRegular.push(group);
            }
        });

        // Combine strictly: All Football -> All Others
        // Note: Return clean objects but KEEP isFeatured flag for the chunker
        return [
            ...footballFeatured.map(g => ({ ...g, isFeatured: true })),
            ...footballRegular.map(g => ({ ...g, isFeatured: false })),
            ...otherFeatured.map(g => ({ ...g, isFeatured: true })),
            ...otherRegular.map(g => ({ ...g, isFeatured: false }))
        ];
    };

    // Initialize slideGroups when predictions or files change
    useEffect(() => {
        const groups = getAllSelections();
        // Only update if different to avoid loop (simple check or just set)
        setSlideGroups(groups);
    }, [predictions, availableFiles]);

    // Chunk Logic: Smarter Chunking
    // Rules:
    // 1. Featured items (with specific BG) GET THEIR OWN SLIDE (Isolation).
    // 2. Regular items are grouped max 3 per slide.
    const slidesData: any[][] = [];
    let currentChunk: any[] = [];

    slideGroups.forEach((item: any) => {
        if (item.isFeatured) {
            // If we have a pending regular chunk, push it first
            if (currentChunk.length > 0) {
                slidesData.push(currentChunk);
                currentChunk = [];
            }
            // Push the featured item as its own exclusive slide
            slidesData.push([item]);
        } else {
            // Regular item logic
            currentChunk.push(item);
            if (currentChunk.length >= 3) {
                slidesData.push(currentChunk);
                currentChunk = [];
            }
        }
    });
    // Push last partial chunk
    if (currentChunk.length > 0) slidesData.push(currentChunk);

    // Balance Logic: Avoid 3-1 split for REGULAR chunks only?
    // Actually, simple balance is safer.
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
    // Legacy randomizer (REMOVED - Now sets fallback filenames)
    const randomizeBackgroundsLegacy = () => {
        // Fallback to safe defaults if no API data
        const safeDefaults = ['bg-portada-1.png', 'bg-futbol-comodin-1.png', 'bg-futbol-comodin-2.png', 'bg-basket-comodin-1.png'];
        const count = slidesData.length + 2;
        const result: string[] = [];
        for (let i = 0; i < count; i++) {
            result.push(safeDefaults[i % safeDefaults.length]);
        }
        setConfig(prev => ({ ...prev, bgSelection: result }));
    };

    const smartSelectBackgrounds = () => {
        const newSelection: any[] = [];

        // Helper: Get random item from array
        const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

        // Helper: clean string for comparison (remove accents, spaces, lowercase)
        const cleanStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        // 1. COVER (Intro) - Must contain "portada"
        // 1. COVER (Intro) - Must contain "portada"
        const portadas = availableFiles.filter(f => f.toLowerCase().includes('portada'));
        const coverBg = portadas.length > 0 ? pickRandom(portadas) : 'bg-portada-1.png'; // Fallback to filename
        newSelection.push(coverBg);

        // Track last used to prevent duplicates
        let lastUsedBg = coverBg;

        // 2. BET SLIDES
        slidesData.forEach((chunk) => {
            let selectedBg = null;
            const mainSport = (chunk[0]?.sport || 'football').toLowerCase();

            // Try to find Team Match (ONLY for bets matching the main sport)
            for (const group of chunk) {
                const currentSport = (group.sport || 'football').toLowerCase();
                if (currentSport !== mainSport) continue;

                // Use the group's match display directly
                const matchDisplay = group.matchDisplay || "";
                const teams = matchDisplay.split(/\s*vs\s*|\s*-\s*/i).map((t: string) => t.trim()).filter(Boolean);

                for (const team of teams) {
                    const cleanTeam = cleanStr(team);
                    if (cleanTeam.length < 3) continue;

                    const matchSportKeyword = mainSport === 'basketball' ? 'basket' : 'futbol';

                    const matches = availableFiles.filter(f =>
                        !f.toLowerCase().includes('comodin') &&
                        f.toLowerCase().includes(matchSportKeyword) &&
                        cleanStr(f).includes(cleanTeam)
                    );
                    if (matches.length > 0) {
                        selectedBg = pickRandom(matches);
                        break;
                    }
                }
                if (selectedBg) break;
            }

            // Fallback: Sport + Comodin (Avoid repeating lastUsedBg)
            if (!selectedBg) {
                const keyword = mainSport === 'basketball' ? 'basket' : 'futbol';

                const comodines = availableFiles.filter(f =>
                    f.toLowerCase().includes(keyword) &&
                    f.toLowerCase().includes('comodin')
                );

                if (comodines.length > 0) {
                    // Filter out the one just used
                    const availableComodines = comodines.filter(c => c !== lastUsedBg);

                    if (availableComodines.length > 0) {
                        selectedBg = pickRandom(availableComodines);
                    } else {
                        // If only 1 exists and it was just used, we have no choice but to repeat or pick random from original
                        selectedBg = pickRandom(comodines);
                    }
                }
            }

            const finalBg = selectedBg || 'bg-futbol-comodin-1.png'; // Fallback to filename
            newSelection.push(finalBg);
            lastUsedBg = finalBg;
        });

        // 3. OUTRO (Last) - Must contain "futbol" AND "comodin"
        const outroFiles = availableFiles.filter(f =>
            f.toLowerCase().includes('futbol') &&
            f.toLowerCase().includes('comodin')
        );

        // Try to pick one different from the last used slide if possible, otherwise random
        let outroBg = outroFiles.length > 0 ? pickRandom(outroFiles) : 'bg-futbol-comodin-2.png'; // Fallback to filename
        newSelection.push(outroBg);

        setConfig(prev => ({ ...prev, bgSelection: newSelection }));
    };

    const generateImages = async () => {
        if (!containerRef.current) return;
        setGenerating(true);
        setImages([]);
        await new Promise(r => setTimeout(r, 800));

        const generated: string[] = [];
        const slides = containerRef.current.children;

        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i] as HTMLElement;
            try {
                const canvas = await html2canvas(slide, {
                    scale: 1,
                    useCORS: true,
                    allowTaint: true,
                    width: 1080,
                    height: 1350,
                    windowWidth: 1080,
                    windowHeight: 1350,
                    backgroundColor: null,
                    logging: false,
                    x: 0,
                    y: 0,
                    scrollX: 0,
                    scrollY: 0
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
        <div className="w-full h-full flex flex-col md:flex-row bg-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300 relative">

            {/* SOCIAL MODAL */}
            {showSocialModal && socialContent && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">📱 Contenido Viral Generado</h2>
                            <button onClick={() => setShowSocialModal(false)} className="text-white/50 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        {/* TITLE SECTION */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-emerald-400">Título (Headline)</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-black/50 p-3 rounded-xl border border-white/5 text-white font-bold text-lg">
                                    {socialContent.title}
                                </div>
                                <button
                                    onClick={() => handleCopyText(socialContent.title, 'title')}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    className={`btn-active-effect p-3 rounded-xl transition-transform duration-300 ${copiedStates['title'] ? 'bg-emerald-500 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                                >
                                    {copiedStates['title'] ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* DESCRIPTION SECTION */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-purple-400">Descripción (Caption)</label>
                            <div className="flex gap-2 items-start">
                                <div className="flex-1 bg-black/50 p-3 rounded-xl border border-white/5 text-white/80 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {socialContent.description || socialContent.caption}
                                </div>
                                <button
                                    onClick={() => handleCopyText(socialContent.description || socialContent.caption, 'desc')}
                                    onTouchStart={() => triggerTouchFeedback()}
                                    className={`btn-active-effect p-3 rounded-xl transition-transform duration-300 ${copiedStates['desc'] ? 'bg-emerald-500 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                                >
                                    {copiedStates['desc'] ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 text-center">
                            <p className="text-[10px] text-white/30">Generado automáticamente por Gemini • {new Date(socialContent.updated_at).toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>
            )}

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
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="useFullDate"
                                            checked={config.useFullDate}
                                            onChange={(e) => setConfig({ ...config, useFullDate: e.target.checked })}
                                            className="accent-emerald-500 w-4 h-4"
                                        />
                                        <label htmlFor="useFullDate" className="text-xs text-emerald-400 cursor-pointer select-none">
                                            Usar Fecha Larga + Iconos
                                        </label>
                                    </div>
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
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs text-white/50">Cuota (Texto Editable)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="addHundred"
                                                checked={config.addHundred}
                                                onChange={(e) => {
                                                    const isChecked = e.target.checked;

                                                    // Logic to update text dynamically
                                                    let current = config.introSubtitle.replace(' 📈', '').replace('+', '');
                                                    let num = parseInt(current);

                                                    if (!isNaN(num)) {
                                                        if (isChecked) num = num * 10;
                                                        else num = Math.round(num / 10);

                                                        setConfig({
                                                            ...config,
                                                            addHundred: isChecked,
                                                            introSubtitle: `+${num} 📈`
                                                        });
                                                    } else {
                                                        // Fallback if text is not number
                                                        setConfig({ ...config, addHundred: isChecked });
                                                    }
                                                }}
                                                className="accent-emerald-500 w-3 h-3"
                                            />
                                            <label htmlFor="addHundred" className="text-[10px] text-emerald-400 cursor-pointer select-none">Añadir Centena</label>
                                        </div>
                                    </div>
                                    <input value={config.introSubtitle} onChange={e => setConfig({ ...config, introSubtitle: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-sm font-bold" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 1.5: BETS (EDIT TEXTS) */}
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleSection('bets')} className="w-full flex justify-between items-center p-2 hover:bg-white/5">
                            <span className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2">📝 Editar Apuestas</span>
                            {collapsed.bets ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {!collapsed.bets && (
                            <div className="p-4 space-y-6 border-t border-white/10 max-h-[400px] overflow-y-auto">
                                {slideGroups.map((group, i) => (
                                    <div key={i} className="space-y-3 p-3 bg-black/30 rounded-lg border border-white/5">
                                        {/* Match Title Input */}
                                        <div>
                                            <label className="text-[10px] text-white/40 uppercase font-bold mb-1 block">Partido {i + 1}</label>
                                            <input
                                                value={group.matchDisplay}
                                                onChange={(e) => {
                                                    const newGroups = [...slideGroups];
                                                    newGroups[i] = { ...newGroups[i], matchDisplay: e.target.value };
                                                    setSlideGroups(newGroups);
                                                }}
                                                className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs font-bold"
                                                placeholder="Nombre del Partido"
                                            />
                                        </div>

                                        {/* Bets Loop */}
                                        <div className="space-y-2">
                                            {group.picks.map((pick: string, j: number) => (
                                                <div key={j}>
                                                    <label className="text-[10px] text-white/30 uppercase block mb-1">Selección {j + 1}</label>
                                                    <input
                                                        value={pick}
                                                        onChange={(e) => {
                                                            const newGroups = [...slideGroups];
                                                            const newPicks = [...newGroups[i].picks];
                                                            newPicks[j] = e.target.value;
                                                            newGroups[i] = { ...newGroups[i], picks: newPicks };
                                                            setSlideGroups(newGroups);
                                                        }}
                                                        className="w-full bg-black/50 border border-white/10 rounded p-2 text-white text-xs"
                                                        placeholder="Texto de la apuesta"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
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
                    <div className="grid grid-cols-3 gap-2">
                        {/* VIEW VIRAL BUTTON */}
                        {socialContent && (
                            <button
                                onClick={() => setShowSocialModal(true)}
                                onTouchStart={() => triggerTouchFeedback()}
                                className="btn-active-effect bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 text-[10px] rounded-xl shadow-lg transition-transform active:scale-95 flex flex-col items-center justify-center gap-1 leading-tight"
                            >
                                <ScanEye size={16} /> VER VIRAL
                            </button>
                        )}
                        {!socialContent && (
                            <button disabled className="bg-zinc-800 text-white/20 font-bold py-3 text-[10px] rounded-xl border border-white/5 flex flex-col items-center justify-center gap-1">
                                <Loader2 size={16} /> NO DATA
                            </button>
                        )}

                        {/* GENERATE BUTTON */}
                        <button
                            onClick={generateImages}
                            onTouchStart={() => triggerTouchFeedback()}
                            disabled={generating}
                            className="btn-active-effect bg-white hover:bg-gray-200 text-black font-bold py-3 text-[10px] rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 leading-tight"
                        >
                            {generating ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                            {generating ? '...' : 'GENERAR'}
                        </button>

                        {/* DOWNLOAD ALL BUTTON */}
                        <button
                            onClick={downloadAll}
                            onTouchStart={() => triggerTouchFeedback()}
                            disabled={images.length === 0}
                            className="btn-active-effect bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-[10px] rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 leading-tight"
                        >
                            <Save size={16} /> BAJAR TODO
                        </button>
                    </div>
                    <p className="text-center text-white/30 text-[10px] mt-2">{slidesData.length} slides (+2)</p>
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

                            <div className="relative h-auto max-h-[55vh] bg-transparent rounded-lg overflow-hidden border border-white/10 shadow-2xl group aspect-[4/5]">
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
                        <p className="text-xs text-white/20">Se encontraron {slideGroups.length} selecciones</p>
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

            {/* HIDDEN RENDER CONTAINER */}
            <div className="fixed top-0 left-0 z-[-1000] opacity-0 pointer-events-none">
                <div ref={containerRef} style={{ width: 1080, height: 1350 }}>

                    <div className="w-[1080px] relative flex flex-col items-center justify-center font-sans overflow-hidden bg-black" style={{ height: 1350 }}>
                        <img
                            src={config.bgSelection[0]?.includes('.') ? `/backgrounds/${config.bgSelection[0]}` : `/backgrounds/${config.bgSelection[0] || 'bg-portada-1.png'}`}
                            onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=1920&fit=crop"}
                            crossOrigin="anonymous"
                            width={1080}
                            height={1350}
                            className="absolute inset-0 w-full h-full object-cover z-0 opacity-100"
                            alt="bg"
                        />
                        <div className="absolute inset-0 z-0 bg-black/5" />

                        <div className="relative z-10 w-full flex flex-col items-center gap-14 p-8">
                            {/* TITLE SPLIT: 2 blocks, 2nd block has icons */}
                            {(() => {
                                const parts = config.introTitle.split('\n');
                                const line1 = parts[0] || "";
                                const line2 = parts[1] || "";

                                return (
                                    <div className="flex flex-col items-center gap-4 w-full">
                                        {/* Line 1 */}
                                        <div className="bg-white px-12 pt-2 pb-6 rounded-2xl w-fit max-w-[90%] flex items-center justify-center">
                                            <h1 className="text-6xl font-black text-black tracking-tighter leading-tight whitespace-nowrap text-center pb-5">
                                                {line1}
                                            </h1>
                                        </div>
                                        {/* Line 2 with Icons */}
                                        <div className="bg-white px-12 pt-2 pb-4 rounded-2xl flex items-center justify-center gap-6 w-fit max-w-[95%]">
                                            <h1 className="text-5xl font-black text-black tracking-tighter leading-tight whitespace-nowrap pb-5">
                                                {line2}
                                            </h1>
                                            <div className="flex items-center gap-4 pb-5">
                                                {config.introEmoji1 && (
                                                    <span className="text-5xl filter drop-shadow hover:brightness-110">{config.introEmoji1}</span>
                                                )}
                                                {config.introEmoji2 && (
                                                    <span className="text-5xl filter drop-shadow hover:brightness-110">{config.introEmoji2}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ODDS PILL: STICKER STYLE (Editable) - Hide if empty */}
                            {config.introSubtitle && config.introSubtitle.trim() !== "" && (
                                <div className="bg-white px-14 pt-4 pb-8 rounded-2xl mt-8 flex items-center justify-center">
                                    <span className="text-6xl font-black text-black uppercase tracking-tighter leading-none pb-5">
                                        {config.introSubtitle}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SLIDES 2-N: BETS (3 per slide) */}
                    {slidesData.map((chunk, slideIdx) => (
                        <div key={slideIdx} className="w-[1080px] relative flex flex-col items-center justify-center font-sans overflow-hidden bg-black" style={{ height: 1350 }}>
                            <img
                                src={config.bgSelection[slideIdx + 1]?.includes('.') ? `/backgrounds/${config.bgSelection[slideIdx + 1]}` : `/backgrounds/${config.bgSelection[slideIdx + 1] || 'bg-futbol-comodin-1.png'}`}
                                onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1920&fit=crop"}
                                crossOrigin="anonymous"
                                width={1080}
                                height={1350}
                                className="absolute inset-0 w-full h-full object-cover z-0 opacity-100"
                                alt="bg"
                            />
                            <div className="absolute inset-0 z-0 bg-black/5" />

                            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 gap-16 pb-[80px]">
                                {chunk.map((group: any, bIdx: number) => {
                                    const { match } = parseBetDisplay(group.matchDisplay, "");
                                    const sportIcon = group.sport === 'basketball' ? '🏀' : '⚽';

                                    // Extract team names for comparison
                                    const teams = match.toLowerCase().split(' vs ').map(t => t.trim());

                                    return (
                                        <div key={bIdx} className="w-full flex flex-col items-center gap-4">
                                            {/* MATCH TITLE: Inverted Colors (Black BG, White Text) - NO BORDER */}
                                            <div className="bg-black px-8 pt-2 pb-4 rounded-xl max-w-[95%] border-2 border-black flex items-center justify-center text-center">
                                                <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight whitespace-pre-wrap break-words pb-5">
                                                    {group.matchDisplay}
                                                </h3>
                                            </div>

                                            {/* PICKS LOOP */}
                                            {group.picks.map((pick: string, pIdx: number) => {
                                                return (
                                                    <div key={pIdx} className="bg-white px-8 pt-2 pb-4 rounded-xl max-w-[95%] flex items-center justify-center text-center mt-[-10px]">
                                                        <span className="text-3xl font-black text-black tracking-tight leading-tight whitespace-pre-wrap break-words pb-5">
                                                            {pick}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* SLIDE N: OUTRO */}
                    <div className="w-[1080px] relative flex flex-col items-center justify-center gap-16 font-sans overflow-hidden bg-black" style={{ height: 1350 }}>
                        <img
                            src={config.bgSelection[slidesData.length + 1]?.includes('.') ? `/backgrounds/${config.bgSelection[slidesData.length + 1]}` : `/backgrounds/${config.bgSelection[slidesData.length + 1] || 'bg-futbol-comodin-2.png'}`}
                            onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1579952363873-1b9132c3f58a?q=80&w=1920&fit=crop"}
                            crossOrigin="anonymous"
                            width={1080}
                            height={1350}
                            className="absolute inset-0 w-full h-full object-cover z-0 opacity-100"
                            alt="bg"
                        />
                        <div className="absolute inset-0 z-0 bg-black/5" />

                        <div className="relative z-10 w-full flex flex-col items-center gap-16 p-12">

                            {/* MAIN TEXT - REMOVED SHADOW-2XL replaced with shadow-lg for flat look */}
                            <div className="bg-white px-10 py-10 rounded-2xl max-w-[95%] text-center">
                                <h2 className="text-6xl font-black text-black uppercase tracking-tighter leading-tight whitespace-pre-line">
                                    {config.outroTitle}
                                </h2>
                            </div>

                            {/* SUBTEXT (White w/ shadow-lg) */}
                            <div className="bg-white px-12 py-6 rounded-2xl">
                                <p className="text-3xl font-black text-black uppercase tracking-tight">
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
