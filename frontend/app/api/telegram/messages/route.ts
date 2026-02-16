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

        // Parse JSON strings for each date and fetch morning messages
        const parsedData: Record<string, any> = {};

        // Upstash hgetall returns an cbject { key: value }
        for (const [date, jsonStr] of Object.entries(data)) {
            try {
                const messages = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;

                // Fetch Morning Messages for this date (if any)
                const morningMsgs = await redis.get(`${prefix}morning_messages:${date}`);

                // Fetch Victory Messages for this date (if any)
                const winMsgs = await redis.get(`${prefix}win_messages:${date}`);

                parsedData[date] = {
                    messages: messages,
                    morning_messages: morningMsgs || [],
                    win_messages: winMsgs || { stake1: [], stake4: [], stake5: [], stakazo: [] }
                };
            } catch (e) {
                console.error(`Error parsing telegram data for date ${date}`, e);
                parsedData[date] = { messages: [], morning_messages: [] };
            }
        }

        // Sort keys descending (newest first)
        const sortedData: Record<string, any> = {};
        const sortedDates = Object.keys(parsedData).sort().reverse();

        for (const dateKey of sortedDates) {
            sortedData[dateKey] = parsedData[dateKey];
        }

        return NextResponse.json(sortedData);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch telegram messages' }, { status: 500 });
    }
}

// Disable caching for dynamic data
export const dynamic = 'force-dynamic';
