import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis 
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const TIKTOK_KEY = 'betai:tiktokfactory';

export async function GET(req: NextRequest) {
    try {
        const data = await redis.get(TIKTOK_KEY);

        // Upstash often returns object automatically if it's JSON
        let parsedData = data;
        if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { }
        }

        return NextResponse.json(parsedData || {});
    } catch (error) {
        console.error('Error fetching tiktok content:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
