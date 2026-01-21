import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis directly
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date } = body;

        // Default to today if no date provided
        // Use Europe/Madrid time to match system behavior
        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid'
        }).format(now);

        const targetDate = date || todayStr;
        const monthStr = targetDate.substring(0, 7); // YYYY-MM

        console.log(`[API-TS] Generating Telegram Messages for ${targetDate}...`);

        // 1. Fetch Daily Analysis
        // Try Hash first: betai:daily_bets:YYYY-MM -> YYYY-MM-DD
        let rawData: any = await redis.hget(`betai:daily_bets:${monthStr}`, targetDate);

        // Fallback or Parse
        let bets: any[] = [];
        if (rawData) {
            // Upstash usually returns object if stored as JSON, but let's be safe
            const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

            if (Array.isArray(parsed)) {
                bets = parsed;
            } else if (parsed && parsed.bets && Array.isArray(parsed.bets)) {
                bets = parsed.bets;
            }
        } else {
            console.warn(`[API-TS] No bets found for ${targetDate} in Hash, checking legacy key...`);
            // Fallback to daily_bets specific key if specific date matches logic (rare with new system)
            // But let's check Master Key if request is for TODAY
            if (targetDate === todayStr) {
                const masterData: any = await redis.get('betai:daily_bets');
                if (masterData) {
                    const parsedMaster = typeof masterData === 'string' ? JSON.parse(masterData) : masterData;
                    if (parsedMaster && parsedMaster.bets) bets = parsedMaster.bets;
                }
            }
        }

        if (!bets || bets.length === 0) {
            return NextResponse.json({ success: false, error: 'No bets found to generate messages.' }, { status: 404 });
        }

        // 2. Format Messages
        const telegramItems: any[] = [];

        const typeMap: Record<string, { icon: string, title: string }> = {
            "safe": { icon: "🛡️", title: "LA APUESTA SEGURA" },
            "value": { icon: "⚡", title: "LA APUESTA DE VALOR" },
            "funbet": { icon: "💣", title: "LA FUNBET" }
        };

        const sportIcons: Record<string, string> = {
            "football": "⚽", "basketball": "🏀", "tennis": "🎾", "default": "🏅"
        };

        bets.forEach(bet => {
            const bType = (bet.betType || "safe").toLowerCase();
            const info = typeMap[bType] || typeMap["safe"];
            const selections = bet.selections || [];

            // 1. League Header
            const uniqueLeagues = Array.from(new Set(selections.map((s: any) => s.league || 'Desconocida')));
            let leagueText = uniqueLeagues.length === 1 ? `🏆 ${uniqueLeagues[0]}` : "🏆 Varios Torneos";

            // 2. Selections Block
            const matchesLines = selections.map((sel: any) => {
                const sport = (sel.sport || 'football').toLowerCase();
                const icon = sportIcons[sport] || sportIcons["default"];
                const matchName = sel.match || 'Unknown';
                const pick = sel.pick || 'Pick';

                return `${icon} ${matchName}\n👉🏼 ${pick}`;
            });

            let matchesBlock = matchesLines.join("\n\n");
            if (!matchesBlock) matchesBlock = "No picks data.";

            // Format Analysis Text
            const rawReason = bet.reason || bet.analysis || 'Sin análisis';
            let formattedReason = rawReason;

            if (rawReason.length > 30 && rawReason.includes('.')) {
                const segments = rawReason.split('.').map((s: string) => s.trim()).filter((s: string) => s.length > 3);
                if (segments.length > 0) {
                    formattedReason = segments.map((seg: string) => {
                        return seg.endsWith('.') ? `🟢 ${seg}` : `🟢 ${seg}.`;
                    }).join("\n\n");
                }
            }

            // 3. Construct Message
            const msg = `${leagueText}\n\n` +
                `${matchesBlock}\n\n` +
                `📊 Cuota ${bet.total_odd || 1.0}   | 📈 STAKE ${bet.stake || 1}\n` +
                `🏠 Apuesta realizada en Bet365\n` +
                `🔞 Apuesta con responsabilidad.\n\n` +
                `🧠 *Análisis de BetAiMaster:*\n` +
                `${formattedReason}`;

            const item = {
                id: crypto.randomUUID(),
                tipo: info.title.replace("LA ", ""),
                bet_type_key: bType,
                enviado: false,
                mensaje: msg,
                timestamp: new Date().toISOString()
            };
            telegramItems.push(item);
        });

        // 3. Monthly Stats Report (Auto-include)
        try {
            const statsKey = `betai:stats:${monthStr}`; // betai:stats:YYYY-MM
            // Check key name in recalculate-stats: `betai:stats:${month}` -> yes
            const statsRaw: any = await redis.get(statsKey);

            if (statsRaw) {
                const stats = typeof statsRaw === 'string' ? JSON.parse(statsRaw) : statsRaw;
                const totalProfit = stats.total_profit || 0;

                const iconProfit = totalProfit >= 0 ? "✅" : "🔻";
                // Month Name in Spanish
                // We can't rely on server locale to be Spanish, so we might map manually or try 'es-ES'
                const monthName = new Date(targetDate).toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

                const msg = `📊 *REPORTE MENSUAL - ${monthStr}* 📊\n\n` +
                    `${iconProfit} *Profit:* ${totalProfit} u\n` +
                    `📈 *Yield:* ${stats.yield || 0}%\n` +
                    `🎯 *Win Rate:* ${stats.win_rate || 0}%\n` +
                    `📅 *Días Operados:* ${stats.days_operated || 0}\n\n` +
                    `🧠 *BetAiMaster Analytics*`;

                const statsItem = {
                    id: crypto.randomUUID(),
                    tipo: "REPORTE MENSUAL",
                    bet_type_key: "monthly_report",
                    enviado: false,
                    mensaje: msg,
                    timestamp: new Date().toISOString()
                };
                telegramItems.push(statsItem); // Add to end or beginning? Python added to end.
                console.log(`[API-TS] Added Monthly Report for ${monthStr}`);
            }
        } catch (e) {
            console.warn("[API-TS] Failed to fetch/parse monthly stats", e);
        }

        // 4. Store in Telegram Queue
        const storeKey = "betai:telegram_store";

        // Retention Logic (Max 2 days)
        // Get all fields to check dates
        const currentStoreRaw: any = await redis.hgetall(storeKey); // Returns object { date: itemJson, date2: ... }

        let currentDates: string[] = [];
        if (currentStoreRaw) {
            currentDates = Object.keys(currentStoreRaw).sort(); // sort chronological
        }

        // Remove old if > 2 (keeping 2, so if we add 1 new, we must have at most 1 existing distinct from this one)
        // Logic: if we have [D1, D2] and we add D3 -> remove D1. Result [D2, D3].
        // If we update D2 -> [D1, D2] -> no change.
        if (currentDates.length >= 2 && !currentDates.includes(targetDate)) {
            while (currentDates.length >= 2) {
                const oldest = currentDates[0];
                await redis.hdel(storeKey, oldest);
                console.log(`[API-TS] Retention Cleanup: Removed ${oldest}`);
                currentDates.shift();
            }
        }

        // Save
        const payloadJson = JSON.stringify(telegramItems);
        await redis.hset(storeKey, { [targetDate]: payloadJson });

        console.log(`[API-TS] Success. Saved ${telegramItems.length} messages for ${targetDate}.`);

        return NextResponse.json({ success: true, message: 'Generated successfully' });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
