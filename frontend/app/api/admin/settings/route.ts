import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis 
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SETTINGS_KEY = 'betai:settings:visibility';

export async function GET(req: NextRequest) {
    try {
        const settings = await redis.hgetall(SETTINGS_KEY);

        // Fetch Last Run Status
        const statusKey = 'betai:status:last_run';
        const lastRunData = await redis.get(statusKey); // Returns JSON string or object depending on Upstash client config
        // Verify Upstash behavior: plain strings usually returned as object if valid JSON? Or string?
        // Usually string if set as string.
        let statusObj = null;
        if (lastRunData) {
            statusObj = typeof lastRunData === 'string' ? JSON.parse(lastRunData) : lastRunData;
        }

        // Default settings if empty
        const defaults = {
            show_daily_bets: true,
            show_calendar: true,
            show_analytics: true,
            show_tiktok: false,
            show_announcement: false,
            announcement_text: '',
            announcement_type: 'info'
        };

        return NextResponse.json({ ...defaults, ...settings, last_run: statusObj });
    } catch (error) {
        console.error("Settings GET Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Body expected: { show_daily_bets: bool, show_calendar: bool, show_analytics: bool }

        // Validate or normalize boolean values to strings/numbers if needed for Redis HSET?
        // Upstash/Redis wrappers usually handle booleans well in hgetall if stored as JSON/strings, 
        // but explicit conversion is safer for portability.
        // Let's store as boolean directly, Upstash handles JSON objects in hset if we pass an object.

        await redis.hset(SETTINGS_KEY, body);

        return NextResponse.json({ success: true, settings: body });
    } catch (error) {
        console.error("Settings POST Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
