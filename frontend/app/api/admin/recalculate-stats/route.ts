import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis directly
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { month } = body; // YYYY-MM

        if (!month) {
            return NextResponse.json({ success: false, error: 'Month required' }, { status: 400 });
        }

        console.log(`[STATS-UPDATE] Force Recalculating Stats for ${month}...`);

        const hashKey = `betai:daily_bets:${month}`;
        const statsKey = `betai:stats:${month}`;

        // 1. Get all daily bets for this month (HGETALL)
        const monthData: Record<string, any> | null = await redis.hgetall(hashKey);

        let totalProfit = 0;
        let totalStaked = 0;
        let wonBets = 0;
        let totalBets = 0;

        // Detailed Stats
        const perfByType: Record<string, any> = {
            safe: { profit: 0, stake: 0, wins: 0, total: 0 },
            value: { profit: 0, stake: 0, wins: 0, total: 0 },
            funbet: { profit: 0, stake: 0, wins: 0, total: 0 }
        };

        const accBySport: Record<string, any> = {
            football: { total: 0, won: 0 },
            basketball: { total: 0, won: 0 }
        };

        const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1 };
        const daysMap: Record<string, any> = {};

        if (monthData) {
            Object.values(monthData).forEach((dayDataRaw: any) => {
                if (!dayDataRaw) return;
                const data = typeof dayDataRaw === 'string' ? JSON.parse(dayDataRaw) : dayDataRaw;
                const bets = Array.isArray(data.bets) ? data.bets : Object.values(data.bets || {});
                const date = data.date;

                let dayProfit = 0;

                bets.forEach((bet: any) => {
                    const status = (bet.status || 'PENDING').toUpperCase();
                    let norm = status;
                    if (norm === 'GANADA') norm = 'WON';
                    if (norm === 'PERDIDA') norm = 'LOST';

                    const betType = (bet.betType || bet.type || 'safe').toLowerCase();
                    const stake = Number(bet.stake) || DEFAULT_STAKES[betType] || 0;
                    const profit = Number(bet.profit || 0);

                    // SOLO sumamos si la apuesta no está PENDING (Target: WON/LOST)
                    if (norm === 'WON' || norm === 'LOST') {
                        totalStaked += stake;
                        totalProfit += profit;
                        dayProfit += profit;
                        totalBets++;
                        if (norm === 'WON') wonBets++;

                        // Type Stats
                        if (!perfByType[betType]) perfByType[betType] = { profit: 0, stake: 0, wins: 0, total: 0 };
                        perfByType[betType].profit += profit;
                        perfByType[betType].stake += stake;
                        perfByType[betType].total += 1;
                        if (norm === 'WON') perfByType[betType].wins += 1;

                        // Sport Accuracy (Selections)
                        if (bet.selections && Array.isArray(bet.selections)) {
                            bet.selections.forEach((sel: any) => {
                                const sStatus = (sel.status || 'PENDING').toUpperCase();
                                if (sStatus === 'WON' || sStatus === 'LOST') {
                                    const sport = (sel.sport || 'football').toLowerCase();
                                    if (accBySport[sport]) {
                                        accBySport[sport].total += 1;
                                        if (sStatus === 'WON') accBySport[sport].won += 1;
                                    }
                                }
                            });
                        }
                    }
                });

                // Track daily profit for evolution (if needed)
                if (date) daysMap[date] = dayProfit;
            });
        }

        // Calculate Derived
        const yieldReal = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
        const winRate = totalBets > 0 ? (wonBets / totalBets) * 100 : 0;

        // Construct Evolution Chart Data
        const chart_evolution = Object.keys(daysMap).sort().reduce((acc: any[], date) => {
            const dayProfit = daysMap[date];
            const prev = acc.length > 0 ? acc[acc.length - 1].accumulated_profit : 0;
            acc.push({
                date,
                daily_profit: Number(dayProfit.toFixed(2)),
                accumulated_profit: Number((prev + dayProfit).toFixed(2))
            });
            return acc;
        }, []);

        // Max Drawdown Calc
        let maxDrawdown = 0;
        let peak = -999999;
        let running = 0;
        chart_evolution.forEach((pt: any) => {
            running = pt.accumulated_profit;
            if (running > peak) peak = running;
            const dd = peak - running;
            if (dd > maxDrawdown) maxDrawdown = dd;
        });

        const stats = {
            total_profit: Number(totalProfit.toFixed(2)),
            total_stake: Number(totalStaked.toFixed(2)),
            yield: Number(yieldReal.toFixed(2)),
            win_rate: Number(winRate.toFixed(2)),
            win_rate_days: 0, // Simplified for now, or calc properly similarly to python
            days_operated: Object.keys(daysMap).length,
            max_drawdown: Number(maxDrawdown.toFixed(2)),

            // Nested
            performance_by_type: perfByType,
            accuracy_by_sport: {
                football: { ...accBySport.football, accuracy_percentage: accBySport.football.total > 0 ? Number(((accBySport.football.won / accBySport.football.total) * 100).toFixed(2)) : 0 },
                basketball: { ...accBySport.basketball, accuracy_percentage: accBySport.basketball.total > 0 ? Number(((accBySport.basketball.won / accBySport.basketball.total) * 100).toFixed(2)) : 0 }
            },
            chart_evolution: chart_evolution,

            last_updated: new Date().toISOString()
        };

        await redis.set(statsKey, JSON.stringify(stats));
        // Also update latest if current month?
        // const currentMonth = new Date().toISOString().slice(0, 7);
        // if (month === currentMonth) await redis.set('betai:stats:latest', JSON.stringify(stats));

        // --- TELEGRAM REPORT AUTO-UPDATE ---
        // If updating the current month, auto-generate the telegram report for TODAY
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

        if (month === currentMonth) {
            try {
                const today = now.toISOString().split('T')[0];
                const storeKey = `betai:telegram_store`;

                const iconProfit = stats.total_profit >= 0 ? "✅" : "🔻";
                // Formatting month name in Spanish
                const monthName = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

                const msg = `📊 *REPORTE MENSUAL - ${month}* 📊\n\n${iconProfit} *Profit:* ${stats.total_profit} u\n📈 *Yield:* ${stats.yield}%\n🎯 *Win Rate:* ${stats.win_rate}%\n📅 *Días Operados:* ${stats.days_operated}\n\n🧠 *BetAiMaster Analytics*`;

                const newItem = {
                    id: crypto.randomUUID(),
                    tipo: "REPORTE MENSUAL",
                    bet_type_key: "monthly_report",
                    enviado: false,
                    mensaje: msg,
                    timestamp: now.toISOString()
                };

                // Fetch existing items for today
                const currentData: any = await redis.hget(storeKey, today);
                let items = [];
                if (currentData) {
                    try { items = typeof currentData === 'string' ? JSON.parse(currentData) : currentData; } catch { items = []; }
                }

                // Remove existing monthly report to replace it
                items = items.filter((i: any) => i.bet_type_key !== 'monthly_report');
                // Add new one at top
                items.unshift(newItem);

                await redis.hset(storeKey, { [today]: JSON.stringify(items) });
                console.log(`[STATS-UPDATE] Telegram Report Updated for ${today}`);

            } catch (tgError) {
                console.error("[STATS-UPDATE] Error updating Telegram Report:", tgError);
                // Non-blocking error
            }
        }

        return NextResponse.json({ success: true, stats });

    } catch (error) {
        console.error(`[STATS-UPDATE] Error:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
