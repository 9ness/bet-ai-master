import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis directly (server-side)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic'; // Ensure no caching

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, betType, selectionId, newStatus, newResult, updates } = body;

        console.log(`\n[UPDATE-BET] --- STARTED ---`);
        console.log(`[UPDATE-BET] Request: Date=${date}, Type=${betType}`);
        console.log(`[UPDATE-BET] Updates:`, JSON.stringify(updates || { selectionId, newStatus }));

        // 1. Get current data (Robust Search)
        const prefix = "betai:";
        const possibleKeys = [
            `history:${date}`,
            `${prefix}history:${date}`,
            `${prefix}bets:${date}`,
            "daily_bets"
        ];

        let historyData: any = null;
        let redisKey = "";

        for (const key of possibleKeys) {
            const data = await redis.get(key);
            if (data) {
                if (key === "daily_bets") {
                    const dData: any = data;
                    // Check if daily_bets actually matches the requested date
                    if (dData.date === date) {
                        historyData = dData;
                        redisKey = key;
                        console.log(`[UPDATE-BET] Found data in key: ${key}`);
                        break;
                    }
                } else {
                    historyData = data;
                    redisKey = key;
                    console.log(`[UPDATE-BET] Found data in key: ${key}`);
                    break;
                }
            }
        }

        if (!historyData) {
            console.error(`[UPDATE-BET] ERROR: History not found for date ${date}`);
            return NextResponse.json({ success: false, error: `History not found` }, { status: 404 });
        }

        const bets = historyData.bets || {};
        let bet: any = null;

        // Find the specific bet
        if (Array.isArray(bets)) {
            bet = bets.find((b: any) => b.type === betType);
        } else {
            bet = bets[betType];
        }

        if (!bet) {
            console.error(`[UPDATE-BET] ERROR: Bet type '${betType}' not found.`);
            return NextResponse.json({ success: false, error: "Bet type not found" }, { status: 404 });
        }

        // 2. Prepare updates list
        let changesToApply: any[] = [];
        if (updates && Array.isArray(updates)) {
            changesToApply = updates;
        } else if (selectionId !== undefined || newStatus) {
            changesToApply.push({ selectionId, newStatus, newResult });
        }

        let somethingChanged = false;

        // 3. Apply Updates (Aggressive Search)
        for (const change of changesToApply) {
            const { selectionId: sId, newStatus: sStatus, newResult: sResult } = change;

            // Global override?
            if (sId === null || sId === undefined) {
                console.log(`[UPDATE-BET] Applying GLOBAL override: ${sStatus}`);
                bet.status = sStatus;
                somethingChanged = true;
                continue;
            }

            // Selection Search
            // Consolidate all possible sources of details
            const possibleArrays = [bet.selections, bet.picks_detail, bet.components].filter(arr => Array.isArray(arr));

            let found = false;
            let targetSelection: any = null;

            // Flatten search
            for (const list of possibleArrays) {
                for (const item of list) {
                    // COMPARISON LOGIC
                    // 1. Exact ID Match (String comparison)
                    // 2. Exact fixture_id Match
                    // 3. Description/Match Name Match (Normalized)

                    const itemId = item.id ? String(item.id) : null;
                    const itemFixtureId = item.fixture_id ? String(item.fixture_id) : null;
                    const itemMatch = item.match ? item.match.toLowerCase().trim() : "";
                    const itemDesc = item.description ? item.description.toLowerCase().trim() : "";

                    const searchId = String(sId).toLowerCase().trim();

                    if (
                        (itemId && itemId === searchId) ||
                        (itemFixtureId && itemFixtureId === searchId) ||
                        (itemMatch && itemMatch === searchId) ||
                        (itemDesc && itemDesc === searchId)
                    ) {
                        targetSelection = item;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (found && targetSelection) {
                console.log(`[UPDATE-BET] Selection FOUND: ${targetSelection.match || targetSelection.description}. New Status: ${sStatus}`);
                targetSelection.status = sStatus;
                if (sResult) targetSelection.result = sResult;
                somethingChanged = true;
            } else {
                console.warn(`[UPDATE-BET] WARNING: Selection not found for ID: ${sId}`);
                console.log(`[UPDATE-BET] Searched in ${possibleArrays.length} arrays.`);
            }
        }

        // 4. Recalculate Global Logic (If changes happened)
        // We look at the FIRST valid array we find to judge global status
        const validDetails = [bet.selections, bet.picks_detail, bet.components].find(arr => Array.isArray(arr) && arr.length > 0);

        if (somethingChanged) {
            // A. Recalculate Status from Selections (Only if selections exist - Combinadas)
            if (validDetails) {
                console.log(`[UPDATE-BET] Recalculating Global Status based on ${validDetails.length} selections...`);
                const statuses = validDetails.map((s: any) => String(s.status || "").toUpperCase());
                console.log(`[UPDATE-BET] Child Statuses: ${JSON.stringify(statuses)}`);

                const hasLost = statuses.some((s: string) => ['LOST', 'PERDIDA', 'FAIL'].includes(s));
                const allWon = statuses.every((s: string) => ['WON', 'GANADA', 'SUCCESS'].includes(s));

                if (hasLost) {
                    bet.status = "PERDIDA";
                    console.log(`[UPDATE-BET] FORCED Status to PERDIDA (found lost selection)`);
                } else if (allWon) {
                    bet.status = "GANADA";
                    console.log(`[UPDATE-BET] FORCED Status to GANADA (all won)`);
                }
                // Else: Leave as is (allows manual PENDING or manual PERDIDA/GANADA override)
            }

            // B. STRICT PROFIT RECALCULATION (Universal for Simple & Combined)
            const stake = Number(bet.stake) || 1;
            const odd = Number(bet.total_odd || bet.odd) || 0;
            let profit = 0;

            const currentStatus = (bet.status || "").toUpperCase();

            // PENDING logic is included in 'else' -> profit = 0
            if (currentStatus === "PERDIDA" || currentStatus === "LOST") {
                profit = -1 * Math.abs(stake);
            } else if (currentStatus === "GANADA" || currentStatus === "WON") {
                profit = (stake * odd) - stake;
            } else {
                profit = 0; // PENDING or others
            }

            bet.profit = Number(profit.toFixed(2));
            console.log(`[RECALCULO] Bet ID: ${bet.type} | Status: ${bet.status} | Stake: ${stake} -> Profit: ${bet.profit}`);
        }
        console.log(`[UPDATE-BET] New Profit: ${bet.profit}`);

        // 5. Recalculate Day Total Profit
        let totalDayProfit = 0;
        const allBetsList = Array.isArray(bets) ? bets : Object.values(bets);
        allBetsList.forEach((b: any) => {
            totalDayProfit += (Number(b.profit) || 0);
        });
        historyData.day_profit = Number(totalDayProfit.toFixed(2));
        console.log(`[UPDATE-BET] Updated Day Profit: ${historyData.day_profit}`);

        // 6. SAVE
        console.log(`[UPDATE-BET] Saving to Redis key: ${redisKey}`);
        await redis.set(redisKey, historyData);
        console.log(`[UPDATE-BET] --- SUCCESS ---\n`);

        return NextResponse.json({ success: true, filtered: bet });

    } catch (error) {
        console.error(`[UPDATE-BET] CRITICAL ERROR:`, error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
