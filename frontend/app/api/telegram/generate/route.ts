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

        // 1. Fetch Daily Analysis & Stakazo
        // Parallel Fetch
        const [rawData, rawStakazo] = await Promise.all([
            redis.hget(`betai:daily_bets:${monthStr}`, targetDate),
            redis.hget(`betai:daily_bets_stakazo:${monthStr}`, targetDate)
        ]);

        // Fallback or Parse Standard Bets
        let bets: any[] = [];
        if (rawData) {
            const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (Array.isArray(parsed)) {
                bets = parsed;
            } else if (parsed && parsed.bets && Array.isArray(parsed.bets)) {
                bets = parsed.bets;
            }
        } else {
            // ... legacy fallback logic for standard bets check ...
            if (targetDate === todayStr) {
                const masterData: any = await redis.get('betai:daily_bets');
                if (masterData) {
                    const parsedMaster = typeof masterData === 'string' ? JSON.parse(masterData) : masterData;
                    if (parsedMaster && parsedMaster.bets) bets = parsedMaster.bets;
                }
            }
        }

        // Parse Stakazo Bets and Merge
        if (rawStakazo) {
            const parsedS = typeof rawStakazo === 'string' ? JSON.parse(rawStakazo) : rawStakazo;
            let sBets: any[] = [];
            if (Array.isArray(parsedS)) sBets = parsedS;
            else if (parsedS && parsedS.bets) sBets = parsedS.bets;

            // Force betType 'stakazo' and merge
            sBets.forEach(b => b.betType = 'stakazo');
            bets = [...bets, ...sBets];
        }

        if (!bets || bets.length === 0) {
            return NextResponse.json({ success: false, error: 'No bets found to generate messages.' }, { status: 404 });
        }

        // 2. Format Messages
        const telegramItems: any[] = [];

        const typeMap: Record<string, { icon: string, title: string }> = {
            "safe": { icon: "🛡️", title: "LA APUESTA SEGURA" },
            "value": { icon: "⚡", title: "LA APUESTA DE VALOR" },
            "funbet": { icon: "💣", title: "LA FUNBET" },
            "stakazo": { icon: "‼️", title: "STAKAZO" }
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

            // Determine Time Context (Tarde vs Noche)
            let timeContext = "noche";
            if (selections && selections.length > 0 && selections[0].time) {
                const tStr = selections[0].time;
                const timePart = tStr.includes(' ') ? tStr.split(' ')[1] : tStr;
                const [hStr] = timePart.split(':');
                const h = parseInt(hStr);
                // User logic: < 21:00 -> tarde, >= 21:00 -> noche.
                // Assuming standard 24h format
                if (!isNaN(h) && h < 21) {
                    timeContext = "tarde";
                }
            }

            // 4. Construct Message(s)

            if (bType === 'stakazo') {
                // SPECIAL FORMAT FOR STAKAZO - 2 MESSAGGER: PROMO & BET

                // --- 1. PROMO MESSAGE ---
                // No analysis needed here? Usually promo is pure hype.
                const promoMsg = `‼️ STAKAZO ${stakeVal} CUOTA ${bet.total_odd || 1.0} ‼️\n\n` +
                    `➡️ Para esta ${timeContext} voy con un puto stakazo ${stakeVal} con el que vamos a ganar dinero seguro, espero veros a todos dentro que vamos a repetir el dia de ayer.\n\n` +
                    `⚡ Os dejo esta bomba, esta ${timeContext} vamos a forrarnos 💸\n\n` +
                    `📊 Stake ${stakeVal} cuota ${bet.total_odd || 1.0}\n` +
                    `🔒 Incluye seguro antifallo\n` +
                    `🏠 Está en todas las casas\n\n` +
                    `👇 Háblame para poder adquirir el STAKAZO\n\n` +
                    `@BetAi_Master`;

                telegramItems.push({
                    id: crypto.randomUUID(),
                    tipo: "STAKAZO (PROMO)",
                    bet_type_key: bType,
                    enviado: false,
                    mensaje: promoMsg,
                    timestamp: new Date().toISOString()
                });

                // --- 2. BET MESSAGE (SCREENSHOT STYLE) ---
                // Format:
                // 🔥 STAKAZO {stake} 🔥
                // Match
                // Pick
                // Stats + Betting House + Analysis

                const betMsg = `🔥 STAKAZO ${stakeVal} 🔥\n\n` +
                    `${matchesBlock}\n\n` + // Matches block already has icons ⚽/👉
                    `📊 Cuota ${bet.total_odd || 1.0}   | 📈 STAKE ${stakeVal}\n` +
                    `🏠 Apuesta realizada en Bet365\n` +
                    `<u>🔞 Apuesta con responsabilidad.</u>\n\n` +
                    `🧠 <b>Análisis de BetAiMaster:</b>\n` +
                    `<blockquote>${formattedReason}</blockquote>`;

                telegramItems.push({
                    id: crypto.randomUUID(),
                    tipo: "STAKAZO (APUESTA)",
                    bet_type_key: bType,
                    enviado: false,
                    mensaje: betMsg,
                    timestamp: new Date().toISOString() // same timestamp is fine?
                });

            } else {
                // STANDARD FORMAT (SINGLE MESSAGE)
                const msg = `${leagueText}\n\n` +
                    `${matchesBlock}\n\n` +
                    `📊 Cuota ${bet.total_odd || 1.0}   | 📈 STAKE ${stakeVal}\n` +
                    `🏠 Apuesta realizada en Bet365\n` +
                    `<u>🔞 Apuesta con responsabilidad.</u>\n\n` +
                    `🧠 <b>Análisis de BetAiMaster:</b>\n` +
                    `<blockquote>${formattedReason}</blockquote>`;

                telegramItems.push({
                    id: crypto.randomUUID(),
                    tipo: info.title.replace("LA ", ""),
                    bet_type_key: bType,
                    enviado: false,
                    mensaje: msg,
                    timestamp: new Date().toISOString()
                });
            }
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

        // 5. Generate 3 "Buenos Días" Intelligent Versions
        const daysMap: Record<string, string> = {
            "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
            "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
        };
        const dayName = daysMap[new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Europe/Madrid' }).format(now)] || "hoy";

        const hasChampions = bets.some(b => b.selections?.some((s: any) => s.league?.toLowerCase().includes('champions')));
        const importantMatches = bets.slice(0, 2).map(b => b.match).join(', ');

        const morningVersions = [
            `☕ <b>¡BUENOS DÍAS FAMILIA!</b>☀️\n\n` +
            `👦 Vamos a por el ${dayName} haciendo dinero como debe ser, el equipo ha analizado los mejores mercados y ya tenemos lista la selección de hoy.‼️\n\n` +
            `📊 ${hasChampions ? "¡Hoy hay noche de Champions y no vamos a perdonar! Tenemos partidazos con mucho valor analizado. ⚽🔥" : "Hoy hay auténticos partidazos, tenemos mercado completo de ligas con mucho valor que tengo ya analizado. ✅‼️"}\n\n` +
            `📲 No os podéis perder el día de hoy, activen notificaciones 🔔✅`,

            `☕ <b>¡BUENOS DÍAS EQUIPO!</b>☀️\n\n` +
            `👦 Seguimos la semana ganando dinero, vaya día tenemos hoy... Vamos con todo en este ${dayName}. Os va a encantar lo que se viene.‼️\n\n` +
            `📊 ${hasChampions ? "Empieza la Champions y tengo claro que va a salir redondo, vamos a hacer dinero fácil como nosotros sabemos. 🏆🔥" : "La jornada de hoy viene cargada de oportunidades claras y la IA ha detectado movimientos de mercado muy interesantes. 📈✅"}\n\n` +
            `📲 No os podéis perder lo que viene hoy, activen notificaciones 🔔🚀`,

            `☕ <b>¡BUENOS DÍAS A TODOS!</b>☀️\n\n` +
            `👦 Arrancamos el ${dayName} con la mente fría y los objetivos claros. Todos atentos al móvil a lo que se viene hoy.‼️\n\n` +
            `📊 ${hasChampions ? "Noche de gala con la Champions League, jornada analizada al detalle para reventar el mercado. 💣✅" : "Tenemos una jornada con mucho potencial, mercado estudiado y listo para empezar en breves momentos. ‼️🔥"}\n\n` +
            `📲 No os podéis perder la jornada de hoy, activen notificaciones 🔔✨`
        ];

        await redis.set(`betai:morning_messages:${targetDate}`, morningVersions);

        // 6. Generate 5 Victory Versions for 4 types (Stake 1, 4, 5, Stakazo)
        const getWinVersions = (type: string, stake: number, odd: number, mesUnidades: number) => {
            const tag = type === 'stakazo' ? `STAKAZO ${stake}` : `STAKE ${stake}`;
            const header = `✅✅ <b>${tag} ACERTADO</b> ✅✅`;
            const profitStr = mesUnidades > 0 ? `Llevamos +${mesUnidades} unidades este mes 📈` : "Seguimos sumando unidades este mes 📈";
            const oddStr = `<b>Cuota ${odd.toFixed(2)}</b>`;

            if (type === 'stakazo') {
                return [
                    `${header}\n\n` +
                    `✅ <b>¡QUE FÁCIL PARA DENTRO!</b> ✅\n` +
                    `Para dentro la apuesta familiar, una mejor lectura era imposible para volver a ganar dinero de forma fácil. ¡Cazada esa ${oddStr} al milímetro! 🤑💰`,

                    `${header}\n\n` +
                    `✅✅ <b>¡LO TENÍA MUY CLARO!</b> ✅✅\n` +
                    `Pues nada os avisé, tenía el trabajo hecho para este partido y como recompensa acertamos esta ${oddStr} muy fácil. Seguid confiando, esto es así. 👑‼️`,

                    `${header}\n\n` +
                    `✅ <b>¡LECTURA MUY TOP!</b> ✅\n` +
                    `Para dentro la apuesta de hoy, lectura perfecta que nos hace seguir generando bank. ${profitStr}. ¡Vamos a por más! 🎯💸`,

                    `${header}\n\n` +
                    `🔥 <b>¡EXPLOSIÓN DE VERDE!</b> 🔥\n` +
                    `Dije que esta noche nos forrábamos y no he mentido. Otra masterclass de lectura deportiva con ${oddStr} para la saca. ¡A CELEBRARLO! 🥂‼️`,

                    `${header}\n\n` +
                    `🏦 <b>¡VISITA AL BANCO!</b> 🏦\n` +
                    `Señores, esto ya es costumbre. Cerramos el Stakazo con un beneficio brutal. Quien me sigue gana, así de simple. ¡A cobrar esa ${oddStr}! 🤑✅`
                ];
            }

            return [
                `${header}\n\n` +
                `✅ <b>¡SUMA Y SIGUE!</b> ✅\n` +
                `Ahí está muchachos, ${tag.toLowerCase()}, cobrada esa ${oddStr}. Quien no gana dinero es porque no quiere... ¡PARA DENTRO! 🤑‼️`,

                `${header}\n\n` +
                `✅ <b>¡LECTURA IMPECABLE!</b> ✅\n` +
                `Muchachos que locura, un verdazo señores para cerrar la jornada con ${oddStr}. Esto no va a parar, ${profitStr} 🤑‼️`,

                `${header}\n\n` +
                `✅ <b>¡SI SI SI Y OTRA MAAAAS!</b> ✅\n` +
                `Para dentro la apuesta que la tenía muy muy clara. Ha tardado en entrar pero era un verde seguro a ${oddStr}. ¡La fiesta no para! 🤑‼️`,

                `${header}\n\n` +
                `📈 <b>OTRA MÁS A LA SACA</b> 📈\n` +
                `Otro acierto más para la saca. Gestión de bank perfecta y lectura impecable de esta ${oddStr}. ¡Seguimos con el plan! ✅💪`,

                `${header}\n\n` +
                `💎 <b>¡JOYA DEL DÍA!</b> 💎\n` +
                `Verdazo limpio y sin sufrir demasiado con esa ${oddStr}. Así es como se trabaja aquí. ${profitStr}. ¡Atentos a lo que viene! 🔥💰`
            ];
        };

        const winMessages: Record<string, string[]> = {
            stake1: [],
            stake4: [],
            stake5: [],
            stakazo: []
        };

        // Get monthly profit for variables
        let monthlyProfit = 0;
        let stakazoProfit = 0;
        try {
            const [statsRaw, stakazoStatsRaw]: any = await Promise.all([
                redis.hget('betai_stats', monthStr),
                redis.hget('betai:stats_stakazo', monthStr)
            ]);

            if (statsRaw) {
                const stats = typeof statsRaw === 'string' ? JSON.parse(statsRaw) : statsRaw;
                monthlyProfit = stats.total_profit || 0;
            }
            if (stakazoStatsRaw) {
                const statsS = typeof stakazoStatsRaw === 'string' ? JSON.parse(stakazoStatsRaw) : stakazoStatsRaw;
                stakazoProfit = statsS.total_profit || 0;
            }
        } catch (e) {
            console.error("Error fetching stats for victory messages:", e);
        }

        const findBet = (stake: number, isStakazo = false) => {
            return bets.find(b => {
                const bStake = Math.floor(parseFloat(b.stake) || 0);
                const bType = (b.betType || '').toLowerCase();
                if (isStakazo) return bType === 'stakazo';
                return bStake === stake && bType !== 'stakazo';
            });
        };

        const stakesToGen = [1, 4, 5];
        stakesToGen.forEach(s => {
            const b = findBet(s);
            winMessages[`stake${s}`] = getWinVersions(`stake${s}`, s, b?.total_odd || 1.80, monthlyProfit);
        });

        const sBet = findBet(0, true);
        const sStake = Math.floor(parseFloat(sBet?.stake) || 30);
        winMessages.stakazo = getWinVersions('stakazo', sStake, sBet?.total_odd || 2.50, stakazoProfit);

        await redis.set(`betai:win_messages:${targetDate}`, winMessages);

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
