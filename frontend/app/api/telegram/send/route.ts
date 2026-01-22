import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, id } = body;

        if (!date || !id) {
            return NextResponse.json({ error: 'Missing date or id' }, { status: 400 });
        }

        const prefix = process.env.REDIS_PREFIX || 'betai:';
        const storeKey = `${prefix}telegram_store`;

        // 1. Get data for the specific date
        const dateData = await redis.hget(storeKey, date) as string | null;

        if (!dateData) {
            return NextResponse.json({ error: 'Date not found in store' }, { status: 404 });
        }

        // 2. Find the specific message item
        let items: any[] = [];
        try {
            items = typeof dateData === 'string' ? JSON.parse(dateData) : dateData;
        } catch (e) {
            return NextResponse.json({ error: 'Corrupt data in store' }, { status: 500 });
        }

        const itemIndex = items.findIndex((i: any) => i.id === id);
        if (itemIndex === -1) {
            return NextResponse.json({ error: 'Message ID not found' }, { status: 404 });
        }

        const item = items[itemIndex];

        if (item.enviado) {
            return NextResponse.json({ message: 'Message already sent', success: true });
        }

        // 3. Prepare Message Content
        let messageText = item.mensaje;

        // Handle "includeAnalysis" flag (default true if undefined, but frontend sends false)
        // Check body.includeAnalysis
        const includeAnalysis = body.includeAnalysis !== false; // Default true

        if (!includeAnalysis) {
            // Strip analysis part. It usually starts with "🧠 <b>Análisis de BetAiMaster:</b>"
            // We splits by the brain emoji if present.
            const parts = messageText.split('🧠');
            if (parts.length > 1) {
                messageText = parts[0].trim();
            }
        }

        // 4. Send to Telegram API
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            return NextResponse.json({ error: 'Server configuration error: Telegram credentials missing' }, { status: 500 });
        }

        // Use standard fetch to call Telegram Bot API
        try {
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: messageText,
                    parse_mode: 'HTML'
                })
            });

            const tgData = await tgRes.json();

            if (!tgData.ok) {
                console.error("Telegram API Error:", tgData);
                return NextResponse.json({
                    error: 'Failed to send to Telegram',
                    details: tgData.description
                }, { status: 502 });
            }
        } catch (netError) {
            console.error("Network Error calling Telegram:", netError);
            return NextResponse.json({ error: 'Network error contacting Telegram' }, { status: 502 });
        }

        // 4. Update status in Redis
        items[itemIndex].enviado = true;

        // Save back to Hash
        await redis.hset(storeKey, { [date]: JSON.stringify(items) });

        return NextResponse.json({ success: true, sent_at: new Date().toISOString() });

    } catch (error) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
