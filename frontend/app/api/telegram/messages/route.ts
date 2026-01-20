import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis. Assumes ENV variables are set (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
    try {
        const prefix = process.env.REDIS_PREFIX || 'betai:';
        const storeKey = `${prefix}telegram_store`;

        // Fetch all fields (dates) from the Hash
        const data = await redis.hgetall(storeKey);

        if (!data) {
            return NextResponse.json({});
        }

        // Parse JSON strings for each date
        const parsedData: Record<string, any> = {};

        // Upstash hgetall returns an cbject { key: value }
        for (const [date, jsonStr] of Object.entries(data)) {
            try {
                parsedData[date] = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
            } catch (e) {
                console.error(`Error parsing telegram data for date ${date}`, e);
                parsedData[date] = [];
            }
        }

        // Sort keys descending (newest first)
        const sortedData: Record<string, any> = {};
        Object.keys(parsedData).sort().reverse().forEach(key => {
            sortedData[key] = parsedData[key];
        });

        return NextResponse.json(sortedData);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch telegram messages' }, { status: 500 });
    }
}

// Disable caching for dynamic data
export const dynamic = 'force-dynamic';
