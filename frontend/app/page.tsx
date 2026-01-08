import React from 'react';
import { Trophy, Activity, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Redis } from '@upstash/redis';
import ResultsCalendar from '@/components/ResultsCalendar';
import AdminAnalytics from '@/components/AdminAnalytics';
import DailyPredictions from '@/components/DailyPredictions';
import { getRecommendations } from '@/lib/server-utils';

// Initialize Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function getSettings() {
    try {
        const settings = await redis.hgetall('betai:settings:visibility');
        return {
            show_daily_bets: true,
            show_calendar: true,
            show_analytics: true,
            ...settings
        } as any;
    } catch (e) {
        return { show_daily_bets: true, show_calendar: true, show_analytics: true };
    }
}



// Revalidate every 60 seconds
export const revalidate = 60;



export default async function Home() {
    const [data, settings] = await Promise.all([
        getRecommendations(),
        getSettings()
    ]);

    // Data format: { date: string, is_real: boolean, bets: { safe: ..., value: ..., funbet: ... } }
    const predictions = data?.bets;
    const date = data?.date || "Fecha desconocida";
    const isMock = data?.is_real === false;

    // Format Date to Spanish Long Format
    let formattedDate = date;
    if (date && date.includes('-')) {
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        // Capitalize first letter
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }

    return (
        <main className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {/* Navbar & Hero ... (keep existing) */}

            {/* ... (Keep existing Navbar and Hero code via context or re-paste if needed, but here I'm replacing the whole component structure so I need to be careful.
            Wait, I should probably use a smaller replacement or ensure I duplicate the navbar/hero correctly.
            Better to target the return block or specific sections if possible, but I need to inject the fetch logic at top.
            
            Let's assume I replace from `export default async function Home` down to end.
            I need to include Navbar and Hero in the replacement.)
            */}

            {/* Navbar */}
            <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-tr from-violet-600 to-fuchsia-600 p-2 rounded-lg text-white shadow-lg shadow-fuchsia-500/20">
                            <Trophy size={20} strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-xl tracking-tight">
                            BET AI <span className="text-fuchsia-500">MASTER</span>
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

                    <h1 className="text-3xl md:text-7xl font-black mb-6 tracking-tight leading-tight">
                        BET AI MASTER <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500 animate-gradient block md:inline mt-2 md:mt-0">
                            PREDICCIONES DIARIAS
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed capitalize">
                        Predicciones para el día: <br className="md:hidden" />
                        <span className="font-bold text-foreground">{formattedDate}</span>
                    </p>

                    {isMock && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-4">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Modo Demostración (Datos de Ejemplo)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* DAILY BETS SECTION */}
            {settings.show_daily_bets && (
                <div className="border-b border-border/50">
                    <DailyPredictions predictions={predictions} />
                </div>
            )}

            {/* CALENDAR SECTION */}
            {settings.show_calendar && (
                <section className="max-w-7xl mx-auto px-4 py-12 border-b border-border/50">
                    <h2 className="text-3xl font-black mb-8 flex items-center gap-2">
                        <span className="text-4xl">📅</span>
                        Resultados Históricos
                    </h2>
                    <ResultsCalendar />
                </section>
            )}

            {/* ANALYTICS SECTION */}
            {settings.show_analytics && (
                <section className="max-w-7xl mx-auto px-4 py-12">
                    <h2 className="text-3xl font-black mb-8 flex items-center gap-2">
                        <span className="text-4xl">📊</span>
                        Rendimiento del Mes
                    </h2>
                    <AdminAnalytics />
                </section>
            )}
        </main>
    );
}
