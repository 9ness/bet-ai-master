"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { Play, Download, Trash2, X, Plus, Image as ImageIcon, Video, Type, Music, Settings, Upload, MonitorPlay, Palette, LayoutTemplate, Megaphone, Search, Loader2, Check, Info, ChevronLeft, ScanEye, ChevronRight, Save, RefreshCw, Copy, Settings2 } from 'lucide-react';
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
                    ? 'bg-gradient-to-br from-fuchsia-600 to-fuchsia-500 border-fuchsia-400 text-white shadow-lg shadow-fuchsia-500/30'
                    : 'bg-white dark:bg-black/20 border-border/10 dark:border-white/5 text-muted-foreground dark:text-white/40 hover:bg-secondary dark:hover:bg-white/5 hover:text-foreground dark:hover:text-white/70'
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
    const [activeTab, setActiveTab] = useState<'editor' | 'portada' | 'bets' | 'outro' | 'bg' | 'settings'>('editor');
    const [onlyFootball, setOnlyFootball] = useState(true);

    // --- NEW: VIRAL MODE (Today vs Tomorrow) ---
    const [viewMode, setViewMode] = useState<'today' | 'tomorrow'>('today');
    const [localPredictions, setLocalPredictions] = useState(predictions);

    useEffect(() => {
        setLocalPredictions(predictions);
    }, [predictions]);

    // Fetch Data on Mode Change
    useEffect(() => {
        const fetchData = async () => {
            if (viewMode === 'today') {
                // Restore props and today's social
                setLocalPredictions(predictions);
                fetch('/api/social/tiktok').then(res => res.ok ? res.json() : null).then(data => data?.title && setSocialContent(data));
            } else {
                // Fetch Tomorrow's Data
                try {
                    const [predsRes, socialRes] = await Promise.all([
                        fetch('/api/predictions-tomorrow'),
                        fetch('/api/social/tiktok-tomorrow')
                    ]);

                    if (predsRes.ok) {
                        const predsData = await predsRes.json();
                        setLocalPredictions(predsData);
                    }

                    if (socialRes.ok) {
                        const socialData = await socialRes.json();
                        if (socialData?.title) setSocialContent(socialData);
                    }
                } catch (e) {
                    console.error("Error fetching viral mode data", e);
                }
            }
        };
        fetchData();
    }, [viewMode, predictions]);


    const [generating, setGenerating] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [previewImg, setPreviewImg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showSocialModal, setShowSocialModal] = useState(false);
    const [socialContent, setSocialContent] = useState<any>(null);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    // --- HELPERS ---
    const getFilename = (pathOrUrl: string) => pathOrUrl.split('/').pop() || "";

    const formatTeamName = (name: string) => {
        if (!name) return "";
        // 1. Extract filename if it's a path/URL
        let formatted = getFilename(name);

        // 2. Decode URL characters (Fix for %20, %C3%B6 etc.)
        try { formatted = decodeURIComponent(formatted); } catch (e) { }

        // 3. Remove extension
        formatted = formatted.split('.')[0];
        // 4. Separate CamelCase
        formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
        // 5. Replace Underscores, Hyphens and 'bg-' prefix with spaces
        formatted = formatted.replace('bg-', '').replace(/[_-]/g, ' ');
        // 6. Proper Case + trim
        return formatted.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    // --- CONFIG & DATA ---
    const getDayName = () => ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][new Date().getDay()];

    const [config, setConfig] = useState({
        introTitle: `JUBILADORA PARA HOY\n(${getDayName()})`,
        introSubtitle: "",
        introEmoji1: '🤫',
        introEmoji2: '✅',
        outroTitle: "ESTAMOS ACERTANDO\n TODO EN EL GRUPO",
        outroSub: "MÁS INFO EN EL PERFIL",
        bgSelection: [] as string[],
        addHundred: true,
        useFullDate: true,
        showOdds: false, // NEW: Visibility toggle for odds
        titleScale: 1.05,
        betsScale: 0.7,
        oddsScale: 0.8,
        showTitleBorder: false,
        showPickOdds: false,
        // Advance Settings (Sizes in rem, Gap in px)
        introTitleSize: 2.8, // TÍTULO PRINCIPAL (Default: 3)
        introSubSize: 2.4, // SUBTÍTULO (FECHA) (Default: 2.25)
        matchTitleSize: 2.25, // TÍTULO PARTIDO (Default: 2.25)
        pickTextSize: 3, // TEXTO SELECCIÓN (Default: 3.3)
        pickOddSize: 2.8, // TAMAÑO CUOTA (Default: 2.8)
        outroTitleSize: 3, // TÍTULO CIERRE (Default: 3)
        outroSubSize: 1.875, // SUBTÍTULO CIERRE (Default: 1.875)
        gapBody: -8, // ESPACIO TÍTULO-CAJA (Default: -8)
        gapOdds: -18, // ESPACIO CAJA-CUOTA (Default: -18)
        boxPaddingY: 18, // ALTURA RECUADROS (Default: 18)
        introItalic: true, // ESTILO CURSIVA PORTADA (Default: true)
    });

    const [imageSelector, setImageSelector] = useState<{ idx: number | null }>({ idx: null });

    const [slideGroups, setSlideGroups] = useState<any[]>([]);

    // --- SLIDES DATA CALCULATION (Hoisted) ---
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
    const [currentPreviewIdx, setCurrentPreviewIdx] = useState(0);
    const [availableFiles, setAvailableFiles] = useState<string[]>([]);

    // --- FILTERS FOR BG SELECTOR ---
    const [bgFilter, setBgFilter] = useState<'all' | 'futbol' | 'basket' | 'portada' | 'comodin' | 'equipo'>('all');
    const [bgTeamSelected, setBgTeamSelected] = useState<string | null>(null);
    const [bgSportForTeam, setBgSportForTeam] = useState<'futbol' | 'basket'>('futbol');

    // --- DRAGGABLE & SCALABLE TEXT STATE ---
    const [textPositions, setTextPositions] = useState<{ x: number, y: number }[]>([]);
    const [textScales, setTextScales] = useState<number[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number, idx: number } | null>(null);
    const pinchRef = useRef<{ initialDist: number, initialScale: number, idx: number } | null>(null);

    // --- MOBILE SETTINGS (Overlay) ---
    const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
    const [currentMobilePropIdx, setCurrentMobilePropIdx] = useState(0);

    const mobileConfigProperties = [
        // Sizes
        { key: 'introTitleSize', label: 'Tamaño Título Portada', type: 'range', min: 1.5, max: 5, step: 0.1 },
        { key: 'introSubSize', label: 'Tamaño Fecha', type: 'range', min: 1, max: 4, step: 0.1 },
        { key: 'gapBody', label: 'Separación Título-Apuesta', type: 'range', min: -60, max: 20, step: 1 },
        { key: 'matchTitleSize', label: 'Tamaño Partido', type: 'range', min: 1, max: 4, step: 0.1 },
        { key: 'pickTextSize', label: 'Tamaño Selección', type: 'range', min: 1.5, max: 6, step: 0.1 },
        { key: 'gapOdds', label: 'Espacio Caja-Cuota', type: 'range', min: -50, max: 50, step: 1 },
        { key: 'pickOddSize', label: 'Tamaño Cuota', type: 'range', min: 1, max: 4, step: 0.1 },
        { key: 'boxPaddingY', label: 'Altura Recuadros', type: 'range', min: -10, max: 30, step: 1 }, // NEW
        // Toggles
        { key: 'showOdds', label: 'Cuota en Portada', type: 'toggle' },
        { key: 'showTitleBorder', label: 'Borde en Título', type: 'toggle' },
        { key: 'useFullDate', label: 'Fecha Larga', type: 'toggle' },
        { key: 'introItalic', label: 'Cursiva en Portada', type: 'toggle' },
        { key: 'onlyFootball', label: 'Solo Fútbol', type: 'toggle' },
    ];

    const cycleMobileProperty = (dir: number) => {
        setCurrentMobilePropIdx(prev => {
            const next = prev + dir;
            if (next < 0) return mobileConfigProperties.length - 1;
            if (next >= mobileConfigProperties.length) return 0;
            return next;
        });
    };

    useEffect(() => {
        // Sync positions array size
        const total = (slideGroups.length ? Math.ceil(slideGroups.reduce((acc: any, curr: any) => acc + (curr.isFeatured ? 1 : 0.34), 0)) : 0) + 10; // Rough estimate or just resize dynamically
        // Better:
        const required = slidesData.length + 2;
        if (textPositions.length !== required) {
            setTextPositions(prev => {
                const newArr = new Array(required).fill({ x: 0, y: 0 });
                // Preserve old positions if possible? Maybe too complex for now, just reset on structure change or preserve by index
                return newArr.map((_, i) => prev[i] || { x: 0, y: 0 });
            });
            setTextScales(prev => {
                const newArr = new Array(required).fill(1.0);
                return newArr.map((_, i) => prev[i] || 1.0);
            });
        }
    }, [slidesData.length]);

    const getDistance = (touches: any) => {
        return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent, idx: number) => {
        // e.preventDefault(); // allow touch scroll if not on text? No, on text we want drag.

        // CHECK FOR PINCH (2 fingers)
        if ('touches' in e && e.touches.length === 2) {
            const dist = getDistance(e.touches);
            pinchRef.current = {
                initialDist: dist,
                initialScale: textScales[idx] || 1,
                idx
            };
            setIsDragging(true);
            return;
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        dragRef.current = {
            startX: clientX,
            startY: clientY,
            initialX: textPositions[idx]?.x || 0,
            initialY: textPositions[idx]?.y || 0,
            idx
        };
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;

            // HANDLE PINCH ZOOM
            if ('touches' in e && (e as TouchEvent).touches.length === 2 && pinchRef.current) {
                e.preventDefault(); // Prevent page zooming
                const dist = getDistance((e as TouchEvent).touches);
                const scaleFactor = dist / pinchRef.current.initialDist;

                // Clamp scale (0.5x to 3x)
                let newScale = pinchRef.current.initialScale * scaleFactor;
                newScale = Math.max(0.5, Math.min(newScale, 3.0));

                const newScales = [...textScales];
                newScales[pinchRef.current.idx] = newScale;
                setTextScales(newScales);
                return;
            }

            // HANDLE DRAG (If single touch or mouse)
            if (!dragRef.current) return;
            if ('touches' in e && (e as TouchEvent).touches.length !== 1) return;

            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

            // Calculate scale roughly strictly for dragging sensitivity
            // The preview is 1080px wide internally, scaled down.
            // If displayed width is ~300px, scale is ~0.27.
            // Movement of 1px on screen = 1/0.27 px in internal units.
            // Let's assume a generic factor or calculate from an element if needed.
            // For now, let's use a multiplier (e.g. 3) to make it feel responsive on small screens
            // Or ideally, find the element width.
            const scaleFactor = 3.5; // Approximate for mobile/desktop preview sizes

            const deltaX = (clientX - dragRef.current.startX) * scaleFactor;
            const deltaY = (clientY - dragRef.current.startY) * scaleFactor;

            const newPositions = [...textPositions];
            newPositions[dragRef.current.idx] = {
                x: dragRef.current.initialX + deltaX,
                y: dragRef.current.initialY + deltaY
            };
            setTextPositions(newPositions);
        };

        const handleUp = () => {
            setIsDragging(false);
            dragRef.current = null;
            pinchRef.current = null;
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('touchmove', handleMove);
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchend', handleUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, textPositions, textScales]);

    useEffect(() => {
        // Initial Fetch for Today (managed by viewMode effect now, but keep distinct if needed)
        // fetch('/api/social/tiktok').then(res => res.ok ? res.json() : null).then(data => data?.title && setSocialContent(data));
        fetch('/api/backgrounds').then(res => res.json()).then(data => data.files && setAvailableFiles(data.files));
    }, []);

    // --- SEARCH ONLINE STATE ---
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [saveSettings, setSaveSettings] = useState({ type: 'futbol' as 'futbol' | 'basket' | 'portada' | 'comodin', tag: '' });
    // State variables removed (duplicates)
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [teamSearch, setTeamSearch] = useState(""); // NEW: Search for teams
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const getUniqueTeams = () => {
        const teams = new Set<string>();
        availableFiles.forEach(f => {
            const fname = getFilename(f);
            if (fname.includes('bg-') && (fname.includes('futbol') || fname.includes('basket')) && !fname.includes('comodin') && !fname.includes('portada')) {
                const parts = fname.split('-');
                if (parts[2]) teams.add(formatTeamName(parts[2]));
            }
        });
        return Array.from(teams).sort();
    };

    const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSaveSettings({ ...saveSettings, tag: val });

        if (val.length > 1) {
            const allTeams = getUniqueTeams();
            const filtered = allTeams.filter(t => t.toLowerCase().includes(val.toLowerCase()));
            setSuggestions(filtered.slice(0, 5));
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (name: string) => {
        setSaveSettings({ ...saveSettings, tag: name });
        setShowSuggestions(false);
    };


    // --- ERROR MODAL STATE ---
    const [errorAlert, setErrorAlert] = useState<{ show: boolean, title: string, msg: string }>({ show: false, title: '', msg: '' });

    // --- DELETE FOLDER MODAL STATE ---
    const [deleteFolderModal, setDeleteFolderModal] = useState<{ show: boolean, team: string, count: number, sport: string }>({ show: false, team: '', count: 0, sport: '' });

    const handleDeleteFolder = (team: string, sport: string) => {
        const filesToDelete = availableFiles.filter(f => {
            const fname = getFilename(f).toLowerCase();
            return fname.startsWith(`bg-${sport}-`) && fname.split('-')[2] === team;
        });

        if (filesToDelete.length === 0) return;

        setDeleteFolderModal({
            show: true,
            team: formatTeamName(team),
            count: filesToDelete.length,
            sport
        });
    };

    const confirmDeleteFolder = async () => {
        const { team, sport } = deleteFolderModal;
        try {
            const res = await fetch('/api/admin/delete-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team, sport })
            });
            if (res.ok) {
                setAvailableFiles(prev => prev.filter(f => !getFilename(f).toLowerCase().startsWith(`bg-${sport}-${team.replace(/\s+/g, '').toLowerCase()}`)));
                setDeleteFolderModal(prev => ({ ...prev, show: false }));
            }
        } catch (e) {
            console.error("Error deleting folder:", e);
        }
    };

    const performSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch('/api/admin/search-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery })
            });
            const data = await res.json();
            if (data.images) setSearchResults(data.images);
        } catch (e) { console.error(e); }
        setIsSearching(false);
    };

    const [confirmModal, setConfirmModal] = useState<{ show: boolean, onConfirm: () => void }>({ show: false, onConfirm: () => { } });

    // --- ADMIN STATE ---
    const [adminModalOpen, setAdminModalOpen] = useState(false);
    const [adminFilter, setAdminFilter] = useState<'futbol' | 'basket' | 'portada' | 'comodin'>('futbol');
    const [moveModal, setMoveModal] = useState<{ open: boolean, url: string, type: 'futbol' | 'basket' | 'portada' | 'comodin', tag: string }>({ open: false, url: '', type: 'futbol', tag: '' });

    const handleDeleteImage = async (url: string) => {
        if (!confirm("¿Seguro que quieres borrar esta imagen?")) return;
        try {
            const res = await fetch('/api/admin/manage-images', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (res.ok) {
                // Refresh
                const data = await fetch('/api/backgrounds').then(r => r.json());
                if (data.files) setAvailableFiles(data.files);
            } else {
                alert("Error al borrar");
            }
        } catch (e) { console.error(e); alert("Error de conexión"); }
    };

    const handleMoveImage = async () => {
        try {
            const res = await fetch('/api/admin/manage-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: moveModal.url, type: moveModal.type, tag: moveModal.tag })
            });
            if (res.ok) {
                const data = await fetch('/api/backgrounds').then(r => r.json());
                if (data.files) setAvailableFiles(data.files);
                setMoveModal({ ...moveModal, open: false });
            } else {
                const err = await res.json();
                alert(`Error al mover: ${err.error || 'Desconocido'}`);
            }
        } catch (e) { console.error(e); alert("Error de conexión"); }
    };

    const saveWebImage = async (url: string, force: boolean = false) => {
        if (!force && !saveSettings.tag.trim()) {
            setConfirmModal({
                show: true,
                onConfirm: () => saveWebImage(url, true)
            });
            return;
        }

        setIsSearching(true); // Reuse loading state
        try {
            const res = await fetch('/api/admin/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: url,
                    type: saveSettings.type,
                    tag: saveSettings.tag
                })
            });

            if (res.ok) {
                // Refresh list
                const data = await fetch('/api/backgrounds').then(r => r.json());
                if (data.files) setAvailableFiles(data.files);
                setSearchModalOpen(false);
            } else {
                const err = await res.json();
                setErrorAlert({
                    show: true,
                    title: "Imagen Protegida 🛡️",
                    msg: `Esta web bloquea las descargas externas.\n\nIntenta buscar otra versión de la misma foto o elige un resultado diferente.\n\nDetalle: ${err.error || 'Desconocido'}`
                });
            }
        } catch (e) {
            console.error(e);
            setErrorAlert({
                show: true,
                title: "Error de Conexión ⚠️",
                msg: "Hubo un problema al intentar guardar la imagen. Revisa tu conexión o intenta más tarde."
            });
        }
        setIsSearching(false);
    };

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
        const titleText = viewMode === 'tomorrow' ? "JUBILADORA PARA MAÑANA" : "JUBILADORA PARA HOY";

        if (config.useFullDate) {
            // Calculate date based on viewMode
            let dateToUse = new Date(rawDate || formattedDate);
            if (viewMode === 'tomorrow') {
                dateToUse.setDate(dateToUse.getDate() + 1);
            }

            // Format manually to ensure correct display
            const dayName = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(dateToUse);
            const dayNum = dateToUse.getDate();
            const monthName = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(dateToUse);
            const dateString = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;

            setConfig(prev => ({ ...prev, introTitle: `${titleText}\n${dateString}`, introEmoji1: '⚽', introEmoji2: '📅' }));
        } else {
            // Calculate day name
            let dateToUse = new Date();
            if (viewMode === 'tomorrow') dateToUse.setDate(dateToUse.getDate() + 1);
            const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dateToUse.getDay()];

            setConfig(prev => ({ ...prev, introTitle: `${titleText}\n(${dayName})`, introEmoji1: '🤫', introEmoji2: '✅' }));
        }
    }, [config.useFullDate, viewMode]);

    const calculateInitialOdds = (addHundred: boolean) => {
        let totalOdd = 1;
        const rawBets = localPredictions?.bets || (Array.isArray(localPredictions) ? localPredictions : []);
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

    useEffect(() => setConfig(prev => ({ ...prev, introSubtitle: calculateInitialOdds(prev.addHundred) })), [localPredictions, viewMode]);

    const parseBetDisplay = (match: string, pick: string) => {
        if (!match) return { match: "Evento Desconocido", pick: pick || "" };
        const cleanMatch = match.replace(/\s*vs\s*/i, " vs ").trim();
        const teams = cleanMatch.split(" vs ");
        const displayMatch = cleanMatch.split("(")[0].trim();
        let displayPick = pick ? pick.toLowerCase().trim() : "";
        if (displayPick.startsWith("1 ") || displayPick === "1") displayPick = teams[0] || "Local";
        else if (displayPick.startsWith("2 ") || displayPick === "2") displayPick = teams[1] || "Visitante";
        else if (displayPick.startsWith("x ") || displayPick === "x") displayPick = "Empate";
        else if (displayPick.toLowerCase() === "1x") displayPick = `${teams[0] || "Local"} o Empate`;
        else if (displayPick.toLowerCase() === "x2") displayPick = `Empate o ${teams[1] || "Visitante"}`;
        else if (displayPick.toLowerCase() === "12") displayPick = `${teams[0] || "Local"} o ${teams[1] || "Visitante"}`;
        else {
            displayPick = displayPick.replace(/Apuesta/gi, "").replace(/Ganador/gi, "").replace(/Gana/gi, "").replace(/Del Partido/gi, "").replace(/Doble Oportunidad/gi, "").replace(/\(.*\)/g, "").replace(/\bAH\b/gi, "Hándicap").replace(/^[\s\-\:]+|[\s\-\:]+$/g, "").trim();
            displayPick = displayPick.replace(/\blocal\b/gi, teams[0] || "Local").replace(/\bvisitante\b/gi, teams[1] || "Visitante");

            // Capitalize first letter
            displayPick = displayPick.charAt(0).toUpperCase() + displayPick.slice(1);
        }
        return { match: displayMatch, pick: displayPick };
    };

    const getAllSelections = () => {
        const flatBets: any[] = [];
        const rawBets = localPredictions?.bets || (Array.isArray(localPredictions) ? localPredictions : []);
        if (rawBets.length === 0) {
            if (localPredictions?.safe) rawBets.push(localPredictions.safe);
            if (localPredictions?.value) rawBets.push(localPredictions.value);
            if (localPredictions?.funbet) rawBets.push(localPredictions.funbet);
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
            if (!groups[key]) groups[key] = { matchDisplay: match, sport: bet.sport, picks: [] };

            // Format Odd: ensure it has + if it's American style or just clear
            let rawOdd = bet.total_odd || bet.odd || bet.price || '';
            let displayOdd = "";
            if (rawOdd) {
                const num = parseFloat(rawOdd);
                if (!isNaN(num)) {
                    if (num > 10) displayOdd = `+${Math.round(num)}`;
                    else displayOdd = `+${num.toFixed(2)}`;
                } else {
                    displayOdd = rawOdd.toString().startsWith('+') ? rawOdd.toString() : `+${rawOdd}`;
                }
            }

            groups[key].picks.push({ rawPick: pick, odd: displayOdd });
        });

        const groupedList = Object.values(groups);
        const teamsWithBg: any = { football: new Set(), basketball: new Set() };
        availableFiles.forEach(f => {
            const fname = getFilename(f).toLowerCase();
            if (fname.includes('bg-')) {
                const p = fname.split('-');
                if (p.length >= 3) teamsWithBg[f.includes('basket') ? 'basketball' : 'football'].add(p[2]); // Note: p[2] from filename "bg-sport-team.png" is team
            }
        });

        const mappedList = groupedList.map(g => {
            const rawMatchDisplay = g.matchDisplay; // No sport icons here

            // Featured detection logic (RESTORED)
            const clean = (s: string) => s.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "");

            const mt = clean(g.matchDisplay);
            let isFeatured = false;

            const relevantSet = teamsWithBg[(g.sport || '').includes('basket') ? 'basketball' : 'football'];
            const relevant = Array.from(relevantSet) as string[];

            for (let t of relevant) {
                if (t === 'comodin') continue;
                const cleanTeam = clean(t);
                if (cleanTeam.length < 3) continue;
                if (mt.includes(cleanTeam)) {
                    isFeatured = true;
                    break;
                }
            }

            const getPickIcon = (text: string, sport: string, matchTitle: string) => {
                const t = text.toLowerCase();
                const m = matchTitle.toLowerCase();

                // 1. Player Props / Basket
                if (t.includes('puntos') || t.includes('rebotes') || t.includes('asistencias') || sport.includes('basket')) {
                    if (t.includes('puntos')) return '🏀 ';
                }

                // 2. Props
                if (t.includes('córners') || t.includes('corners')) return '⛳ ';
                if (t.includes('tarjetas')) return '🟨 ';

                // 3. Shots
                if (t.includes('remates')) {
                    if (t.includes('totales')) return '🥅 ';
                    return '🎯 ';
                }

                // 4. Handicap -> Pin
                if (t.includes('hándicap') || t.includes('handicap')) return '📌 ';

                // 5. BTTS / Goals -> Ball
                if (t.includes('ambos marcan') || t.includes('ambos gol') || t.includes('ambos equipos') || t.includes('goles') || t.includes('gol')) return '⚽ ';

                // 6. Double Chance Expanded -> Pin
                // Expanded double chance often contains "o empate", "empate o", or just " o " (for 12: Team A o Team B)
                if (t.includes('o empate') || t.includes('empate o') || t.includes(' o ')) return '📌 ';

                // Team Name Smart Match
                const teams = m.split(' vs ').map(tm => tm.trim().toLowerCase());

                // Check if any significant word from team names appears in the pick
                const isTeamMentioned = teams.some(team => {
                    const teamWords = team.split(/\s+/).filter(w => w.length > 3);
                    return teamWords.some(word => t.includes(word));
                });

                if (isTeamMentioned || t === 'empate' || t.includes('empate')) {
                    return '✅ ';
                }

                return '';
            };

            return {
                ...g,
                matchDisplay: rawMatchDisplay,
                picks: g.picks.map((item: any) => {
                    const { pick } = parseBetDisplay(g.matchDisplay, item.rawPick);

                    // 1. Shorthand replacement (+ / -)
                    let cleanPick = pick.replace(/más de\s*/gi, '+')
                        .replace(/menos de\s*/gi, '-');

                    // 2. Title Case for players/names
                    const formattedPick = cleanPick.split(/\s+/)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');

                    return {
                        text: `${getPickIcon(formattedPick, g.sport || '', g.matchDisplay)}${formattedPick}`,
                        odd: item.odd
                    };
                }),
                isFeatured
            };
        });

        if (onlyFootball) {
            return mappedList.filter(g => {
                const sport = (g.sport || '').toLowerCase();
                return !sport.includes('basket') && !sport.includes('nba');
            });
        }
        return mappedList;
    };

    useEffect(() => {
        setSlideGroups(getAllSelections());
    }, [localPredictions, onlyFootball, availableFiles, viewMode]);


    // slidesData moved up

    useEffect(() => {
        if (availableFiles.length && slidesData.length) {
            const newBgs: string[] = [];
            const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

            // Robust cleaning (Match with getAllSelections)
            const clean = (s: string) => s.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "");

            const portadas = availableFiles.filter(f => getFilename(f).includes('portada'));
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
                        const ms = availableFiles.filter(f => {
                            const fname = getFilename(f);
                            return !fname.includes('comodin') && fname.includes(mainSport.includes('basket') ? 'basket' : 'futbol') && clean(fname).includes(ct);
                        });
                        if (ms.length) { sel = pick(ms); break; }
                    }
                    if (sel) break;
                }
                if (!sel) {
                    const coms = availableFiles.filter(f => getFilename(f).includes('comodin') && getFilename(f).includes(mainSport.includes('basket') ? 'basket' : 'futbol'));
                    const av = coms.filter(c => c !== last);
                    sel = av.length ? pick(av) : (pick(coms) || 'bg-comodin.png');
                }
                newBgs.push(sel);
                last = sel;
            });
            const outros = availableFiles.filter(f => getFilename(f).includes('futbol') && getFilename(f).includes('comodin'));
            newBgs.push(outros.length ? pick(outros) : 'bg-outro.png');
            setConfig(p => ({ ...p, bgSelection: newBgs }));
        }
    }, [availableFiles, slidesData.length]);

    const handleBgChange = (i: number, bg: string) => { const n = [...config.bgSelection]; n[i] = bg; setConfig(p => ({ ...p, bgSelection: n })); };
    const generate = async () => {
        if (!containerRef.current) return;
        setGenerating(true); setImages([]);

        // Aseguramos que las fuentes estén cargadas antes de capturar
        if (typeof document !== 'undefined') {
            await document.fonts.ready;
        }

        await new Promise(r => setTimeout(r, 800));
        const imgs = [];
        for (let c of Array.from(containerRef.current.children) as HTMLElement[]) {
            try {
                const cvs = await html2canvas(c, {
                    scale: 2, // Mayor calidad para evitar pixelado y mejorar alineación
                    useCORS: true,
                    width: 1080,
                    height: 1350,
                    backgroundColor: null, // Evita fondos sólidos inesperados
                    logging: false
                });
                imgs.push(cvs.toDataURL('image/png'));
            } catch (e) {
                console.error("Error generating slide:", e);
            }
        }
        setImages(imgs); setGenerating(false);
    }
    const download = (url: string, i: number) => { const a = document.createElement('a'); a.href = url; a.download = `slide-${i + 1}.png`; a.click(); };
    const downloadAll = () => images.forEach((img, i) => download(img, i));

    const openImageSelectorSmart = (idx: number) => {
        const file = config.bgSelection[idx];
        setImageSelector({ idx });

        if (!file) return;
        const name = getFilename(file).toLowerCase();

        // Default reset
        setBgFilter('all');
        setBgTeamSelected(null);

        if (name.includes('portada')) {
            setBgFilter('portada');
        } else if (name.includes('comodin')) {
            setBgFilter('comodin');
        } else if (name.includes('bg-futbol-') || name.includes('bg-basket-')) {
            // Optimistic parsing: bg-sport-team-...
            // We use the original filename to get parts, but ensure comparison is safe
            const parts = getFilename(file).split('-');
            const sport = parts[1];
            const team = parts[2];

            if (sport && team && (sport === 'futbol' || sport === 'basket')) {
                setBgFilter('equipo');
                setBgSportForTeam(sport as 'futbol' | 'basket');
                setBgTeamSelected(team.toLowerCase());
            } else {
                // Fallback if structure fits but team missing?
                setBgFilter(sport as any || 'all');
            }
        }
    };

    const smartSelectBackgrounds = () => setAvailableFiles([...availableFiles]); // Toggle for effect re-run
    const triggerTouchFeedback = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50); };

    // --- SHARED RENDERER ---
    const renderSlideContent = (index: number, isPreview = false) => {
        const pos = textPositions[index] || { x: 0, y: 0 };
        const scale = textScales[index] || 1;

        const style = {
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            cursor: isPreview ? 'grab' : 'default',
            touchAction: 'none'
        };

        const titleBoxStyle = {
            transform: `scale(${config.titleScale || 1.0})`,
            transformOrigin: 'center'
        };

        const betsBoxStyle = {
            transform: `scale(${config.betsScale || 1.0})`,
            transformOrigin: 'center'
        };

        const oddsBoxStyle = {
            transform: `scale(${config.oddsScale || 1.0})`,
            transformOrigin: 'center'
        };

        const handlers = isPreview ? {
            onMouseDown: (e: any) => handleDragStart(e, index),
            onTouchStart: (e: any) => handleDragStart(e, index)
        } : {};

        // 1. INTRO
        if (index === 0) {
            return (
                <div className="relative z-10 w-full flex flex-col items-center gap-14 p-8" style={style} {...handlers}>
                    <div className="flex flex-col items-center gap-4 w-full">
                        <div className="bg-white px-12 pt-0 pb-8 rounded-2xl w-fit max-w-[90%] flex items-center justify-center pointer-events-none">
                            <h1 className={`font-black text-black ${(config as any).introItalic ? 'italic' : ''} tracking-tighter leading-none whitespace-nowrap text-center`} style={{ fontSize: `${config.introTitleSize}rem` }}>
                                {config.introTitle.split('\n')[0]}
                            </h1>
                        </div>
                        <div className="bg-white px-12 pt-0 pb-8 rounded-2xl flex items-center justify-center gap-6 w-fit max-w-[95%] pointer-events-none">
                            <h1 className={`font-black text-black ${(config as any).introItalic ? 'italic' : ''} tracking-tighter leading-none whitespace-nowrap`} style={{ fontSize: `${config.introSubSize}rem` }}>
                                {config.introTitle.split('\n')[1] || ''}
                            </h1>
                            <div className="flex items-center gap-4 -mt-4">
                                {config.introEmoji1 && <span className="text-5xl filter drop-shadow">{config.introEmoji1}</span>}
                                {config.introEmoji2 && <span className="text-5xl filter drop-shadow">{config.introEmoji2}</span>}
                            </div>
                        </div>
                    </div>
                    {config.showOdds && config.introSubtitle && (
                        <div className="bg-white px-14 py-8 rounded-2xl mt-8 flex items-center justify-center pointer-events-none">
                            <span className="text-6xl font-black text-black uppercase tracking-tighter leading-none" style={{ fontFamily: 'var(--font-retro)' }}>
                                {config.introSubtitle}
                            </span>
                        </div>
                    )}
                </div>
            );
        }

        // 3. OUTRO
        if (index === slidesData.length + 1) {
            return (
                <div className="relative z-10 w-full flex flex-col items-center gap-16 p-12" style={style} {...handlers}>
                    <div className="bg-white px-10 pt-2 pb-12 rounded-2xl max-w-[95%] text-center pointer-events-none border-[3px] border-white shadow-xl"><h2 className="font-black text-black uppercase tracking-tighter leading-tight whitespace-pre-line -mt-3" style={{ fontSize: `${config.outroTitleSize}rem` }}>{config.outroTitle}</h2></div>
                    <div className="bg-white px-12 pt-1 pb-10 rounded-2xl pointer-events-none border-[3px] border-white shadow-xl"><p className="font-black text-black uppercase tracking-tight -mt-2" style={{ fontSize: `${config.outroSubSize}rem` }}>{config.outroSub}</p></div>
                </div>
            );
        }

        // 2. BETS
        const chunkIndex = index - 1;
        const chunk = slidesData[chunkIndex];
        if (!chunk) return null;

        return (
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 gap-16 pb-[80px]" style={style} {...handlers}>
                {chunk.map((group: any, bIdx: number) => (
                    <div key={bIdx} className="w-full flex flex-col items-center relative">

                        {/* TÍTULO PARTIDO - Estilo Etiqueta Negra (TikTok Retro - Kurale) */}
                        {/* TÍTULO PARTIDO - Estilo Etiqueta Negra (TikTok Retro - Kurale) */}
                        <div className={`bg-black px-10 rounded-xl z-20 shadow-lg flex items-center justify-center ${config.showTitleBorder ? 'border-[3px] border-white' : ''}`} style={{ ...titleBoxStyle, marginBottom: `${config.gapBody}px`, paddingTop: `${0 + ((config as any).boxPaddingY || 0)}px`, paddingBottom: `${6 + ((config as any).boxPaddingY || 0)}px` }}>
                            <h3 className="text-white italic font-black tracking-normal leading-none text-center -mt-5" style={{ fontFamily: 'var(--font-retro)', fontSize: `${config.matchTitleSize}rem` }}>
                                {group.matchDisplay}
                            </h3>
                        </div>

                        {/* BLOQUES DE APUESTAS Y CUOTAS SEPARADOS */}
                        <div className="w-full flex flex-col items-center justify-center gap-5 z-10">
                            <div className="bg-white px-10 rounded-[32px] w-fit max-w-[95%] flex flex-col items-start justify-center shadow-2xl border-[6px] border-white gap-16" style={{ ...betsBoxStyle, paddingTop: `${1 + ((config as any).boxPaddingY || 0)}px`, paddingBottom: `${8 + ((config as any).boxPaddingY || 0)}px` }}>
                                {group.picks.map((item: any, pIdx: number) => (
                                    <div key={pIdx} className="w-full flex flex-col items-start py-1">
                                        <div className="flex flex-col items-start gap-8 w-full">
                                            {item.text.split('\n').filter((l: string) => l.trim()).map((line: string, lIdx: number) => (
                                                <span key={`${pIdx}-${lIdx}`} className="text-black italic font-black tracking-tight leading-none text-left -mt-4" style={{ fontFamily: 'var(--font-retro)', fontSize: `${config.pickTextSize}rem` }}>
                                                    {line}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* NUEVO BLOQUE DE CUOTA TOTAL SEPARADO */}
                            {config.showPickOdds && (
                                <div className="bg-white px-8 pt-0 pb-6 rounded-xl shadow-xl flex items-center justify-center border-[3px] border-white" style={{ ...oddsBoxStyle, marginTop: `${(config as any).gapOdds}px` }}>
                                    <span className="text-black italic font-black tracking-tighter leading-none -mt-3" style={{ fontFamily: 'var(--font-retro)', fontSize: `${config.pickOddSize}rem` }}>
                                        {/* Calcular cuota total o mostrar la del primer pick si es simple */}
                                        +{group.picks.length > 1
                                            ? (group.picks.reduce((acc: number, curr: any) => {
                                                const val = parseFloat((curr.odd || '0').toString().replace(',', '.').replace(/[^\d.-]/g, ''));
                                                return acc * (isNaN(val) ? 1 : val);
                                            }, 1)).toFixed(2)
                                            : parseFloat((group.picks[0]?.odd || '0').toString().replace(',', '.').replace(/[^\d.-]/g, '')).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // --- FILTER VIRAL CONTENT ---
    const getProcessedSocialContent = () => {
        if (!socialContent) return null;

        let title = socialContent.title || "";
        let desc = socialContent.description || socialContent.caption || "";

        // 1. Clean Markdown (TikTok doesn't support bold)
        const clean = (t: string) => t.replace(/\*\*/g, '');
        title = clean(title);
        desc = clean(desc);

        // 2. Filter Sports if enabled
        if (onlyFootball) {
            const filter = (t: string) => {
                const blacklist = ['🏀', 'basket', 'nba', 'puntos', 'rebotes', 'asistencias', 'triples', 'euroleague', 'nbb', 'ncaa', 'pintura', 'cba', 'l NB', 'euroliga'];
                return t.split('\n').filter(line => {
                    const l = line.toLowerCase();
                    return !blacklist.some(word => l.includes(word));
                }).join('\n');
            };
            title = filter(title);
            desc = filter(desc);
        }

        return { ...socialContent, title, description: desc };
    };
    const processedSocialContent = getProcessedSocialContent();

    // --- RENDER ---
    return (
        <div className="max-w-[1600px] mx-auto pb-10 space-y-6 select-none">

            {/* === MOBILE LAYOUT (Tabs) === */}
            <div className="md:hidden space-y-6">
                {/* 1. TOP NAVIGATION */}
                <div className="flex items-center justify-start gap-3 overflow-x-auto pb-2 scrollbar-hide px-2 snap-x">
                    <TabButton id="editor" label="Editor" icon={MonitorPlay} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="bg" label="Fondos" icon={Palette} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="portada" label="Portada" icon={LayoutTemplate} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="bets" label="Apuestas" icon={Type} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="outro" label="Cierre" icon={Megaphone} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="settings" label="Ajustes" icon={Settings2} activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>

                {/* VIRAL MODE TOGGLE (MOBILE) */}
                <div className="px-4">
                    <div className="flex bg-[#1a1a1a] rounded-xl border border-white/10 p-1">
                        <button
                            onClick={() => setViewMode('today')}
                            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                ${viewMode === 'today' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                            HOY
                        </button>
                        <button
                            onClick={() => setViewMode('tomorrow')}
                            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1
                                ${viewMode === 'tomorrow' ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                            <span>MAÑANA</span>
                        </button>
                    </div>
                </div>

                {/* 2. CONTENT AREA */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-[500px]">
                    {/* TAB 1: EDITOR */}
                    {activeTab === 'editor' && (
                        <>
                            {/* SOLO FUTBOL TV (Mobile) */}
                            {/* MOVED TO BUTTON COLUMN */}

                            <div className="w-full max-w-lg mx-auto flex flex-row items-center justify-center gap-4 px-2">
                                <div className="relative aspect-[9/16] w-full max-w-[200px] bg-black rounded-3xl border border-white/10 shadow-2xl overflow-hidden group shrink-0">
                                    {/* LIVE PREVIEW (Mobile) */}
                                    <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
                                        {/* Scaled Render */}
                                        <div className="w-[1080px] h-[1350px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.18] lg:scale-[0.25] origin-center flex flex-col items-center justify-center bg-black">
                                            <img src={getImageSrc(config.bgSelection[currentPreviewIdx])} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                            {renderSlideContent(currentPreviewIdx, true)}
                                        </div>

                                        {/* Overlay Controls */}
                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-center gap-4 z-20">
                                            <button onClick={() => setCurrentPreviewIdx(Math.max(0, currentPreviewIdx - 1))} className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur"><ChevronLeft className="text-white" size={16} /></button>
                                            <div className="flex gap-2">
                                                {images.length > 0 && <button onClick={() => setPreviewImg(images[currentPreviewIdx])} className="p-2 bg-white text-black rounded-lg hover:scale-110 transition"><ScanEye size={16} /></button>}
                                            </div>
                                            <button onClick={() => setCurrentPreviewIdx(Math.min((slidesData.length + 1), currentPreviewIdx + 1))} className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur"><ChevronRight className="text-white" size={16} /></button>
                                        </div>
                                        <div className="absolute top-4 right-4 flex gap-2 z-20 pointer-events-none">
                                            {images[currentPreviewIdx] && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); download(images[currentPreviewIdx], currentPreviewIdx); }}
                                                    className="pointer-events-auto p-1.5 bg-black/60 hover:bg-emerald-500 rounded-full border border-white/10 text-white/70 hover:text-white transition-all shadow-lg backdrop-blur"
                                                >
                                                    <Download size={12} />
                                                </button>
                                            )}
                                            <div className="px-2 py-0.5 bg-black/60 rounded text-[10px] text-white/50 border border-white/5 flex items-center">{currentPreviewIdx + 1}/{slidesData.length + 2}</div>
                                        </div>

                                        {/* SLIDERS (Mobile) */}
                                        {currentPreviewIdx > 0 && currentPreviewIdx < slidesData.length + 1 && (
                                            <>
                                                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[80%] z-30 flex flex-col gap-1 items-center bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                                                    <div className="flex justify-between w-full text-[7px] font-black text-white/60 uppercase px-1"><span>Título</span><span>{Math.round(config.titleScale * 100)}%</span></div>
                                                    <input type="range" min="0.5" max="1.8" step="0.01" value={config.titleScale} onChange={e => setConfig({ ...config, titleScale: parseFloat(e.target.value) })} className="w-full h-1 accent-emerald-500 bg-white/10 rounded-full appearance-none" />
                                                </div>
                                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[80%] z-30 flex flex-col gap-1 items-center bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                                                    <div className="flex justify-between w-full text-[7px] font-black text-white/60 uppercase px-1"><span>Apuestas</span><span>{Math.round(config.betsScale * 100)}%</span></div>
                                                    <input type="range" min="0.5" max="1.8" step="0.01" value={config.betsScale} onChange={e => setConfig({ ...config, betsScale: parseFloat(e.target.value) })} className="w-full h-1 accent-sky-500 bg-white/10 rounded-full appearance-none" />
                                                </div>
                                                {config.showPickOdds && (
                                                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[80%] z-40 flex flex-col gap-1 items-center bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10">
                                                        <div className="flex justify-between w-full text-[7px] font-black text-white/60 uppercase px-1"><span>Cuotas</span><span>{Math.round(config.oddsScale * 100)}%</span></div>
                                                        <input type="range" min="0.5" max="1.5" step="0.01" value={config.oddsScale} onChange={e => setConfig({ ...config, oddsScale: parseFloat(e.target.value) })} className="w-full h-1 accent-amber-500 bg-white/10 rounded-full appearance-none" />
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* MOBILE SETTINGS OVERLAY (NEW) */}
                                        {mobileSettingsOpen && (
                                            <div className="absolute inset-x-4 bottom-16 z-50 flex flex-col items-center gap-3 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 animate-in slide-in-from-bottom-2 fade-in duration-200">

                                                {/* Property Selector */}
                                                <div className="flex items-center justify-between w-full gap-2 mb-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); cycleMobileProperty(-1); }}
                                                        className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white/70"
                                                    >
                                                        <ChevronLeft size={16} />
                                                    </button>

                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Ajustar propiedad</span>
                                                        <span className="text-sm font-black text-white">{mobileConfigProperties[currentMobilePropIdx].label}</span>
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); cycleMobileProperty(1); }}
                                                        className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white/70"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </div>

                                                {/* Controls */}
                                                <div className="w-full space-y-2">
                                                    {mobileConfigProperties[currentMobilePropIdx].type === 'range' ? (
                                                        <>
                                                            <div className="flex justify-between w-full text-[9px] font-mono text-white/50 px-1">
                                                                <span>Min</span>
                                                                <span className="text-emerald-400 font-bold">{(config as any)[mobileConfigProperties[currentMobilePropIdx].key]}</span>
                                                                <span>Max</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min={mobileConfigProperties[currentMobilePropIdx].min}
                                                                max={mobileConfigProperties[currentMobilePropIdx].max}
                                                                step={mobileConfigProperties[currentMobilePropIdx].step}
                                                                value={(config as any)[mobileConfigProperties[currentMobilePropIdx].key]}
                                                                onChange={(e) => setConfig({ ...config, [mobileConfigProperties[currentMobilePropIdx].key]: parseFloat(e.target.value) })}
                                                                className="w-full h-2 accent-emerald-500 bg-white/10 rounded-full appearance-none cursor-pointer"
                                                            />
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-4 py-2">
                                                            <button
                                                                onClick={() => setConfig({ ...config, [mobileConfigProperties[currentMobilePropIdx].key]: !(config as any)[mobileConfigProperties[currentMobilePropIdx].key] })}
                                                                className={`px-6 py-2 rounded-xl font-bold text-xs uppercase transition-all ${(config as any)[mobileConfigProperties[currentMobilePropIdx].key] ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/10 text-white/40'}`}
                                                            >
                                                                {(config as any)[mobileConfigProperties[currentMobilePropIdx].key] ? 'ACTIVADO' : 'DESACTIVADO'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 w-[100px] shrink-0">
                                    <button
                                        onClick={() => setMobileSettingsOpen(!mobileSettingsOpen)}
                                        className={`btn-active-effect border font-bold py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 h-[60px] transition-all ${mobileSettingsOpen ? 'bg-zinc-700 text-white border-white/30' : 'bg-black/40 border-white/10 text-white/40 hover:text-white'}`}
                                    >
                                        <Settings2 size={18} className={mobileSettingsOpen ? 'animate-spin-slow' : ''} />
                                        <span className="text-[8px] uppercase leading-tight text-center">Ajustes</span>
                                    </button>
                                    <button onClick={() => setShowSocialModal(true)} disabled={!socialContent} className="btn-active-effect bg-purple-100 dark:bg-purple-600/20 hover:bg-purple-200 dark:hover:bg-purple-600/30 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-400 font-bold py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 h-[70px]"><ScanEye size={18} /><span className="text-[9px] uppercase">Viral</span></button>
                                    <button onClick={generate} disabled={generating} className="btn-active-effect bg-white hover:bg-gray-100 text-black font-black py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/5 dark:shadow-white/10 h-[70px] border border-gray-100"><span className="text-black">{generating ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}</span> <span className="text-[9px] uppercase text-black">{generating ? '...' : 'Generar'}</span></button>
                                    <button onClick={() => images.forEach((img, i) => download(img, i))} disabled={!images.length} className="btn-active-effect bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-900/20 disabled:opacity-50 h-[70px]"><Save size={18} /><span className="text-[9px] uppercase">Bajar</span></button>
                                </div>
                            </div>
                        </>
                    )}
                    {/* TAB 2: PORTADA */}
                    {activeTab === 'portada' && (
                        <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#121212] border border-border/10 dark:border-white/10 rounded-2xl p-6 space-y-6 shadow-lg shadow-black/5 dark:shadow-none">
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider block mb-2">Título Principal</label><textarea value={config.introTitle} onChange={e => setConfig({ ...config, introTitle: e.target.value })} className="w-full bg-secondary/30 dark:bg-black/50 border border-border/10 dark:border-white/10 rounded-xl p-3 text-foreground dark:text-white text-sm font-bold min-h-[80px] focus:border-emerald-500/50 outline-none" /><div className="mt-2 flex items-center gap-2"><input type="checkbox" checked={config.useFullDate} onChange={(e) => setConfig({ ...config, useFullDate: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><label className="text-[10px] text-muted-foreground dark:text-white/50">Fecha Larga + Iconos</label></div></div>
                                <div className="grid grid-cols-2 gap-3"><div><label className="text-[9px] text-muted-foreground dark:text-white/30 uppercase mb-1 block">Emoji 1</label><input value={config.introEmoji1} onChange={e => setConfig({ ...config, introEmoji1: e.target.value })} className="w-full bg-secondary/30 dark:bg-black/50 border border-border/10 dark:border-white/10 rounded-lg p-2 text-center text-foreground dark:text-white" /></div><div><label className="text-[9px] text-muted-foreground dark:text-white/30 uppercase mb-1 block">Emoji 2</label><input value={config.introEmoji2} onChange={e => setConfig({ ...config, introEmoji2: e.target.value })} className="w-full bg-secondary/30 dark:bg-black/50 border border-border/10 dark:border-white/10 rounded-lg p-2 text-center text-foreground dark:text-white" /></div></div>
                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase">Cuota Sticker</label><div className="flex items-center gap-1"><input type="checkbox" checked={config.showOdds} onChange={(e) => setConfig({ ...config, showOdds: e.target.checked })} className="accent-emerald-500 w-3 h-3" /><span className="text-[9px] text-muted-foreground dark:text-white/50">Mostrar</span></div><div className="flex items-center gap-1"><input type="checkbox" checked={config.addHundred} onChange={(e) => { const c = e.target.checked; let val = parseInt(config.introSubtitle.replace(/\D/g, '')) || 0; setConfig({ ...config, addHundred: c, introSubtitle: `+${c ? val * 10 : Math.round(val / 10)} 📈` }) }} className="accent-emerald-500 w-3 h-3" /><span className="text-[9px] text-muted-foreground dark:text-white/50">x10</span></div></div><input value={config.introSubtitle} onChange={e => setConfig({ ...config, introSubtitle: e.target.value })} className="w-full bg-secondary/30 dark:bg-black/50 border border-border/10 dark:border-white/10 rounded-xl p-3 text-foreground dark:text-white text-sm font-bold outline-none focus:border-emerald-500/50" /></div>

                            </div>
                        </div>
                    )}
                    {/* TAB 3: APUESTAS */}
                    {activeTab === 'bets' && (
                        <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#121212] border border-border/10 dark:border-white/10 rounded-2xl p-4 shadow-lg shadow-black/5 dark:shadow-none">
                            {/* SOLO FÚTBOL TOGGLE (Mobile) */}
                            <button
                                onClick={() => setOnlyFootball(!onlyFootball)}
                                className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition-all mb-4 group ${onlyFootball
                                    ? 'bg-emerald-500/10 border-emerald-500/50 hover:bg-emerald-500/20'
                                    : 'bg-black/40 border-white/5 hover:bg-black/60 hover:border-white/10'
                                    }`}
                            >
                                <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${onlyFootball ? 'text-emerald-400' : 'text-white/60 group-hover:text-white/80'}`}>
                                    Solo Fútbol
                                </span>
                                <div className={`relative w-8 h-4 rounded-full transition-colors ${onlyFootball ? 'bg-emerald-500/30' : 'bg-white/10'}`}>
                                    <div className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-300 ${onlyFootball
                                        ? 'left-[18px] bg-emerald-400'
                                        : 'left-1 bg-white/40'
                                        }`} />
                                </div>
                            </button>

                            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                {!slideGroups.length && <p className="text-center text-xs text-muted-foreground dark:text-white/30 py-8">No hay apuestas cargadas</p>}
                                {slideGroups.map((group: any, gIdx: number) => (
                                    <div key={gIdx} className="bg-secondary/30 dark:bg-black/30 rounded-xl p-3 border border-border/10 dark:border-white/5 hover:border-sky-500/30 transition-colors">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input value={group.matchDisplay} onChange={(e) => { const n = [...slideGroups]; n[gIdx].matchDisplay = e.target.value; setSlideGroups(n); }} className="bg-transparent border-b border-white/10 w-full text-xs font-bold text-sky-500 dark:text-sky-400 focus:border-sky-500 outline-none pb-1" />
                                            <button onClick={() => { const n = [...slideGroups]; n[gIdx].isFeatured = !n[gIdx].isFeatured; setSlideGroups(n); }} className={`p-1.5 rounded-lg border ${group.isFeatured ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white/5 border-white/5 text-muted-foreground dark:text-white/20'}`}><ScanEye size={12} /></button>
                                        </div>
                                        <div className="space-y-3 pl-2 border-l border-white/10">
                                            {group.picks.map((item: any, pIdx: number) => (
                                                <div key={pIdx} className="space-y-1">
                                                    <textarea value={item.text} onChange={(e) => { const n = [...slideGroups]; n[gIdx].picks[pIdx].text = e.target.value; setSlideGroups(n); }} rows={2} className="bg-transparent w-full text-[10px] text-foreground/70 dark:text-white/60 focus:text-foreground dark:focus:text-white outline-none resize-y min-h-[40px] whitespace-pre-wrap" />
                                                    <div className="flex items-center gap-1.5 opacity-60">
                                                        <span className="text-[8px] font-bold text-sky-400 uppercase">Cuota</span>
                                                        <input value={item.odd} onChange={(e) => { const n = [...slideGroups]; n[gIdx].picks[pIdx].odd = e.target.value; setSlideGroups(n); }} className="bg-black/20 border border-white/5 rounded px-1.5 py-0.5 text-[9px] text-white/50 w-16" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* TAB 4: CIERRE */}
                    {activeTab === 'outro' && (
                        <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#121212] border border-border/10 dark:border-white/10 rounded-2xl p-6 space-y-6 shadow-lg shadow-black/5 dark:shadow-none">
                            <div><label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-2">Título Cierre</label><textarea value={config.outroTitle} onChange={e => setConfig({ ...config, outroTitle: e.target.value })} className="w-full bg-secondary/30 dark:bg-black/50 border border-border/10 dark:border-white/10 rounded-xl p-3 text-foreground dark:text-white text-sm font-bold min-h-[60px] focus:border-purple-500/50 outline-none" /></div>
                            <div><label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block mb-2">Subtítulo</label><textarea value={config.outroSub} onChange={e => setConfig({ ...config, outroSub: e.target.value })} className="w-full bg-secondary/30 dark:bg-black/50 border border-border/10 dark:border-white/10 rounded-xl p-3 text-foreground dark:text-white text-sm font-bold min-h-[50px] focus:border-purple-500/50 outline-none" /></div>
                        </div>
                    )}
                    {/* TAB 5: FONDOS (Renumbered to 6 technically but kept as is in flow) */}
                    {activeTab === 'bg' && (
                        <div className="w-full max-w-lg mx-auto bg-[#121212] border border-white/10 rounded-2xl p-6">
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setSearchModalOpen(true)} className="flex-1 py-2 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-xl text-xs font-bold hover:bg-sky-500/20 transition flex items-center justify-center gap-2"><Search size={14} /> BUSCAR</button>
                                <button onClick={() => { setAvailableFiles([...availableFiles]); }} className="flex-1 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition flex items-center justify-center gap-2"><RefreshCw size={14} /> REGENERAR</button>
                                <button onClick={() => setAdminModalOpen(true)} className="flex-1 py-2 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-xl text-xs font-bold hover:bg-purple-500/20 transition flex items-center justify-center gap-2"><Settings size={14} /> ADMIN</button>
                            </div>
                            <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar p-1 mb-4">
                                {config.bgSelection.map((bg, i) => (
                                    <div key={i} className="group relative" onClick={() => openImageSelectorSmart(i)}>
                                        <div className="aspect-[9/16] bg-black/50 rounded-lg overflow-hidden border border-white/10 group-hover:border-sky-500 transition relative">
                                            <img src={getImageSrc(bg)} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" />
                                            {/* PREVIEW OVERLAY */}
                                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                                <div className="w-[1080px] h-[1350px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.11] origin-center flex flex-col justify-center items-center">
                                                    {renderSlideContent(i, false)}
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <button className="p-1.5 bg-amber-500 rounded-full text-black hover:scale-110"><RefreshCw size={12} /></button>
                                            </div>
                                        </div>
                                        <p className="text-[8px] text-center text-white/30 mt-1">Slide {i + 1}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 6: AJUSTES (RESTORED) */}
                    {activeTab === 'settings' && (
                        <div className="w-full max-w-lg mx-auto bg-white dark:bg-[#121212] border border-border/10 dark:border-white/10 rounded-2xl p-6 space-y-6 shadow-lg shadow-black/5 dark:shadow-none animate-in fade-in slide-in-from-bottom-4 duration-300">

                            {/* SECCIÓN 1: VISIBILIDAD */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Visualización</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 bg-secondary/30 dark:bg-black/50 p-2 rounded-lg border border-border/10 dark:border-white/5"><input type="checkbox" checked={config.useFullDate} onChange={(e) => setConfig({ ...config, useFullDate: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-muted-foreground dark:text-white/60 font-bold">Fecha Larga</span></div>
                                    <div className="flex items-center gap-2 bg-secondary/30 dark:bg-black/50 p-2 rounded-lg border border-border/10 dark:border-white/5"><input type="checkbox" checked={config.showOdds} onChange={(e) => setConfig({ ...config, showOdds: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-muted-foreground dark:text-white/60 font-bold">Cuota Portada</span></div>
                                    <div className="flex items-center gap-2 bg-secondary/30 dark:bg-black/50 p-2 rounded-lg border border-border/10 dark:border-white/5"><input type="checkbox" checked={config.showTitleBorder} onChange={(e) => setConfig({ ...config, showTitleBorder: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-muted-foreground dark:text-white/60 font-bold">Borde Título</span></div>
                                    <div className="flex items-center gap-2 bg-secondary/30 dark:bg-black/50 p-2 rounded-lg border border-border/10 dark:border-white/5"><input type="checkbox" checked={config.showPickOdds} onChange={(e) => setConfig({ ...config, showPickOdds: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-muted-foreground dark:text-white/60 font-bold">Cuota Apuesta</span></div>
                                    <div className="flex items-center gap-2 bg-secondary/30 dark:bg-black/50 p-2 rounded-lg border border-border/10 dark:border-white/5"><input type="checkbox" checked={config.addHundred} onChange={(e) => { const c = e.target.checked; let val = parseInt(config.introSubtitle.replace(/\D/g, '')) || 0; setConfig({ ...config, addHundred: c, introSubtitle: `+${c ? val * 10 : Math.round(val / 10)} 📈` }) }} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-muted-foreground dark:text-white/60 font-bold">Cuota x10</span></div>
                                    <div className="flex items-center gap-2 bg-secondary/30 dark:bg-black/50 p-2 rounded-lg border border-border/10 dark:border-white/5"><input type="checkbox" checked={onlyFootball} onChange={(e) => setOnlyFootball(e.target.checked)} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-muted-foreground dark:text-white/60 font-bold">Solo Fútbol</span></div>
                                </div>
                            </div>

                            {/* SECCIÓN 2: TAMAÑOS PORTADA */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Tamaños Portada</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Título Principal</span><span className="text-[9px] text-white/50">{config.introTitleSize}rem</span></div>
                                        <input type="range" min="1.5" max="5" step="0.1" value={config.introTitleSize} onChange={e => setConfig({ ...config, introTitleSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-sky-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Subtítulo (Fecha)</span><span className="text-[9px] text-white/50">{config.introSubSize}rem</span></div>
                                        <input type="range" min="1" max="4" step="0.1" value={config.introSubSize} onChange={e => setConfig({ ...config, introSubSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-sky-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN 3: APUESTAS */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Apuestas & Espaciado</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Espacio Título-Caja</span><span className="text-[9px] text-white/50">{config.gapBody}px</span></div>
                                        <input type="range" min="-60" max="20" step="1" value={config.gapBody} onChange={e => setConfig({ ...config, gapBody: parseInt(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Título Partido</span><span className="text-[9px] text-white/50">{config.matchTitleSize}rem</span></div>
                                        <input type="range" min="1" max="4" step="0.1" value={config.matchTitleSize} onChange={e => setConfig({ ...config, matchTitleSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Texto Selección</span><span className="text-[9px] text-white/50">{config.pickTextSize}rem</span></div>
                                        <input type="range" min="1.5" max="6" step="0.1" value={config.pickTextSize} onChange={e => setConfig({ ...config, pickTextSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Tamaño Cuota</span><span className="text-[9px] text-white/50">{config.pickOddSize}rem</span></div>
                                        <input type="range" min="1" max="4" step="0.1" value={config.pickOddSize} onChange={e => setConfig({ ...config, pickOddSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Espacio Caja-Cuota</span><span className="text-[9px] text-white/50">{(config as any).gapOdds}px</span></div>
                                        <input type="range" min="-50" max="50" step="1" value={(config as any).gapOdds} onChange={e => setConfig({ ...config, gapOdds: parseInt(e.target.value) } as any)} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN 4: CIERRE */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Cierre</h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Título Cierre</span><span className="text-[9px] text-white/50">{config.outroTitleSize}rem</span></div>
                                        <input type="range" min="1.5" max="5" step="0.1" value={config.outroTitleSize} onChange={e => setConfig({ ...config, outroTitleSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-purple-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Subtítulo Cierre</span><span className="text-[9px] text-white/50">{config.outroSubSize}rem</span></div>
                                        <input type="range" min="1" max="4" step="0.1" value={config.outroSubSize} onChange={e => setConfig({ ...config, outroSubSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-purple-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                    }




                </div>
            </div>

            {/* === DESKTOP LAYOUT (SPLIT PANE) === */}
            <div className="hidden md:flex w-full max-w-full min-h-[85vh] gap-6 p-6 bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl items-start overflow-visible">
                {/* LEFT: SETTINGS (Full Height, No Scroll) */}
                {/* LEFT: SETTINGS (Tabbed Sidebar) */}
                <div className="w-[35%] shrink-0 flex flex-col bg-[#121212] rounded-l-3xl border-r border-white/5 h-full overflow-hidden">
                    {/* PC TABS */}
                    <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-black/20 overflow-x-auto scrollbar-hide">
                        <button onClick={() => setActiveTab('portada')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition flex flex-col items-center gap-1 ${activeTab === 'portada' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-white/40 hover:bg-white/5'}`}>
                            <LayoutTemplate size={14} /> Portada
                        </button>
                        <button onClick={() => setActiveTab('bets')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition flex flex-col items-center gap-1 ${activeTab === 'bets' || activeTab === 'editor' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-white/40 hover:bg-white/5'}`}>
                            <Type size={14} /> Apuestas
                        </button>
                        <button onClick={() => setActiveTab('outro')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition flex flex-col items-center gap-1 ${activeTab === 'outro' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-white/40 hover:bg-white/5'}`}>
                            <Megaphone size={14} /> Cierre
                        </button>
                        <button onClick={() => setActiveTab('bg')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition flex flex-col items-center gap-1 ${activeTab === 'bg' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/40 hover:bg-white/5'}`}>
                            <Palette size={14} /> Fondos
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'bg-zinc-700/50 text-white border border-white/20' : 'text-white/40 hover:bg-white/5'}`}>
                            <Settings2 size={14} /> Ajustes
                        </button>
                    </div>

                    {/* VIRAL MODE TOGGLE (GLOBAL) */}
                    <div className="p-3 border-b border-white/5 bg-[#121212]">
                        <div className="flex bg-[#1a1a1a] rounded-xl border border-white/10 p-1">
                            <button
                                onClick={() => setViewMode('today')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                ${viewMode === 'today' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                HOY
                            </button>
                            <button
                                onClick={() => setViewMode('tomorrow')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1
                                ${viewMode === 'tomorrow' ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                <span>MAÑANA</span>
                            </button>
                        </div>
                    </div>

                    {/* PC CONTENT */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                        {/* PORTADA TAB */}
                        {activeTab === 'portada' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div><label className="text-[10px] text-white/40 font-bold uppercase block mb-1">Título</label><textarea value={config.introTitle} onChange={e => setConfig({ ...config, introTitle: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[70px] focus:border-emerald-500/50 outline-none" /></div>
                                <div className="grid grid-cols-2 gap-2">

                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input value={config.introEmoji1} onChange={e => setConfig({ ...config, introEmoji1: e.target.value })} className="bg-black/40 border border-white/10 rounded-lg p-2 text-center text-white" placeholder="Emoji 1" />
                                    <input value={config.introEmoji2} onChange={e => setConfig({ ...config, introEmoji2: e.target.value })} className="bg-black/40 border border-white/10 rounded-lg p-2 text-center text-white" placeholder="Emoji 2" />
                                </div>
                                <input value={config.introSubtitle} onChange={e => setConfig({ ...config, introSubtitle: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-emerald-500/50" placeholder="Texto Cuota" />
                            </div>
                        )}

                        {/* BETS TAB (Default if editor) */}
                        {(activeTab === 'bets' || activeTab === 'editor') && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                <button
                                    onClick={() => setOnlyFootball(!onlyFootball)}
                                    className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition-all mb-4 group ${onlyFootball
                                        ? 'bg-emerald-500/10 border-emerald-500/50 hover:bg-emerald-500/20'
                                        : 'bg-black/40 border-white/5 hover:bg-black/60 hover:border-white/10'
                                        }`}
                                >
                                    <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${onlyFootball ? 'text-emerald-400' : 'text-white/60 group-hover:text-white/80'}`}>
                                        Solo Fútbol
                                    </span>
                                    <div className={`relative w-8 h-4 rounded-full transition-colors ${onlyFootball ? 'bg-emerald-500/30' : 'bg-white/10'}`}>
                                        <div className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-300 ${onlyFootball
                                            ? 'left-[18px] bg-emerald-400'
                                            : 'left-1 bg-white/40'
                                            }`} />
                                    </div>
                                </button>


                                {slideGroups.map((group, idx) => (
                                    <div key={idx} className="bg-black/30 p-3 rounded-xl border border-white/5 hover:border-sky-500/20 transition-all">
                                        <div className="flex gap-2 mb-2">
                                            <input value={group.matchDisplay} onChange={e => { const n = [...slideGroups]; n[idx].matchDisplay = e.target.value; setSlideGroups(n) }} className="bg-transparent border-b border-white/10 w-full text-xs font-bold text-sky-300 focus:border-sky-500 outline-none pb-1" />
                                            <button onClick={() => { const n = [...slideGroups]; n[idx].isFeatured = !n[idx].isFeatured; setSlideGroups(n) }} className={`p-1 rounded ${group.isFeatured ? 'bg-sky-500 text-white' : 'text-white/20'}`}><ScanEye size={12} /></button>
                                        </div>
                                        <div className="pl-2 border-l border-white/10 space-y-3">
                                            {group.picks.map((item: any, i: number) => (
                                                <div key={i} className="space-y-1">
                                                    <textarea value={item.text} onChange={e => { const n = [...slideGroups]; n[idx].picks[i].text = e.target.value; setSlideGroups(n) }} rows={2} className="bg-transparent w-full text-[10px] text-white/50 focus:text-white outline-none resize-y min-h-[40px] whitespace-pre-wrap" />
                                                    <div className="flex items-center gap-2 opacity-50">
                                                        <span className="text-[7px] font-black text-sky-400 uppercase tracking-widest">Cuota</span>
                                                        <input value={item.odd} onChange={e => { const n = [...slideGroups]; n[idx].picks[i].odd = e.target.value; setSlideGroups(n) }} className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-white/70 w-16" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {!slideGroups.length && <p className="text-xs text-center text-white/20 py-4">Sin datos</p>}
                            </div>
                        )}

                        {/* OUTRO TAB */}
                        {activeTab === 'outro' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                <textarea value={config.outroTitle} onChange={e => setConfig({ ...config, outroTitle: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[60px] focus:border-purple-500/50 outline-none" placeholder="Título Cierre" />
                                <textarea value={config.outroSub} onChange={e => setConfig({ ...config, outroSub: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm font-bold min-h-[50px] focus:border-purple-500/50 outline-none" placeholder="Subtítulo" />
                            </div>
                        )}

                        {/* BACKGROUNDS TAB */}
                        {activeTab === 'bg' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                                    <h3 className="text-xs font-bold text-amber-500 uppercase">Galería</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => setSearchModalOpen(true)} className="px-3 py-1.5 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-lg text-[10px] font-bold hover:bg-sky-500/20 flex items-center gap-1 transition-colors"><Search size={12} /> BUSCAR</button>
                                        <button onClick={() => smartSelectBackgrounds()} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[10px] font-bold hover:bg-amber-500/20 flex items-center gap-1 transition-colors"><RefreshCw size={12} /> REGENERAR</button>
                                        <button onClick={() => setAdminModalOpen(true)} className="px-3 py-1.5 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-lg text-[10px] font-bold hover:bg-purple-500/20 flex items-center gap-1 transition-colors"><Settings size={12} /> ADMIN</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {config.bgSelection.map((bg, i) => (
                                        <div key={i} className={`group relative aspect-[9/16] rounded-lg overflow-hidden border cursor-pointer transition-all ${imageSelector.idx === i ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-white/10 hover:border-white/30'}`} onClick={() => openImageSelectorSmart(i)}>
                                            <img src={getImageSrc(bg)} className="w-full h-full object-cover" />

                                            {/* PREVIEW OVERLAY */}
                                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                                <div className="w-[1080px] h-[1350px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.13] origin-center flex flex-col justify-center items-center">
                                                    {renderSlideContent(i, false)}
                                                </div>
                                            </div>

                                            {imageSelector.idx === i && <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />}
                                            <div className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0 rounded text-[8px] text-white/70">{i + 1}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SETTINGS TAB (PC) */}
                        {activeTab === 'settings' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">

                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Visualización</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.useFullDate} onChange={(e) => setConfig({ ...config, useFullDate: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Fecha Larga</span></div>
                                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.showOdds} onChange={(e) => setConfig({ ...config, showOdds: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Cuota Portada</span></div>
                                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={(config as any).introItalic} onChange={(e) => setConfig({ ...config, introItalic: e.target.checked } as any)} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Cursiva Portada</span></div>
                                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.showTitleBorder} onChange={(e) => setConfig({ ...config, showTitleBorder: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Borde Título</span></div>
                                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.showPickOdds} onChange={(e) => setConfig({ ...config, showPickOdds: e.target.checked })} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Cuota Apuesta</span></div>
                                        <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5"><input type="checkbox" checked={config.addHundred} onChange={(e) => { const c = e.target.checked; let val = parseInt(config.introSubtitle.replace(/\D/g, '')) || 0; setConfig({ ...config, addHundred: c, introSubtitle: `+${c ? val * 10 : Math.round(val / 10)} 📈` }) }} className="accent-emerald-500 w-4 h-4 cursor-pointer" /><span className="text-[10px] text-white/60 font-bold">Cuota x10</span></div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Tamaños Portada</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Título Principal</span><span className="text-[9px] text-white/50">{config.introTitleSize}rem</span></div>
                                            <input type="range" min="1.5" max="5" step="0.1" value={config.introTitleSize} onChange={e => setConfig({ ...config, introTitleSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-sky-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Subtítulo (Fecha)</span><span className="text-[9px] text-white/50">{config.introSubSize}rem</span></div>
                                            <input type="range" min="1" max="4" step="0.1" value={config.introSubSize} onChange={e => setConfig({ ...config, introSubSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-sky-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Apuestas & Espaciado</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Espacio Título-Caja</span><span className="text-[9px] text-white/50">{config.gapBody}px</span></div>
                                            <input type="range" min="-60" max="20" step="1" value={config.gapBody} onChange={e => setConfig({ ...config, gapBody: parseInt(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Título Partido</span><span className="text-[9px] text-white/50">{config.matchTitleSize}rem</span></div>
                                            <input type="range" min="1" max="4" step="0.1" value={config.matchTitleSize} onChange={e => setConfig({ ...config, matchTitleSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Texto Selección</span><span className="text-[9px] text-white/50">{config.pickTextSize}rem</span></div>
                                            <input type="range" min="1.5" max="6" step="0.1" value={config.pickTextSize} onChange={e => setConfig({ ...config, pickTextSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Tamaño Cuota</span><span className="text-[9px] text-white/50">{config.pickOddSize}rem</span></div>
                                            <input type="range" min="1" max="4" step="0.1" value={config.pickOddSize} onChange={e => setConfig({ ...config, pickOddSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Espacio Caja-Cuota</span><span className="text-[9px] text-white/50">{(config as any).gapOdds}px</span></div>
                                            <input type="range" min="-50" max="50" step="1" value={(config as any).gapOdds} onChange={e => setConfig({ ...config, gapOdds: parseInt(e.target.value) } as any)} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Altura Recuadros</span><span className="text-[9px] text-white/50">{(config as any).boxPaddingY}px</span></div>
                                            <input type="range" min="-10" max="30" step="1" value={(config as any).boxPaddingY} onChange={e => setConfig({ ...config, boxPaddingY: parseInt(e.target.value) } as any)} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider mb-2 border-b border-white/10 pb-1">Cierre</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Título Cierre</span><span className="text-[9px] text-white/50">{config.outroTitleSize}rem</span></div>
                                            <input type="range" min="1.5" max="5" step="0.1" value={config.outroTitleSize} onChange={e => setConfig({ ...config, outroTitleSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-purple-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-[9px] uppercase text-white/50">Subtítulo Cierre</span><span className="text-[9px] text-white/50">{config.outroSubSize}rem</span></div>
                                            <input type="range" min="1" max="4" step="0.1" value={config.outroSubSize} onChange={e => setConfig({ ...config, outroSubSize: parseFloat(e.target.value) })} className="w-full h-1.5 accent-purple-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: PREVIEW (Sticky) */}
                <div className="flex-1 min-w-0 bg-[#121212] rounded-2xl border border-white/5 flex flex-col relative overflow-hidden sticky top-6 h-[85vh]">
                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />

                    {/* PREVIEW IMAGE AREA */}
                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100 overflow-hidden relative">
                        <div className="relative h-full aspect-[9/16] shadow-2xl rounded-xl overflow-hidden group bg-black">
                            <div className="w-[1080px] h-[1350px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.45] origin-center flex flex-col items-center justify-center">
                                <img src={getImageSrc(config.bgSelection[currentPreviewIdx])} className="absolute inset-0 w-full h-full object-cover z-0" />
                                <div className="absolute inset-0 bg-black/10 z-0" />
                                {renderSlideContent(currentPreviewIdx, true)}
                            </div>

                            <div className="absolute inset-x-0 bottom-0 p-8 flex border-t border-white/10 justify-center gap-8 bg-gradient-to-t from-black/90 to-transparent z-30">
                                <button onClick={() => setCurrentPreviewIdx(Math.max(0, currentPreviewIdx - 1))} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition"><ChevronLeft className="text-white" size={24} /></button>
                                <button onClick={() => setCurrentPreviewIdx(Math.min(slidesData.length + 1, currentPreviewIdx + 1))} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition"><ChevronRight className="text-white" size={24} /></button>
                            </div>
                            <div className="absolute top-6 right-6 flex gap-2 z-30 pointer-events-none">
                                {images[currentPreviewIdx] && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); download(images[currentPreviewIdx], currentPreviewIdx); }}
                                        className="pointer-events-auto p-2 bg-black/60 hover:bg-emerald-500 rounded-full border border-white/10 text-white/70 hover:text-white transition-all shadow-lg backdrop-blur group/dl"
                                        title="Descargar esta imagen"
                                    >
                                        <Download size={16} className="group-hover/dl:scale-110 transition-transform" />
                                    </button>
                                )}
                                <div className="px-3 py-1 bg-black/60 rounded-full border border-white/10 text-xs font-bold text-white/70 flex items-center">{currentPreviewIdx + 1} / {slidesData.length + 2}</div>
                            </div>

                            {/* SLIDERS (Desktop) */}
                            {currentPreviewIdx > 0 && currentPreviewIdx < slidesData.length + 1 && (
                                <>
                                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[60%] z-[40] flex flex-col gap-1.5 items-center bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="flex justify-between w-full text-[9px] font-black text-white/70 uppercase tracking-widest px-1"><span>Ajustar Título</span><span>{Math.round(config.titleScale * 100)}%</span></div>
                                        <input type="range" min="0.5" max="1.8" step="0.01" value={config.titleScale} onChange={e => setConfig({ ...config, titleScale: parseFloat(e.target.value) })} className="w-full h-1.5 accent-emerald-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[60%] z-[40] flex flex-col gap-1.5 items-center bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="flex justify-between w-full text-[9px] font-black text-white/70 uppercase tracking-widest px-1"><span>Ajustar Selecciones</span><span>{Math.round(config.betsScale * 100)}%</span></div>
                                        <input type="range" min="0.5" max="1.8" step="0.01" value={config.betsScale} onChange={e => setConfig({ ...config, betsScale: parseFloat(e.target.value) })} className="w-full h-1.5 accent-sky-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    {config.showPickOdds && (
                                        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[60%] z-[40] flex flex-col gap-1.5 items-center bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="flex justify-between w-full text-[9px] font-black text-white/70 uppercase tracking-widest px-1"><span>Ajustar Cuotas</span><span>{Math.round(config.oddsScale * 100)}%</span></div>
                                            <input type="range" min="0.5" max="1.5" step="0.01" value={config.oddsScale} onChange={e => setConfig({ ...config, oddsScale: parseFloat(e.target.value) })} className="w-full h-1.5 accent-amber-500 bg-white/10 rounded-full appearance-none cursor-pointer" />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
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
            </div >

            {/* MODAL & RENDERER (Cleaned up) */}
            {
                showSocialModal && processedSocialContent && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur p-4 text-left">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4">
                            <div className="flex justify-between items-center"><h3 className="font-bold text-white flex gap-2 items-center">📱 Viral Content {onlyFootball && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 rounded-full border border-emerald-500/30">FÚTBOL</span>}</h3><button onClick={() => setShowSocialModal(false)} className="text-white/50"><X size={24} /></button></div>
                            <div className="space-y-2"><label className="text-[10px] text-emerald-400 font-bold uppercase">Título</label><div className="flex gap-2"><div className="flex-1 bg-black/50 p-2 rounded text-white text-sm">{processedSocialContent.title}</div><button onClick={() => handleCopyText(processedSocialContent.title, 't')} className="p-2 bg-white/10 rounded hover:bg-white/20 text-white">{copiedStates['t'] ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
                            <div className="space-y-2"><label className="text-[10px] text-purple-400 font-bold uppercase">Caption</label><div className="flex gap-2"><div className="flex-1 bg-black/50 p-2 rounded text-white/80 text-xs max-h-32 overflow-y-auto whitespace-pre-line">{processedSocialContent.description}</div><button onClick={() => handleCopyText(processedSocialContent.description, 'c')} className="p-2 bg-white/10 rounded hover:bg-white/20 text-white h-fit">{copiedStates['c'] ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
                        </div>
                    </div>
                )
            }

            {previewImg && <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}><img src={previewImg} className="h-full object-contain rounded-xl shadow-2xl" /></div>}

            {/* HIDDEN RENDERER */}
            <div className="fixed top-0 left-0 z-[-9999] opacity-0 pointer-events-none">
                <div ref={containerRef} style={{ width: 1080, height: 1350 }}>
                    {/* 
                       RENDER LOGIC (Identical Structure as before) 
                     */}
                    {/* 1. INTRO (Hidden) */}
                    <div className="w-[1080px] relative flex flex-col items-center justify-center overflow-hidden bg-black" style={{ height: 1350 }}>
                        <img src={getImageSrc(config.bgSelection[0])} width={1080} height={1350} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" alt="bg" />
                        <div className="absolute inset-0 z-0 bg-black/5" />
                        {renderSlideContent(0, false)}
                    </div>

                    {/* 2. CHUNKS (Hidden) */}
                    {slidesData.map((chunk, slideIdx) => (
                        <div key={slideIdx} className="w-[1080px] relative flex flex-col items-center justify-center overflow-hidden bg-black" style={{ height: 1350 }}>
                            <img src={getImageSrc(config.bgSelection[slideIdx + 1])} width={1080} height={1350} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" alt="bg" />
                            <div className="absolute inset-0 z-0 bg-black/5" />
                            {renderSlideContent(slideIdx + 1, false)}
                        </div>
                    ))}

                    {/* 3. OUTRO (Hidden) */}
                    <div className="w-[1080px] relative flex flex-col items-center justify-center overflow-hidden bg-black" style={{ height: 1350 }}>
                        <img src={getImageSrc(config.bgSelection[slidesData.length + 1])} width={1080} height={1350} className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" alt="bg" />
                        <div className="absolute inset-0 z-0 bg-black/5" />
                        {renderSlideContent(slidesData.length + 1, false)}
                    </div>
                </div>
            </div>

            {/* IMAGE SELECTOR MODAL */}
            {
                imageSelector.idx !== null && (
                    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 backdrop-blur p-4">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-white/10 space-y-4 bg-[#1a1a1a] z-10">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <ImageIcon size={20} className="text-amber-500" />
                                            Seleccionar Fondo {imageSelector.idx === 0 ? "(Portada)" : `(Slide ${imageSelector.idx + 1})`}
                                        </h3>
                                        <p className="text-xs text-white/40 mt-1">Elige una imagen de la galería para reemplazar</p>
                                    </div>
                                    <button onClick={() => setImageSelector({ idx: null })} className="p-2 hover:bg-white/10 rounded-full transition"><X size={24} className="text-white/70" /></button>
                                </div>

                                {/* --- ACTION BAR (Removed) --- */}

                                {/* ... (Existing Filters) ... */}
                                <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                                    <button
                                        onClick={() => { setBgFilter('all'); setBgTeamSelected(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${bgFilter === 'all' ? 'bg-white text-black border-white' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
                                    >
                                        Todas ({availableFiles.length})
                                    </button>
                                    {/* ... other filters ... */}
                                    <button
                                        onClick={() => { setBgFilter('futbol'); setBgTeamSelected(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${bgFilter === 'futbol' ? 'bg-sky-500 text-white border-sky-500' : 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20'}`}
                                    >
                                        ⚽ Fútbol ({availableFiles.filter(f => getFilename(f).includes('futbol') && !getFilename(f).includes('portada')).length})
                                    </button>
                                    <button
                                        onClick={() => { setBgFilter('basket'); setBgTeamSelected(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${bgFilter === 'basket' ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'}`}
                                    >
                                        🏀 Basket ({availableFiles.filter(f => getFilename(f).includes('basket') && !getFilename(f).includes('portada')).length})
                                    </button>
                                    <button
                                        onClick={() => { setBgFilter('portada'); setBgTeamSelected(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${bgFilter === 'portada' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                                    >
                                        🖼️ Portada ({availableFiles.filter(f => getFilename(f).includes('portada')).length})
                                    </button>
                                    <button
                                        onClick={() => { setBgFilter('comodin'); setBgTeamSelected(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${bgFilter === 'comodin' ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'}`}
                                    >
                                        🃏 Comodín ({availableFiles.filter(f => getFilename(f).includes('comodin')).length})
                                    </button>
                                    <button
                                        onClick={() => setBgFilter('equipo')}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${bgFilter === 'equipo' ? 'bg-amber-500 text-black border-amber-500' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'}`}
                                    >
                                        🛡️ Equipos ({new Set(availableFiles.filter(f => {
                                            const n = getFilename(f);
                                            return (n.includes('futbol') || n.includes('basket')) && !n.includes('comodin') && !n.includes('portada');
                                        }).map(f => getFilename(f).split('-')[2])).size})
                                    </button>
                                </div>

                                {/* --- TEAM SELECTOR (Conditional) --- */}
                                {bgFilter === 'equipo' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-white/5 pt-3">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setBgSportForTeam('futbol'); setBgTeamSelected(null); }}
                                                className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all
                                                ${bgSportForTeam === 'futbol' ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/30'}`}
                                            >
                                                Fútbol
                                            </button>
                                            <button
                                                onClick={() => { setBgSportForTeam('basket'); setBgTeamSelected(null); }}
                                                className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all
                                                ${bgSportForTeam === 'basket' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/30'}`}
                                            >
                                                Basket
                                            </button>
                                        </div>
                                        {/* Team List with Search */}
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={12} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar equipo..."
                                                    value={teamSearch}
                                                    onChange={(e) => setTeamSearch(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-white/30 outline-none placeholder:text-white/20"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar p-1">
                                                {Array.from(new Set(availableFiles
                                                    .filter(f => {
                                                        const lower = getFilename(f).toLowerCase();
                                                        const sport = bgSportForTeam === 'futbol' ? 'futbol' : 'basket';
                                                        return lower.startsWith(`bg-${sport}-`) && !lower.includes('comodin') && !lower.includes('portada');
                                                    })
                                                    .map(f => {
                                                        const parts = getFilename(f).split('-');
                                                        return (parts[2] || "").toLowerCase();
                                                    })
                                                    .filter(Boolean)
                                                ))
                                                    .filter(team => team.toLowerCase().includes(teamSearch.toLowerCase()))
                                                    .sort((a, b) => {
                                                        const nameA = formatTeamName(a);
                                                        const nameB = formatTeamName(b);
                                                        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
                                                    }).map(team => (
                                                        <div key={team} className="relative group/btn flex items-stretch">
                                                            <button
                                                                onClick={() => setBgTeamSelected(team)}
                                                                className={`flex-1 px-3 py-2 rounded-l-lg text-[9px] font-bold uppercase border-y border-l transition-all text-left truncate
                                                    ${bgTeamSelected === team ? 'bg-white text-black border-white' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
                                                            >
                                                                {formatTeamName(team)}
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(team, bgSportForTeam === 'futbol' ? 'futbol' : 'basket'); }}
                                                                className={`px-2 rounded-r-lg border-y border-r transition-colors flex items-center justify-center
                                                    ${bgTeamSelected === team ? 'bg-white border-white text-black/50 hover:text-red-600' : 'bg-white/5 border-white/10 text-white/20 hover:text-red-500 hover:bg-white/10'}`}
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                {/* Empty state */}
                                                {teamSearch && !Array.from(new Set(availableFiles.map(f => getFilename(f).split('-')[2]))).some(t => t?.toLowerCase().includes(teamSearch.toLowerCase())) && (
                                                    <p className="col-span-full text-center text-[10px] text-white/30 py-2">No se encontraron equipos</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/20">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {/* ... grid items ... */}
                                    {availableFiles
                                        .filter(f => {
                                            const fname = getFilename(f);
                                            const lowerName = fname.toLowerCase();
                                            if (bgFilter === 'all') return true;
                                            if (bgFilter === 'portada') return fname.includes('portada');
                                            if (bgFilter === 'comodin') return fname.includes('comodin');
                                            if (bgFilter === 'futbol' && !fname.includes('portada')) return fname.includes('futbol');
                                            if (bgFilter === 'basket' && !fname.includes('portada')) return fname.includes('basket');
                                            if (bgFilter === 'equipo') {
                                                if (!bgTeamSelected) return false;
                                                return lowerName.includes(`bg-${bgSportForTeam}-${bgTeamSelected.toLowerCase()}-`);
                                            }
                                            return true;
                                        })
                                        .sort((a, b) => {
                                            if (a === config.bgSelection[imageSelector.idx!]) return -1;
                                            if (b === config.bgSelection[imageSelector.idx!]) return 1;
                                            return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
                                        }).map((file, i) => (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    handleBgChange(imageSelector.idx!, file);
                                                    setImageSelector({ idx: null });
                                                }}
                                                className={`
                                                group relative aspect-[9/16] rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 hover:scale-105
                                                ${config.bgSelection[imageSelector.idx!] === file ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-2 ring-amber-500/20' : 'border-white/5 hover:border-white/30'}
                                            `}
                                            >
                                                <img src={getImageSrc(file)} className="w-full h-full object-cover" loading="lazy" />
                                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-[10px] text-white font-mono truncate">
                                                        {formatTeamName(getFilename(file).split('-')[2] || getFilename(file).replace('bg-', '').replace('.png', ''))}
                                                    </p>
                                                </div>
                                                {config.bgSelection[imageSelector.idx!] === file && (
                                                    <div className="absolute top-2 right-2 bg-amber-500 text-black p-1 rounded-full shadow-lg">
                                                        <Check size={12} strokeWidth={4} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SEARCH ONLINE MODAL */}
            {
                searchModalOpen && (
                    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 backdrop-blur p-4">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Search size={22} className="text-sky-500" /> Buscador Online
                                    </h3>
                                    <p className="text-xs text-white/50 mt-1">Busca imágenes en internet, guárdalas y úsalas al instante.</p>
                                </div>

                                <button onClick={() => setSearchModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={24} /></button>
                            </div>

                            {/* Controls */}
                            <div className="p-6 border-b border-white/10 bg-black/20 space-y-4">
                                <div className="flex gap-3">
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                        placeholder="Ej: Real Madrid Vertical Wallpaper..."
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 text-white placeholder:text-white/20 focus:border-sky-500 outline-none"
                                        autoFocus
                                    />
                                    <button onClick={performSearch} disabled={isSearching} className="px-6 py-3 bg-sky-500 text-white font-bold rounded-xl hover:bg-sky-400 disabled:opacity-50">
                                        {isSearching ? <Loader2 className="animate-spin" /> : "Buscar"}
                                    </button>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-bold uppercase text-white/50">Guardar como:</span>
                                    <div className="flex gap-2">
                                        {['futbol', 'basket', 'portada', 'comodin'].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setSaveSettings({ ...saveSettings, type: t as any })}
                                                className={`px-3 py-1 rounded-lg text-[10px] uppercase font-bold border transition ${saveSettings.type === t ? 'bg-sky-500 text-white border-sky-500' : 'bg-transparent text-white/40 border-white/10'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex-1 relative">
                                        <input
                                            value={saveSettings.tag}
                                            onChange={handleTagChange}
                                            onFocus={() => saveSettings.tag.length > 1 && setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            placeholder="Nombre del Equipo (Ej: RealMadrid)"
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:border-sky-500 outline-none"
                                        />
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                                {suggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => selectSuggestion(s)}
                                                        className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
                                                    >
                                                        <Search size={10} className="text-white/30" />
                                                        <span dangerouslySetInnerHTML={{ __html: s.replace(new RegExp(`(${saveSettings.tag})`, 'gi'), (match) => `<span class="text-sky-400 font-bold">${match}</span>`) }} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Results */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#121212]">
                                {searchResults.length === 0 && !isSearching && (
                                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                        <Search size={48} />
                                        <p>Escribe algo para buscar</p>
                                    </div>
                                )}

                                {isSearching ? (
                                    <div className="h-full flex flex-col items-center justify-center text-sky-500 gap-4">
                                        <Loader2 size={48} className="animate-spin" />
                                        <p className="text-white/50 text-xs animate-pulse">Buscando imágenes 4K...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {searchResults.map((img, idx) => (
                                            <div key={idx} className="group relative aspect-[9/16] bg-black rounded-xl overflow-hidden cursor-pointer border border-white/10 hover:border-sky-500 transition" onClick={() => saveWebImage(img.url)}>
                                                <img
                                                    src={img.thumbnail || img.url}
                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                    loading="lazy"
                                                    onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all">
                                                    <Download size={24} className="text-sky-400" />
                                                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Guardar</span>
                                                </div>
                                                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                                                    <p className="text-[9px] text-white/70 truncate">{img.title}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ERROR ALERT MODAL */}
            {
                errorAlert.show && (
                    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur p-6 animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 text-amber-500 mb-2">
                                <Megaphone size={24} className="animate-bounce" />
                                <h3 className="text-lg font-bold text-white">{errorAlert.title}</h3>
                            </div>
                            <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
                                {errorAlert.msg}
                            </p>
                            <button
                                onClick={() => setErrorAlert({ ...errorAlert, show: false })}
                                className="w-full py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )
            }

            {/* ADMIN MODAL */}
            {
                adminModalOpen && (
                    <div className="fixed inset-0 z-[4500] flex items-center justify-center bg-black/90 backdrop-blur p-4">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Settings2 size={18} className="text-amber-500" /> Administrar Imágenes
                                </h3>
                                <button onClick={() => setAdminModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-white/70"><X size={20} /></button>
                            </div>

                            {/* Filters */}
                            <div className="flex gap-2 p-4 border-b border-white/10 overflow-x-auto">
                                {['futbol', 'basket', 'portada', 'comodin'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setAdminFilter(t as any)}
                                        className={`px-4 py-2 rounded-xl text-xs uppercase font-bold border transition whitespace-nowrap ${adminFilter === t ? 'bg-amber-500 text-black border-amber-500' : 'bg-transparent text-white/40 border-white/10 hover:bg-white/5'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            {/* Grid */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {availableFiles.filter(f => {
                                        const n = getFilename(f);
                                        if (adminFilter === 'futbol') return n.includes('futbol') && !n.includes('comodin');
                                        if (adminFilter === 'basket') return n.includes('basket') && !n.includes('comodin');
                                        if (adminFilter === 'portada') return n.includes('portada');
                                        if (adminFilter === 'comodin') return n.includes('comodin');
                                        return false;
                                    }).map((file, i) => (
                                        <div key={i} className="group relative aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10">
                                            <img src={getImageSrc(file)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />

                                            {/* Actions Overlay */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                                <div className="flex justify-end">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(file); }} className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] text-white font-mono truncate mb-2">
                                                        {getFilename(file).split('-')[2] || 'Sin Nombre'}
                                                    </p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setMoveModal({ open: true, url: file, type: adminFilter, tag: '' }); }}
                                                        className="w-full py-2 bg-white/10 text-white rounded-lg text-[10px] uppercase font-bold hover:bg-white/20 transition flex items-center justify-center gap-1"
                                                    >
                                                        <RefreshCw size={10} /> Mover / Renombrar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MOVE MODAL */}
            {
                moveModal.open && (
                    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur p-6 animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-2 text-sky-500 border-b border-white/10 pb-2 mb-2">
                                <RefreshCw size={18} />
                                <h3 className="text-md font-bold text-white">Mover o Renombrar</h3>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-white/50">Mover a Sección:</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['futbol', 'basket', 'portada', 'comodin'].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setMoveModal({ ...moveModal, type: t as any })}
                                                className={`px-2 py-2 rounded-lg text-[10px] uppercase font-bold border transition ${moveModal.type === t ? 'bg-sky-500 text-white border-sky-500' : 'bg-transparent text-white/40 border-white/10'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase text-white/50">Nuevo Nombre (Opcional):</label>
                                    <input
                                        value={moveModal.tag}
                                        onChange={(e) => setMoveModal({ ...moveModal, tag: e.target.value })}
                                        onFocus={() => (moveModal.type === 'futbol' || moveModal.type === 'basket') && setMoveModal({ ...moveModal, tag: moveModal.tag })}
                                        placeholder="Ej: Barcelona"
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 outline-none"
                                    />

                                    {/* Team Selection List (Always visible if Futbol/Basket selected) */}
                                    {(moveModal.type === 'futbol' || moveModal.type === 'basket') && (
                                        <div className="mt-2 p-2 bg-black/20 rounded-xl border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                                            <p className="text-[9px] uppercase font-bold text-white/30 mb-2 px-1">Seleccionar Equipo Existente:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {Array.from(new Set(availableFiles
                                                    .filter(f => getFilename(f).includes(moveModal.type) && !getFilename(f).includes('comodin') && !getFilename(f).includes('portada'))
                                                    .map(f => getFilename(f).split('-')[2]) // Extract team part
                                                    .filter(Boolean)
                                                )).sort().map(team => (
                                                    <button
                                                        key={team}
                                                        onClick={() => setMoveModal({ ...moveModal, tag: team })}
                                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition
                                                        ${moveModal.tag === team ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
                                                    >
                                                        {formatTeamName(team)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setMoveModal({ ...moveModal, open: false })}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold uppercase text-xs rounded-xl hover:bg-white/10 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleMoveImage}
                                    className="flex-1 py-3 bg-sky-500 text-white font-bold uppercase text-xs rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* CONFIRMATION MODAL */}
            {
                confirmModal.show && (
                    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur p-6 animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 text-sky-500 mb-2">
                                <Info size={24} className="animate-pulse" />
                                <h3 className="text-lg font-bold text-white">¿Guardar sin nombre?</h3>
                            </div>
                            <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
                                No has escrito ningún nombre para el equipo.
                                <br /><br />
                                La imagen se guardará como <b>GENÉRICA</b> y podrías perderla entre tantos archivos.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold uppercase text-xs rounded-xl hover:bg-white/10 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }}
                                    className="flex-1 py-3 bg-sky-500 text-white font-bold uppercase text-xs rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
                                >
                                    Guardar Igual
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DELETE FOLDER MODAL */}
            {
                deleteFolderModal.show && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/80 backdrop-blur p-6 animate-in fade-in duration-200">
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 text-red-500 mb-2">
                                <Trash2 size={24} className="animate-bounce" />
                                <h3 className="text-lg font-bold text-white">¿Borrar {deleteFolderModal.team}?</h3>
                            </div>
                            <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">
                                Vas a eliminar la carpeta del equipo <strong className="text-white">{deleteFolderModal.team}</strong>.
                                <br /><br />
                                Esta carpeta contiene <strong className="text-amber-500">{deleteFolderModal.count} imágenes</strong>.
                                <br />
                                Esta acción no se puede deshacer.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setDeleteFolderModal({ ...deleteFolderModal, show: false })}
                                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold uppercase text-xs rounded-xl hover:bg-white/10 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDeleteFolder}
                                    className="flex-1 py-3 bg-red-600/20 text-red-500 border border-red-500/30 font-bold uppercase text-xs rounded-xl hover:bg-red-600 hover:text-white transition-colors shadow-lg shadow-red-900/20"
                                >
                                    Sí, Borrar Todo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function getImageSrc(bg: string | undefined) {
    if (!bg) return "/backgrounds/bg-portada-1.png";
    if (bg.startsWith('http')) return bg;
    return `/backgrounds/${bg}`;
}
