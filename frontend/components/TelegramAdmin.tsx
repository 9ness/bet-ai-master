"use client";

import React, { useState, useEffect } from 'react';
import {
    Send, CheckCircle2, Clock, ExternalLink, RefreshCw, Save, Edit3, X,
    ChevronDown, ChevronLeft, ChevronRight, Calendar, Rocket, Zap, Loader2, AlertCircle,
    Copy, Check
} from 'lucide-react';

type TelegramMsg = {
    id: string;
    tipo: string;
    bet_type_key: string;
    enviado: boolean;
    mensaje: string;
    timestamp: string;
};

type DatesData = Record<string, {
    messages: TelegramMsg[];
    morning_messages: string[];
    win_messages: {
        stake1: string[];
        stake4: string[];
        stake5: string[];
        stakazo: string[];
    };
}>;

export default function TelegramAdmin({ readOnly }: { readOnly?: boolean }) {
    const [data, setData] = useState<DatesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

    // Toast Notification State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({
        message: '',
        type: 'info',
        visible: false
    });

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    // Logic for Editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Logic for Syncing
    const [isSyncing, setIsSyncing] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Carousel state for morning messages
    const [currentMorningIdx, setCurrentMorningIdx] = useState(0);
    const [winIndices, setWinIndices] = useState<Record<string, number>>({
        stake1: 0,
        stake4: 0,
        stake5: 0,
        stakazo: 0
    });

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        isDestructive?: boolean;
        confirmText?: string;
    }>({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: () => { },
        isDestructive: false,
        confirmText: "Continuar"
    });

    const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const confirmAction = (title: string, description: string, action: () => void, isDestructive = false) => {
        setConfirmModal({
            isOpen: true,
            title,
            description,
            onConfirm: () => {
                closeConfirm();
                action();
            },
            isDestructive,
            confirmText: "Continuar"
        });
    };

    const handleCopyToClipboard = (text: string) => {
        // 1. Replace <br> with newlines
        let cleanText = text.replace(/<br\s*\/?>/gi, '\n');

        // 2. Clear all other HTML tags (<b>, </u>, <blockquote>, etc)
        cleanText = cleanText.replace(/<\/?[^>]+(>|$)/g, "");

        navigator.clipboard.writeText(cleanText).then(() => {
            showToast("Mensaje copiado al portapapeles", "success");
        }).catch(err => {
            console.error('Error al copiar:', err);
            showToast("Error al copiar al portapapeles", "error");
        });
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/telegram/messages?nocache=' + Date.now());
            const json = await res.json();
            if (!json.error) {
                setData(json);
                return json;
            }
        } catch (e) {
            console.error("Failed to fetch telegram", e);
        } finally {
            setLoading(false);
        }
        return null;
    };

    const handleSyncLogic = async () => {
        setIsSyncing(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch('/api/telegram/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today })
            });
            const ans = await res.json();
            if (ans.success) {
                const newData = await fetchData();
                if (newData) {
                    const sortedDates = Object.keys(newData)
                        .filter(d => newData[d].messages.some((i: TelegramMsg) => i.bet_type_key !== 'monthly_report'))
                        .sort((a, b) => b.localeCompare(a));
                    if (sortedDates.length > 0) {
                        setSelectedDate(sortedDates[0]);
                    }
                }
            } else {
                alert("Error al sincronizar: " + (ans.details || ans.error));
            }
        } catch (e) {
            alert("Error de red al sincronizar");
        } finally {
            setIsSyncing(false);
        }
    }

    const handleSync = () => {
        confirmAction(
            "¿Sincronizar Análisis?",
            "Esto regenerará los mensajes a partir del análisis actual, incluyendo las 3 versiones de Buenos Días.",
            handleSyncLogic,
            true
        );
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch('/api/telegram/add-monthly-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: today })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                await fetchData();
            } else {
                alert("Error: " + (json.error || "Desconocido"));
            }
        } catch (e) {
            alert("Error de red");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleEditStart = (item: TelegramMsg) => {
        if (readOnly) return;
        setEditingId(item.id);
        setEditValue(item.mensaje);
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditValue("");
    };

    const handleEditSave = async (date: string, item: TelegramMsg) => {
        if (!data) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/telegram/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, id: item.id, mensaje: editValue })
            });

            if (res.ok) {
                const newData = { ...data };
                if (item.id.startsWith('morning_')) {
                    const idx = parseInt(item.id.split('_')[1]);
                    if (date && newData[date]) {
                        newData[date].morning_messages[idx] = editValue;
                        setData(newData);
                    }
                } else if (item.id.startsWith('win_')) {
                    const parts = item.id.split('_');
                    const type = parts[1] as keyof DatesData[string]['win_messages'];
                    const idx = parseInt(parts[2]);
                    if (date && newData[date]) {
                        newData[date].win_messages[type][idx] = editValue;
                        setData(newData);
                    }
                } else {
                    const realDate = date === 'REPORT' ? Object.keys(data).find(d => data[d].messages.some(i => i.id === item.id)) : date;

                    if (realDate && newData[realDate]) {
                        const idx = newData[realDate].messages.findIndex(x => x.id === item.id);
                        if (idx !== -1) {
                            newData[realDate].messages[idx].mensaje = editValue;
                            setData(newData);
                        }
                    }
                }
                setEditingId(null);
            } else {
                showToast("Error al guardar edición", "error");
            }
        } catch (e) {
            showToast("Error de red", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendLogic = async (date: string, item: TelegramMsg, includeAnalysis: boolean) => {
        if (!data) return;
        setSendingId(item.id);
        try {
            const realDate = date === 'REPORT'
                ? Object.keys(data).find(d => data[d].messages.some(i => i.id === item.id)) || date
                : date;

            const res = await fetch('/api/telegram/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: realDate, id: item.id, includeAnalysis })
            });
            const answer = await res.json();

            if (res.ok && answer.success) {
                if (realDate && data[realDate]) {
                    const newData = { ...data };
                    const idx = newData[realDate].messages.findIndex(x => x.id === item.id);
                    if (idx !== -1) {
                        newData[realDate].messages[idx].enviado = true;
                        setData(newData);
                    }
                }
            } else {
                showToast(`Error: ${answer.error || 'Desconocido'}`, "error");
            }
        } catch (e) {
            showToast("Error de red", "error");
        } finally {
            setSendingId(null);
        }
    };

    const handleSend = (date: string, item: TelegramMsg, includeAnalysis: boolean) => {
        confirmAction(
            "¿Enviar a Telegram?",
            "Esta acción publicará el mensaje inmediatamente en el canal oficial. ¿Estás seguro de que quieres enviarlo?",
            () => handleSendLogic(date, item, includeAnalysis),
            false
        );
    }

    // Color Helpers
    const getCardColor = (type: string) => {
        switch (type.toLowerCase()) {
            case 'safe': return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/20';
            case 'value': return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/20';
            case 'funbet': return 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-500/20';
            case 'stakazo': return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/20';
            case 'monthly_report': return 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-500/20';
            default: return 'bg-secondary/30 dark:bg-gray-900/40 border-border/20 dark:border-gray-500/30';
        }
    };

    // State for Section (Daily vs General)
    const [section, setSection] = useState<'daily' | 'general'>('daily');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Initial Date Selection & Carousel Reset
    useEffect(() => {
        if (!selectedDate && data) {
            const dates = Object.keys(data).filter(d => data[d].messages.some(i => i.bet_type_key !== 'monthly_report')).sort((a, b) => b.localeCompare(a));
            const today = new Date().toISOString().split('T')[0];
            if (dates.includes(today)) setSelectedDate(today);
            else if (dates.length > 0) setSelectedDate(dates[0]);
            else setSelectedDate('REPORT');
        }
        setCurrentMorningIdx(0);
    }, [data, selectedDate]);


    const handleSendStatic = async (filename: string, caption?: string) => {
        confirmAction(
            "¿Enviar imagen a Telegram?",
            "Esta acción enviará la imagen 'Buenos Días' al canal inmediatamente.",
            async () => {
                setSendingId(filename);
                try {
                    const res = await fetch('/api/telegram/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'static_photo',
                            filename: filename,
                            caption: caption
                        })
                    });
                    const resData = await res.json();
                    if (resData.success) {
                        showToast("Imagen enviada correctamente", "success");
                    } else {
                        showToast("Error al enviar: " + resData.error, "error");
                    }
                } catch (e) {
                    showToast("Error de red", "error");
                } finally {
                    setSendingId(null);
                }
            },
            false
        );
    };

    const handleSendRawText = async (id: string, text: string) => {
        confirmAction(
            "¿Enviar mensaje a Telegram?",
            "Esta acción enviará el texto seleccionado al canal inmediatamente.",
            async () => {
                setSendingId(id);
                try {
                    const res = await fetch('/api/telegram/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'raw_text',
                            text: text
                        })
                    });
                    const resData = await res.json();
                    if (resData.success) {
                        showToast("Mensaje enviado correctamente", "success");
                    } else {
                        showToast("Error al enviar: " + resData.error, "error");
                    }
                } catch (e) {
                    showToast("Error de red", "error");
                } finally {
                    setSendingId(null);
                }
            },
            false
        );
    };

    if (loading && !data) return <div className="p-10 text-center text-white/50 animate-pulse">Cargando Gestor de Telegram...</div>;

    // Filter items based on selected date (for Daily section)
    const currentItems = (data && selectedDate && data[selectedDate])
        ? data[selectedDate].messages.filter(i => i.bet_type_key !== 'monthly_report')
        : [];

    // Available dates for selector
    const availableDates = data ? Object.keys(data).filter(d => data[d].messages.some(i => i.bet_type_key !== 'monthly_report')).sort((a, b) => b.localeCompare(a)) : [];

    const morningVersions = (selectedDate && data?.[selectedDate]?.morning_messages) || [];

    // Helper to render basic Telegram HTML tags in the preview (Shared)
    const renderTelegramHTML: any = (text: string) => {
        if (!text) return null;
        // Remove markdown artifacts for preview
        const clean = text.replace(/\*\*/g, '');

        // Split by supported tags (<b>, <u>, <blockquote>) using [\s\S] to match newlines
        const parts = clean.split(/(<[bu]>[\s\S]*?<\/[bu]>|<blockquote>[\s\S]*?<\/blockquote>)/gi);

        return parts.map((part, i) => {
            if (!part) return null;

            const bMatch = part.match(/^<b>([\s\S]*)<\/b>$/i);
            if (bMatch) {
                return <b key={i} className="font-bold text-black dark:text-white">{renderTelegramHTML(bMatch[1])}</b>;
            }

            const uMatch = part.match(/^<u>([\s\S]*)<\/u>$/i);
            if (uMatch) {
                return <u key={i} className="underline decoration-white/40">{renderTelegramHTML(uMatch[1])}</u>;
            }

            const qMatch = part.match(/^<blockquote>([\s\S]*)<\/blockquote>$/i);
            if (qMatch) {
                return (
                    <blockquote key={i} className="border-l-2 border-border dark:border-white/20 pl-3 my-2 italic text-muted-foreground dark:text-gray-400 bg-secondary/30 dark:bg-white/5 py-1 rounded-r-md whitespace-pre-wrap">
                        {renderTelegramHTML(qMatch[1].trim())}
                    </blockquote>
                );
            }

            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    };

    return (
        <div className="space-y-6">
            {/* HEADER & TABS */}
            {/* HEADER & TABS - PREMIUM REDESIGN */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.03] backdrop-blur-md p-5 rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative group">
                {/* Decorative Background Glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 blur-[100px] pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center gap-6 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                            <Send className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">
                                GESTOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">TELEGRAM</span>
                            </h2>
                            <p className="text-white/30 text-[11px] font-medium uppercase tracking-widest mt-0.5">Centro de Control Oficial</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-xl border border-white/5">
                        <button
                            onClick={() => setSection('daily')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${section === 'daily' ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/20 translate-y-[-1px]' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                        >
                            <Calendar size={14} />
                            DIARIO
                        </button>
                        <button
                            onClick={() => setSection('general')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${section === 'general' ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-600/20 translate-y-[-1px]' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                        >
                            <Rocket size={14} />
                            GENERAL
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 z-10 bg-black/20 md:bg-transparent p-3 md:p-0 rounded-2xl border border-white/5 md:border-none">
                    <div className="relative group/select min-w-[160px]">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Clock size={14} className="text-blue-400" />
                        </div>
                        <select
                            value={selectedDate || ''}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-black/60 hover:bg-black/80 border border-white/10 hover:border-blue-500/50 text-white text-xs font-bold rounded-xl pl-9 pr-8 py-3 outline-none transition-all cursor-pointer appearance-none shadow-inner"
                        >
                            {availableDates.length > 0 ? (
                                availableDates.map(date => (
                                    <option key={date} value={date} className="bg-zinc-900 text-white">{date}</option>
                                ))
                            ) : (
                                <option value="" disabled className="bg-zinc-900">Sin fechas</option>
                            )}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none group-hover/select:translate-y-0.5 transition-transform duration-300">
                            <ChevronDown size={14} className="text-white/30" />
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-white/10 mx-1 hidden md:block" />

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchData}
                            className="group/btn p-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-300 shadow-xl"
                            title="Actualizar datos"
                        >
                            <RefreshCw size={18} className="group-hover/btn:rotate-180 transition-transform duration-700" />
                        </button>

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="relative flex items-center gap-2 pl-4 pr-5 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-bold text-xs transition-all duration-300 disabled:opacity-50 group/sync"
                            title="Sincronizar Hoy"
                        >
                            {isSyncing ? (
                                <RefreshCw className="animate-spin" size={16} />
                            ) : (
                                <Zap size={16} className="group-hover/sync:scale-125 transition-transform" />
                            )}
                            <span className="hidden sm:inline">SINCRONIZAR</span>
                            <div className="absolute inset-0 rounded-xl bg-emerald-400/5 animate-pulse pointer-events-none" />
                        </button>
                    </div>
                </div>
            </div>

            {/* SECTION CONTENT */}
            {section === 'general' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
                    {/* BUENOS DIAS PHOTO CARD */}
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl hover:border-purple-500/30 transition-all group">
                        <div className="relative h-44 w-full bg-black/50 flex items-center justify-center overflow-hidden">
                            <img src="/assets/telegram/buenos_dias.png" alt="Buenos Días" className="object-cover w-full h-full opacity-60 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <h3 className="absolute bottom-4 left-4 text-xl font-bold text-white flex items-center gap-2">
                                ☀️ Imagen Buenos Días
                            </h3>
                        </div>
                        <div className="p-4">
                            <button
                                onClick={() => handleSendStatic('buenos_dias.png')}
                                disabled={sendingId === 'buenos_dias.png'}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
                            >
                                <Send size={16} />
                                {sendingId === 'buenos_dias.png' ? 'Enviando...' : 'Enviar Foto'}
                            </button>
                        </div>
                    </div>

                    {/* BUENOS DIAS MESSAGE CAROUSEL CARD */}
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl hover:border-purple-500/30 transition-all group">
                        <div className="p-4 border-b border-white/10 bg-black/20">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                ☕ Mensaje Buenos Días
                            </h3>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Versiones diarias</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {morningVersions.length > 0 ? (
                                <div className="space-y-3">
                                    <div className={`relative bg-black/40 rounded-lg p-3 flex flex-col transition-all duration-300 ${editingId === `morning_${currentMorningIdx}` ? 'min-h-[300px]' : 'min-h-[140px]'}`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">Versión {currentMorningIdx + 1} / {morningVersions.length}</span>

                                                {/* Botón de Editar para Buenos Días */}
                                                {!readOnly && editingId !== `morning_${currentMorningIdx}` && (
                                                    <div className="flex items-center gap-1 ml-2">
                                                        <button
                                                            onClick={() => handleCopyToClipboard(morningVersions[currentMorningIdx])}
                                                            className="p-1 text-white/30 hover:text-white transition duration-300"
                                                            title="Copiar texto"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(`morning_${currentMorningIdx}`);
                                                                setEditValue(morningVersions[currentMorningIdx]);
                                                            }}
                                                            className="p-1 text-white/30 hover:text-white transition duration-300"
                                                            title="Editar versión"
                                                        >
                                                            <Edit3 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-1.5 bg-white/5 p-1 rounded-lg border border-white/5">
                                                <button
                                                    onClick={() => setCurrentMorningIdx(prev => (prev > 0 ? prev - 1 : (morningVersions.length - 1)))}
                                                    className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-all duration-300"
                                                    title="Anterior"
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <div className="w-[1px] h-4 bg-white/10 self-center" />
                                                <button
                                                    onClick={() => setCurrentMorningIdx(prev => (prev < (morningVersions.length - 1) ? prev + 1 : 0))}
                                                    className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-all duration-300"
                                                    title="Siguiente"
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {editingId === `morning_${currentMorningIdx}` ? (
                                            <div className="flex-grow flex flex-col animate-in fade-in zoom-in-95 duration-300">
                                                <textarea
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-full flex-grow bg-black/40 border border-white/10 rounded-lg p-2 text-[11px] font-mono text-white focus:outline-none focus:border-purple-500/50 resize-none custom-scrollbar min-h-[200px]"
                                                />
                                                <div className="flex justify-end gap-2 mt-2">
                                                    <button
                                                        onClick={handleEditCancel}
                                                        className="px-2 py-1 text-[10px] font-bold text-white/50 hover:text-white transition"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSave(selectedDate!, { id: `morning_${currentMorningIdx}` } as any)}
                                                        disabled={isSaving}
                                                        className="px-3 py-1 text-[10px] font-bold text-black bg-purple-400 hover:bg-purple-300 rounded transition flex items-center gap-1.5"
                                                    >
                                                        {isSaving ? <RefreshCw className="animate-spin" size={10} /> : <Save size={10} />}
                                                        Guardar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-white/80 font-mono leading-relaxed flex-grow italic custom-scrollbar overflow-y-auto">
                                                {renderTelegramHTML(morningVersions[currentMorningIdx])}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleSendRawText(`morning-${currentMorningIdx}`, morningVersions[currentMorningIdx])}
                                        disabled={sendingId === `morning-${currentMorningIdx}`}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/10"
                                    >
                                        <Send size={16} />
                                        {sendingId === `morning-${currentMorningIdx}` ? 'Enviando...' : 'Enviar Texto'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm text-white/50 italic mb-4">
                                        Sincroniza la jornada de hoy para generar los mensajes inteligentes.
                                    </p>
                                    <button
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50"
                                    >
                                        <RefreshCw className={isSyncing ? "animate-spin" : ""} size={18} />
                                        {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* VICTORY MESSAGES CAROUSELS */}
                    {(['stake1', 'stake4', 'stake5', 'stakazo'] as const).map((type) => {
                        const winMsgs = selectedDate && data?.[selectedDate]?.win_messages;
                        const versions = (winMsgs as any)?.[type] || [];
                        const currentIdx = winIndices[type];
                        const titleMap = {
                            stake1: "✅ Acierto Stake 1",
                            stake4: "✅ Acierto Stake 4",
                            stake5: "✅ Acierto Stake 5",
                            stakazo: "🏆 Victoria STAKAZO"
                        };

                        return (
                            versions.length > 0 && (
                                <div key={type} className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl hover:border-${type === 'stakazo' ? 'yellow' : 'emerald'}-500/30 transition-all group`}>
                                    <div className="p-4 border-b border-white/10 bg-black/20">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            {titleMap[type]}
                                        </h3>
                                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Versiones inteligentes</p>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="relative bg-black/40 rounded-lg p-3 flex flex-col transition-all duration-300" style={{ minHeight: editingId === `win_${type}_${currentIdx}` ? '300px' : '140px' }}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${type === 'stakazo' ? 'bg-yellow-500' : 'bg-emerald-500'} animate-pulse`} />
                                                    <span className={`text-[10px] font-black ${type === 'stakazo' ? 'text-yellow-400' : 'text-emerald-400'} uppercase tracking-[0.2em]`}>Versión {currentIdx + 1} / {versions.length}</span>
                                                    {!readOnly && editingId !== `win_${type}_${currentIdx}` && (
                                                        <div className="flex items-center gap-1 ml-2">
                                                            <button
                                                                onClick={() => handleCopyToClipboard(versions[currentIdx])}
                                                                className="p-1 text-white/30 hover:text-white transition duration-300"
                                                                title="Copiar texto"
                                                            >
                                                                <Copy size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingId(`win_${type}_${currentIdx}`);
                                                                    setEditValue(versions[currentIdx]);
                                                                }}
                                                                className="p-1 text-white/30 hover:text-white transition duration-300"
                                                                title="Editar versión"
                                                            >
                                                                <Edit3 size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5 bg-white/5 p-1 rounded-lg border border-white/5">
                                                    <button
                                                        onClick={() => setWinIndices(prev => ({ ...prev, [type]: prev[type] > 0 ? prev[type] - 1 : (versions.length - 1) }))}
                                                        className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-all duration-300"
                                                        title="Anterior"
                                                    >
                                                        <ChevronLeft size={14} />
                                                    </button>
                                                    <div className="w-[1px] h-4 bg-white/10 self-center" />
                                                    <button
                                                        onClick={() => setWinIndices(prev => ({ ...prev, [type]: prev[type] < (versions.length - 1) ? prev[type] + 1 : 0 }))}
                                                        className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-all duration-300"
                                                        title="Siguiente"
                                                    >
                                                        <ChevronRight size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {editingId === `win_${type}_${currentIdx}` ? (
                                                <div className="flex-grow flex flex-col animate-in fade-in zoom-in-95 duration-300">
                                                    <textarea
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-full flex-grow bg-black/40 border border-white/10 rounded-lg p-2 text-[11px] font-mono text-white focus:outline-none focus:border-purple-500/50 resize-none custom-scrollbar min-h-[200px]"
                                                    />
                                                    <div className="flex justify-end gap-2 mt-2">
                                                        <button
                                                            onClick={handleEditCancel}
                                                            className="px-2 py-1 text-[10px] font-bold text-white/50 hover:text-white transition"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditSave(selectedDate!, { id: `win_${type}_${currentIdx}` } as any)}
                                                            disabled={isSaving}
                                                            className="px-3 py-1 text-[10px] font-bold text-black bg-purple-400 hover:bg-purple-300 rounded transition flex items-center gap-1.5"
                                                        >
                                                            {isSaving ? <RefreshCw className="animate-spin" size={10} /> : <Save size={10} />}
                                                            Guardar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-white/80 font-mono leading-relaxed flex-grow italic custom-scrollbar overflow-y-auto">
                                                    {renderTelegramHTML(versions[currentIdx])}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleSendRawText(`win-${type}-${currentIdx}`, versions[currentIdx])}
                                            disabled={sendingId === `win-${type}-${currentIdx}`}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
                                        >
                                            <Send size={16} />
                                            {sendingId === `win-${type}-${currentIdx}` ? 'Enviando...' : 'Enviar Texto'}
                                        </button>
                                    </div>
                                </div>
                            )
                        );
                    })}
                </div>
            ) : (
                /* DAILY CONTENT */
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* GENERATE BUTTON IF EMPTY */
                        (currentItems.length === 0) && (
                            <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/10 rounded-2xl bg-white/5 text-center space-y-4">
                                <div className="p-4 bg-blue-500/20 rounded-full text-blue-400 mb-2">
                                    <Send size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Sin mensajes generados para {selectedDate}</h3>
                                <p className="text-white/50 max-w-md">
                                    No se han encontrado mensajes de Telegram listos para enviar.
                                    Pulsa el botón para analizar las apuestas del día y generar los borradores.
                                </p>
                                <button
                                    onClick={handleSync}
                                    disabled={isSyncing}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/20"
                                >
                                    {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                    {isSyncing ? 'Generando...' : 'Generar Mensajes de Hoy'}
                                </button>
                            </div>
                        )}

                    {currentItems.map((item: any) => (
                        <TelegramCard
                            key={item.id}
                            item={item}
                            date={selectedDate}
                            readOnly={readOnly}
                            editingId={editingId}
                            editValue={editValue}
                            setEditValue={setEditValue}
                            handleEditStart={handleEditStart}
                            handleEditCancel={handleEditCancel}
                            handleEditSave={handleEditSave}
                            handleSendClick={handleSend} // Pass the wrapper logic
                            renderTelegramHTML={renderTelegramHTML}
                            handleCopyToClipboard={handleCopyToClipboard}
                            sendingId={sendingId}
                            isSaving={isSaving}
                            getCardColor={getCardColor}
                        />
                    ))}
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
                isDestructive={confirmModal.isDestructive}
                confirmText={confirmModal.confirmText}
            />

            {/* PREMIUM TOAST NOTIFICATION */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 transform ${toast.visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-90 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] min-w-[320px] ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                    toast.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-blue-500/20 text-blue-400'
                    }`}>
                    <div className={`p-2 rounded-xl ${toast.type === 'success' ? 'bg-emerald-500/20' :
                        toast.type === 'error' ? 'bg-rose-500/20' :
                            'bg-blue-500/20'
                        }`}>
                        {toast.type === 'success' ? <CheckCircle2 size={20} /> :
                            toast.type === 'error' ? <AlertCircle size={20} /> :
                                <Send size={20} />}
                    </div>
                    <div>
                        <p className="text-[13px] font-bold tracking-wide uppercase opacity-50 mb-0.5">Notificación</p>
                        <p className="text-white font-medium">{toast.message}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// HELPER COMPONENTS
// -----------------------------------------------------------------------------

function TelegramCard({
    item, date, readOnly,
    editingId, editValue, setEditValue,
    handleEditStart, handleEditCancel, handleEditSave, handleSendClick,
    handleCopyToClipboard,
    sendingId, isSaving, getCardColor, renderTelegramHTML
}: any) {
    const isEditing = editingId === item.id;
    const [showAnalysis, setShowAnalysis] = useState(false); // Default unchecked

    const displayMessage = showAnalysis
        ? item.mensaje
        : (item.mensaje.includes('🧠') ? item.mensaje.split('🧠')[0].trim() : item.mensaje);

    // Recursive helper moved to parent

    return (
        <div className={`relative group p-3 md:p-4 rounded-xl border transition-all hover:border-opacity-50 ${getCardColor(item.bet_type_key)}`}>
            {/* Header Compact - Now includes Edit Button */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.enviado ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <h5 className="font-bold text-gray-700 dark:text-white/90 tracking-tight text-xs truncate max-w-[150px]">
                        {item.tipo}
                    </h5>

                    {/* Copy and Edit Buttons */}
                    {!readOnly && !item.enviado && !isEditing && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleCopyToClipboard(displayMessage)}
                                className="p-1 text-muted-foreground/50 hover:text-foreground dark:text-white/30 dark:hover:text-white transition opacity-0 group-hover:opacity-100"
                                title="Copiar mensaje"
                            >
                                <Copy size={12} />
                            </button>
                            <button
                                onClick={() => handleEditStart(item)}
                                className="p-1 text-muted-foreground/50 hover:text-foreground dark:text-white/30 dark:hover:text-white transition opacity-0 group-hover:opacity-100"
                                title="Editar mensaje"
                            >
                                <Edit3 size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {item.enviado ? (
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider opacity-60">Enviado</span>
                ) : (
                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider opacity-60">Pendiente</span>
                )}
            </div>

            {/* Content Preview or Edit Mode */}
            {isEditing ? (
                <div className="mb-2 animate-in fade-in zoom-in-95">
                    <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full h-[120px] bg-black/40 border border-white/10 rounded-lg p-2 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 resize-y custom-scrollbar"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            onClick={handleEditCancel}
                            className="px-2 py-1 text-[10px] font-bold text-white/50 hover:text-white transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => handleEditSave(date, item)}
                            disabled={isSaving}
                            className="px-3 py-1 text-[10px] font-bold text-black bg-white/80 hover:bg-white rounded transition flex items-center gap-1.5"
                        >
                            {isSaving ? <RefreshCw className="animate-spin" size={10} /> : <Save size={10} />}
                            Guardar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative group/text">
                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2 font-mono text-[11px] text-gray-700 dark:text-gray-300 w-full mb-2 max-h-[140px] overflow-y-auto custom-scrollbar leading-relaxed">
                        {renderTelegramHTML(displayMessage)}
                    </div>
                </div>
            )}

            {/* Show Analysis Checkbox - Condition: NOT monthly report (it always shows full) */}
            {!readOnly && item.bet_type_key !== 'monthly_report' && (
                <div className="flex items-center gap-2 mb-2 px-1">
                    <input
                        type="checkbox"
                        id={`check-${item.id}`}
                        checked={showAnalysis}
                        onChange={(e) => setShowAnalysis(e.target.checked)}
                        className="w-3 h-3 rounded border-border dark:border-white/20 bg-secondary dark:bg-white/5 text-sky-500 focus:ring-sky-500/20 cursor-pointer"
                    />
                    <label htmlFor={`check-${item.id}`} className="text-[10px] font-bold text-muted-foreground dark:text-white/50 cursor-pointer select-none">
                        Mostrar análisis
                    </label>
                </div>
            )}

            {/* Compact Actions */}
            {!readOnly && (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => handleSendClick(date, item, showAnalysis)} // Pass checkbox state
                        disabled={item.enviado || (sendingId !== null && sendingId !== item.id) || (editingId !== null && editingId !== item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold text-[10px] transition-all w-full justify-center
                            ${item.enviado
                                ? 'bg-emerald-500/5 text-emerald-500/30 cursor-not-allowed border border-emerald-500/10'
                                : 'bg-secondary dark:bg-white/5 hover:bg-secondary/80 dark:hover:bg-white/10 text-foreground dark:text-white border border-border/50 dark:border-white/10 hover:border-border dark:hover:border-white/20'
                            }`}
                    >
                        {sendingId === item.id ? (
                            <>
                                <RefreshCw className="animate-spin" size={10} /> Enviando...
                            </>
                        ) : item.enviado ? (
                            <>
                                <CheckCircle2 size={10} /> Enviado
                            </>
                        ) : (
                            <>
                                <Send size={10} /> Enviar Telegram
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

function ConfirmationModal({ isOpen, title, description, onConfirm, onCancel, confirmText = "Continuar", cancelText = "Cancelar", isDestructive = false }: any) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 ring-1 ring-white/5">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                    {description}
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-bold text-white/60 hover:text-white transition hover:bg-white/5 rounded-lg"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition shadow-lg ${isDestructive
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                            : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20'
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
