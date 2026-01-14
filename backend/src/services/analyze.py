import sys
import os
import json
import time
import math
from datetime import datetime, timedelta

# Path setup to include backend root
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.gemini import GeminiService

# DICCIONARIO DE TRADUCCIÓN FORZADA (Picks & Mercados)
PICK_TRANSLATIONS = {
    "Home": "Local",
    "Away": "Visitante",
    "Win": "Gana",
    "Draw": "Empate",
    "Over": "Más de",
    "Under": "Menos de",
    "Yes": "Sí",
    "No": "No",
    "Goals": "Goles",
    "Points": "Puntos",
    "Handicap": "Hándicap",
    "Shots on Goal": "Tiros a Puerta:",
    "Gananer": "Ganador",
    "Asian Hándicap": "Hándicap Asiático",
    "Corners": "Córners"
}

# --- FLAG MAPPINGS REMOVED (Moved to Frontend) ---

def clean_team_name(name):
    """
    Remove suffixes like (Home), (Away) and extra spaces.
    """
    if not name: return "Desconocido"
    name = name.replace("(Home)", "").replace("(Away)", "")
    name = name.replace("(Local)", "").replace("(Visitante)", "")
    if name.endswith(" Home"): name = name[:-5]
    if name.endswith(" Away"): name = name[:-5]
    return name.strip()

def translate_pick(pick_text):
    """
    Translates betting terms to Spanish.
    """
    if not pick_text: return pick_text
    
    # Simple replacement checks
    for eng, esp in PICK_TRANSLATIONS.items():
        if eng in pick_text:
            pick_text = pick_text.replace(eng, esp)
            
    return pick_text

def validate_bets_pre(candidates):
    """
    Pre-validation of AI output structure
    """
    if not candidates: return False, "Empty list"
    return True, "OK"

