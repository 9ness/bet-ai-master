import React from 'react';
import { Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Redis } from '@upstash/redis';
import { getRecommendations } from '@/lib/server-utils';
import HomeTabs from '@/components/HomeTabs';

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

    // Data format
    const predictions = data?.bets;
    const date = data?.date || "Fecha desconocida";
    const isMock = data?.is_real === false;

    // Format Date
    let formattedDate = date;
    if (date && date.includes('-')) {
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    }

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
                            BET AI <span className="text-fuchsia-500">MASTER</span>
                        </span>
                    </div>
                    <ThemeToggle />
                </div>
            </nav>

            {/* Dynamic Content (Hero + Tabs) */}
            <HomeTabs
                settings={settings}
                predictions={predictions}
                formattedDate={formattedDate}
                isMock={isMock}
            />
        </main>
    );
}
