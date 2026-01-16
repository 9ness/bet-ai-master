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
            pipeline.get(`${prefix}daily_bets:${date}`);
        }

        // Parallel Fetch: Stats + Daily Pipeline
        const [statsRaw, results] = await Promise.all([
            redis.get(`${prefix}stats:${month}`),
            pipeline.exec<(string | null)[]>()
        ]);

        // Process Results
        const daysMap: Record<string, any> = {};
        let totalMonthlyProfit = 0;
        let totalMonthlyStake = 0;
        let totalSettledDays = 0;
        let wonDays = 0;

        dates.forEach((date, idx) => {
            const historyData = results[idx * 2];
            const dailyDataRaw = results[idx * 2 + 1];

            // PRIORIDAD CRÍTICA: DAILY BETS
            // El usuario edita 'daily_bets' directamente. Esa es la fuente de verdad.
            // 'history' es secundario/backup.
            const sourceRaw = dailyDataRaw || historyData;

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
                const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1 };

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

                // Acumular Stakes (Solo de apuestas resueltas o activas? 
                // Normalmente Yield se calcula sobre apuestas resultas (Settled).
                // Pero para "Total Stake" se suele mostrar todo lo apostado.
                // Ajustaremos a "Settled" para consistencia con Yield, o Todo?
                // El usuario quiere ver reflejado cambios manuales.

                let dayHasSettled = false;
                let dayIsWon = dayProfit > 0;

                transformedBets.forEach(b => {
                    const s = (b.status || '').toUpperCase();
                    if (s === 'WON' || s === 'LOST') {
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
                    daysMap[date] = {
                        date: date,
                        day_profit: Number(dayProfit.toFixed(2)), // Forzar número
                        status: dailyCtx.status || (dayHasSettled ? 'FINISHED' : 'PENDING'),
                        bets: transformedBets
                    };
                }
            }
        });

        // 3. Get Pre-calculated Stats (Already fetched in parallel)
        const statsKey = `${prefix}stats:${month}`;
        const storedStatsRaw = statsRaw;
        let finalStats: any = null;

        if (storedStatsRaw) {
            const parsed = typeof storedStatsRaw === 'string' ? JSON.parse(storedStatsRaw) : storedStatsRaw;
            finalStats = {
                ...parsed,
                yesterday_profit: parsed.yesterday_profit ?? 0
            };
        } else {
            // Fallback if Python hasn't run yet
            finalStats = {
                total_profit: Number(totalMonthlyProfit.toFixed(2)),
                total_stake: Number(totalMonthlyStake.toFixed(2)),
                yield: totalMonthlyStake > 0 ? Number(((totalMonthlyProfit / totalMonthlyStake) * 100).toFixed(2)) : 0,
                // Zeroes for complex stats not calc'd here
                profit_factor: 0,
                roi: 0,
                max_drawdown: 0,
                yesterday_profit: 0
            };
        }

        // Cache Stats for Dashboard (Only if we did fallback calc, otherwise no need to re-set)
        if (!storedStatsRaw) {
            await redis.set(statsKey, JSON.stringify(finalStats));
        }

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