def analyze():
    print("--- REANALYSIS SCRIPT STARTED (Lookup V3) ---")
    
    # 1. Services
    try:
        rs = RedisService()
        gs = GeminiService() 
    except Exception as e:
        print(f"[FATAL] Service Init Failed: {e}")
        return

    # 2. Fetch Data (Full 24h Window logic handled by fetcher, we just read raw)
    today_str = datetime.now().strftime("%Y-%m-%d")
    raw_key = f"betai:raw_matches:{today_str}"
    
    print(f"[*] Fetching Raw Data: {raw_key}")
    raw_json = rs.get(raw_key) 
    if not raw_json: raw_json = rs.get(f"raw_matches:{today_str}")
    
    if not raw_json:
        print(f"[ERROR] No raw matches found for {today_str}. Aborting.")
        return

    raw_matches = json.loads(raw_json)
    print(f"[*] Matches Loaded: {len(raw_matches)} events.")

    # 3. Build Lookup Map (Fixture ID -> Data)
    fixture_map = {}
    for m in raw_matches:
        fid = m.get("id")
        if fid:
            fixture_map[fid] = m
            
    print(f"[*] Fixture Map Built: {len(fixture_map)} items.")

    # 4. Master Prompt
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

            REGLAS DE SELECCIÓN Y STAKE:
            1. SAFE (La Segura): Cuota total 1.50 - 2.00. Probabilidad > 75%. STAKE FIJO: 6.
            2. VALUE (De Valor): Cuota total 2.50 - 3.50. STAKE FIJO: 3.
            3. FUNBET (Arriesgada): Cuota total 10.00 - 20.00. STAKE FIJO: 1. 
            - REGLA FUNBET: Puedes combinar mercados. Para llegar a cuota 10+, usa selecciones con cuota individual entre 1.10 y 1.50.
            - REGLA NO REPETIR: No repitas el mismo pronóstico en diferentes apuestas. Con esto nos aseguramos de no perder varias apuestas por un único pronóstico fallido.

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
                "match": "Título Descriptivo de la apuesta (si es combinada, indica una informacion breve para saber en una linea de que trata la combinada)",
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

    # 5. Retry Loop
    valid_bets = None
    max_attempts = 3
    
    for i in range(max_attempts):
        print(f"[*] Gemini Attempt {i+1}...")
        try:
            resp = gs.model.generate_content(base_prompt)
            text = resp.text.replace("```json", "").replace("```", "").strip()
            
            s = text.find("[")
            e = text.rfind("]") + 1
            if s == -1: raise ValueError("No JSON")
            
            candidates = json.loads(text[s:e])
            
            # --- DATA INJECTION & CLEANING ---
            validation_error = None
            
            for bet in candidates:
                # Basic cleaning
                bet["reason"] = clean_team_name(bet.get("reason", ""))
                
                real_selections = []
                for sel in bet.get("selections", []):
                    fid = sel.get("fixture_id")
                    
                    # Lookup Source
                    source = fixture_map.get(fid) or fixture_map.get(str(fid))
                    
                    if not source:
                        # Fallback: Try match by ID inside object? No, ID is key.
                        # Fail logic: skipping invalid ID selection
                        print(f"    [WARN] Fixture ID {fid} not found in Raw Data. Skipping selection.")
                        continue
                        
                    # INJECT REAL DATA
                    sel["match"] = f"{clean_team_name(source['home'])} vs {clean_team_name(source['away'])}"
                    
                    # INJECT REAL DATA
                    sel["match"] = f"{clean_team_name(source['home'])} vs {clean_team_name(source['away'])}"
                    
                    # Pass League Metadata for Frontend
                    sel["league"] = source.get("league", "Unknown")
                    sel["league_id"] = source.get("league_id")
                    sel["country"] = source.get("country")
                    
                    sel["sport"] = source.get("sport", "football")
                    sel["time"] = source.get("startTime") or datetime.fromtimestamp(source.get("timestamp", 0)).strftime("%Y-%m-%d %H:%M")
                    
                    # Translate Pick
                    sel["pick"] = translate_pick(sel.get("pick", ""))
                    
                    # Store
                    real_selections.append(sel)
                    
                    # FUNBET Check
                    if "funbet" in bet.get("betType", "").lower():
                        if float(sel.get("odd", 0)) > 1.50:
                            validation_error = f"Funbet Selection > 1.50 ({sel.get('odd')})"
                
                # Update selections with valid ones only
                if not real_selections:
                    validation_error = "Bet has no valid selections (IDs not found)."
                bet["selections"] = real_selections
                
                # Update top-level metadata from first selection
                if real_selections:
                    bet["sport"] = real_selections[0]["sport"]
                    bet["startTime"] = real_selections[0]["time"]
                    bet["match"] = real_selections[0]["match"] # Representative match
                    bet["pick"] = "Combinada" if len(real_selections) > 1 else real_selections[0]["pick"]

            if validation_error:
                print(f"[!] Logic Rejection: {validation_error}")
                base_prompt += f"\n\nERROR: {validation_error}. REHAZLO."
                continue
                
            valid_bets = candidates
            break
            
        except Exception as e:
            print(f"[!] Error: {e}")
            time.sleep(1)

    if not valid_bets:
        print("[FATAL] Could not generate valid bets.")
        return

    # 6. POST-PROCESSING (MATH)
    print("[*] Calculating Finals...")
    final_output = []
    
    for bet in valid_bets:
        # Get Clean Odds
        odds_values = []
        for s in bet["selections"]:
            try:
                ov = float(s.get("odd", 0))
                if ov > 1.0: odds_values.append(ov)
            except: pass
            
        if not odds_values: continue
        
        # Total Odd
        total_odd = math.prod(odds_values)
        total_odd = round(total_odd, 2)
        bet["total_odd"] = total_odd
        bet["odd"] = total_odd # CRITICAL: RedisService reads 'odd', not 'total_odd'
        
        # Stake
        bt = bet.get("betType", "safe").lower()
        if "safe" in bt: st = 6
        elif "value" in bt: st = 3
        else: st = 1
        bet["stake"] = st
        
        # Units
        bet["estimated_units"] = round(st * (total_odd - 1), 2)
        
        final_output.append(bet)

    # 7. Save
    print("[*] Saving to Redis...")
    rs.save_daily_bets(today_str, final_output)
    print(f"[SUCCESS] Saved {len(final_output)} bets.")

if __name__ == "__main__":
    analyze()
