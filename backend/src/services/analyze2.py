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
    "AH": "Hándicap Asiático",
    "Double Chance": "Doble Oportunidad",
    "(ML)": "(Prórroga incluída)",
    "BTTS": "Ambos marcan:",
    "Corners": "Córners"
}

def clean_team_name(name):
    if not name: return "Desconocido"
    name = str(name).replace("(Home)", "").replace("(Away)", "")
    name = name.replace("(Local)", "").replace("(Visitante)", "")
    if name.endswith(" Home"): name = name[:-5]
    if name.endswith(" Away"): name = name[:-5]
    return name.strip()

def translate_pick(pick_text, home_team=None, away_team=None):
    if not pick_text: return pick_text
    p = str(pick_text).strip().upper()
    if p == "1" and home_team:
        return f"Gana {home_team}"
    if p == "2" and away_team:
        return f"Gana {away_team}"
    if p == "X":
        return "Empate"
    for eng, esp in PICK_TRANSLATIONS.items():
        if eng in pick_text:
            pick_text = pick_text.replace(eng, esp)
    return pick_text

def analyze():
    print("--- REANALYSIS SCRIPT STARTED (ANALYZE2 - V3) ---")
    
    try:
        rs = RedisService()
        gs = GeminiService() 
    except Exception as e:
        print(f"[FATAL] Service Init Failed: {e}")
        return

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

    fixture_map = {}
    for m in raw_matches:
        fid = m.get("id")
        if fid:
            fixture_map[str(fid)] = m
            
    print(f"[*] Fixture Map Built: {len(fixture_map)} items.")

    base_prompt = f"""
            Estás operando en modo Risk Manager & Pro Tipster Multi-Sport (Football & Basketball/NBA).
            Tu objetivo es analizar los datos proporcionados y generar las 3 mejores apuestas del día (SAFE, VALUE, FUNBET).

            IMPORTANTE: Tienes datos de Fútbol y de Baloncesto (NBA/Europa). Evalúa AMBOS deportes por igual. No ignores los partidos de madrugada si presentan mejores oportunidades que el fútbol.

            INSTRUCCIONES DE ANÁLISIS TÉCNICO (NIVEL PRO ANALYTICS):
            1. SÍNTESIS DE FÚTBOL (CORRELACIÓN Y PRESIÓN): 
               - Dinámica Ofensiva: Evalúa la correlación entre el volumen de remates y la generación de saques de esquina. Determina si el estilo de juego es de transiciones rápidas o de posesión estática.
               - Vulnerabilidad Estructural: Analiza el diferencial de goles histórico cruzado con la solidez defensiva reciente.

            2. DINÁMICA BASKETBALL/NBA (MÉTRICAS DE IMPACTO):
               - Disponibilidad y Roster: Realiza un escaneo crítico del Injury Report. Evalúa el impacto de la ausencia de jugadores clave.
               - Ritmo y Fatiga: Analiza el Pace proyectado. Considera factores de fatiga como el Back-to-Back.

            3. CRITERIO DE VALOR (PROBABILIDAD VS. CUOTA):
                - Identificación de Edge: Misión encontrar discrepancia entre probabilidad estadística y cuota ofrecida.

            REGLAS DE SELECCIÓN Y STAKE:
            1. SAFE (La Segura): Cuota 1.50 - 2.00. STAKE: 6.
            2. VALUE (De Valor): Cuota 2.50 - 3.50. STAKE: 3.
            3. FUNBET (Arriesgada): Cuota 10.00 - 20.00. STAKE: 1.

            SCHEMA OBLIGATORIO:
            [{{
                "betType": "safe",
                "sport": "football",
                "startTime": "YYYY-MM-DD HH:mm",
                "match": "Título Descriptivo",
                "pick": "Resumen del Pick",
                "stake": 6,
                "total_odd": 0.0,
                "reason": "Análisis detallado.",
                "selections": [
                    {{
                        "fixture_id": "ID",
                        "sport": "football",
                        "league": "Nombre Liga",
                        "match": "Equipo A vs Equipo B",
                        "time": "YYYY-MM-DD HH:mm",
                        "pick": "Mercado específico",
                        "odd": 1.55
                    }}
                ]
            }}]

            INPUT DATA:
            {json.dumps(raw_matches, indent=2)}
            """

    valid_bets = None
    for i in range(3):
        print(f"[*] Gemini Attempt {i+1}...")
        try:
            resp = gs.model.generate_content(base_prompt)
            text = resp.text.replace("```json", "").replace("```", "").strip()
            candidates = json.loads(text[text.find("["):text.rfind("]")+1])
            
            validation_error = None
            for bet in candidates:
                real_selections = []
                for sel in bet.get("selections", []):
                    fid = str(sel.get("fixture_id"))
                    source = fixture_map.get(fid)
                    
                    if not source:
                        print(f"    [WARN] Fixture ID {fid} not found.")
                        continue
                        
                    # Soporte para 'home' o 'home_team'
                    h_raw = source.get("home") or source.get("home_team")
                    a_raw = source.get("away") or source.get("away_team")
                    h_name = clean_team_name(h_raw)
                    a_name = clean_team_name(a_raw)
                    
                    sel["match"] = f"{h_name} vs {a_name}"
                    sel["league"] = source.get("league", "Desconocida")
                    sel["sport"] = source.get("sport", "football")
                    sel["time"] = source.get("startTime") or datetime.fromtimestamp(source.get("timestamp", 0)).strftime("%Y-%m-%d %H:%M")
                    sel["pick"] = translate_pick(sel.get("pick", ""), h_name, a_name)
                    real_selections.append(sel)
                
                bet["selections"] = real_selections
                if real_selections:
                    bet["sport"] = real_selections[0]["sport"]
                    bet["startTime"] = real_selections[0]["time"]
                    bet["match"] = real_selections[0]["match"] if len(real_selections) == 1 else "Combinada Multi-Evento"

            valid_bets = candidates
            break
        except Exception as e:
            print(f"[!] Error: {e}")

    if not valid_bets: return

    final_output = []
    for bet in valid_bets:
        odds = [float(s.get("odd", 1.0)) for s in bet["selections"]]
        total_odd = round(math.prod(odds), 2)
        bet["total_odd"] = total_odd
        bet["odd"] = total_odd
        bt = bet.get("betType", "safe").lower()
        bet["stake"] = 6 if "safe" in bt else (3 if "value" in bt else 1)
        bet["estimated_units"] = round(bet["stake"] * (total_odd - 1), 2)
        final_output.append(bet)

    print("[*] Saving to Redis...")
    rs.save_daily_bets(today_str, final_output)
    print(f"[SUCCESS] Saved {len(final_output)} bets.")

if __name__ == "__main__":
    analyze()