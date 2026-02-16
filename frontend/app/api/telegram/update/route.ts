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

        // --- MORNING MESSAGE SUPPORT ---
        if (id.startsWith('morning_')) {
            const index = parseInt(id.split('_')[1]);
            const morningKey = `${prefix}morning_messages:${date}`;
            const morningData = await redis.get(morningKey) as string[] | null;

            if (!morningData) {
                return NextResponse.json({ error: 'Morning messages not found for this date' }, { status: 404 });
            }

            morningData[index] = mensaje;
            await redis.set(morningKey, morningData);
            return NextResponse.json({ success: true });
        }

        // --- VICTORY MESSAGE SUPPORT ---
        if (id.startsWith('win_')) {
            const parts = id.split('_');
            const type = parts[1]; // stake1, stake4, stake5, stakazo
            const index = parseInt(parts[2]);
            const winKey = `${prefix}win_messages:${date}`;
            const winData = await redis.get(winKey) as Record<string, string[]> | null;

            if (!winData || !winData[type]) {
                return NextResponse.json({ error: 'Victory messages not found for this date' }, { status: 404 });
            }

            winData[type][index] = mensaje;
            await redis.set(winKey, winData);
            return NextResponse.json({ success: true });
        }

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

        items[itemIndex].mensaje = mensaje;

        // 3. Save
        await redis.hset(storeKey, { [date]: JSON.stringify(items) });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
