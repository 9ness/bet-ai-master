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

        console.log(`\n[UPDATE-BET] --- STARTED ---`);
        console.log(`[UPDATE-BET] Target: ${date} | Type: ${betType} | Status: ${newStatus} | PickUpdate: ${!!newPick}`);

        const yearMonth = date.substring(0, 7);
        const hashKey = `betai:daily_bets:${yearMonth}`;
        const dayKey = `betai:daily_bets:${date}`;

        // 1. LOAD DATA (Try Hash first, then Day Key)
        let data: any = await redis.hget(hashKey, date);
        let source = 'HASH';
        if (!data) {
            console.log(`[UPDATE-BET] Data not found in HASH ${hashKey}, trying Key ${dayKey}`);
            data = await redis.get(dayKey);
            source = 'KEY';
        } else {
            console.log(`[UPDATE-BET] Loaded data from HASH ${hashKey} field ${date}`);
        }

        // Fallback checks (Migration)
        if (!data) {
            const fallbackData: any = await redis.get("daily_bets");
            if (fallbackData && fallbackData.date === date) {
                data = fallbackData;
                source = 'FALLBACK_LEGACY';
            } else {
                return NextResponse.json({ success: false, error: "No data found" }, { status: 404 });
            }
        }

        console.log(`[UPDATE-BET] Source: ${source}`);


        const historyData: any = typeof data === 'string' ? JSON.parse(data) : data;
        const bets = historyData.bets || {};

        // Find specific bet
        let bet: any = null;

        console.log(`[UPDATE-BET] Searching for '${betType}' in bets (IsArray: ${Array.isArray(bets)})`);

        // Support Array or Object structure
        if (Array.isArray(bets)) {
            bet = bets.find((b: any) => b.type === betType || b.betType === betType);
            if (!bet) {
                console.log(`[UPDATE-BET] Available Types in Array:`, bets.map(b => b.type || b.betType));
            }
        } else {
            bet = bets[betType];
            if (!bet) {
                // Try finding it by value loop if object keys are not the type
                // Sometimes it might be { "0": { type: "safe" }, "1": { type: "value" } }
                const foundKey = Object.keys(bets).find(k => bets[k].type === betType || bets[k].betType === betType);
                if (foundKey) bet = bets[foundKey];

                if (!bet) console.log(`[UPDATE-BET] Available Keys in Object:`, Object.keys(bets));
            }
        }

        if (!bet) {
            console.error(`[UPDATE-BET] Bet not found: ${betType} in date ${date}`);
            // Dump snippet of bets to debug
            console.error(`[UPDATE-BET] Bets dump:`, JSON.stringify(bets).substring(0, 200));
            return NextResponse.json({ success: false, error: "Bet not found" }, { status: 404 });
        }

        // 2. APPLY UPDATES

        // A) Global Pick Text
        if (newPick) {
            bet.pick = newPick;
            console.log(`[UPDATE-BET] Updated Bet Pick to: ${newPick}`);
        }

        // B) Selections (Status & Result)
        let somethingChanged = !!newPick;

        let changes = [];
        if (updates && Array.isArray(updates)) changes = updates;
        else if (newStatus) changes.push({ selectionId, newStatus });

        // Normalize Status Helper
        const norm = (s: string) => {
            if (!s) return null; // Allow null if only updating result
            s = s.toUpperCase();
            if (s === 'GANADA') return 'WON';
            if (s === 'PERDIDA') return 'LOST';
            if (s === 'PENDIENTE') return 'PENDING';
            if (s === 'NULA') return 'VOID';
            return s;
        };

        // Apply changes to specific selections
        console.log(`[UPDATE-BET] Processing ${changes.length} updates:`, JSON.stringify(changes));

        for (const change of changes) {
            const sId = change.selectionId;
            const sStatus = norm(change.newStatus);
            const sResult = change.newResult; // New field

            if (sId === null || sId === undefined) {
                // Global Override
                if (sStatus) bet.status = sStatus;
                continue;
            }

            const arrays = [bet.selections, bet.picks_detail, bet.components].filter(Array.isArray);
            let updated = false;
            // Search Strategy:
            // 1. Try finding by ID properties (fixture_id, id, selectionId)
            // 2. Try finding by Match Name
            // 3. Fallback to index ONLY if sId is a small number

            for (const arr of arrays) {
                // Find by ID/Match
                let match = arr.find((item: any) =>
                    String(item.fixture_id) === String(sId) ||
                    String(item.match) === String(sId) ||
                    String(item.id) === String(sId) ||
                    String(item.selectionId) === String(sId)
                );

                // If not found, and sId is number-like and small, try index
                if (!match && !isNaN(Number(sId)) && Number(sId) < 100 && arr[sId]) {
                    match = arr[sId];
                }

                if (match) {
                    console.log(`[UPDATE-BET] Matched Selection: ${sId} -> ${sStatus}`);
                    if (sStatus) match.status = sStatus;
                    if (sResult !== undefined) match.result = sResult;
                    somethingChanged = true;
                    updated = true;
                    break;
                }
            }
            if (!updated) {
                console.warn(`[UPDATE-BET] WARNING: Selection ${sId} NOT FOUND in any array.`);
                console.warn(`[UPDATE-BET] Available IDs/Matches:`, arrays.flat().map((i: any) => `${i.fixture_id}|${i.match}`));
            }
        }

        // 3. RECALCULATE LOGIC (Mirrored from check_api_results.py)
        // Check if we have selections to evaluate
        const arrays = [bet.selections, bet.picks_detail, bet.components].filter(Array.isArray);
        const allSelections = arrays.flat();

        // Detect Manual Override: No selection updates, but global status provided
        const isManualOverride = (!updates || !Array.isArray(updates) || updates.length === 0) && !!newStatus;

        if (allSelections.length > 0) {
            let anyLost = false;
            let pendingCount = 0;
            let voidCount = 0;
            let effectiveOdd = 1.0;

            for (const sel of allSelections) {
                const s = norm(sel.status);
                const odd = parseFloat(sel.odd) || 1.0;

                if (s === 'LOST') {
                    anyLost = true;
                } else if (s === 'PENDING') {
                    pendingCount++;
                } else if (s === 'WON') {
                    effectiveOdd *= odd;
                } else if (s === 'VOID') {
                    voidCount++;
                }
            }

            // Derive Parent Status
            if (!isManualOverride) {
                if (anyLost) {
                    bet.status = 'LOST';
                } else if (pendingCount > 0) {
                    bet.status = 'PENDING';
                } else if (voidCount === allSelections.length) {
                    bet.status = 'VOID';
                } else {
                    // All resolved, no lost, no pending -> WON
                    bet.status = 'WON';
                    // Update the Total Odd to the effective odd (so profit calc is correct)
                    bet.total_odd = parseFloat(effectiveOdd.toFixed(2));
                }
            } else {
                // Apply manual status
                if (newStatus) bet.status = norm(newStatus);
                console.log(`[UPDATE-BET] Manual Override active. Taking ${bet.status} as truth.`);
            }
        } else {
            // Single Bet (No Selections)
            if (newStatus) bet.status = norm(newStatus);
        }

        // 4. CALCULATE PROFIT
        let stake = Number(bet.stake) || 0;
        // Self-heal stake
        if (stake === 0) {
            if (betType === 'safe') stake = 6;
            else if (betType === 'value') stake = 3;
            else if (betType === 'funbet') stake = 1;
            bet.stake = stake;
        }

        const finalStatus = norm(bet.status);
        const finalOdd = Number(bet.total_odd || bet.odd || 0);

        if (finalStatus === 'WON') {
            bet.profit = Number((stake * (finalOdd - 1)).toFixed(2));
        } else if (finalStatus === 'LOST') {
            bet.profit = -stake;
        } else {
            // VOID, PENDING
            bet.profit = 0;
        }

        console.log(`[UPDATE-BET] Result: ${betType} -> ${finalStatus} (${bet.profit}u)`);

        // 5. RECALCULATE DAY PROFIT
        let dayProfit = 0;
        const betList = Array.isArray(bets) ? bets : Object.values(bets);
        betList.forEach((b: any) => {
            dayProfit += (Number(b.profit) || 0);
        });
        historyData.day_profit = Number(dayProfit.toFixed(2));

        // 6. SAVE (DUAL WRITE)
        // 6. SAVE (DUAL WRITE)
        const jsonStr = JSON.stringify(historyData);
        console.log(`[UPDATE-BET] Saving ${jsonStr.length} chars to HASH ${hashKey} -> ${date}`);

        // A) Menthly Hash
        await redis.hset(hashKey, { [date]: jsonStr });

        // B) Daily Key (Standardization)
        await redis.set(dayKey, jsonStr);

        // VERIFY IMMEDIATE READ
        const check: any = await redis.hget(hashKey, date);
        const isMatch = check === jsonStr;
        console.log(`[UPDATE-BET] Persistence Check (Hash): ${isMatch ? 'MATCH' : 'MISMATCH'}`);
        if (!isMatch) {
            console.error(`[UPDATE-BET] WRITE FAILED!? Read back length: ${check?.length}, Expected: ${jsonStr.length}`);
        }

        // 7. STATS CHECK
        await updateMonthStats(date);

        revalidatePath('/', 'layout');
        return NextResponse.json({ success: true, bet });

    } catch (error) {
        console.error(`[UPDATE-BET] Error:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// Helper to recalculate monthly stats by reading all days (User Logic Replacement)
async function updateMonthStats(dateStr: string) {
    const [year, month] = dateStr.split('-');
    const statsKey = `betai:stats:${year}-${month}`;
    const hashKey = `betai:daily_bets:${year}-${month}`;

    console.log(`[UPDATE-BET] Recalculating Stats for ${year}-${month} using HASH ${hashKey}...`);

    // 1. Get all daily bets for this month (HGETALL)
    const monthData: Record<string, any> | null = await redis.hgetall(hashKey);

    let totalProfit = 0;
    let totalStaked = 0;
    let wonBets = 0;
    let totalBets = 0;

    // Default Stakes (Safety Net)
    const DEFAULT_STAKES: Record<string, number> = { safe: 6, value: 3, funbet: 1 };

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
                    const betType = (bet.type || '').toLowerCase();
                    const stake = Number(bet.stake) || DEFAULT_STAKES[betType] || 0;

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
    console.log(`[UPDATE-BET] Stats Persisted:`, stats);
    return stats;
}
