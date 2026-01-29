"use client";

import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, CalendarDays, ExternalLink, RefreshCw, Save, Edit3, X, ChevronDown, BarChart3, AlertCircle } from 'lucide-react';

type TelegramMsg = {
    id: string;
    tipo: string;
    bet_type_key: string;
    enviado: boolean;
    mensaje: string;
    timestamp: string;
};

type DatesData = Record<string, TelegramMsg[]>;

export default function TelegramAdmin({ readOnly }: { readOnly?: boolean }) {
    const [data, setData] = useState<DatesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

    // Logic for Editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Logic for Syncing
    const [isSyncing, setIsSyncing] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);


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


    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/telegram/messages?nocache=' + Date.now());
            const json = await res.json();
            if (!json.error) {
                setData(json);
            }
        } catch (e) {
            console.error("Failed to fetch telegram", e);
        } finally {
            setLoading(false);
        }
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
                await fetchData();
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
            "Esto regenerará los mensajes a partir del análisis actual, sobrescribiendo cambios no guardados en el día de hoy.",
            handleSyncLogic,
            true // Destructive
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
        setIsSaving(true);
        try {
            const res = await fetch('/api/telegram/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, id: item.id, mensaje: editValue })
            });

            if (res.ok) {
                // Optimistic Update
                if (data) {
                    const newData = { ...data };
                    // If date is 'REPORT', we need to check where it came from. 
                    // Reports are in the data object under their real date.
                    // But our 'update' api expects the 'key' in Redis which is usually the date.
                    // If 'REPORT' is passed as date key, it's virtual. We must find real date.
                    // Wait, the API needs the date KEY in `telegram_store`.
                    // The 'item' knows its parent date in our loop? No.
                    const realDate = date === 'REPORT' ? Object.keys(data).find(d => data[d].some(i => i.id === item.id)) : date;

                    if (realDate) {
                        const idx = newData[realDate].findIndex(x => x.id === item.id);
                        if (idx !== -1) {
                            newData[realDate][idx].mensaje = editValue;
                            setData(newData);
                        }
                    }
                }
                setEditingId(null);
            } else {
                alert("Error al guardar edición");
            }
        } catch (e) {
            alert("Error de red");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendLogic = async (date: string, item: TelegramMsg, includeAnalysis: boolean) => {
        setSendingId(item.id);
        try {
            // Find real date if coming from REPORT view
            const realDate = date === 'REPORT' && data
                ? Object.keys(data).find(d => data[d].some(i => i.id === item.id)) || date
                : date;

            const res = await fetch('/api/telegram/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: realDate, id: item.id, includeAnalysis })
            });
            const answer = await res.json();

            if (res.ok && answer.success) {
                // Optimistic Update
                if (data && realDate) {
                    const newData = { ...data };
                    const idx = newData[realDate].findIndex(x => x.id === item.id);
                    if (idx !== -1) {
                        newData[realDate][idx].enviado = true;
                        setData(newData);
                    }
                }
            } else {
                alert(`Error: ${answer.error || 'Desconocido'}`);
            }
        } catch (e) {
            alert("Error de red");
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
            case 'monthly_report': return 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-500/20';
            default: return 'bg-secondary/30 dark:bg-gray-900/40 border-border/20 dark:border-gray-500/30';
        }
    };

    if (loading && !data) {
        return <div className="p-10 text-center text-white/50 animate-pulse">Cargando mensajes...</div>;
    }

    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-4">
                <Send size={48} className="opacity-20" />
                <p>No hay mensajes generados aún.</p>
                {!readOnly && (
                    <div className="flex gap-4">
                        <button
                            onClick={fetchData}
                            className="px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition text-sm font-bold flex items-center gap-2"
                        >
                            <RefreshCw size={14} /> Refrescar
                        </button>
                        <button
                            onClick={handleSync}
                            className="px-4 py-2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full hover:bg-sky-500/30 transition text-sm font-bold flex items-center gap-2"
                        >
                            {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                            Generar Análisis de Hoy
                        </button>
                    </div>
                )}
                {/* Modal Render just in case */}
                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    title={confirmModal.title}
                    description={confirmModal.description}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={closeConfirm}
                    isDestructive={confirmModal.isDestructive}
                    confirmText={confirmModal.confirmText}
                />
            </div>
        );
    }

    // Extract Monthly Reports
    const allReports: { date: string, item: TelegramMsg }[] = [];
    let availableDates: string[] = [];

    // Parse Data Logic
    Object.entries(data).forEach(([date, items]) => {
        items.forEach(item => {
            if (item.bet_type_key === 'monthly_report') {
                allReports.push({ date, item });
            }
        });
        if (items.some(i => i.bet_type_key !== 'monthly_report')) {
            availableDates.push(date);
        }
    });

    // Sort
    allReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    availableDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    // Get Only Latest Report
    const latestReport = allReports.length > 0 ? allReports[0] : null;

    // Build Tab List: [REPORT?] + [Dates]
    // If there is ANY report, we show the REPORT tab. But user said "only the last one".
    // We already found 'latestReport'.
    const hasReport = !!latestReport;

    return (
        <DateSelectorWrapper
            data={data}
            latestReport={latestReport}
            availableDates={availableDates}
            readOnly={readOnly}
            loading={loading}
            // Pass logic functions
            fetchData={fetchData}
            handleSync={handleSync}
            handleSend={handleSend}
            handleGenerateReport={handleGenerateReport}
            isSyncing={isSyncing}
            isGeneratingReport={isGeneratingReport}
            // Edit logic
            editingId={editingId}
            editValue={editValue}
            setEditValue={setEditValue}
            handleEditStart={handleEditStart}
            handleEditCancel={handleEditCancel}
            handleEditSave={handleEditSave}
            sendingId={sendingId}
            isSaving={isSaving}
            getCardColor={getCardColor}
            confirmModal={confirmModal}
            closeConfirm={closeConfirm}
            hasReport={hasReport}
        />
    );
}

