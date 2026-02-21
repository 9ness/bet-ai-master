import { NextResponse } from 'next/server';
import { redis } from '@/lib/server-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayStr = now.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const monthToday = todayStr.substring(0, 7);
        const monthTomorrow = tomorrowStr.substring(0, 7);

        // Check availability in Redis for TikTok/Viral data
        const [hasViralToday, hasViralTomorrow] = await Promise.all([
            redis.hexists(`betai:raw_matches_tiktok:${monthToday}`, todayStr),
            redis.hexists(`betai:raw_matches_tiktok:${monthTomorrow}`, tomorrowStr)
        ]);

        return NextResponse.json({
            success: true,
            modes: {
                standard_today: true, // Always available after morning fetch
                viral_today: hasViralToday === 1,
                viral_tomorrow: hasViralTomorrow === 1
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, modes: { standard_today: true, viral_today: false, viral_tomorrow: false } });
    }
}
