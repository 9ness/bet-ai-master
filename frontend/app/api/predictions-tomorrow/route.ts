import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
    try {
        // Calculate Tomorrow in YYYY-MM-DD format
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        const tomDateStr = `${yyyy}-${mm}-${dd}`;

        // NEW LOGIC: Fetch from HASH 'betai:daily_bets_tiktok:YYYY-MM'
        // Field: 'YYYY-MM-DD'
        const hashKey = `betai:daily_bets_tiktok:${yyyy}-${mm}`;
        const field = tomDateStr;

        console.log(`[API] Fetching from Hash: ${hashKey} -> Field: ${field}`);

        // Upstash Redis 'hget'
        const data = await redis.hget(hashKey, field);

        // Data from hget comes already parsed if it's JSON? 
        // In Upstash SDK, hget returns the value. If stored as stringified JSON, we might need to parse it?
        // Actually, redis-py stores it as string. Upstash SDK usually auto-parses if response is JSON, 
        // but let's be safe.
        let parsedData = data;
        if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { }
        }

        // If 'bets' array is nested (from analyze_tiktok.py structure), extract it or pass as is
        // The structure from analyze_tiktok is { date, generated_at, bets: [...] }
        // The frontend expects { bets: [...] } or the array directly? 
        // DailyPredictions usually expects { bets: [...] } or just the array.
        // Let's pass the whole object, as long as it has 'bets'.

        return NextResponse.json(parsedData || {});
    } catch (error) {
        console.error('Error fetching tomorrow predictions:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