// Wrapper to manage date state cleanly without conditional hook errors
function DateSelectorWrapper({
    data, latestReport, availableDates, readOnly, loading,
    fetchData, handleSync, handleSend, handleGenerateReport,
    isSyncing, isGeneratingReport,
    editingId, editValue, setEditValue, handleEditStart, handleEditCancel, handleEditSave,
    sendingId, isSaving, getCardColor,
    confirmModal, closeConfirm, hasReport
}: any) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Initial Selection
    useEffect(() => {
        if (!selectedDate) {
            const today = new Date().toISOString().split('T')[0];
            if (availableDates.includes(today)) {
                setSelectedDate(today);
            } else if (availableDates.length > 0) {
                setSelectedDate(availableDates[0]);
            } else if (hasReport) {
                setSelectedDate('REPORT');
            }
        }
    }, [availableDates, selectedDate, hasReport]);

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            {!readOnly && (
                <div className="flex items-center justify-between bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-border/10 dark:border-white/5 backdrop-blur-sm sticky top-0 z-10 w-full shadow-xl shadow-black/5 dark:shadow-black/20">
                    <h3 className="text-xl font-bold text-foreground dark:text-white flex items-center gap-2">
                        <Send className="text-sky-500 dark:text-sky-400" />
                        Gestor Telegram
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Report Generator is now accessible mainly if no report? or explicitly? */}
                        {/* We can keep it here for manual generation/update */}
                        <button
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport}
                            className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition"
                            title="Generar/Actualizar Reporte Mensual"
                        >
                            {isGeneratingReport ? <RefreshCw className="animate-spin" size={18} /> : <BarChart3 size={18} />}
                        </button>

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold rounded-lg border border-sky-500/20 transition"
                        >
                            {isSyncing ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                            <span className="hidden sm:inline">Sincronizar Hoy</span>
                            <span className="inline sm:hidden">Sync</span>
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2 bg-secondary/80 dark:bg-white/5 rounded-full hover:bg-secondary dark:hover:bg-white/10 transition text-muted-foreground dark:text-white/60 hover:text-foreground dark:hover:text-white"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* MAIN SELECTOR TABS (Dates + Report) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Clock className="text-emerald-500 dark:text-emerald-400" size={18} />
                    <h4 className="text-sm font-bold text-muted-foreground dark:text-white/70 uppercase tracking-widest">
                        Gestor de Contenido
                    </h4>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide pt-2 px-1">
                    {/* REPORT TAB */}
                    {hasReport && (
                        <button
                            onClick={() => setSelectedDate('REPORT')}
                            className={`
                                flex flex-col items-center justify-center px-4 py-2 rounded-xl border transition-all min-w-[80px] hover:scale-105 active:scale-95 duration-200
                                ${selectedDate === 'REPORT'
                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-500 dark:text-indigo-400 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]'
                                    : 'bg-white dark:bg-white/5 border-border/20 dark:border-white/5 text-muted-foreground dark:text-white/50 hover:bg-secondary/50 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white/80'
                                }
                            `}
                        >
                            <span className="text-[9px] font-bold uppercase tracking-wider mb-1">
                                REPORTE
                            </span>
                            <BarChart3 size={20} />
                            {latestReport.item.enviado && (
                                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            )}
                        </button>
                    )}

                    {/* DATE TABS */}
                    {availableDates.map((date: string) => {
                        const isSelected = selectedDate === date;
                        const isToday = date === new Date().toISOString().split('T')[0];
                        const dateObj = new Date(date);

                        return (
                            <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                className={`
                                    flex flex-col items-center justify-center px-4 py-2 rounded-xl border transition-all min-w-[80px] hover:scale-105 active:scale-95 duration-200 relative
                                    ${isSelected
                                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-600 dark:text-sky-400 shadow-[0_0_15px_-3px_rgba(14,165,233,0.3)]'
                                        : 'bg-white dark:bg-white/5 border-border/20 dark:border-white/5 text-muted-foreground dark:text-white/50 hover:bg-secondary/50 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white/80'
                                    }
                                 `}
                            >
                                <span className="text-[10px] font-bold uppercase">
                                    {dateObj.toLocaleDateString('es-ES', { weekday: 'short' })}
                                </span>
                                <span className="text-lg font-bold leading-none">
                                    {dateObj.getDate()}
                                </span>
                                {isToday && (
                                    <span className="absolute -top-2 bg-sky-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold shadow-lg shadow-sky-500/20">
                                        HOY
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {availableDates.length === 0 && !hasReport && (
                        <div className="text-xs text-white/30 px-4">No hay contenido disponible</div>
                    )}
                </div>

                {/* CONTENT AREA */}
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 min-h-[300px]">

                    {/* CASE 1: SHOW REPORT */}
                    {selectedDate === 'REPORT' && latestReport && (
                        <div className="max-w-xl mx-auto mt-8">
                            <div className="flex items-center justify-center gap-2 mb-4 text-indigo-400 opacity-80">
                                <BarChart3 size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Vista Previa del Reporte Mensual</span>
                            </div>
                            <TelegramCard
                                item={latestReport.item}
                                date={latestReport.date}
                                readOnly={readOnly}
                                editingId={editingId}
                                editValue={editValue}
                                setEditValue={setEditValue}
                                handleEditStart={handleEditStart}
                                handleEditCancel={handleEditCancel}
                                handleEditSave={handleEditSave}
                                handleSendClick={handleSend}
                                sendingId={sendingId}
                                isSaving={isSaving}
                                getCardColor={getCardColor}
                            />
                            <p className="text-center text-white/20 text-[10px] mt-4 max-w-sm mx-auto">
                                Este es el reporte más reciente generado. Puedes editarlo o enviarlo desde aquí.
                            </p>
                        </div>
                    )}

                    {/* CASE 2: SHOW DAY */}
                    {selectedDate && selectedDate !== 'REPORT' && data[selectedDate] && (
                        <DailyGroup
                            date={selectedDate}
                            betItems={data[selectedDate].filter((i: any) => i.bet_type_key !== 'monthly_report')}
                            readOnly={readOnly}
                            editingId={editingId}
                            editValue={editValue}
                            setEditValue={setEditValue}
                            handleEditStart={handleEditStart}
                            handleEditCancel={handleEditCancel}
                            handleEditSave={handleEditSave}
                            handleSendClick={handleSend}
                            sendingId={sendingId}
                            isSaving={isSaving}
                            getCardColor={getCardColor}
                        />
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                description={confirmModal.description}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
                isDestructive={confirmModal.isDestructive}
                confirmText={confirmModal.confirmText}
            />
        </div>
    );
}

// SIMPLIFIED COMPONENT FOR PER-DAY STATE (Only Bets)
function DailyGroup({
    date, betItems, readOnly,
    editingId, editValue, setEditValue,
    handleEditStart, handleEditCancel, handleEditSave, handleSendClick,
    sendingId, isSaving, getCardColor
}: any) {
    const isToday = date === new Date().toISOString().split('T')[0];

    return (
        <div className="bg-white/50 dark:bg-white/5 rounded-2xl border border-border/10 dark:border-white/5 p-4 min-h-[200px]">
            <div className="flex items-center justify-between mb-4 border-b border-border/10 dark:border-white/5 pb-2">
                <div className="flex items-center gap-3">
                    <CalendarDays className="text-sky-500 dark:text-sky-400" size={20} />
                    <h4 className="text-lg font-bold text-foreground dark:text-white/90 capitalize">
                        {new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h4>
                </div>
                {isToday && (
                    <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-3 py-1 rounded-full border border-sky-500/30">
                        VISTA DE HOY
                    </span>
                )}
            </div>

            {/* ONLY BETS - NO COLUMNS, JUST GRID OF CARDS */}
            {betItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {betItems.map((item: any) => (
                        <TelegramCard
                            key={item.id}
                            item={item}
                            date={date}
                            readOnly={readOnly}
                            editingId={editingId}
                            editValue={editValue}
                            setEditValue={setEditValue}
                            handleEditStart={handleEditStart}
                            handleEditCancel={handleEditCancel}
                            handleEditSave={handleEditSave}
                            handleSendClick={handleSendClick}
                            sendingId={sendingId}
                            isSaving={isSaving}
                            getCardColor={getCardColor}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-[150px] text-white/30 gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <Clock size={18} />
                    </div>
                    <span className="text-xs uppercase font-bold tracking-wider">Sin Apuestas para este día</span>
                </div>
            )}
        </div>
    );
}

// Extracted Card Component to avoid duplication
function TelegramCard({
    item, date, readOnly,
    editingId, editValue, setEditValue,
    handleEditStart, handleEditCancel, handleEditSave, handleSendClick,
    sendingId, isSaving, getCardColor
}: any) {
    const isEditing = editingId === item.id;
    const [showAnalysis, setShowAnalysis] = useState(false); // Default unchecked

    const displayMessage = showAnalysis
        ? item.mensaje
        : (item.mensaje.includes('🧠') ? item.mensaje.split('🧠')[0].trim() : item.mensaje);

    // Recursive helper to render basic Telegram HTML tags in the preview
    const renderTelegramHTML: any = (text: string) => {
        if (!text) return null;
        // Remove markdown artifacts for preview
        const clean = text.replace(/\*\*/g, '');

        // Split by supported tags (<b>, <u>, <blockquote>) using [\s\S] to match newlines
        // Using a more inclusive regex for the split
        const parts = clean.split(/(<[bu]>[\s\S]*?<\/[bu]>|<blockquote>[\s\S]*?<\/blockquote>)/gi);

        return parts.map((part, i) => {
            if (!part) return null;

            // Check for tags using regex matching for robustness
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

            // Default text node
            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    };

    return (
        <div className={`relative group p-3 md:p-3 rounded-xl border transition-all hover:border-opacity-50 ${getCardColor(item.bet_type_key)}`}>
            {/* Header Compact - Now includes Edit Button */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.enviado ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <h5 className="font-bold text-gray-700 dark:text-white/90 tracking-tight text-xs truncate max-w-[150px]">
                        {item.tipo}
                    </h5>

                    {/* Move Edit Button Here (Top Leftish next to title) */}
                    {!readOnly && !item.enviado && !isEditing && (
                        <button
                            onClick={() => handleEditStart(item)}
                            className="p-1 text-muted-foreground/50 hover:text-foreground dark:text-white/30 dark:hover:text-white transition opacity-0 group-hover:opacity-100"
                            title="Editar mensaje"
                        >
                            <Edit3 size={12} />
                        </button>
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
                        <div>{renderTelegramHTML(displayMessage)}</div>
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
                        className={`
                            flex items-center gap-1.5 px-3 py-1 rounded-md font-bold text-[10px] transition-all w-full justify-center
                            ${item.enviado
                                ? 'bg-emerald-500/5 text-emerald-500/30 cursor-not-allowed border border-emerald-500/10'
                                : 'bg-secondary dark:bg-white/5 hover:bg-secondary/80 dark:hover:bg-white/10 text-foreground dark:text-white border border-border/50 dark:border-white/10 hover:border-border dark:hover:border-white/20'
                            }
                        `}
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

// Custom Confirmation Modal
const ConfirmationModal = ({ isOpen, title, description, onConfirm, onCancel, confirmText = "Continuar", cancelText = "Cancelar", isDestructive = false }: any) => {
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
};
