
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let dateParam = searchParams.get('date'); // YYYY-MM-DD

        if (!dateParam) {
            const now = new Date();
            dateParam = now.toISOString().split('T')[0];
        }

        const key = `betai:execution_history:${dateParam}`;

        // Fetch all history entries
        const rawHistory = await redis.lrange(key, 0, -1);

        const history = rawHistory.map((item) => {
            try {
                return typeof item === 'string' ? JSON.parse(item) : item;
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        return NextResponse.json({ history, date: dateParam });
    } catch (error) {
        console.error('Error fetching execution history:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
