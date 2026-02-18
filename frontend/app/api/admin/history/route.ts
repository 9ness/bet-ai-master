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
        const yearParam = searchParams.get('year'); // YYYY
        const category = searchParams.get('category') || 'daily_bets'; // Default to legacy

        const prefix = "betai:";
        let statsHashKey = 'betai_stats'; // Default
        if (category === 'daily_bets_stakazo') {
            statsHashKey = 'betai:stats_stakazo';
        }

        // --- NEW: ANNUAL VIEW LOGIC ---
        if (yearParam && !month) {
            const allStats = await redis.hgetall(statsHashKey);
            if (!allStats) return NextResponse.json({ year: yearParam, stats: {} });

            // Filter by Year Prefix (YYYY-)
            const annualData: Record<string, any> = {};
            Object.entries(allStats).forEach(([key, val]) => {
                if (key.startsWith(`${yearParam}-`)) {
                    try {
                        annualData[key] = typeof val === 'string' ? JSON.parse(val) : val;
                    } catch (e) {
                        annualData[key] = val;
                    }
                }
            });

            return NextResponse.json({
                year: yearParam,
                category,
                stats: annualData
            });
        }

        if (!month) {
            return NextResponse.json({ error: 'Month or Year required' }, { status: 400 });
        }

        // 2. Fetch Daily History (HGETALL Monthly Hash)
        const [year, monthStr] = month.split('-');

        // Dynamic Key Selection based on Category
        const hashKey = `${prefix}${category}:${month}`;

        // Parallel Fetch: Stats from Hash + Monthly Hash
        const [statsRaw, monthDataRaw] = await Promise.all([
            redis.hget(statsHashKey, month),
            redis.hgetall(hashKey)
        ]);

        const daysInMonth = new Date(parseInt(year), parseInt(monthStr), 0).getDate();
        const dates: string[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            dates.push(`${month}-${d.toString().padStart(2, '0')}`);
        }

        // Normalize for processing loop below
        // monthDataRaw is Record<string, string> or null
        const monthMap = monthDataRaw || {};

        // Mocking results array to compatible with existing lower logic or refactoring loop?
        // Let's refactor the loop slightly to read from Map instead of Array index.

        // Process Results
        const daysMap: Record<string, any> = {};
        let totalMonthlyProfit = 0;
        let totalMonthlyStake = 0;
        let totalSettledDays = 0;
        let wonDays = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        dates.forEach((date, idx) => {
            // STRICT VALIDATION: Ignore future dates completely for stats
            if (date > todayStr) return;

            // New Logic: Get from Hash Map
            const dailyDataRaw = (monthMap as any)[date];

            // Note: We ignored 'history' legacy key here as per user instruction to use Hash.
            const sourceRaw = dailyDataRaw;

            if (sourceRaw) {
                let dailyCtx: any;
                try {
                    dailyCtx = typeof sourceRaw === 'string' ? JSON.parse(sourceRaw) : sourceRaw;
                } catch (e) {
                    console.error(`Error parsing JSON for ${date}`, e);
                    return;
                }

                // Normalización de Apuestas (Array vs Dict)
                let transformedBets: any[] = [];
                const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1, stakazo: 10 };

                if (Array.isArray(dailyCtx.bets)) {
                    // ESTÁNDAR NUEVO: Lista
                    transformedBets = dailyCtx.bets.map((b: any) => ({
                        ...b,
                        status: b.status || 'PENDING',
                        profit: Number(b.profit) || 0,
                        // Asegurar tipos numéricos para cálculos
                        stake: Number(b.stake) || DEFAULT_STAKES[(b.betType || b.type || '').toLowerCase()] || 0,
                        total_odd: Number(b.total_odd) || 0
                    }));
                } else if (dailyCtx.bets) {
                    // LEGACY: Diccionario
                    ['safe', 'value', 'funbet'].forEach(type => {
                        if (dailyCtx.bets[type]) {
                            const b = dailyCtx.bets[type];
                            let s = (b.status || 'PENDING').toUpperCase();
                            if (s === 'GANADA') s = 'WON';
                            if (s === 'PERDIDA') s = 'LOST';

                            const stakeValue = Number(DEFAULT_STAKES[type] || 0);

                            // Profit estimation logic for legacy lookup if missing
                            let profit = 0;
                            if (s === 'WON') profit = stakeValue * (Number(b.odd) - 1);
                            if (s === 'LOST') profit = -stakeValue;

                            transformedBets.push({
                                type: type,
                                betType: type,
                                stake: stakeValue,
                                total_odd: Number(b.odd) || 0,
                                match: b.match,
                                pick: b.pick,
                                status: s,
                                profit: profit, // Estimado para legacy
                                selections: b.selections || []
                            });
                        }
                    });
                }

                // Extraer Profit del Día (Si ya fue calculado por Python)
                // Si no existe, lo calculamos "on the fly" sumando profits de las bets
                let dayProfit = 0;
                if (dailyCtx.day_profit !== undefined) {
                    dayProfit = Number(dailyCtx.day_profit);
                } else {
                    // Fallback calc
                    dayProfit = transformedBets.reduce((sum, b) => sum + (Number(b.profit) || 0), 0);
                }

                // ACUMULAR TOTALES MENSUALES
                totalMonthlyProfit += dayProfit;

                // Acumular Stakes
                let dayHasSettled = false;
                let dayIsWon = dayProfit > 0;

                transformedBets.forEach(b => {
                    const s = (b.status || '').toUpperCase();
                    const isSettled = s === 'WON' || s === 'LOST';

                    if (isSettled) {
                        totalMonthlyStake += Number(b.stake);
                        dayHasSettled = true;
                    }
                });

                if (dayHasSettled) {
                    totalSettledDays++;
                    if (dayIsWon) wonDays++;
                }

                // Guardar en Mapa
                if (transformedBets.length > 0) {
                    const dayObj = {
                        date: date,
                        day_profit: Number(dayProfit.toFixed(2)), // Forzar número
                        status: dailyCtx.status || (dayHasSettled ? 'FINISHED' : 'PENDING'),
                        bets: transformedBets
                    };
                    daysMap[date] = dayObj;
                }
            }
        });

        // --- LIVE CALCULATION OF DETAILED STATS ---
        // We recalculate this from the `daysMap` we just built to ensure consistency with the Hash data.

        const accuracyBySport: Record<string, { total_selections: number, won_selections: number, accuracy_percentage: number }> = {
            football: { total_selections: 0, won_selections: 0, accuracy_percentage: 0 },
            basketball: { total_selections: 0, won_selections: 0, accuracy_percentage: 0 }
        };

        const performanceByType: Record<string, { profit: number, yield: number, total_stake: number, total_bets?: number, won_bets?: number }> = {
            safe: { profit: 0, yield: 0, total_stake: 0, total_bets: 0, won_bets: 0 },
            value: { profit: 0, yield: 0, total_stake: 0, total_bets: 0, won_bets: 0 },
            funbet: { profit: 0, yield: 0, total_stake: 0, total_bets: 0, won_bets: 0 },
            stakazo: { profit: 0, yield: 0, total_stake: 0, total_bets: 0, won_bets: 0 }
        };

        // NEW: Profit Factor Vars
        let grossProfit = 0;
        let grossLoss = 0;

        Object.values(daysMap).forEach((day: any) => {
            if (!day.bets) return;
            day.bets.forEach((bet: any) => {
                const status = (bet.status || 'PENDING').toUpperCase();
                let p = Number(bet.profit || 0);

                // ROBUST FALLBACK: If profit is 0 but status is settled, calculate it manually.
                if (Math.abs(p) < 0.01) {
                    const stake = Number(bet.stake || 0);
                    if (status === 'LOST') {
                        p = -stake;
                    } else if (status === 'WON') {
                        const odd = Number(bet.total_odd || bet.odd || 0);
                        if (odd > 1) {
                            p = stake * (odd - 1);
                        }
                    }
                }

                // PF Accumulation
                if (p > 0) grossProfit += p;
                if (p < 0) grossLoss += Math.abs(p);

                // 1. Performance By Type
                let bType = (bet.betType || 'safe').toLowerCase();
                // [USER FIX] Force Stakazo type for Stakazo category to ensure stats appear in Summary
                if (category === 'daily_bets_stakazo') {
                    bType = 'stakazo';
                }

                if (performanceByType[bType]) {
                    // Update profit with the robust value
                    performanceByType[bType].profit += p;

                    if (status === 'WON' || status === 'LOST') {
                        performanceByType[bType].total_stake += Number(bet.stake || 0);
                        // [USER REQUEST] Hit Rate Counters
                        performanceByType[bType].total_bets = (performanceByType[bType].total_bets || 0) + 1;
                        if (status === 'WON') {
                            performanceByType[bType].won_bets = (performanceByType[bType].won_bets || 0) + 1;
                        }
                    }
                }

                // 2. Accuracy By Sport (Iterate selections if available, or fallback to bet-level)
                const selections = bet.selections || [];
                if (selections.length > 0) {
                    selections.forEach((sel: any) => {
                        const selStatus = (sel.status || 'PENDING').toUpperCase();
                        if (selStatus === 'WON' || selStatus === 'LOST') {
                            const sportKey = (sel.sport || 'Football').toLowerCase();
                            const targetKey = sportKey === 'basketball' || sportKey === 'baloncesto' ? 'basketball' : 'football';

                            accuracyBySport[targetKey].total_selections++;
                            if (selStatus === 'WON') {
                                accuracyBySport[targetKey].won_selections++;
                            }
                        }
                    });
                } else {
                    // Fallback to bet level
                    if (status === 'WON' || status === 'LOST') {
                        const sportKey = (bet.sport || 'Football').toLowerCase();
                        const targetKey = sportKey === 'basketball' || sportKey === 'baloncesto' ? 'basketball' : 'football';

                        accuracyBySport[targetKey].total_selections++;
                        if (status === 'WON') {
                            accuracyBySport[targetKey].won_selections++;
                        }
                    }
                }
            });
        });

        // Calculate Percentages & Yields
        Object.keys(accuracyBySport).forEach(key => {
            const item = accuracyBySport[key];
            item.accuracy_percentage = item.total_selections > 0
                ? Number(((item.won_selections / item.total_selections) * 100).toFixed(2))
                : 0;
        });

        Object.keys(performanceByType).forEach(key => {
            const item = performanceByType[key];
            item.profit = Number(item.profit.toFixed(2));
            item.total_stake = Number(item.total_stake.toFixed(2));
            item.yield = item.total_stake > 0
                ? Number(((item.profit / item.total_stake) * 100).toFixed(2))
                : 0;
        });

        // CALCULATE PROFIT FACTOR
        let profitFactor = 0;
        if (grossLoss === 0) {
            if (grossProfit > 0) profitFactor = Infinity; // Or grossProfit as requested? "retorna el valor de G o Infinity". standard is Infinity
            else profitFactor = 0;
        } else {
            profitFactor = grossProfit / grossLoss;
        }
        // Round to 2 decimals if not Infinity
        const profitFactorFixed = profitFactor === Infinity ? 999.99 : Number(profitFactor.toFixed(2)); // Use simplified large number or proper infinity for JSON?
        // JSON supports null, but not Infinity standardly. Let's return Number or a high cap if infinity, or String?
        // AdminAnalytics checks >= 1.5. 
        // Let's stick to returning a Number. 
        // If Infinity, usually usually shown as 99.99 or similar in dashboards to avoid breakers.
        // User said "retorna el valor de G o Infinity". 
        // I'll return the numeric division result. JSON.stringify usually converts Infinity to null. 
        // So I will convert Infinity to a large number like 100 or keep it as matches 0 description if G=0. 
        // Actually, if JSON converts Infinity to null, frontend might break or show nothing.
        // Let's cap it or use G as fallback if Infinity?
        // "Si L = 0 y G > 0, retorna el valor de G o Infinity" -> I will return G (Gross Profit) as a safe fallback that implies "Pure Profit"
        const finalPF = profitFactor === Infinity ? Number(grossProfit.toFixed(2)) : Number(profitFactor.toFixed(2));


        // 3. Get Pre-calculated Stats (Already fetched in parallel)
        const statsKey = `${prefix}stats:${month}`;
        const storedStatsRaw = statsRaw;
        let finalStats: any = null;
        let parsedCached = {};

        if (storedStatsRaw) {
            try {
                parsedCached = typeof storedStatsRaw === 'string' ? JSON.parse(storedStatsRaw) : storedStatsRaw;
            } catch (e) { }
        }

        const liveYield = totalMonthlyStake > 0 ? (totalMonthlyProfit / totalMonthlyStake) * 100 : 0;
        const liveWinRate = totalSettledDays > 0 ? (wonDays / totalSettledDays) * 100 : 0;

        // Create Chart Evolution Data Live
        const chartEvolution: any[] = [];
        let runningAccumulated = 0;

        // Drawdown Vars
        let maxDrawdown = 0;
        let runningPeak = -Infinity;

        dates.forEach((date, idx) => {
            // ... [Existing Logic to get dayProfit] ...
            // We need to mirror the logic: if day exists in map, get profit. else 0.

            let dailyProfitForChart = 0;
            const dailyDataRaw = (monthMap as any)[date];

            if (dailyDataRaw) {
                // Reuse logic or just access what we stored in daysMap? 
                // We populated daysMap[date] earlier. Let's use it if available.
                if (daysMap[date]) {
                    dailyProfitForChart = daysMap[date].day_profit;
                }
            }

            runningAccumulated += dailyProfitForChart;

            // Drawdown Calculation
            if (runningAccumulated > runningPeak) {
                runningPeak = runningAccumulated;
            }
            const currentDD = runningPeak - runningAccumulated;
            if (currentDD > maxDrawdown) {
                maxDrawdown = currentDD;
            }

            // Only add to chart if date is <= today
            if (date <= todayStr) {
                chartEvolution.push({
                    date: date,
                    daily_profit: Number(dailyProfitForChart.toFixed(2)),
                    accumulated_profit: Number(runningAccumulated.toFixed(2))
                });
            }
        });

        const liveMaxDD = Number(maxDrawdown.toFixed(2));
        const liveLastUpdated = new Date().toISOString().replace('T', ' ').split('.')[0];

        // Construct Summary Object (Mirroring Top Level)
        const liveSummary = {
            total_profit: Number(totalMonthlyProfit.toFixed(2)),
            total_stake: Number(totalMonthlyStake.toFixed(2)),
            yield: Number(liveYield.toFixed(2)),
            profit_factor: finalPF,
            roi: Number(liveYield.toFixed(2)),
            max_drawdown: liveMaxDD,
            win_rate_days: Number(liveWinRate.toFixed(2)),
            yesterday_profit: (parsedCached as any).yesterday_profit ?? 0
        };

        if (storedStatsRaw) {
            finalStats = {
                ...parsedCached,
                ...liveSummary, // Override top-level
                summary: liveSummary, // Override summary object

                // Extra explicit overrides just in case
                performance_by_type: performanceByType,
                accuracy_by_sport: accuracyBySport,
                chart_evolution: chartEvolution,
                last_updated: liveLastUpdated
            };
        } else {
            // Fallback if Python hasn't run yet
            finalStats = {
                ...liveSummary,
                summary: liveSummary,

                performance_by_type: performanceByType,
                accuracy_by_sport: accuracyBySport,
                chart_evolution: chartEvolution,
                // Zeroes for complex stats not calc'd here
                last_updated: liveLastUpdated
            };
        }

        // Cache Stats for Dashboard (Always update Hash with Live Stats)
        await redis.hset(statsHashKey, { [month]: JSON.stringify(finalStats) });

        return NextResponse.json({
            month,
            stats: finalStats,
            days: daysMap
        });

    } catch (error) {
        console.error("History API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
