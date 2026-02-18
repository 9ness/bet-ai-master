
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

        // Parallel fetch
        const [remFootball, remBasketball] = await Promise.all([
            redis.get<string | number>(keyFootball),
            redis.get<string | number>(keyBasketball)
        ]);

        const limit = 100; // Default limit

        const parseUsage = (rem: string | number | null) => {
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
            football: parseUsage(remFootball),
            basketball: parseUsage(remBasketball)
        });
    } catch (error) {
        console.error("Error fetching API usage:", error);
        return NextResponse.json({ success: false, error: "Redis Error" }, { status: 500 });
    }
}
