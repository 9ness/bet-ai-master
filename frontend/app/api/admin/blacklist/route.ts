import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis 
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let month = searchParams.get('month');

        if (!month) {
            // Default to current month YYYY-MM
            const now = new Date();
            month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        const hashKey = `betai:daily_bets:${month}`;
        const fieldName = "ID_RESULT_FAILED";

        const rawJson = await redis.hget(hashKey, fieldName);

        let blacklist = {};
        if (rawJson) {
            // @ts-ignore
            blacklist = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        }

        return NextResponse.json({ month, blacklist });

    } catch (error) {
        console.error("Blacklist GET Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let month = searchParams.get('month');

        if (!month) {
            const now = new Date();
            month = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        const hashKey = `betai:daily_bets:${month}`;
        const fieldName = "ID_RESULT_FAILED";

        // Clear the field
        await redis.hdel(hashKey, fieldName);

        return NextResponse.json({ success: true, message: `Blacklist cleared for ${month}` });

    } catch (error) {
        console.error("Blacklist DELETE Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
