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
        let data = await redis.hget(hashKey, field);

        // FALLBACK: If Tomorrow is empty, try Today
        if (!data) {
            console.log(`[API] Tomorrow (${tomDateStr}) is empty, falling back to Today...`);
            const today = new Date();
            const y_t = today.getFullYear();
            const m_t = String(today.getMonth() + 1).padStart(2, '0');
            const d_t = String(today.getDate()).padStart(2, '0');
            const todayDateStr = `${y_t}-${m_t}-${d_t}`;
            const todayHashKey = `betai:daily_bets_tiktok:${y_t}-${m_t}`;
            data = await redis.hget(todayHashKey, todayDateStr);
        }

        let parsedData = data;
        if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { }
        }

        return NextResponse.json(parsedData || {});
    } catch (error) {
        console.error('Error fetching tomorrow predictions:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
