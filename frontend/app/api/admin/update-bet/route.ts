import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis directly (server-side)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, betType, selectionId, newStatus, newResult } = body;

        // 1. Get current data
        const historyKey = `history:${date}`;
        // Also check daily_bets if likely
        const historyData: any = await redis.get(historyKey);

        if (!historyData) {
            return NextResponse.json({ success: false, error: "History not found" }, { status: 404 });
        }

        const bets = historyData.bets || {};
        const bet = bets[betType];

        if (!bet) {
            return NextResponse.json({ success: false, error: "Bet type not found" }, { status: 404 });
        }

        // 2. Update selection
        let updated = false;
        if (bet.selections) {
            const sel = bet.selections.find((s: any) => s.fixture_id == selectionId);
            if (sel) {
                sel.status = newStatus;
                if (newResult) sel.result = newResult;
                updated = true;
            }
        }

        // Recalculate Global Status if needed (Frontend ensures this? Or Backend?)
        // Let's do a simple recalc here similar to python script logic
        if (updated && bet.selections) {
            const statuses = bet.selections.map((s: any) => s.status);
            let finalStatus = "PENDING";
            if (statuses.includes("LOST") || statuses.includes("PERDIDA")) finalStatus = "PERDIDA";
            else if (statuses.includes("PENDING")) finalStatus = "PENDIENTE";
            else if (statuses.every((s: string) => s === "WON" || s === "GANADA")) finalStatus = "GANADA";

            bet.status = finalStatus;

            // Recalc profit
            const stake = bet.stake || 1;
            const odd = bet.odd || 0;
            let profit = 0;
            if (finalStatus === "PERDIDA") profit = -stake;
            else if (finalStatus === "GANADA") profit = (stake * odd) - stake;

            bet.profit = Number(profit.toFixed(2));
        }

        // 3. Save back
        await redis.set(historyKey, historyData);

        return NextResponse.json({ success: true, filtered: bet });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
