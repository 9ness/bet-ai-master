import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis 
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const month = searchParams.get('month'); // YYYY-MM

        if (!month) {
            return NextResponse.json({ error: 'Month required' }, { status: 400 });
        }

        const prefix = "betai:";
        const statsKey = `${prefix}stats:${month}`;

        // 1. Fetch Monthly Stats
        const stats = await redis.hgetall(statsKey);

        // 2. Fetch Daily History (Pipeline)
        // Generate all possible date keys for this month
        const [year, monthStr] = month.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(monthStr), 0).getDate();

        const pipeline = redis.pipeline();
        const dates: string[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const dayStr = d.toString().padStart(2, '0');
            const date = `${month}-${dayStr}`;
            dates.push(date);
            pipeline.get(`${prefix}history:${date}`);
            pipeline.get(`${prefix}bets:${date}`);
        }

        const results = await pipeline.exec<(string | null)[]>();

        // Process Results
        const daysMap: Record<string, any> = {};

        dates.forEach((date, idx) => {
            const historyData = results[idx * 2];
            const betsData = results[idx * 2 + 1];

            if (historyData) {
                // Confirmed History
                daysMap[date] = historyData;
            } else if (betsData) {
                // Pending Bets (No history yet)
                const parsedBets = typeof betsData === 'string' ? JSON.parse(betsData) : betsData;

                // Map to DayHistory format with PENDING status
                daysMap[date] = {
                    date: date,
                    day_profit: 0,
                    status: 'PENDING', // Custom flag for UI
                    bets: (parsedBets.bets || []).map((b: any) => ({
                        ...b,
                        status: 'PENDING',
                        profit: 0
                    }))
                };
            }
        });

        return NextResponse.json({
            month,
            stats: stats || { total_profit: 0, win_rate: 0 },
            days: daysMap
        });

    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
