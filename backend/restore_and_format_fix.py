import json
import sys
import os
import math

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from src.services.redis_service import RedisService
from src.services.bet_formatter import BetFormatter

def run_definitive_fix():
    print("[*] Starting Definitive Fix (Restore + Format)...")
    
    # 1. THE CLEAN, ORIGINAL DATA (One selection for Value bet)
    clean_data = {
      "date": "2026-01-21",
      "is_real": True,
      "day_profit": 0,
      "status": "PENDING",
      "bets": [
        {
          "betType": "safe",
          "sport": "football",
          "startTime": "2026-01-21 21:45",
          "match": "Watford vs Portsmouth",
          "pick": "Victoria de Watford (1X2)",
          "stake": 6,
          "total_odd": 1.73,
          "estimated_units": 4.38,
          "reason": "Análisis de Vulnerabilidad Estructural: Watford presenta una solidez defensiva en casa...",
          "status": "PENDING",
          "profit": 0,
          "selections": [
            {
              "fixture_id": 1386885,
              "sport": "football",
              "league": "Championship",
              "match": "Watford vs Portsmouth",
              "time": "2026-01-21 21:45",
              "pick": "Match Ganador: Local",
              "odd": 1.73,
              "status": "PENDING",
              "result": None
            }
          ]
        },
        {
          "betType": "value",
          "sport": "football",
          "startTime": "2026-01-21 19:45",
          "match": "AZ Alkmaar vs Excelsior",
          "pick": "AZ Gana y Más de 3.5 Goles",
          "stake": 3,
          "total_odd": 2.62,
          "estimated_units": 4.86,
          "reason": "Dinámica Ofensiva y Edge: AZ Alkmaar (cuota base 1.33) enfrenta a la defensa...",
          "status": "PENDING",
          "profit": 0,
          "selections": [
            {
              "fixture_id": 1381003,
              "sport": "football",
              "league": "Eredivisie",
              "match": "AZ Alkmaar vs Excelsior",
              "time": "2026-01-21 19:45",
              "pick": "Result & Total Goles: Local & Más de 3.5",
              "odd": 2.62,
              "status": "PENDING",
              "result": None
            }
          ]
        },
        {
          "betType": "funbet",
          "sport": "football",
          "startTime": "2026-01-21 22:00",
          "match": "Pro Acca Multi-Sport (7-Fold)",
          "pick": "Combinada de Favoritos & Hándicaps Cortos",
          "stake": 1,
          "total_odd": 10.65,
          "estimated_units": 9.65,
          "reason": "Acumulador táctico de 'Pequeñas Certezas'...",
          "status": "PENDING",
          "profit": 0,
          "selections": [
            {
              "fixture_id": 1451139,
              "sport": "football",
              "league": "UEFA Champions League",
              "match": "Slavia Praha vs Barcelona",
              "time": "2026-01-21 22:00",
              "pick": "Match Ganador: Visitante (Barcelona)",
              "odd": 1.33,
              "status": "PENDING",
              "result": None
            },
            {
              "fixture_id": 1451138,
              "sport": "football",
              "league": "UEFA Champions League",
              "match": "Qarabag vs Eintracht Frankfurt",
              "time": "2026-01-21 19:45",
              "pick": "Doble Oportunidad: X2 (Empate or Visitante)",
              "odd": 1.36,
              "status": "PENDING",
              "result": None
            },
            {
              "fixture_id": 1386884,
              "sport": "football",
              "league": "Championship",
              "match": "Southampton vs Sheffield Utd",
              "time": "2026-01-21 21:45",
              "pick": "Doble Oportunidad: 1X (Local or Empate)",
              "odd": 1.4,
              "status": "PENDING",
              "result": None
            },
            {
              "fixture_id": 453235,
              "sport": "basketball",
              "league": "Eurocup",
              "match": "Panionios vs Turk Telekom",
              "time": "2026-01-21 19:30",
              "pick": "Hándicap Asiático: Visitante -1.5",
              "odd": 1.45,
              "status": "PENDING",
              "result": None
            },
            {
              "fixture_id": 453242,
              "sport": "basketball",
              "league": "Eurocup",
              "match": "Besiktas vs Buducnost",
              "time": "2026-01-21 19:00",
              "pick": "Hándicap Asiático: Local -3.5",
              "odd": 1.48,
              "status": "PENDING",
              "result": None
            },
            {
              "fixture_id": 489372,
              "sport": "basketball",
              "league": "Champions League",
              "match": "Galatasaray vs Le Mans",
              "time": "2026-01-21 19:00",
              "pick": "Hándicap Asiático: Local -2.5",
              "odd": 1.4,
              "status": "PENDING",
              "result": None
            },
            {
              "fixture_id": 489373,
              "sport": "basketball",
              "league": "Champions League",
              "match": "Joventut Badalona vs Chalon/Saone",
              "time": "2026-01-21 21:30",
              "pick": "Hándicap Asiático: Local -3.5",
              "odd": 1.4,
              "status": "PENDING",
              "result": None
            }
          ]
        }
      ]
    }

    rs = RedisService()
    
    # 2. RUN FORMATTER BEFORE SAVING? OR SAVE THEN FORMAT?
    # Let's use the formatter locally on the dict to verify it.
    
    formatter = BetFormatter()
    raw_bets = clean_data["bets"]
    
    print("[*] Running BetFormatter on CLEAN data...")
    formatted_bets = formatter.process_bets(raw_bets)
    
    # Verify NO splitting occurred (Value bet should still be 1 selection)
    value_bet = formatted_bets[1]
    msg = f"Value bet selections count: {len(value_bet['selections'])}"
    print(msg)
    if len(value_bet['selections']) > 1:
        print("[ERROR] BetFormatter is STILL splitting bets! Aborting save.")
        return
    else:
        print("[SUCCESS] BetFormatter did NOT split the bet.")

    # 3. SAVE TO REDIS
    # We save the formatted result
    rs.save_daily_bets("2026-01-21", formatted_bets)
    print("[SUCCESS] Restored and Formatted Correctly in Redis.")

if __name__ == "__main__":
    run_definitive_fix()
