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
        let totalMonthlyStake = 0;
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

                    // Iterate bets to sum stake
                    if (dayObj.bets && Array.isArray(dayObj.bets)) {
                        const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1 };
                        dayObj.bets.forEach((b: any) => {
                            let s = (b.status || 'PENDING').toUpperCase();
                            if (s === 'GANADA') s = 'WON';
                            if (s === 'PERDIDA') s = 'LOST';

                            if (s === 'WON' || s === 'LOST') {
                                const betType = (b.type || '').toLowerCase();
                                const stake = Number(b.stake) || DEFAULT_STAKES[betType] || 0;
                                totalMonthlyStake += stake;
                            }
                        });
                    }

                    totalSettledDays++;
                    if (Number(dayObj.day_profit) > 0) wonDays++;
                }
            } else if (betsData) {
                // Pending Bets (Explicitly saved for calendar)
                const parsedBets = typeof betsData === 'string' ? JSON.parse(betsData) : betsData;
                const betsArray = parsedBets.bets || [];

                daysMap[date] = {
                    date: date,
                    day_profit: 0,
                    status: 'PENDING',
                    bets: betsArray.map((b: any) => ({
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

                const stakes: Record<string, number> = { "safe": 6, "value": 3, "funbet": 1 };

                ['safe', 'value', 'funbet'].forEach(type => {
                    if (betsMap[type]) {
                        const b = betsMap[type];
                        // Check if this fallback data actually has a status update
                        let s = (b.status || 'PENDING').toUpperCase();
                        if (s === 'GANADA') s = 'WON';
                        if (s === 'PERDIDA') s = 'LOST';

                        // Accumulate stake if settled (even if not in history key yet)
                        if (s === 'WON' || s === 'LOST') {
                            totalMonthlyStake += Number(stakes[type] || 0);
                        }

                        transformedBets.push({
                            type: type,
                            stake: stakes[type] || 0,
                            total_odd: b.odd,
                            match: b.match,
                            pick: b.pick,
                            status: s === 'WON' || s === 'LOST' ? s : 'PENDING', // Visual only
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

        // Calculate Stats Dynamically (REAL ROI/YIELD)
        const dynamicStats = {
            total_profit: Number(totalMonthlyProfit.toFixed(2)),
            total_stake: Number(totalMonthlyStake.toFixed(2)),
            yield: totalMonthlyStake > 0 ? Number(((totalMonthlyProfit / totalMonthlyStake) * 100).toFixed(2)) : 0,
            win_rate: totalSettledDays > 0 ? Number(((wonDays / totalSettledDays) * 100).toFixed(1)) : 0
        };

        // Cache Stats for Dashboard
        await redis.set(`${prefix}stats:${month}`, JSON.stringify(dynamicStats));

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
