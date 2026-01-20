import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, id, mensaje } = body;

        if (!date || !id || !mensaje) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const prefix = process.env.REDIS_PREFIX || 'betai:';
        const storeKey = `${prefix}telegram_store`;

        // 1. Get data
        const dateData = await redis.hget(storeKey, date) as string | null;

        if (!dateData) {
            return NextResponse.json({ error: 'Date not found' }, { status: 404 });
        }

        let items: any[] = [];
        try {
            items = typeof dateData === 'string' ? JSON.parse(dateData) : dateData;
        } catch (e) {
            return NextResponse.json({ error: 'Corrupt data' }, { status: 500 });
        }

        // 2. Find and Update
        const itemIndex = items.findIndex((i: any) => i.id === id);
        if (itemIndex === -1) {
            return NextResponse.json({ error: 'Message ID not found' }, { status: 404 });
        }

        // Prevent editing sent messages? Maybe allow corrections? Let's allow it but warn in UI.
        items[itemIndex].mensaje = mensaje;

        // 3. Save
        await redis.hset(storeKey, { [date]: JSON.stringify(items) });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
