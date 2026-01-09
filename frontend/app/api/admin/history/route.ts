import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis 
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const month = searchParams.get('month'); // YYYY-MM

        if (!month) {
            return NextResponse.json({ error: 'Month required' }, { status: 400 });
        }

        const prefix = "betai:";
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
            pipeline.get(`${prefix}daily_bets:${date}`);
        }

        const results = await pipeline.exec<(string | null)[]>();

        // Process Results
        const daysMap: Record<string, any> = {};
        let totalMonthlyProfit = 0;
        let totalSettledDays = 0;
        let wonDays = 0;

        dates.forEach((date, idx) => {
            const historyData = results[idx * 3];
            const betsData = results[idx * 3 + 1];
            const dailyDataRaw = results[idx * 3 + 2];

            if (historyData) {
                // Confirmed History
                const dayObj = historyData as any;
                daysMap[date] = dayObj;

                // Accumulate stats
                if (dayObj.day_profit !== undefined) {
                    totalMonthlyProfit += Number(dayObj.day_profit);
                    totalSettledDays++;
                    if (Number(dayObj.day_profit) > 0) wonDays++;
                }
            } else if (betsData) {
                // Pending Bets (Explicitly saved for calendar)
                const parsedBets = typeof betsData === 'string' ? JSON.parse(betsData) : betsData;

                daysMap[date] = {
                    date: date,
                    day_profit: 0,
                    status: 'PENDING',
                    bets: (parsedBets.bets || []).map((b: any) => ({
                        ...b,
                        status: 'PENDING',
                        profit: 0
                    }))
                };
            } else if (dailyDataRaw) {
                // Fallback: Smart Sync with Daily Analysis
                const dailyCtx = typeof dailyDataRaw === 'string' ? JSON.parse(dailyDataRaw) : dailyDataRaw;
                const betsMap = dailyCtx.bets || {};
                const transformedBets: any[] = [];

                const stakes: Record<string, number> = { "safe": 10, "value": 5, "funbet": 1 };

                ['safe', 'value', 'funbet'].forEach(type => {
                    if (betsMap[type]) {
                        const b = betsMap[type];
                        transformedBets.push({
                            type: type,
                            stake: stakes[type] || 1,
                            total_odd: b.odd,
                            match: b.match,
                            pick: b.pick,
                            status: 'PENDING',
                            profit: 0,
                            selections: b.selections || []
                        });
                    }
                });

                if (transformedBets.length > 0) {
                    daysMap[date] = {
                        date: date,
                        day_profit: 0,
                        status: 'PENDING',
                        bets: transformedBets
                    };
                }
            }
        });

        // Calculate Stats Dynamically
        const dynamicStats = {
            total_profit: Number(totalMonthlyProfit.toFixed(2)),
            win_rate: totalSettledDays > 0 ? Number(((wonDays / totalSettledDays) * 100).toFixed(1)) : 0
        };

        return NextResponse.json({
            month,
            stats: dynamicStats,
            days: daysMap
        });

    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
