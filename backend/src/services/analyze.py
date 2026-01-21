import sys
import os
import json
import time
import math
from datetime import datetime, timedelta

# Importamos la nueva SDK de Google (requiere: pip install google-genai)
from google import genai
from google.genai import types

# Path setup
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.bet_formatter import BetFormatter


def analyze():
    print("--- REANALYSIS SCRIPT STARTED (ANALYZE2 - PROMPT MAESTRO + SEARCH v3) ---")
    
    # 1. Inicialización de Servicios
    try:
        rs = RedisService()
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY no encontrada en variables de entorno")
            
        client = genai.Client(api_key=api_key)
        model_name = 'gemini-3-pro-preview'
        
    except Exception as e:
        print(f"[FATAL] Service Init Failed: {e}")
        return

    # 2. Obtención de datos
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # NEW: Fetch from Monthly Hash via RedisService
    raw_json = rs.get_raw_matches(today_str)
    
    # Fallback to old keys just in case (Migration Safety, though user said data is migrated)
    if not raw_json:
        raw_key = f"betai:raw_matches:{today_str}"
        raw_json = rs.get(raw_key) or rs.get(f"raw_matches:{today_str}")
    
    if not raw_json:
        print(f"[ERROR] No raw matches found for {today_str}.")
        return

    raw_matches = json.loads(raw_json)
    fixture_map = {str(m.get("id")): m for m in raw_matches if m.get("id")}

    # 3. PROMPT ORIGINAL
    base_prompt = f"""
            Estás operando en modo Risk Manager & Pro Tipster Multi-Sport (Football & Basketball/NBA).
            Tu objetivo es analizar los datos proporcionados y generar las 3 mejores apuestas del día (SAFE, VALUE, FUNBET).

            IMPORTANTE: Tienes datos de Fútbol y de Baloncesto (NBA/Europa). Evalúa AMBOS deportes por igual. No ignores los partidos de madrugada si presentan mejores oportunidades que el fútbol.

            INSTRUCCIONES DE ANÁLISIS TÉCNICO (NIVEL PRO ANALYTICS):
            1. SÍNTESIS DE FÚTBOL (CORRELACIÓN Y PRESIÓN): 
               - Dinámica Ofensiva: Evalúa la correlación entre el volumen de remates (ID 87) y la generación de saques de esquina (ID 45). Determina si el estilo de juego es de transiciones rápidas o de posesión estática para predecir escenarios de goles vs. córners.
               - Vulnerabilidad Estructural: Analiza el diferencial de goles histórico cruzado con la solidez defensiva reciente. No priorices resultados; pondera la probabilidad de que un equipo rompa o mantenga su tendencia actual basándote en la calidad del oponente.

            2. DINÁMICA BASKETBALL/NBA (MÉTRICAS DE IMPACTO):
               - Disponibilidad y Roster: Realiza un escaneo crítico del Injury Report. Evalúa el impacto sistémico de la ausencia de jugadores clave (estrellas o especialistas defensivos). Ajusta la proyección de puntos y hándicaps basándote en la pérdida de PER (Player Efficiency Rating) y volumen de uso (Usage Rate).
               - Ritmo y Fatiga: Analiza el Pace (ritmo de posesiones) proyectado. Considera factores de fatiga como el Back-to-Back o giras prolongadas fuera de casa para detectar posibles bajones de rendimiento físico en el 4Q.
               - Segmentación Temporal: Cruza datos de la 1ª Mitad (ID 5) con el resultado final (ID 15) para identificar ineficiencias en las líneas de salida de las casas de apuestas.

            3. CRITERIO DE VALOR (PROBABILIDAD VS. CUOTA):
                - Identificación de Edge: Tu misión es encontrar la discrepancia entre la probabilidad estadística calculada y la cuota ofrecida. Selecciona únicamente eventos donde el valor matemático sea evidente tras filtrar el ruido estadístico.
                - Análisis Multivariante: Considera el factor campo, la relevancia del encuentro para ambos equipos y las tendencias históricas head-to-head como modificadores de la probabilidad base.
                - Antes de emitir cualquier pronóstico, utiliza GOOGLE SEARCH para verificar el Injury Report (lesiones) de hoy en NBA/NCAA, bajas críticas en Football o quien es el árbitro del encuentro para saber si la línea de tarjetas es alta o baja. Esto es importante para tomar decisiones, pero lo que sigue mandando son las cuotas, la búsqueda de google search es para determinar datos clave y asegurarte de que cada pronóstico es lo más fiable posible.

            REGLAS DE SELECCIÓN Y STAKE:
            1. SAFE (La Segura): Cuota total 1.50 - 2.00. Probabilidad > 75%. STAKE FIJO: 6.
            2. VALUE (De Valor): Cuota total 2.50 - 3.50. STAKE FIJO: 3.
            3. FUNBET (Arriesgada): Cuota total 10.00 - 20.00. STAKE FIJO: 1. 

            REGLAS DE ORO (CRÍTICAS):
            - **PROHIBIDO REPETIR PARTIDOS**: Un mismo partido (Fixture ID) SÓLO puede aparecer en UNA de las 3 categorías.
            - **ORIGINALIDAD**: Cada categoría debe tener su propia identidad.
            - **COHERENCIA DEPORTIVA**: No mezcles contextos NBA/Fútbol.

            CONSTRUCCIÓN DE APUESTAS (ESTRICTO):
            - **SAFE**:
                *   PRIORIDAD MÁXIMA: **Bet Builder** de ESTADÍSTICAS en un mismo partido. Combina mercados que NO dependan de quién gana (ej: Más de X Tarjetas + Más de X Córners + Gol en 2ª mitad). Evita el 1X2 aquí.
                *   PRIORIDAD SECUNDARIA: Si no ves clara la opción de estadísticas, busca una **APUESTA SIMPLE** de cuota 1.50 a 1.80 que sea muy probable (ej: Victoria local clara o Ambos Marcan).
                *   EVITA EN LO POSIBLE: Combinar varios partidos. Solo hazlo (máximo 2 partidos) si no encuentras NADA en las opciones anteriores.
            
            - **VALUE**: Busca fallos de cuota o "underdogs" con opciones reales.
            
            - **FUNBET (ACUMULADOR)**:
                *   OBLIGATORIO: Selecciona entre 5 y 8 picks.
                *   **RESTRICCIÓN ABSOLUTA DE CUOTA**: CADA selección individual DEBE tener una cuota **ENTRE 1.10 Y 1.50**.
                *   **PROHIBIDO**: Incluir cualquier selección con cuota SUPERIOR A 1.50 en la Funbet. Si tiene 1.51, DESCÁRTALA.
                *   El objetivo es sumar muchas "pequeñas certezas" para crear una cuota grande.

            REGLAS DE FORMATO (STRICT JSON):
            - Devuelve UNICAMENTE un ARRAY JSON `[...]`.
            - El campo `reason` debe ser TÉCNICO, ESPECÍFICO DEL DEPORTE y SIN ALUCINACIONES.
            - MUY IMPORTANTE: Aunque tú propongas la "total_odd", el sistema la recalculará matemáticamente por código basándose en tus "selections".
            
            **REGLA DE DESGLOSE (CRÍTICA):**
            - Si propones una apuesta combinada ("Bet Builder", ej: Gana Barcelona y Más de 2.5 Goles), **NO** la pongas en una sola selección como "Gana Barcelona & Más de 2.5".
            - **DEBES** separarla en 2 (o más) objetos dentro del array `selections`:
                1. Selección 1: "Gana Barcelona" (Cuota X)
                2. Selección 2: "Más de 2.5 Goles" (Cuota Y)
            - El sistema multiplicará X * Y para obtener la cuota total.

            SCHEMA OBLIGATORIO:
            {{
                "betType": "safe", // "safe", "value", "funbet"
                "type": "safe",
                "sport": "football", // o "basketball"
                "startTime": "YYYY-MM-DD HH:mm",
                "match": "Título Descriptivo",
                "pick": "Resumen del Pick",
                "stake": 6, 
                "total_odd": 0.0,
                "estimated_units": 0.0,
                "reason": "Análisis detallado. (no incluir datos de IDs)",
                "selections": [
                    {{
                        "fixture_id": 123456,
                        "sport": "football",
                        "league": "Nombre Liga",
                        "match": "Equipo A vs Equipo B",
                        "time": "YYYY-MM-DD HH:mm",
                        "pick": "Gana Barcelona",
                        "odd": 1.45
                    }},
                    {{
                        "fixture_id": 123456,
                        "sport": "football",
                        "league": "Nombre Liga",
                        "match": "Equipo A vs Equipo B",
                        "time": "YYYY-MM-DD HH:mm",
                        "pick": "Más de 2.5 Goles",
                        "odd": 1.60
                    }}
                ]
            }}

            INPUT DATA:
            {json.dumps(raw_matches, indent=2)}
            """

    valid_bets = None
    
    # 4. Loop de Intentos
    for i in range(3):
        print(f"[*] Gemini Attempt {i+1} (Research Mode)...")
        try:
            search_tool = types.Tool(google_search=types.GoogleSearch())
            
            resp = client.models.generate_content(
                model=model_name,
                contents=base_prompt,
                config=types.GenerateContentConfig(
                    tools=[search_tool],
                    response_mime_type='application/json'
                )
            )

            # --- VERIFICACIÓN DE USO DE BÚSQUEDA (MEJORADO) ---
            try:
                if hasattr(resp, 'candidates') and resp.candidates:
                    cand = resp.candidates[0]
                    if hasattr(cand, 'grounding_metadata') and cand.grounding_metadata:
                        gm = cand.grounding_metadata
                        
                        # 1. ¿Qué buscó la IA? (Esto es lo que quieres ver)
                        if hasattr(gm, 'web_search_queries') and gm.web_search_queries:
                            print(f"\n[SEARCH LOG] 🕵️  La IA ha buscado en Google: {gm.web_search_queries}")
                        
                        # 2. ¿Encontró resultados?
                        if gm.search_entry_point:
                            print(f"[SEARCH LOG] 🌐 Google devolvió resultados visuales (HTML leído).")
                        
                        # 3. ¿Usó citas directas?
                        chunks = len(gm.grounding_chunks) if gm.grounding_chunks else 0
                        if chunks > 0:
                            print(f"[SEARCH LOG] 📝 Se extrajeron {chunks} datos específicos.")
                            
                    else:
                        print("[SEARCH WARNING] El modelo decidió NO buscar nada (confió en su memoria).")
            except Exception as e_log:
                print(f"[DEBUG LOG] Error imprimiendo metadatos: {e_log}")
            # ---------------------------------------
            
            # Limpieza y Parsing
            text = resp.text.replace("```json", "").replace("```", "").strip()
            
            start_idx = text.find("[")
            end_idx = text.rfind("]")
            
            if start_idx != -1 and end_idx != -1:
                json_str = text[start_idx:end_idx+1]
                candidates = json.loads(json_str)
            else:
                candidates = json.loads(text)
            
            # Procesamiento
            for bet in candidates:
                real_selections = []
                for sel in bet.get("selections", []):
                    source = fixture_map.get(str(sel.get("fixture_id")))
                    if source:
                        h = source.get("home") or source.get("home_team") # kept raw for formatter
                        a = source.get("away") or source.get("away_team")
                        league = source.get("league", "Desconocida")
                        
                        # Update with API data (Time, Sport, League)
                        # We do NOT translate here anymore, Formatter does it.
                        sel.update({
                            "match": f"{h} vs {a}",
                            "league": league,
                            "sport": source.get("sport", "football"),
                            "time": source.get("startTime"),
                            # "pick": val  <-- Left as Gemini output, cleaned later
                        })
                        real_selections.append(sel)
                bet["selections"] = real_selections
                if real_selections:
                    bet["sport"] = real_selections[0]["sport"]
                    bet["startTime"] = real_selections[0]["time"]

            valid_bets = candidates
            break
        except Exception as e:
            print(f"[!] Reintentando por error: {e}")
            time.sleep(2)

    if not valid_bets: 
        print("[ERROR] No se pudieron generar apuestas válidas tras 3 intentos.")
        return

    # FORMATTER INTEGRATION
    try:
        formatter = BetFormatter()
        print("[*] Running BetFormatter Service...")
        final_output = formatter.process_bets(valid_bets)
    except Exception as e:
        print(f"[ERROR] Formatter Failed: {e}. Saving raw.")
        final_output = valid_bets

    # Final Calculation Update (Safety check)
    for bet in final_output:
        odds = [float(s.get("odd", 1.0)) for s in bet["selections"]]
        if not odds: continue
        total_odd = round(math.prod(odds), 2)
        bet["total_odd"] = total_odd
        bt = bet.get("betType", "safe").lower()
        bet["stake"] = 6 if "safe" in bt else (3 if "value" in bt else 1)
        bet["estimated_units"] = round(bet["stake"] * (total_odd - 1), 2)

    # GUARDADO (Redis SET sobrescribe automáticamente)
    rs.save_daily_bets(today_str, final_output)
    print(f"[SUCCESS] Nuevas predicciones guardadas en Redis para {today_str}.")
    
    # TELEGRAM SYNC
    print(f"[*] Generando cola de mensajes para Telegram...")
    try:
        from src.services.telegram_generator import generate_messages_from_analysis
        generate_messages_from_analysis(today_str)
    except ImportError:
        # Fallback if running as script directly without package context issues
        import telegram_generator
        telegram_generator.generate_messages_from_analysis(today_str)
    except Exception as e:
        print(f"[ERROR] Failed to auto-generate telegram messages: {e}")

if __name__ == "__main__":
    analyze()