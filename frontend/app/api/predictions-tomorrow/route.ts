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

        const key = `betai:daily_bets:${tomDateStr}_tiktok`;

        const data = await redis.get(key);

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
