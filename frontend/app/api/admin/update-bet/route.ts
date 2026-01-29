import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { revalidatePath } from 'next/cache';

// Initialize Redis directly (server-side)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic'; // Ensure no caching

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let { date, betType, selectionId, newStatus, updates, newPick } = body;

        // HELPER: Normalize Status
        const normalizeStatus = (s: string | undefined | null) => {
            if (!s) return null;
            const upper = s.toUpperCase().trim();
            if (['GANADA', 'WON', 'WIN'].includes(upper)) return 'WON';
            if (['PERDIDA', 'LOST', 'LOSS'].includes(upper)) return 'LOST';
            if (['NULA', 'VOID'].includes(upper)) return 'VOID';
            if (['PENDIENTE', 'PENDING'].includes(upper)) return 'PENDING';
            return upper;
        };

        const isStakazo = betType && String(betType).toLowerCase().includes('stakazo');
        const category = isStakazo ? 'daily_bets_stakazo' : 'daily_bets';

        const yearMonth = date.substring(0, 7);
        const hashKey = `betai:${category}:${yearMonth}`;
        const dayKey = `betai:${category}:${date}`;

        // 1. LOAD DATA
        // Priority: HASH -> KEY
        let data: any = await redis.hget(hashKey, date);
        let source = 'HASH';

        if (!data) {
            data = await redis.get(dayKey);
            source = 'KEY';
        }

        // Fallback checks (Only for regular bets logic mainly, but keeps safety)
        if (!data) {
            const masterKeyRaw = isStakazo ? "betai:daily_bets_stakazo" : "betai:daily_bets";
            const fallbackData: any = await redis.get(masterKeyRaw);
            if (fallbackData && fallbackData.date === date) {
                data = fallbackData;
                source = 'FALLBACK_MASTER';
            } else if (!isStakazo) {
                // Last ditch: legacy key without prefix? (Only for legacy daily_bets)
                const legacy = await redis.get("daily_bets");
                if (legacy && (legacy as any).date === date) {
                    data = legacy;
                    source = 'FALLBACK_LEGACY';
                } else {
                    return NextResponse.json({ success: false, error: "No data found for this date" }, { status: 404 });
                }
            } else {
                return NextResponse.json({ success: false, error: "No data found for this date (Stakazo)" }, { status: 404 });
            }
        }

        const historyData: any = typeof data === 'string' ? JSON.parse(data) : data;
        const bets = historyData.bets || {};

        // 2. FIND BET
        let bet: any = null;
        if (Array.isArray(bets)) {
            bet = bets.find((b: any) => b.type === betType || b.betType === betType);
            // Relaxed search for Stakazo if betType differs slightly
            if (!bet && isStakazo) {
                bet = bets.find((b: any) => String(b.betType).toLowerCase().includes('stakazo'));
            }
        } else {
            bet = bets[betType];
            if (!bet) {
                // Try searching values
                const foundKey = Object.keys(bets).find(k => bets[k].type === betType || bets[k].betType === betType);
                if (foundKey) bet = bets[foundKey];
            }
        }

        if (!bet) {
            console.error(`[UPDATE-BET] Bet '${betType}' not found.`);
            return NextResponse.json({ success: false, error: "Bet not found" }, { status: 404 });
        }

        // 3. APPLY UPDATES

        // A) Global Pick Text
        if (newPick) {
            bet.pick = newPick;
        }

        // B) Selections
        let changes = [];
        if (updates && Array.isArray(updates)) changes = updates;
        else if (newStatus && (selectionId !== undefined && selectionId !== null)) changes.push({ selectionId, newStatus });

        // Apply changes to matching selections
        for (const change of changes) {
            const sId = change.selectionId;
            const sStatus = normalizeStatus(change.newStatus);
            const sResult = change.newResult;

            if (!sStatus && sResult === undefined) continue;

            const arrays = [bet.selections, bet.picks_detail, bet.components].filter(Array.isArray);
            let updated = false;

            for (const arr of arrays) {
                let match = arr.find((item: any) =>
                    String(item.fixture_id) === String(sId) ||
                    String(item.match) === String(sId) ||
                    String(item.id) === String(sId) ||
                    String(item.selectionId) === String(sId)
                );

                // Index fallback
                if (!match && !isNaN(Number(sId)) && Number(sId) < 50 && arr[Number(sId)]) {
                    match = arr[Number(sId)];
                }

                if (match) {
                    if (sStatus) match.status = sStatus;
                    if (sResult !== undefined) match.result = sResult;
                    updated = true;
                }
            }
        }

        // 4. RECALCULATE BET STATUS & PROFIT (The Core Logic)

        // Gather all selections
        const arrays = [bet.selections, bet.picks_detail, bet.components].filter(Array.isArray);
        const allSelections = arrays.flat();

        const isManualGlobalOverride = changes.length === 0 && !!newStatus;

        if (allSelections.length > 0 && !isManualGlobalOverride) {
            let anyLost = false;
            let pendingCount = 0;
            let voidCount = 0;
            let effectiveOdd = 1.0;

            for (const sel of allSelections) {
                const s = normalizeStatus(sel.status || 'PENDING');
                const odd = parseFloat(sel.odd) || 1.0;

                if (s === 'LOST') {
                    anyLost = true;
                } else if (s === 'PENDING') {
                    pendingCount++;
                } else if (s === 'VOID') {
                    voidCount++;
                    // Void selections do NOT contribute to effective odd (odd = 1.0)
                } else if (s === 'WON') {
                    effectiveOdd *= odd;
                }
            }

            // Determine Bet Status
            if (anyLost) {
                bet.status = 'LOST';
            } else if (pendingCount > 0) {
                bet.status = 'PENDING';
            } else if (voidCount === allSelections.length) {
                bet.status = 'VOID'; // All void
            } else {
                // All resolved, no lost, at least one won (or mixed won/void)
                bet.status = 'WON';
                // Update total odd to reflect reality
                bet.total_odd = parseFloat(effectiveOdd.toFixed(2));
            }

        } else if (isManualGlobalOverride) {
            // Manual override of the global status
            bet.status = normalizeStatus(newStatus);
        } else if (allSelections.length === 0 && newStatus) {
            // Single bet without selections array?
            bet.status = normalizeStatus(newStatus);
        }

        // CALCULATE PROFIT
        const finalStatus = normalizeStatus(bet.status);
        let stake = Number(bet.stake) || 0;

        // Heal Stake
        if (stake === 0) {
            const typeKey = (bet.type || betType || '').toLowerCase();
            if (typeKey === 'safe') stake = 6;
            else if (typeKey === 'value') stake = 3;
            else if (typeKey === 'funbet') stake = 1;
            else if (typeKey.includes('stakazo')) stake = 10;
            bet.stake = stake;
        }

        const finalOdd = Number(bet.total_odd || bet.odd || 0);

        if (finalStatus === 'WON') {
            const p = stake * (finalOdd - 1);
            bet.profit = Number(p.toFixed(2));
        } else if (finalStatus === 'LOST') {
            bet.profit = -stake;
        } else if (finalStatus === 'VOID') {
            bet.profit = 0;
        } else {
            // PENDING or other
            bet.profit = 0;
        }

        // 5. UPDATE DAY SUMMARY (Day Profit)
        let dayProfit = 0;
        const betList = Array.isArray(bets) ? bets : Object.values(bets);
        betList.forEach((b: any) => {
            // Only sum finalized bets
            const s = normalizeStatus(b.status);
            if (s === 'WON' || s === 'LOST') {
                dayProfit += (Number(b.profit) || 0);
            }
        });
        historyData.day_profit = Number(dayProfit.toFixed(2));

        // 6. SAVE
        const jsonStr = JSON.stringify(historyData);
        // A) Month Hash
        await redis.hset(hashKey, { [date]: jsonStr });

        // B) Master Key (Legacy/Current View) if Today
        const todayStr = new Date().toISOString().split('T')[0];
        if (date === todayStr) {
            const masterKey = isStakazo ? "betai:daily_bets_stakazo" : "betai:daily_bets";
            await redis.set(masterKey, jsonStr);
        }

        // 7. STATS
        await updateMonthStats(date, category);

        revalidatePath('/', 'layout');
        return NextResponse.json({ success: true, bet, dayProfit: historyData.day_profit });

    } catch (error) {
        console.error(`[UPDATE-BET] Error:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// Helper to recalculate monthly stats by reading all days (User Logic Replacement)
async function updateMonthStats(dateStr: string, category: string = 'daily_bets') {
    const [year, month] = dateStr.split('-');

    // Stats Key -> stats:YYYY-MM OR stats_stakazo:YYYY-MM
    const statsPrefix = category === 'daily_bets_stakazo' ? 'stats_stakazo' : 'stats';
    const statsKey = `betai:${statsPrefix}:${year}-${month}`;

    // Data Hash -> daily_bets:YYYY-MM OR daily_bets_stakazo:YYYY-MM
    // Note: Variable 'hashKey' in main func used 'betai:' prefix. Here we construct similarly.
    // The previous logic used `betai:daily_bets:...` hardcoded?
    // Let's match the category passed.
    const hashKey = `betai:${category}:${year}-${month}`;

    // 1. Get all daily bets for this month (HGETALL)
    const monthData: Record<string, any> | null = await redis.hgetall(hashKey);

    let totalProfit = 0;
    let totalStaked = 0;
    let wonBets = 0;
    let totalBets = 0;

    // Default Stakes (Safety Net)
    const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1, stakazo: 10 };

    if (monthData) {
        Object.values(monthData).forEach((dayDataRaw: any) => {
            if (!dayDataRaw) return;
            const data = typeof dayDataRaw === 'string' ? JSON.parse(dayDataRaw) : dayDataRaw;
            const bets = Array.isArray(data.bets) ? data.bets : Object.values(data.bets || {});

            bets.forEach((bet: any) => {
                const status = (bet.status || 'PENDING').toUpperCase();

                // Normalize
                let norm = status;
                if (norm === 'GANADA') norm = 'WON';
                if (norm === 'PERDIDA') norm = 'LOST';

                // SOLO sumamos si la apuesta no está PENDING (Target: WON/LOST)
                if (norm === 'WON' || norm === 'LOST') {
                    const betType = (bet.type || bet.betType || '').toLowerCase();
                    // Identify stake safely
                    let stake = Number(bet.stake);
                    if (!stake) {
                        if (betType.includes('stakazo')) stake = 10;
                        else stake = DEFAULT_STAKES[betType] || 0;
                    }

                    totalStaked += stake;
                    totalProfit += Number(bet.profit || 0);
                    totalBets++;
                    if (norm === 'WON') wonBets++;
                }
            });
        });
    }

    const yieldReal = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const winRate = totalBets > 0 ? (wonBets / totalBets) * 100 : 0;

    const stats = {
        total_profit: Number(totalProfit.toFixed(2)),
        total_stake: Number(totalStaked.toFixed(2)), // Added for visibility
        yield: Number(yieldReal.toFixed(2)),
        win_rate: Number(winRate.toFixed(2)),
        days_operated: monthData ? Object.keys(monthData).length : 0,
        last_updated: new Date().toISOString()
    };

    await redis.set(statsKey, JSON.stringify(stats));
    return stats;
}
