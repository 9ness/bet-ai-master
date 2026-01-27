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

            // 2. Selections Block (Grouped by Match)
            const groupedSelections: Record<string, any[]> = {};
            const matchOrder: string[] = [];

            selections.forEach((sel: any) => {
                const matchName = sel.match || 'Evento Desconocido';
                if (!groupedSelections[matchName]) {
                    groupedSelections[matchName] = [];
                    matchOrder.push(matchName);
                }
                groupedSelections[matchName].push(sel);
            });

            const matchesLines: string[] = [];

            matchOrder.forEach(mName => {
                const groupedSels = groupedSelections[mName];
                const sport = (groupedSels[0].sport || 'football').toLowerCase();
                const icon = sportIcons[sport] || sportIcons["default"];

                // Add Header (Match Name)
                matchesLines.push(`${icon} ${mName}`);

                // Add Picks
                groupedSels.forEach(s => {
                    matchesLines.push(`👉🏼 ${s.pick || 'Pick'}`);
                });

                // Add spacer if not last
                // matchesLines.push(""); 
            });

            // Join with single newlines, but we want gaps between matches?
            // actually above push logic adds lines sequentially. 
            // Let's join with "\n" but insert an empty line between groups in the loop?
            // Simpler: Map each group to a block, then join blocks.

            const matchBlocks = matchOrder.map(mName => {
                const groupedSels = groupedSelections[mName];
                const sport = (groupedSels[0].sport || 'football').toLowerCase();
                const icon = sportIcons[sport] || sportIcons["default"];

                const picksLines = groupedSels.map(s => `👉🏼 ${s.pick}`);
                return `${icon} ${mName}\n${picksLines.join('\n')}`;
            });

            let matchesBlock = matchBlocks.join("\n\n");
            if (!matchesBlock) matchesBlock = "No picks data.";

            // Format Analysis Text
            const rawReason = bet.reason || bet.analysis || 'Sin análisis';

            // 1. Pre-process: Clean asterisks and replace technical terms
            let cleanReason = rawReason.replace(/\*/g, '').replace(/BTTS/gi, 'ambos marcan');

            // 2. Robust Splitting into 3 main blocks (Anchors 1. 2. 3.)
            // We look for "1. ", "2. ", "3. " at the start of original lines or after a dot/space
            const pointsRegex = /(?:\n|\r|\. |^)(1\.|2\.|3\.)\s+/g;
            let matches = [];
            let match;
            while ((match = pointsRegex.exec(cleanReason)) !== null) {
                matches.push({
                    num: match[1],
                    index: match.index + (match[0].length - match[1].length - 1), // Adjust to point to the start of "N. "
                    fullMatchLength: match[0].length
                });
            }

            // Refined extraction to ensure we don't catch "1.83" indoors
            // Actually, let's use a simpler logic for split since points are usually well defined
            const finalLines: string[] = [];
            let formattedReason = '';

            if (matches.length > 0) {
                matches.forEach((m, i) => {
                    const startPos = m.index + m.num.length + 1;
                    const endPos = (i + 1 < matches.length) ? matches[i + 1].index : cleanReason.length;
                    let content = cleanReason.substring(startPos, endPos).trim();
                    if (content) {
                        content = content.replace(/[\r\n]+/g, ' ').replace(/\s\s+/g, ' ');

                        // Logic to bold the title (up to the colon)
                        const titleMatch = content.match(/^([^:]+:)(.*)/);
                        if (titleMatch) {
                            const title = titleMatch[1];
                            const rest = titleMatch[2];
                            finalLines.push(`🟢 <b>${m.num} ${title}</b>${rest}`);
                        } else {
                            finalLines.push(`🟢 <b>${m.num}</b> ${content}`);
                        }
                    }
                });
                formattedReason = finalLines.join("\n\n");
            } else {
                formattedReason = `🟢 ${cleanReason.replace(/[\r\n]+/g, ' ').trim()}`;
            }

            // 3. Stake formatting (ensure integer)
            const stakeVal = Math.floor(parseFloat(bet.stake) || 1);

            // 4. Construct Message
            const msg = `${leagueText}\n\n` +
                `${matchesBlock}\n\n` +
                `📊 Cuota ${bet.total_odd || 1.0}   | 📈 STAKE ${stakeVal}\n` +
                `🏠 Apuesta realizada en Bet365\n` +
                `<u>🔞 Apuesta con responsabilidad.</u>\n\n` +
                `🧠 <b>Análisis de BetAiMaster:</b>\n` +
                `<blockquote>${formattedReason}</blockquote>`;

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

                const msg = `📊 <b>REPORTE MENSUAL - ${monthStr}</b> 📊\n\n` +
                    `${iconProfit} <b>Profit:</b> ${totalProfit} u\n` +
                    `📈 <b>Yield:</b> ${stats.yield || 0}%\n` +
                    `🎯 <b>Win Rate:</b> ${stats.win_rate || 0}%\n` +
                    `📅 <b>Días Operados:</b> ${stats.days_operated || 0}\n\n` +
                    `🧠 <b>BetAiMaster Analytics</b>`;

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
