
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
        const prefix = process.env.REDIS_PREFIX || 'betai:';
        const keyFootball = `${prefix}api_usage:football:remaining`;
        const keyBasketball = `${prefix}api_usage:basketball:remaining`;
        const keyFootballDate = `${prefix}api_usage:football:last_updated`;
        const keyBasketballDate = `${prefix}api_usage:basketball:last_updated`;

        // Parallel fetch
        const [remFootball, dateFootball, remBasketball, dateBasketball] = await Promise.all([
            redis.get<string | number>(keyFootball),
            redis.get<string>(keyFootballDate),
            redis.get<string | number>(keyBasketball),
            redis.get<string>(keyBasketballDate)
        ]);

        const limit = 100; // Default limit
        const today = new Date().toISOString().split('T')[0];

        const parseUsage = (rem: string | number | null, lastUpdate: string | null) => {
            // Check if stale
            if (lastUpdate !== today) {
                // If date is not today, assume reset -> Remaining = Limit (100)
                return { used: 0, remaining: limit, limit };
            }

            let used = 0;
            let val = null;
            if (rem !== null && rem !== undefined) {
                const remInt = typeof rem === 'string' ? parseInt(rem, 10) : Number(rem);
                if (!isNaN(remInt)) {
                    val = remInt;
                    used = Math.max(0, limit - remInt);
                }
            }
            return { used, remaining: val, limit };
        };

        return NextResponse.json({
            success: true,
            football: parseUsage(remFootball, dateFootball),
            basketball: parseUsage(remBasketball, dateBasketball)
        });
    } catch (error) {
        console.error("Error fetching API usage:", error);
        return NextResponse.json({ success: false, error: "Redis Error" }, { status: 500 });
    }
}
