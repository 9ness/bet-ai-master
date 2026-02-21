
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis with env vars
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Robust Prefix Logic: Try constructed prefix, then fallback
        const envPrefix = process.env.REDIS_PREFIX || 'betai:';

        // Helper to fetch with fallback
        const fetchRobust = async (suffix: string) => {
            // 1. Try with Environment Prefix
            const key1 = `${envPrefix}${suffix}`;
            const val1 = await redis.get<string | number>(key1);
            if (val1 !== null) return val1;

            // 2. Try with Explicit 'betai:' (Common fallback)
            if (envPrefix !== 'betai:') {
                const key2 = `betai:${suffix}`;
                const val2 = await redis.get<string | number>(key2);
                if (val2 !== null) return val2;
            }

            // 3. Try Raw (No prefix - in case env var included it but key didn't ?)
            // or if stored without prefix
            const key3 = suffix;
            const val3 = await redis.get<string | number>(key3);

            return val3;
        };

        // Parallel fetch utilizing robust helper
        const [remFootball, limitFootball, dateFootball, remBasketball, limitBasketball, dateBasketball] = await Promise.all([
            fetchRobust('api_usage:football:remaining'),
            fetchRobust('api_usage:football:limit'),
            fetchRobust('api_usage:football:last_updated'),
            fetchRobust('api_usage:basketball:remaining'),
            fetchRobust('api_usage:basketball:limit'),
            fetchRobust('api_usage:basketball:last_updated')
        ]);

        const today = new Date().toISOString().split('T')[0];

        const parseUsage = (rem: string | number | null, limitVal: string | number | null, lastUpdate: string | number | null) => {
            const lastUpdateStr = String(lastUpdate || '');
            const parsedLimit = limitVal ? (typeof limitVal === 'string' ? parseInt(limitVal, 10) : Number(limitVal)) : 100;

            if (lastUpdateStr && lastUpdateStr !== today) {
                // It was updated on a previous day. Reset Usage for new day, but keep limit.
                return { used: 0, remaining: parsedLimit, limit: parsedLimit };
            }

            let used = 0;
            let val = null;

            if (rem !== null && rem !== undefined) {
                const remInt = typeof rem === 'string' ? parseInt(rem, 10) : Number(rem);
                if (!isNaN(remInt)) {
                    val = remInt;
                    used = Math.max(0, parsedLimit - remInt);
                }
            }
            return { used, remaining: val, limit: parsedLimit };
        };

        return NextResponse.json({
            success: true,
            football: parseUsage(remFootball, limitFootball, dateFootball),
            basketball: parseUsage(remBasketball, limitBasketball, dateBasketball)
        });
    } catch (error) {
        console.error("Error fetching API usage:", error);
        return NextResponse.json({ success: false, error: "Redis Error" }, { status: 500 });
    }
}
