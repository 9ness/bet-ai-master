import React from 'react';
import { Trophy, Calendar, ArrowRight, Activity, ShieldCheck, TrendingUp, Clock, Zap, Target, PartyPopper, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import path from 'path';
import fs from 'fs';

// Revalidate every 60 seconds
export const revalidate = 60;

async function getRecommendations() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'data', 'daily_bets.json');
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }
        return null;
    } catch (error) {
        console.error("Error reading recommendation file:", error);
        return null;
    }
}

// Helper to format numbered reasons
const FormattedReason = ({ text }: { text?: string }) => {
    if (!text) return null;
    // Split by "1. ", "2. " etc. using lookahead to keep the number
    const parts = text.split(/(?=\d\. )/g).filter(p => p.trim().length > 0);

    if (parts.length <= 1) return <p className="text-sm text-muted-foreground italic">"{text}"</p>;

    return (
        <ul className="text-sm text-muted-foreground space-y-2 mt-2 text-left">
            {parts.map((part, idx) => (
                <li key={idx} className="flex gap-2 bg-background/50 p-2 rounded-md border border-border/30">
                    <span className="font-bold text-primary/70 shrink-0">{part.substring(0, 2)}</span>
                    <span className="italic">{part.substring(2)}</span>
                </li>
            ))}
        </ul>
    );
};

export default async function Home() {
    const data = await getRecommendations();
    // Data format: { date: string, is_real: boolean, bets: { safe: ..., value: ..., funbet: ... } }
    const predictions = data?.bets;
    const date = data?.date || "Fecha desconocida";
    const isMock = data?.is_real === false;

    return (
        <main className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {/* Navbar */}
            <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-tr from-violet-600 to-fuchsia-600 p-2 rounded-lg text-white shadow-lg shadow-fuchsia-500/20">
                            <Trophy size={20} strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-xl tracking-tight">
                            BETTING <span className="text-fuchsia-500">ADVISOR</span>
                        </span>
                    </div>
                    <ThemeToggle />
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative overflow-hidden border-b border-border">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-[128px] pointer-events-none opacity-50" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] pointer-events-none opacity-50" />

                <div className="max-w-4xl mx-auto px-4 py-16 md:py-20 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-6 hover:bg-secondary/80 transition-colors cursor-default">
                        <Activity size={14} className="text-fuchsia-500 animate-pulse" />
                        <span>AI Analysis Active</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-tight">
                        Smart Betting <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient">
                            Daily Picks
                        </span>
                    </h1>

                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
                        Predicciones para el día: <span className="font-bold text-foreground">{date}</span>
                    </p>

                    {isMock && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-4">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Modo Demostración (Datos de Ejemplo)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Cards Section */}
            <section className="max-w-7xl mx-auto px-4 py-12 md:py-20">
                {!predictions ? (
                    <div className="text-center py-12">
                        <div className="inline-block p-4 rounded-full bg-secondary mb-4">
                            <Clock className="w-8 h-8 text-muted-foreground animate-spin-slow" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Esperando datos del analista...</h3>
                        <p className="text-muted-foreground">Ejecuta el script de python para generar las recomendaciones.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* SAFE CARD */}
                        <div className="group relative bg-card border border-border rounded-3xl p-6 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
                            <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500 rounded-t-3xl" />
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">La Segura</h3>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Probabilidad Alta</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <span className="text-muted-foreground text-sm">Partido</span>
                                    <span className="font-medium text-right text-sm">{predictions.safe?.match || "N/A"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-xl">
                                    <span className="text-muted-foreground text-sm">Pick</span>
                                    <span className="font-bold text-emerald-500">{predictions.safe?.pick}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground text-sm">Cuota</span>
                                    <span className="font-mono text-2xl font-black">{predictions.safe?.odd}</span>
                                </div>
                                <div className="pt-4 border-t border-border mt-4">
                                    <FormattedReason text={predictions.safe?.reason} />
                                </div>
                            </div>
                        </div>

                        {/* VALUE CARD */}
                        <div className="group relative bg-card border border-border rounded-3xl p-6 hover:border-violet-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/10 scale-105 z-10 shadow-xl">
                            <div className="absolute inset-x-0 top-0 h-1 bg-violet-500 rounded-t-3xl" />
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                                Recomendado
                            </div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-500">
                                    <Target size={28} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">De Valor</h3>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Rentabilidad Alta</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <span className="text-muted-foreground text-sm">Partido</span>
                                    <span className="font-medium text-right text-sm">{predictions.value?.match || "N/A"}</span>
                                </div>
                                <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-xl">
                                    <span className="text-muted-foreground text-sm">Pick</span>
                                    <span className="font-bold text-violet-500">{predictions.value?.pick}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground text-sm">Cuota</span>
                                    <span className="font-mono text-2xl font-black">{predictions.value?.odd}</span>
                                </div>
                                <div className="pt-4 border-t border-border mt-4">
                                    <FormattedReason text={predictions.value?.reason} />
                                </div>
                            </div>
                        </div>

                        {/* FUNBET CARD */}
                        <div className="group relative bg-card border border-border rounded-3xl p-6 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10">
                            <div className="absolute inset-x-0 top-0 h-1 bg-amber-500 rounded-t-3xl" />
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                                    <PartyPopper size={28} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">Funbet</h3>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Arriesgada</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <span className="text-muted-foreground text-sm">Partido</span>
                                    <span className="font-medium text-right text-sm">{predictions.funbet?.match || "N/A"}</span>
                                </div>

                                {/* REFACTORED FUNBET PICK SECTION */}
                                <div className="bg-secondary/50 p-3 rounded-xl">
                                    <span className="text-muted-foreground text-xs block mb-2 font-semibold">Combinada:</span>
                                    {predictions.funbet?.components && Array.isArray(predictions.funbet.components) && predictions.funbet.components.length > 0 ? (
                                        <ul className="space-y-2">
                                            {predictions.funbet.components.map((comp: any, idx: number) => (
                                                <li key={idx} className="flex flex-col text-sm border-b border-border/50 last:border-0 pb-1 last:pb-0">
                                                    <span className="text-xs text-muted-foreground">{comp.match}</span>
                                                    <span className="font-bold text-amber-500">{comp.pick}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="font-bold text-amber-500 block">{predictions.funbet?.pick}</span>
                                    )}
                                </div>

                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-muted-foreground text-sm">Cuota Total</span>
                                    <span className="font-mono text-2xl font-black">{predictions.funbet?.odd}</span>
                                </div>
                                <div className="pt-4 border-t border-border mt-4">
                                    <FormattedReason text={predictions.funbet?.reason} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
