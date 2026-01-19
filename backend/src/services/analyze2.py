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

# DICCIONARIO DE TRADUCCIÓN FORZADA
PICK_TRANSLATIONS = {
    "Home": "Local", "Away": "Visitante", "Win": "Gana", "Draw": "Empate",
    "Over": "Más de", "Under": "Menos de", "Yes": "Sí", "No": "No",
    "Goals": "Goles", "Points": "Puntos", "Handicap": "Hándicap",
    "Shots on Goal": "Tiros a Puerta:", "BTTS": "Ambos marcan:", "Corners": "Córners"
}

def clean_team_name(name):
    if not name: return "Desconocido"
    name = str(name).replace("(Home)", "").replace("(Away)", "").replace("(Local)", "").replace("(Visitante)", "")
    if name.endswith(" Home"): name = name[:-5]
    if name.endswith(" Away"): name = name[:-5]
    return name.strip()

def translate_pick(pick_text, home_team=None, away_team=None):
    if not pick_text: return pick_text
    p = str(pick_text).strip().upper()
    if p == "1" and home_team: return f"Gana {home_team}"
    if p == "2" and away_team: return f"Gana {away_team}"
    if p == "X": return "Empate"
    for eng, esp in PICK_TRANSLATIONS.items():
        if eng in pick_text:
            pick_text = pick_text.replace(eng, esp)
    return pick_text

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
               - Antes de emitir cualquier pronóstico, utiliza GOOGLE SEARCH para verificar el Injury Report (lesiones) de hoy en NBA/NCAA y bajas críticas en Football. Esto es importante para tomar decisiones, pero lo que sigue mandando son las cuotas, la búsqueda de google search es para determinar datos clave y asegurarte de que cada pronóstico es lo más fiable posible.

            2. DINÁMICA BASKETBALL/NBA (MÉTRICAS DE IMPACTO):
               - Disponibilidad y Roster: Realiza un escaneo crítico del Injury Report. Evalúa el impacto sistémico de la ausencia de jugadores clave (estrellas o especialistas defensivos). Ajusta la proyección de puntos y hándicaps basándote en la pérdida de PER (Player Efficiency Rating) y volumen de uso (Usage Rate).
               - Ritmo y Fatiga: Analiza el Pace (ritmo de posesiones) proyectado. Considera factores de fatiga como el Back-to-Back o giras prolongadas fuera de casa para detectar posibles bajones de rendimiento físico en el 4Q.
               - Segmentación Temporal: Cruza datos de la 1ª Mitad (ID 5) con el resultado final (ID 15) para identificar ineficiencias en las líneas de salida de las casas de apuestas.

            3. CRITERIO DE VALOR (PROBABILIDAD VS. CUOTA):
                - Identificación de Edge: Tu misión es encontrar la discrepancia entre la probabilidad estadística calculada y la cuota ofrecida. Selecciona únicamente eventos donde el valor matemático sea evidente tras filtrar el ruido estadístico.
                - Análisis Multivariante: Considera el factor campo, la relevancia del encuentro para ambos equipos y las tendencias históricas head-to-head como modificadores de la probabilidad base.

            REGLAS DE SELECCIÓN Y STAKE:
            1. SAFE (La Segura): Cuota total 1.50 - 2.00. Probabilidad > 75%. STAKE FIJO: 6.
            2. VALUE (De Valor): Cuota total 2.50 - 3.50. STAKE FIJO: 3.
            3. FUNBET (Arriesgada): Cuota total 10.00 - 20.00. STAKE FIJO: 1. 
            - REGLA FUNBET: Puedes combinar mercados. Para llegar a cuota 10+, usa selecciones con cuota individual entre 1.10 y 1.50.
            - REGLA NO REPETIR: No repitas el mismo pronóstico en diferentes apuestas. Con esto nos aseguramos de no perder varias apuestas por un único pronóstico fallido. 
            - REGLA EVENTO: Hay la posibilidad de que puedas hacer varios pronósticos diferentes para el mismo evento si te convencen mucho, siempre que no sean contradictorios (ej: victoria del local y over 2.5 goles).

            REGLAS DE FORMATO (STRICT JSON):
            - Devuelve UNICAMENTE un ARRAY JSON `[...]`.
            - El campo reason debe ser un informe de inteligencia técnica. Debe explicar el PORQUÉ técnico de la selección (ej: 'La baja del pívot titular reduce la protección de aro un 15%, aumentando la probabilidad de puntos en la pintura y rebotes ofensivos del rival'). (NO incluyas ningún dato de ID en el "reason").
            - MUY IMPORTANTE: Aunque tú propongas la "total_odd", el sistema la recalculará matemáticamente por código basándose en tus "selections".

            SCHEMA OBLIGATORIO:
            {{
                "betType": "safe", // "safe", "value", "funbet"
                "type": "safe",
                "sport": "football", // o "basketball"
                "startTime": "YYYY-MM-DD HH:mm",
                "match": "Título Descriptivo de la apuesta (si es una combinada debes indicar una informacion breve para saber en una linea de que trata la combinada, no pongas el nombre del primer partido de la combinada)",
                "pick": "Resumen del Pick",
                "stake": 6, // 6 para safe, 3 para value, 1 para funbet
                "total_odd": 0.0, // Deja en 0.0, el código lo calculará
                "estimated_units": 0.0, // Deja en 0.0, el código lo calculará
                "reason": "Análisis detallado. (no incluir datos de IDs)",
                "selections": [
                    {{
                        "fixture_id": 123456,
                        "sport": "football",
                        "league": "Nombre Liga",
                        "match": "Equipo A vs Equipo B",
                        "time": "YYYY-MM-DD HH:mm",
                        "pick": "Mercado específico",
                        "odd": 1.55
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

            # --- VERIFICACIÓN DE USO DE BÚSQUEDA ---
            try:
                # Verificamos si existen candidatos y metadatos de grounding
                if hasattr(resp, 'candidates') and resp.candidates:
                    cand = resp.candidates[0]
                    if hasattr(cand, 'grounding_metadata') and cand.grounding_metadata:
                        gm = cand.grounding_metadata
                        chunks_count = len(gm.grounding_chunks) if gm.grounding_chunks else 0
                        print(f"[SEARCH EVIDENCE] 🔍 Google Search ejecutado. Fuentes consultadas: {chunks_count}")
                        if gm.search_entry_point:
                            print(f"[SEARCH EVIDENCE] 🌐 Resultados HTML generados.")
                    else:
                        print("[SEARCH WARNING] No se detectaron metadatos de búsqueda en la respuesta.")
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
                        h = clean_team_name(source.get("home") or source.get("home_team"))
                        a = clean_team_name(source.get("away") or source.get("away_team"))
                        sel.update({
                            "match": f"{h} vs {a}",
                            "league": source.get("league", "Desconocida"),
                            "sport": source.get("sport", "football"),
                            "time": source.get("startTime"),
                            "pick": translate_pick(sel.get("pick", ""), h, a)
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

    final_output = []
    for bet in valid_bets:
        odds = [float(s.get("odd", 1.0)) for s in bet["selections"]]
        if not odds: continue
        
        total_odd = round(math.prod(odds), 2)
        bet.update({"total_odd": total_odd, "odd": total_odd})
        bt = bet.get("betType", "safe").lower()
        bet["stake"] = 6 if "safe" in bt else (3 if "value" in bt else 1)
        bet["estimated_units"] = round(bet["stake"] * (total_odd - 1), 2)
        final_output.append(bet)

    # GUARDADO (Redis SET sobrescribe automáticamente)
    rs.save_daily_bets(today_str, final_output)
    print(f"[SUCCESS] Nuevas predicciones guardadas en Redis para {today_str}.")

if __name__ == "__main__":
    analyze()