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
        let { date, betType, selectionId, newStatus, updates } = body; // updates supports batch

        console.log(`\n[UPDATE-BET] --- STARTED ---`);
        console.log(`[UPDATE-BET] Target: ${date} | Type: ${betType} | Status: ${newStatus}`);

        // 1. PRIMARY KEY: betai:daily_bets:YYYY-MM-DD
        const redisKey = `betai:daily_bets:${date}`;

        let data = await redis.get(redisKey);

        // Fallback checks if primary key empty (Migration support)
        if (!data) {
            console.log(`[UPDATE-BET] Primary key missing, checking fallback: daily_bets`);
            const fallbackData: any = await redis.get("daily_bets");
            if (fallbackData && fallbackData.date === date) {
                data = fallbackData;
                console.log(`[UPDATE-BET] Found in fallback 'daily_bets'`);
            } else {
                console.error(`[UPDATE-BET] CRITICAL: No data found for ${date}`);
                return NextResponse.json({ success: false, error: "No data found for this date" }, { status: 404 });
            }
        }

        const historyData: any = data;
        const bets = historyData.bets || {};

        // Find Bet
        let bet: any = null;

        // Robust finding logic: Handle array or object
        if (Array.isArray(bets)) {
            bet = bets.find((b: any) => b.type === betType);
        } else if (bets[betType]) {
            bet = bets[betType];
        } else {
            // Try strict equality on keys if object
            const key = Object.keys(bets).find(k => k === betType);
            if (key) bet = bets[key];
        }

        if (!bet) {
            console.error(`[UPDATE-BET] Bet Not Found. Target: ${betType}. Available types: ${Array.isArray(bets) ? bets.map((b: any) => b.type).join(',') : Object.keys(bets).join(',')}`);
            return NextResponse.json({ success: false, error: `Bet type '${betType}' not found for date ${date}` }, { status: 404 });
        }

        // 2. APPLY UPDATES (Status & Logic)
        let somethingChanged = false;

        // Normalize batch items
        let changes = [];
        if (updates && Array.isArray(updates)) changes = updates;
        else if (newStatus) changes.push({ selectionId, newStatus });

        for (const change of changes) {
            let sStatus = change.newStatus;
            const sId = change.selectionId;

            // Normalize
            if (sStatus === 'GANADA') sStatus = 'WON';
            if (sStatus === 'PERDIDA') sStatus = 'LOST';
            if (sStatus === 'PENDIENTE') sStatus = 'PENDING';

            // Global?
            if (sId === null || sId === undefined) {
                bet.status = sStatus;
                somethingChanged = true;
                continue;
            }

            // Selection
            const arrays = [bet.selections, bet.picks_detail, bet.components].filter(Array.isArray);
            let found = false;
            for (const arr of arrays) {
                // Try index
                if (arr[sId]) {
                    arr[sId].status = sStatus;
                    found = true;
                    somethingChanged = true;
                    break;
                }
                // Try ID search
                const match = arr.find((item: any) => String(item.fixture_id) === String(sId) || String(item.match) === String(sId));
                if (match) {
                    match.status = sStatus;
                    found = true;
                    somethingChanged = true;
                    break;
                }
            }
        }

        if (!somethingChanged) {
            return NextResponse.json({ success: true, message: "No changes needed" });
        }

        // 2.5 AUTO-DERIVE PARENT STATUS FROM SELECTIONS
        // Check if we have selections to evaluate
        const arrays = [bet.selections, bet.picks_detail, bet.components].filter(Array.isArray);
        const allSelections = arrays.flat();

        if (allSelections.length > 0) {
            const hasLost = allSelections.some((s: any) => s.status === 'LOST' || s.status === 'PERDIDA');
            const allWon = allSelections.every((s: any) => s.status === 'WON' || s.status === 'GANADA');

            if (hasLost) {
                // If any selection is lost, the whole bet is lost
                newStatus = 'LOST';
                console.log(`[UPDATE-BET] Auto-update: Bet ${betType} marked as HOST because a selection is LOST.`);
            } else if (allWon) {
                // If all selections are won, the whole bet is won
                newStatus = 'WON';
                console.log(`[UPDATE-BET] Auto-update: Bet ${betType} marked as WON because ALL selections are WON.`);
            }
            // Else change nothing, respect manual or pending
        }

        // 3. VALIDATE & CALCULATE
        // STRICT: Read from Redis object.
        let stake = Number(bet.stake);
        let odd = Number(bet.total_odd || bet.odd);

        // SELF-HEALING: If stake is missing (old data), infer from type
        if (!stake || isNaN(stake)) {
            console.warn(`[UPDATE-BET] Missing Stake for ${betType}. Attempting self-healing defaults.`);
            if (betType === 'safe') stake = 6;
            else if (betType === 'value') stake = 3;
            else if (betType === 'funbet') stake = 1;

            if (stake) {
                bet.stake = stake; // Persist self-healing
                console.log(`[UPDATE-BET] Healed Stake for ${betType} -> ${stake}`);
            } else {
                console.error(`[UPDATE-BET] Critical: Stake missing and type unknown (Data: ${JSON.stringify(bet)}).`);
                return NextResponse.json({ success: false, error: `Critical: Stake missing for ${betType}.` }, { status: 400 });
            }
        }

        if (!odd || isNaN(odd)) {
            console.error(`[UPDATE-BET] Missing Odd for ${betType} in DB. Data:`, bet);
            return NextResponse.json({ success: false, error: `Critical: Odd missing in Redis for ${betType}. Cannot calculate profit.` }, { status: 400 });
        }

        let profit = 0;
        let currentStatus = (newStatus || bet.status || "PENDING").toUpperCase();
        if (currentStatus === 'GANADA') currentStatus = 'WON';
        if (currentStatus === 'PERDIDA') currentStatus = 'LOST';
        if (currentStatus === 'PENDIENTE') currentStatus = 'PENDING';

        // UPDATE STATUS
        bet.status = currentStatus;

        // CALCULATE PROFIT
        if (currentStatus === 'WON') {
            profit = stake * (odd - 1); // Exact formula requested
        } else if (currentStatus === 'LOST') {
            profit = -stake; // Exact loss
        } else {
            profit = 0;
        }

        // UPDATE PROFIT ONLY
        bet.profit = Number(profit.toFixed(2));

        // Verify peristance
        bet.stake = stake;
        if (!bet.total_odd) bet.total_odd = odd;

        console.log(`[UPDATE-BET] Recalculated: ${betType} | Status: ${currentStatus} | Stake: ${stake} | Odd: ${odd} | Profit: ${bet.profit}`);

        // 4. RECALCULATE DAY PROFIT
        let totalDayProfit = 0;
        const allBets = Array.isArray(bets) ? bets : Object.values(bets);
        allBets.forEach((b: any) => {
            totalDayProfit += (Number(b.profit) || 0);
        });
        historyData.day_profit = Number(totalDayProfit.toFixed(2));

        // 5. CASCADING SAVE
        console.log(`[UPDATE-BET] Saving to Keys (Day Profit: ${totalDayProfit})...`);

        try {
            const pKey = `betai:daily_bets:${date}`;
            const hKey = `betai:history:${date}`;

            // Parallel save for speed + consistency
            await Promise.all([
                redis.set(pKey, historyData),
                redis.set(hKey, historyData)
            ]);

            console.log(`[UPDATE-BET] Saved to ${pKey} and ${hKey}`);

            // 6. MONTHLY STATS
            await updateMonthStats(date);

        } catch (dbError) {
            console.error("[UPDATE-BET] Redis Write Failed:", dbError);
            return NextResponse.json({ success: false, error: "Redis Write Failed" }, { status: 500 });
        }

        // 7. REVALIDATE
        revalidatePath('/', 'layout');

        console.log(`[UPDATE-BET] Success.`);
        return NextResponse.json({ success: true, filtered: bet });

    } catch (error) {
        console.error(`[UPDATE-BET] Server Error:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// Helper to recalculate monthly stats by reading all days (User Logic Replacement)
async function updateMonthStats(dateStr: string) {
    const [year, month] = dateStr.split('-');
    const statsKey = `betai:stats:${year}-${month}`;
    const pattern = `betai:daily_bets:${year}-${month}-*`;

    console.log(`[UPDATE-BET] Recalculating Stats for ${year}-${month} using pattern ${pattern}...`);

    // 1. Get all keys for the month
    const keys = await redis.keys(pattern);
    let totalProfit = 0;
    let totalStaked = 0;
    let wonBets = 0;
    let totalBets = 0;

    // Default Stakes (Safety Net)
    const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1 };

    for (const key of keys) {
        const dayData = await redis.get(key);
        if (!dayData) continue;

        const data = typeof dayData === 'string' ? JSON.parse(dayData) : dayData;
        const bets = Array.isArray(data.bets) ? data.bets : Object.values(data.bets || {});

        bets.forEach((bet: any) => {
            const status = (bet.status || 'PENDING').toUpperCase();

            // Normalize
            let norm = status;
            if (norm === 'GANADA') norm = 'WON';
            if (norm === 'PERDIDA') norm = 'LOST';

            // SOLO sumamos si la apuesta no está PENDING (Target: WON/LOST)
            if (norm === 'WON' || norm === 'LOST') {
                const betType = (bet.type || '').toLowerCase();
                // User said "totalStaked += Number(bet.stake || 0)" but complained about "only detecting 20u".
                // I will add the safety net DEFAULT_STAKES because that WAS the root cause.
                const stake = Number(bet.stake) || DEFAULT_STAKES[betType] || 0;

                totalStaked += stake;
                totalProfit += Number(bet.profit || 0);
                totalBets++;
                if (norm === 'WON') wonBets++;
            }
        });
    }

    const yieldReal = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
    const winRate = totalBets > 0 ? (wonBets / totalBets) * 100 : 0;

    const stats = {
        total_profit: Number(totalProfit.toFixed(2)),
        total_stake: Number(totalStaked.toFixed(2)), // Added for visibility
        yield: Number(yieldReal.toFixed(2)),
        win_rate: Number(winRate.toFixed(2)),
        days_operated: keys.length,
        last_updated: new Date().toISOString()
    };

    await redis.set(statsKey, JSON.stringify(stats));
    console.log(`[UPDATE-BET] Stats Persisted:`, stats);
    return stats;
}
