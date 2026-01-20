"use client";

import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Clock, CalendarDays, ExternalLink, RefreshCw, Save, Edit3, X } from 'lucide-react';

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

    const handleSync = async () => {
        if (!confirm("Esto regenerará los mensajes a partir del análisis actual, sobrescribiendo cambios no guardados en el día de hoy. ¿Continuar?")) return;

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
                    const idx = newData[date].findIndex(x => x.id === item.id);
                    if (idx !== -1) {
                        newData[date][idx].mensaje = editValue;
                        setData(newData);
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

    const handleSend = async (date: string, item: TelegramMsg) => {
        if (!confirm("¿Enviar este mensaje al Canal de Telegram?")) return;

        setSendingId(item.id);
        try {
            const res = await fetch('/api/telegram/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, id: item.id })
            });
            const answer = await res.json();

            if (res.ok && answer.success) {
                // Optimistic Update
                if (data) {
                    const newData = { ...data };
                    const idx = newData[date].findIndex(x => x.id === item.id);
                    if (idx !== -1) {
                        newData[date][idx].enviado = true;
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

    // Color Helpers
    const getCardColor = (type: string) => {
        switch (type.toLowerCase()) {
            case 'safe': return 'from-emerald-950/40 to-emerald-900/10 border-emerald-500/20';
            case 'value': return 'from-amber-950/40 to-amber-900/10 border-amber-500/20';
            case 'funbet': return 'from-violet-950/40 to-violet-900/10 border-violet-500/20';
            default: return 'from-gray-900/40 to-gray-800/20 border-gray-500/30';
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
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-10">
            {!readOnly && (
                <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-sm sticky top-0 z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Send className="text-sky-400" />
                        Gestor Telegram
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold rounded-lg border border-sky-500/20 transition"
                        >
                            {isSyncing ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                            Sincronizar Hoy
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            )}

            {Object.entries(data).map(([date, items]) => (
                <div key={date} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <CalendarDays className="text-sky-400" size={18} />
                        <h4 className="text-lg font-bold text-white/90 capitalize">
                            {new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h4>
                        {date === new Date().toISOString().split('T')[0] && (
                            <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
                                HOY
                            </span>
                        )}
                    </div>

                    {/* Section: Daily Bets */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <div className="h-4 w-1 bg-sky-500 rounded-full" />
                            <h5 className="text-xs font-bold text-white/50 uppercase tracking-widest">
                                Apuestas del Día
                            </h5>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className={`relative group p-3 md:p-4 rounded-xl border bg-gradient-to-br transition-all hover:border-opacity-50 ${getCardColor(item.bet_type_key)}`}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-bold text-white/90 tracking-tight text-sm flex items-center gap-2">
                                            {item.tipo}
                                        </h5>
                                        {item.enviado ? (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                                <CheckCircle2 size={12} />
                                                ENVIADO
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500/70 text-[10px] font-bold">
                                                <Clock size={12} />
                                                PENDIENTE
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Preview or Edit Mode */}
                                    {editingId === item.id ? (
                                        <div className="mb-2 animate-in fade-in zoom-in-95">
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="w-full h-[200px] bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-white/20 resize-y"
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
                                            <div className="bg-transparent rounded-lg p-0 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed mb-3">
                                                {item.mensaje}
                                            </div>
                                            {!readOnly && !item.enviado && (
                                                <button
                                                    onClick={() => handleEditStart(item)}
                                                    className="absolute -top-1 -right-1 p-1.5 text-white/40 hover:text-white transition"
                                                >
                                                    <Edit3 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {!readOnly && (
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                                            <button
                                                disabled={true}
                                                className="hidden md:flex items-center gap-1.5 text-[10px] font-bold text-white/30 px-2 py-1.5"
                                            >
                                                <ExternalLink size={12} /> Vista Previa
                                            </button>

                                            <button
                                                onClick={() => handleSend(date, item)}
                                                disabled={item.enviado || sendingId === item.id || editingId === item.id}
                                                className={`
                                                    flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-xs transition-all
                                                    ${item.enviado
                                                        ? 'bg-emerald-500/10 text-emerald-500/50 cursor-not-allowed'
                                                        : 'bg-white/10 hover:bg-white/20 text-white'
                                                    }
                                                `}
                                            >
                                                {sendingId === item.id ? (
                                                    <>
                                                        <RefreshCw className="animate-spin" size={12} /> Enviando...
                                                    </>
                                                ) : item.enviado ? (
                                                    <>
                                                        Enviado <CheckCircle2 size={12} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={12} /> Enviar a BetAiMaster
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
