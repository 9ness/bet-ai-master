import { Redis } from '@upstash/redis';

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function trackAIUsage(tokensInput: number, tokensOutput: number, context: string, userId: string = "anonymous") {
    try {
        const costInput = (tokensInput / 1000000) * 0.10;
        const costOutput = (tokensOutput / 1000000) * 0.40;
        const totalCost = costInput + costOutput;

        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);

        // 1. Global Stats
        await redis.hincrbyfloat(`betai:ai_stats:${month}`, "total_cost", totalCost);
        await redis.hincrby(`betai:ai_stats:${month}`, "total_messages", 1);
        await redis.hincrby(`betai:ai_stats:${month}`, "total_tokens", tokensInput + tokensOutput);

        // 2. Per-User Stats
        const userKey = `betai:ai_user_stats:${userId}`;
        await redis.hincrbyfloat(userKey, "total_cost", totalCost);
        await redis.hincrby(userKey, "total_messages", 1);
        await redis.hset(userKey, { "last_interaction": today });

        // 3. Log user activity in a list (last 50 messages)
        const logEntry = JSON.stringify({
            userId,
            cost: totalCost,
            tokens: tokensInput + tokensOutput,
            context,
            timestamp: new Date().toISOString()
        });
        await redis.lpush(`betai:ai_logs:${month}`, logEntry);
        await redis.ltrim(`betai:ai_logs:${month}`, 0, 49);

        console.log(`[AI-TRACKER] User ${userId} tracked. Cost: $${totalCost.toFixed(4)}.`);
    } catch (e) {
        console.error("Failed to track AI Usage:", e);
    }
}

export async function getRecommendations(category = "daily_bets") {
    try {
        // Dynamic Date Calculation (Europe/Madrid) - Unified with Home Page
        const now = new Date();
        const today = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid'
        }).format(now);

        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid'
        }).format(yesterdayDate);

        console.log(`[Admin/Utils] Fetching for Date: ${today}, Category: ${category}`);

        // 1. Try Today (Hash)
        const monthToday = today.substring(0, 7);
        let data: any = await redis.hget(`betai:${category}:${monthToday}`, today);

        // 2. Try Yesterday (Hash)
        if (!data) {
            console.log(`[Admin/Utils] No data for ${today}, trying ${yesterday}`);
            const monthYesterday = yesterday.substring(0, 7);
            data = await redis.hget(`betai:${category}:${monthYesterday}`, yesterday);
        }

        // 3. Last Resort: Master Key (Legacy/Mirror)
        if (!data) {
            console.log(`[Admin/Utils] No hash data, checking Master Key...`);
            data = await redis.get(`betai:${category}`);
        }

        if (data) {
            return data;
        }

        return null;
    } catch (error) {
        console.error("Error reading recommendation from Redis:", error);
        return null;
    }
}

export async function getRawMatches(dateStr: string, isTikTok = false) {
    try {
        const monthKey = dateStr.substring(0, 7);
        const category = isTikTok ? "raw_matches_tiktok" : "raw_matches";
        const key = `betai:${category}:${monthKey}`;

        console.log(`[Admin/Utils] Fetching RAW matches from ${key} for date ${dateStr}`);
        const data = await redis.hget(key, dateStr);

        return data;
    } catch (error) {
        console.error("Error reading RAW matches from Redis:", error);
        return null;
    }
}
