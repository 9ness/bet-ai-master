"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Bot, X, MessageSquare, AlertCircle, ChevronDown,
    Database, Sparkles, Loader2, Minimize2, Maximize2, Trash2, Clock, Plus, LayoutGrid
} from 'lucide-react';
import { triggerTouchFeedback } from '@/utils/haptics';
import { usePathname } from 'next/navigation';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIChatProps {
    rawDate?: string; // Fecha actual del panel
    mode?: 'visible' | 'hidden' | 'disabled';
}

export default function AIChat({ rawDate, mode = 'visible' }: AIChatProps) {
    const pathname = usePathname();
    const isAdminPath = pathname?.startsWith('/admin');
    const effectiveMode = isAdminPath ? 'visible' : mode;

    if (effectiveMode === 'hidden') return null;

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isTikTokMode, setIsTikTokMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [canUseTomorrow, setCanUseTomorrow] = useState(false);
    const [currentTime, setCurrentTime] = useState("");
    const [userId, setUserId] = useState<string>("");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Generar o recuperar ID de usuario único
        let storedId = localStorage.getItem('betai_chat_user_id');
        if (!storedId) {
            storedId = `user_${Math.random().toString(36).substring(2, 11)}`;
            localStorage.setItem('betai_chat_user_id', storedId);
        }
        setUserId(storedId);

        const updateAvailability = () => {
            const now = new Date();
            const madridTime = new Intl.DateTimeFormat('es-ES', {
                timeZone: 'Europe/Madrid',
                hour: 'numeric',
                hour12: false
            }).format(now);

            const hour = parseInt(madridTime);
            setCanUseTomorrow(hour >= 19);
            setCurrentTime(new Intl.DateTimeFormat('es-ES', {
                timeZone: 'Europe/Madrid',
                hour: '2-digit',
                minute: '2-digit'
            }).format(now));
        };

        updateAvailability();
        const interval = setInterval(updateAvailability, 60000);
        return () => clearInterval(interval);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            inputRef.current?.focus();
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || effectiveMode === 'disabled') return;

        const userMessage = input.trim();
        setInput("");
        setError(null);

        const newMessage: Message = {
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newMessage]);
        setIsLoading(true);
        setIsAnalyzing(false); // Empezamos en modo "Pensando" (...)
        triggerTouchFeedback();

        // Calculamos la fecha objetivo
        let targetDate = rawDate || new Date().toISOString().split('T')[0];
        if (isTikTokMode) {
            const tom = new Date();
            tom.setDate(tom.getDate() + 1);
            targetDate = tom.toISOString().split('T')[0];
        }

        try {
            // PASO 1: Llamada al Router (Ligera)
            const response = await fetch('/api/admin/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: messages.slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    date: targetDate,
                    isTikTok: isTikTokMode,
                    userId: userId,
                    includeContext: false // Forzamos solo router
                })
            });

            let data = await response.json();

            // PASO 2: Si el router dice que necesita datos, hacemos la llamada pesada
            if (data.action === "NEED_CONTEXT_DATA") {
                setIsAnalyzing(true); // Cambiamos el texto a "Analizando datos..."

                const secondRes = await fetch('/api/admin/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userMessage,
                        history: messages.slice(-10).map(m => ({
                            role: m.role,
                            content: m.content
                        })),
                        date: targetDate,
                        isTikTok: isTikTokMode,
                        userId: userId,
                        includeContext: true // Ahora sí enviamos el contexto pesado
                    })
                });
                data = await secondRes.json();
            }

            if (data.error) {
                throw new Error(data.error);
            }

            const botMessage: Message = {
                role: 'assistant',
                content: data.content,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (err: any) {
            setError(err.message || "Error al conectar con la IA");
            console.error("Chat Error:", err);
        } finally {
            setIsLoading(false);
            setIsAnalyzing(false);
            triggerTouchFeedback();
        }
    };

    const clearHistory = () => {
        setMessages([]);
        setError(null);
        triggerTouchFeedback();
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => {
                    setIsOpen(true);
                    triggerTouchFeedback();
                }}
                className="fixed bottom-6 right-6 z-[1000] p-4 bg-[#1e1e1e] text-white rounded-2xl shadow-2xl border border-white/10 hover:scale-110 active:scale-95 transition-all duration-300 group overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-[#4285f4] via-[#9162f1] to-[#d96570] opacity-0 group-hover:opacity-20 transition-opacity" />
                <Bot className="w-8 h-8 md:w-9 md:h-9 animate-float" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#1e1e1e]" />
            </button>
        );
    }

    return (
        <div
            className={`fixed z-[1000] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl overflow-hidden
                ${isMinimized ? 'w-14 h-14 bottom-6 right-6' : 'bottom-4 right-4 left-4 md:bottom-6 md:right-6 md:left-auto md:w-[480px] h-[80vh] md:h-[720px]'}
                bg-[#0e0e0e] text-white rounded-[28px] md:rounded-[32px] border border-white/10`}
        >
            {/* Minimalist Top Bar */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0 bg-[#0e0e0e]/95 backdrop-blur-md border-b border-white/5 z-20">
                <div className="flex items-center gap-2">
                    <span className="font-google text-lg tracking-tight text-white font-medium">Gemini</span>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={clearHistory} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-gray-300" title="Borrar historial">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-rose-500/10 rounded-full transition-colors text-gray-500 hover:text-rose-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 md:space-y-10 scrollbar-hide">
                {messages.length === 0 && (
                    <div className="flex flex-col justify-start pt-2 md:pt-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
                        <div className="space-y-2 mb-6 md:mb-10">
                            <h2 className="text-2xl md:text-4xl font-normal leading-tight tracking-tight">
                                <span className="text-gray-400">Hola,</span>
                                <br />
                                <span className="bg-gradient-to-r from-[#4285f4] via-[#9162f1] to-[#d96570] bg-clip-text text-transparent font-medium">
                                    ¿En qué puedo ayudarte?
                                </span>
                            </h2>
                        </div>

                        <div className="flex flex-col gap-2 md:gap-3">
                            {[
                                { text: isTikTokMode ? "Partidos top para mañana" : "Análisis del Manchester City hoy", icon: <Sparkles className="w-4 h-4 text-cyan-400" /> },
                                { text: isTikTokMode ? "Combinada TikTok segura" : "¿Alguna cuota trampa?", icon: <Database className="w-4 h-4 text-amber-400" /> },
                                { text: "Estrategia para cuota 4.00", icon: <LayoutGrid className="w-4 h-4 text-indigo-400" /> },
                            ].map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setInput(item.text)}
                                    className="flex items-center gap-4 px-5 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-[#1e1e1e] border border-white/5 hover:bg-[#2a2a2a] transition-all text-[13px] md:text-[14px] text-gray-200 active:scale-[0.97] group"
                                >
                                    <span className="shrink-0">{item.icon}</span>
                                    <span className="flex-1 text-left line-clamp-1">{item.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`max-w-[92%] md:max-w-[85%] 
                            ${msg.role === 'user'
                                ? 'bg-[#1e1f20] px-5 py-3.5 rounded-[24px] text-gray-200 border border-white/5'
                                : 'w-full space-y-4'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="flex items-start gap-4">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1a73e8] to-[#9333ea] flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-purple-500/20">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div
                                        className="ai-message-content space-y-5 text-[15px] leading-[1.6] text-gray-300 w-full"
                                        dangerouslySetInnerHTML={{
                                            __html: msg.content
                                                .replace(/### (.*)/g, '<h4 class="text-white font-bold text-lg pt-4 pb-1">$1</h4>')
                                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-black">$1</strong>')
                                                .replace(/^[ \t]*[*+-][ \t]+(.*)/gm, '<div class="flex gap-3 py-0 items-start text-gray-300"><span class="mt-2 w-1.5 h-1.5 bg-cyan-400 rounded-full shrink-0"></span><span class="flex-1">$1</span></div>')
                                                .replace(/\n\n/g, '<div class="h-4"></div>')
                                                .replace(/\n(?!\s*<div)/g, '<br/>')
                                        }}
                                    />
                                </div>
                            )}
                            {msg.role === 'user' && (
                                <p className="text-[15px] leading-[1.6]">{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-start gap-4 animate-in fade-in duration-300">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1a73e8] to-[#9333ea] flex items-center justify-center shrink-0 mt-1">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-[#1e1f20] rounded-[20px] border border-white/5 shadow-xl">
                            <div className="relative w-4 h-4">
                                <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                                <div className="absolute inset-0 border-2 border-transparent border-t-cyan-400 rounded-full animate-spin"></div>
                            </div>
                            <span className="text-[13px] text-gray-400 font-medium animate-pulse">
                                {isAnalyzing ? 'Analizando datos...' : '...'}
                            </span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-4 p-5 bg-rose-500/10 border border-rose-500/20 rounded-[24px] text-rose-400 text-sm font-medium">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                <div ref={messagesEndRef} className="h-40" />
            </div>

            {/* Input Bar - Fixed at bottom of the card */}
            <div className="p-4 md:p-6 bg-gradient-to-t from-[#0e0e0e] to-transparent shrink-0">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col bg-[#1e1f20] rounded-[24px] md:rounded-[28px] p-1 border border-white/5 shadow-2xl focus-within:bg-[#242528] transition-all">
                        <textarea
                            ref={inputRef}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={effectiveMode === 'disabled'}
                            placeholder={effectiveMode === 'disabled' ? "Chat bloqueado temporalmente..." : "Pregúntale a Gemini AI..."}
                            className={`w-full bg-transparent border-none focus:ring-0 text-[16px] py-4 px-5 resize-none scrollbar-hide text-gray-200 placeholder:text-gray-500 ${effectiveMode === 'disabled' ? 'opacity-40 cursor-not-allowed' : ''}`}
                        />

                        <div className="flex items-center justify-between px-2 pb-2">
                            <div className="px-3 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-500/80" />
                                <span className="text-[10px] md:text-[11px] text-gray-500 font-bold tracking-tight uppercase">
                                    Gemini 3 Flash
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* Mode Toggle */}
                                <button
                                    onClick={() => {
                                        if (effectiveMode === 'disabled') return;
                                        if (!canUseTomorrow && !isTikTokMode) return;
                                        setIsTikTokMode(!isTikTokMode);
                                        triggerTouchFeedback();
                                    }}
                                    disabled={(!canUseTomorrow && !isTikTokMode) || effectiveMode === 'disabled'}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all
                                        ${isTikTokMode
                                            ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                                            : !canUseTomorrow
                                                ? 'bg-white/5 text-gray-700 cursor-not-allowed'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                                >
                                    <Database className="w-3.5 h-3.5" />
                                    {isTikTokMode ? 'MAÑANA' : 'HOY'}
                                </button>

                                <button
                                    onClick={handleSend}
                                    disabled={isLoading || !input.trim() || effectiveMode === 'disabled'}
                                    className={`p-2.5 rounded-full transition-all flex items-center justify-center
                                        ${isLoading || !input.trim() || effectiveMode === 'disabled'
                                            ? 'text-gray-700'
                                            : 'text-[#8ab4f8] hover:bg-[#8ab4f8]/10 active:scale-[0.92]'}`}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-6 h-6" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                
                .font-google {
                    font-family: 'Roboto', sans-serif;
                }

                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-5px); }
                    100% { transform: translateY(0px); }
                }
                .animate-float {
                    animation: float 4s ease-in-out infinite;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
