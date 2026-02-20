import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'BET AI Master',
    description: 'Predicciones de fútbol impulsadas por Inteligencia Artificial',
};

import localFont from 'next/font/local';

const gazpacho = localFont({
    src: './fonts/gazpacho-italic-heavy.ttf',
    variable: '--font-retro',
    weight: '900', // Heavy/Black
    style: 'italic',
});

import AIChat from '@/components/AIChat';
import { Redis } from '@upstash/redis';

// Force dynamic to always get fresh settings from Redis
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getChatSettings() {
    try {
        const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        const settings: any = await redis.hgetall('betai:settings:visibility');

        // Handle cases where redis might return unconventional results or if the field is missing
        if (!settings || typeof settings !== 'object') return 'visible';

        const mode = settings.ai_chat_mode;
        if (mode === 'visible' || mode === 'hidden' || mode === 'disabled') {
            return mode;
        }

        return 'visible';
    } catch (e) {
        console.error("Redis fetch error in RootLayout:", e);
        return 'visible';
    }
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const chatMode = await getChatSettings();

    return (
        <html lang="es" className="dark">
            {/* className="dark" establece el tema por defecto */}
            <body className={`antialiased min-h-screen bg-background ${gazpacho.variable}`} suppressHydrationWarning>
                {children}
                <AIChat mode={chatMode} />
            </body>
        </html>
    );
}
