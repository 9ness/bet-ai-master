import React from 'react';
import { Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Redis } from '@upstash/redis';
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

// Disable caching to ensure fresh Redis data
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function Home() {
    // Dynamic Date Calculation (Europe/Madrid)
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid'
    }).format(now);

    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid'
    }).format(yesterdayDate);

    console.log(`[Page] Loading Analysis for Date: ${today}`);

    // Fetch Bets Dynamic within betai: prefix
    let betsData: any = await redis.get(`betai:daily_bets:${today}`);

    if (!betsData) {
        console.log(`[Frontend] No bets for ${today}, checking ${yesterday}...`);
        betsData = await redis.get(`betai:daily_bets:${yesterday}`);
    }

    const [settings] = await Promise.all([
        getSettings()
    ]);

    // Data format
    const data = betsData;
    const predictions = data?.bets;
    const dateStr = data?.date || today; // Fallback to 'today' if date is missing in data
    const isMock = data?.is_real === false;

    // Format Date
    let formattedDate = dateStr;
    try {
        if (dateStr && dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        }
    } catch (e) {
        // Fallback if formatting fails
        formattedDate = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
