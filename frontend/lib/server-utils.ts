import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
