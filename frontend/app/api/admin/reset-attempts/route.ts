import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { revalidatePath } from 'next/cache';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date } = body;

        if (!date) {
            return NextResponse.json({ success: false, error: "Date is required" }, { status: 400 });
        }

        console.log(`[RESET-ATTEMPTS] Handling reset for ${date}`);

        const redisKey = `betai:daily_bets:${date}`;
        const data = await redis.get(redisKey);

        if (!data) {
            return NextResponse.json({ success: false, error: "No data found for this date" }, { status: 404 });
        }

        const historyData: any = data;
        let bets = historyData.bets || [];
        // Ensure array
        if (!Array.isArray(bets)) {
            bets = Object.values(bets);
        }

        let modified = false;
        let count = 0;

        for (const bet of bets) {
            // Reset logic: matches Python `reset_attempts.py`
            // If status is PENDING or MANUAL_CHECK, we reset counters.
            // Also if the user manually triggers this, they likely want to force re-check on pending items.
            if (bet.status === 'PENDING' || bet.status === 'MANUAL_CHECK') {
                bet.check_attempts = 0;
                bet.last_check = null; // Clear last check time if exists
                if (bet.status === 'MANUAL_CHECK') {
                    bet.status = 'PENDING';
                }
                modified = true;
                count++;
            }
        }

        if (modified) {
            // Convert back to structure if needed, but we normalized to array.
            // Redis expects proper JSON structure.
            // If the original was object-based (migrated?), we might be changing structure to array here.
            // check_api_results.py expects "bets": [...] (Array). So saving as Array is preferred/correct.
            historyData.bets = bets;

            await redis.set(redisKey, historyData);
            console.log(`[RESET-ATTEMPTS] Reset ${count} bets for ${date}`);

            revalidatePath('/', 'layout');

            return NextResponse.json({ success: true, count, message: `Reset ${count} bets to 0 attempts` });
        } else {
            return NextResponse.json({ success: true, count: 0, message: "No pending bets found to reset" });
        }

    } catch (error) {
        console.error("[RESET-ATTEMPTS] Error:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
