import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date } = body;

        // Use provided date or today
        const targetDate = date || new Date().toISOString().split('T')[0];
        const monthStr = targetDate.substring(0, 7); // YYYY-MM

        console.log(`[API-ADD-REPORT] Generating report for ${monthStr} (Target: ${targetDate})`);

        // 1. Fetch Stats from Redis
        // Priority: 'betai_stats' Hash (Dashboard Source) -> 'betai:stats:YYYY-MM' Key (Python/Legacy)
        const dashboardStatsKey = `betai_stats`;
        let statsRaw: any = await redis.hget(dashboardStatsKey, monthStr);

        if (!statsRaw) {
            console.warn(`[API-ADD-REPORT] No stats in Hash ${dashboardStatsKey}, trying legacy key...`);
            statsRaw = await redis.get(`betai:stats:${monthStr}`);
        }

        if (!statsRaw) {
            return NextResponse.json({ success: false, error: `No stats found for ${monthStr}` }, { status: 404 });
        }

        const stats = typeof statsRaw === 'string' ? JSON.parse(statsRaw) : statsRaw;
        const totalProfit = Number(stats.total_profit || 0);
        const iconProfit = totalProfit >= 0 ? "✅" : "🔻";

        // Format Message
        const msg = `📊 <b>REPORTE MENSUAL - ${monthStr}</b> 📊\n\n` +
            `${iconProfit} <b>Profit:</b> ${totalProfit} u\n` +
            `📈 <b>Yield:</b> ${stats.yield || 0}%\n` +
            `🎯 <b>Win Rate:</b> ${stats.win_rate || 0}%\n` +
            `📅 <b>Días Operados:</b> ${stats.days_operated || 0}\n\n` +
            `🧠 <b>BetAiMaster Analytics</b>`;

        const reportItem = {
            id: crypto.randomUUID(),
            tipo: "REPORTE MENSUAL",
            bet_type_key: "monthly_report",
            enviado: false,
            mensaje: msg,
            timestamp: new Date().toISOString()
        };

        // 2. Add/Update in Telegram Store
        const storeKey = "betai:telegram_store";

        // Load existing messages for that day
        let currentMessagesRaw: any = await redis.hget(storeKey, targetDate);
        let currentMessages: any[] = [];

        if (currentMessagesRaw) {
            currentMessages = typeof currentMessagesRaw === 'string' ? JSON.parse(currentMessagesRaw) : currentMessagesRaw;
        }

        // Remove old report if exists to replace it
        currentMessages = currentMessages.filter((m: any) => m.bet_type_key !== 'monthly_report');

        // Add new one
        currentMessages.push(reportItem);

        // Save back
        await redis.hset(storeKey, { [targetDate]: JSON.stringify(currentMessages) });

        console.log(`[API-ADD-REPORT] Success. Added report to ${targetDate}`);

        return NextResponse.json({ success: true, item: reportItem });

    } catch (e: any) {
        console.error("[API-ADD-REPORT] Error:", e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
