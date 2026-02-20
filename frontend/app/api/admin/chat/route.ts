import { NextResponse } from 'next/server';
import { getRawMatches, trackAIUsage, redis } from '@/lib/server-utils';

export async function POST(req: Request) {
    try {
        const { message, history, date, isTikTok, userId, includeContext = false, isPro = false } = await req.json();

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "API Key no detectada" }, { status: 500 });
        }

        // --- CONTROL DE PRESUPUESTO (Solo para no-PRO) ---
        if (!isPro) {
            const today = new Date().toISOString().split('T')[0];
            const dailyUserKey = `betai:ai_user_stats:${userId}:${today}`;
            const dailyCost: number = await redis.hget(dailyUserKey, "cost") || 0;

            if (dailyCost >= 0.10) {
                return NextResponse.json({
                    error: "Limite diario alcanzado",
                    content: "Has alcanzado el límite de análisis gratuitos por hoy (0.10$). Vuelve mañana o contacta con el administrador para acceso PRO."
                }, { status: 403 });
            }
        }

        // --- PASO 1: ROUTER INTELIGENTE ---
        if (!includeContext) {
            const routerSystemPrompt = `Eres "BET AI ASSISTANT". 
            Tu objetivo es ahorrar tokens. 
            Analiza el mensaje del usuario y decide:
            1. Si es un saludo, una pregunta sobre tus capacidades o algo general que NO requiere ver partidos específicos, RESPONDE DIRECTAMENTE de forma breve.
            2. Si el usuario pide analizar partidos, cuotas, predicciones o algo que requiera ver la base de datos de hoy o mañana, responde ÚNICAMENTE con la palabra: "NEED_CONTEXT_DATA".`.trim();

            const routerContents = [
                { role: 'user', parts: [{ text: routerSystemPrompt }] },
                ...history.slice(-3).map((msg: any) => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                })),
                { role: 'user', parts: [{ text: message }] }
            ];

            const routerResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: routerContents }),
                }
            );

            const routerResult = await routerResponse.json();
            const firstChoice = routerResult.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (firstChoice.includes("NEED_CONTEXT_DATA")) {
                return NextResponse.json({ action: "NEED_CONTEXT_DATA" });
            }

            const usage = routerResult.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
            await trackAIUsage(usage.promptTokenCount, usage.candidatesTokenCount, isTikTok ? "TikTok (Tomorrow)" : "Standard (Today)", userId);

            return NextResponse.json({
                content: firstChoice,
                usage: { prompt: usage.promptTokenCount, completion: usage.candidatesTokenCount }
            });
        }

        // --- PASO 2: ANÁLISIS REAL ---
        const targetDate = date || new Date().toISOString().split('T')[0];
        const rawMatchesJson = await getRawMatches(targetDate, isTikTok);

        if (!rawMatchesJson) {
            return NextResponse.json({
                error: `No hay datos brutos para la fecha ${targetDate}.`
            }, { status: 404 });
        }

        const contextString = typeof rawMatchesJson === 'string'
            ? rawMatchesJson
            : JSON.stringify(rawMatchesJson, null, 2);

        const systemPrompt = `
ERES "BET AI ASSISTANT", EXPERTO EN ANÁLISIS ESTADÍSTICO DEPORTIVO (FECHA: ${targetDate}).

TU MISIÓN:
Proporcionar picks de alta fidelidad basados en datos. Cada sugerencia debe ser quirúrgica y bien fundamentada.

REGLAS DE FORMATO (ESTRICTAS):
1. **PROHIBIDO EL USO DE "###"**: No uses hashtags para títulos. Usa **MAYÚSCULAS EN NEGRITA** para separar secciones.
2. **ESTRUCTURA DE CADA PARTIDO**:
   - Título: **LIGA - PARTIDO**
   - Una lista con " * " para cada mercado sugerido.
   - Cada mercado debe incluir: **Selección (Cuota)** + explicación estadística breve.
3. **BLOQUE DE RESUMEN FINAL**:
   Al final de tu respuesta, añade siempre un bloque de resumen con este formato exacto:
   **💰 RESUMEN DE LA APUESTA**
   * [Selección 1] ([Cuota 1])
   * [Selección 2] ([Cuota 2])
   * **CUOTA TOTAL: [Valor multiplicador]**

4. **RESPETO POR LA CANTIDAD (CRÍTICO)**:
   - Si el usuario pregunta por "la más clara", "el mejor pick", "solo un partido" o utiliza el singular, DEBES elegir únicamente el partido con mayor Win Rate y responder SOLO sobre ese. PROHIBIDO dar listas de varios partidos si se pide el mejor.

5. **INTELIGENCIA PROACTIVA (Uso de Contexto)**:
   - Si el equipo o liga solicitado **NO** está en los datos:
     1. Informa brevemente: "No tengo datos para el [Equipo] hoy".
     2. **APROVECHA EL CONTEXTO**: Como ya has leído el JSON, busca 2 o 3 partidos interesantes que **SÍ** estén disponibles (prioriza la misma liga o partidos de alto nivel).
     3. Sugiere esas alternativas de forma específica: "Pero hoy juegan el **Liverpool vs Arsenal** y el **Chelsea vs Spurs**. ¿Te gustaría que analice alguno de estos partidos por ti?"
     4. Espera la respuesta del usuario antes de realizar el análisis profundo de las alternativas.

6. **ESTILO**:
   - Usa **negrita** para resaltar equipos, cuotas y porcentajes.
   - Sé directo pero mantén la lógica estadística que sustenta el pick.

DATOS DISPONIBLES:
${contextString}
`.trim();

        const fullContents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...history.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        const finalResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: fullContents }),
            }
        );

        const result = await finalResponse.json();
        const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text || "No hay análisis disponible.";

        const usage = result.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
        await trackAIUsage(usage.promptTokenCount, usage.candidatesTokenCount, isTikTok ? "TikTok (Tomorrow)" : "Standard (Today)", userId);

        return NextResponse.json({
            content: aiText,
            usage: {
                prompt: usage.promptTokenCount,
                completion: usage.candidatesTokenCount
            }
        });

    } catch (error: any) {
        console.error("[CHAT-API] Error:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
