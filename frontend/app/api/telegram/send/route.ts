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
        // Actually, the user might want this integrated. But primarily we are modifying the existing flow.
        // Wait, the previous logic requires 'date' and 'id' to find item in Redis.
        // If we want a "General" section that doesn't rely on Redis daily items, we need to bypass steps 1 & 2.

        // Let's check if the request is a "direct send" request (e.g. from General tab)
        if (body.type === 'static_photo' && body.filename) {
            // DIRECT SEND LOGIC
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;

            if (!botToken || !chatId) return NextResponse.json({ error: 'Telegram config missing' }, { status: 500 });

            // Dynamic import for server-side file reading
            const fs = require('fs');
            const path = require('path');

            const filePath = path.join(process.cwd(), 'public', 'assets', 'telegram', body.filename);
            if (!fs.existsSync(filePath)) {
                return NextResponse.json({ error: `File not found: ${body.filename}` }, { status: 404 });
            }

            const fileBuffer = fs.readFileSync(filePath);

            const formData = new FormData();
            formData.append('chat_id', chatId);
            // Blob is needed for FormData in Node environment usually, or correct headers.
            const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
            formData.append('photo', fileBlob, body.filename);

            try {
                // 1. Send the Photo (without caption)
                const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    body: formData
                });
                const tgData = await tgRes.json();

                if (!tgData.ok) {
                    console.error("Telegram Photo Error:", tgData);
                    return NextResponse.json({ error: tgData.description }, { status: 502 });
                }

                // 2. Send the Caption as a separate message (if exists)
                if (body.caption) {
                    const msgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: body.caption,
                            parse_mode: 'HTML'
                        })
                    });
                    const msgData = await msgRes.json();
                    if (!msgData.ok) {
                        console.warn("Telegram Caption Message Error:", msgData);
                    }
                }

                return NextResponse.json({ success: true, sent_at: new Date().toISOString() });
            } catch (e) {
                return NextResponse.json({ error: 'Network error sending content' }, { status: 502 });
            }
        }

        // --- RAW TEXT SUPPORT ---
        if (body.type === 'raw_text' && body.text) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;
            if (!botToken || !chatId) return NextResponse.json({ error: 'Telegram config missing' }, { status: 500 });

            const msgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: body.text,
                    parse_mode: 'HTML'
                })
            });
            const msgData = await msgRes.json();
            if (!msgData.ok) {
                return NextResponse.json({ error: msgData.description }, { status: 502 });
            }
            return NextResponse.json({ success: true, sent_at: new Date().toISOString() });
        }

        // --- EXISTING REDIS LOOKUP LOGIC (Only if NOT static_photo) ---
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

        // Handle "includeAnalysis" flag
        const includeAnalysis = body.includeAnalysis !== false; // Default true

        if (!includeAnalysis) {
            const parts = messageText.split('🧠');
            if (parts.length > 1) {
                messageText = parts[0].trim();
            }
        }

        // 4. Send to Telegram API (TEXT)
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            return NextResponse.json({ error: 'Server configuration error: Telegram credentials missing' }, { status: 500 });
        }

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
