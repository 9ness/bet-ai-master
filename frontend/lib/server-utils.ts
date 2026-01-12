import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getRecommendations() {
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

        console.log(`[Admin/Utils] Fetching for Date: ${today}`);

        // Try Today first
        let data: any = await redis.get(`betai:daily_bets:${today}`);

        // Try Yesterday if Today not found
        if (!data) {
            console.log(`[Admin/Utils] No data for ${today}, trying ${yesterday}`);
            data = await redis.get(`betai:daily_bets:${yesterday}`);
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
