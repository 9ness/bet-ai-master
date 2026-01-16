import sys
import os
import json

# Add backend root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../'))

from src.services.redis_service import RedisService

DATA_15_JAN = {
  "date": "2026-01-15",
  "is_real": True,
  "day_profit": -10,
  "status": "PENDING",
  "bets": [
    {
      "betType": "safe",
      "sport": "football",
      "startTime": "2026-01-15 17:30",
      "match": "Verona vs Bologna",
      "pick": "Menos de 2.5 goles",
      "stake": 6,
      "total_odd": 1.62,
      "estimated_units": 3.72,
      "reason": "Análisis Estructural: El Verona presenta uno de los diferenciales de xG (Goles Esperados) más bajos de la Serie A jugando como local, lo que indica serios problemas en la fase de finalización. Cruzando esto con el estilo de posesión de control del Bologna (bajo Pace), se prevé un escenario de ritmo lento y pocas transiciones ofensivas. La solidez defensiva del visitante fuerza al Verona a ataques estáticos donde son ineficientes, aumentando la probabilidad de un marcador bajo (0-0, 0-1, 1-1).",
      "status": "LOST",
      "profit": -6,
      "selections": [
        {
          "fixture_id": 1378023,
          "sport": "football",
          "league": "Serie A",
          "match": "Verona vs Bologna",
          "time": "2026-01-15 17:30",
          "pick": "Menos de 2.5 goles",
          "odd": 1.62,
          "status": "LOST",
          "result": "2-3 | 5 Goles"
        }
      ]
    },
    {
      "betType": "value",
      "sport": "football",
      "startTime": "2026-01-15 19:45",
      "match": "Como vs AC Milan",
      "pick": "Gana AC Milan",
      "stake": 3,
      "total_odd": 2.5,
      "estimated_units": 4.5,
      "reason": "Discrepancia de Mercado (Edge > 15%): Las casas de apuestas han sobrerreaccionado a la inconsistencia reciente del Milan, ofreciendo una cuota muy superior a la probabilidad real basada en 'Squad Value' y métricas avanzadas. El Como concede un volumen de 'High Danger Chances' insostenible ante equipos de élite. La capacidad de ruptura de líneas del Milan (incluso sin estar al 100%) debería explotar la fragilidad defensiva del local. Matemáticamente, el precio de 2.50 implica solo un 40% de probabilidad de victoria, cuando los modelos de potencia la sitúan cerca del 55%.",
      "status": "WON",
      "profit": -3,
      "selections": [
        {
          "fixture_id": 1378015,
          "sport": "football",
          "league": "Serie A",
          "match": "Como vs AC Milan",
          "time": "2026-01-15 19:45",
          "pick": "Gana AC Milan",
          "odd": 2.5,
          "status": "WON",
          "result": "1-3"
        }
      ],
      "check_attempts": 0
    },
    {
      "betType": "funbet",
      "sport": "basketball",
      "startTime": "2026-01-15 16:00",
      "match": "Dubai vs Virtus Bologna",
      "pick": "Combinada",
      "stake": 1,
      "total_odd": 15.88,
      "estimated_units": 14.88,
      "reason": "Estrategia de Correlación Múltiple: 1) Factor Cancha en Euroliga/NBA: Efes, Milano y Magic tienen ventajas significativas de Net Rating en casa contra rivales con rotaciones cortas o viajes largos. 2) Superioridad Técnica: Panathinaikos (campeón) mantiene un roster muy superior al de Bayern. 3) Lectura de Totales: El duelo Paris-Monaco proyecta un Pace altísimo (Over seguro), mientras que Dubai y Virtus tienen defensas permisivas. 4) Coberturas de Fútbol: Bologna y Augsburg son estructuralmente difíciles de batir, validando las dobles oportunidades, y el partido de Milan garantiza goles por la naturaleza ofensiva de ambos.",
      "status": "LOST",
      "profit": -1,
      "selections": [
        {
          "fixture_id": 454488,
          "sport": "basketball",
          "league": "Euroleague",
          "match": "Dubai vs Virtus Bologna",
          "time": "2026-01-15 16:00",
          "pick": "Total Puntos Más de 159.5",
          "odd": 1.3,
          "status": "LOST",
          "result": "72-80 | 152 Pts"
        },
        {
          "fixture_id": 1378023,
          "sport": "football",
          "league": "Serie A",
          "match": "Verona vs Bologna",
          "time": "2026-01-15 17:30",
          "pick": "Doble Oportunidad X2",
          "odd": 1.28,
          "status": "WON",
          "result": "2-3"
        },
        {
          "fixture_id": 454489,
          "sport": "basketball",
          "league": "Euroleague",
          "match": "Anadolu Efes vs Baskonia",
          "time": "2026-01-15 17:30",
          "pick": "Local Gana (ML)",
          "odd": 1.47,
          "status": "LOST",
          "result": "75-89"
        },
        {
          "fixture_id": 454490,
          "sport": "basketball",
          "league": "Euroleague",
          "match": "Bayern vs Panathinaikos",
          "time": "2026-01-15 18:30",
          "pick": "Visitante Gana (ML)",
          "odd": 1.47,
          "status": "LOST",
          "result": "85-78"
        },
        {
          "fixture_id": 470053,
          "sport": "basketball",
          "league": "NBA",
          "match": "Orlando Magic vs Memphis Grizzlies",
          "time": "2026-01-15 19:00",
          "pick": "Local Gana (ML)",
          "odd": 1.5,
          "status": "WON",
          "result": "118-111"
        },
        {
          "fixture_id": 1388452,
          "sport": "football",
          "league": "Bundesliga",
          "match": "FC Augsburg vs Union Berlin",
          "time": "2026-01-15 19:30",
          "pick": "Doble Oportunidad 1X",
          "odd": 1.44,
          "status": "WON",
          "result": "1-1"
        },
        {
          "fixture_id": 454492,
          "sport": "basketball",
          "league": "Euroleague",
          "match": "Olimpia Milano vs Crvena zvezda",
          "time": "2026-01-15 19:30",
          "pick": "Local Gana (ML)",
          "odd": 1.41,
          "status": "LOST",
          "result": "96-104"
        },
        {
          "fixture_id": 1378015,
          "sport": "football",
          "league": "Serie A",
          "match": "Como vs AC Milan",
          "time": "2026-01-15 19:45",
          "pick": "Más de 1.5 Goles",
          "odd": 1.33,
          "status": "PENDING",
          "result": None
        },
        {
          "fixture_id": 454493,
          "sport": "basketball",
          "league": "Euroleague",
          "match": "Paris vs Monaco",
          "time": "2026-01-15 19:45",
          "pick": "Total Puntos Más de 161.5",
          "odd": 1.09,
          "status": "PENDING",
          "result": None
        }
      ]
    }
  ]
}

if __name__ == "__main__":
    print("--- RESTORING 2026-01-15 DATA ---")
    try:
        rs = RedisService()
        key = "daily_bets:2026-01-15"
        
        # Guardar (save_daily_bets adds prefix and handles logic, but set_data is rawer)
        # Using save_daily_bets logic manually to ensure exact format if needed
        # But rs.set_data(key, data) should work since RedisService handles serialization.
        
        # Verify if existing is indeed corrupted/wrong
        print("Restoring...")
        success = rs.set_data(key, DATA_15_JAN)
        
        if success:
            print("SUCCESS: Data for 2026-01-15 restored to Redis.")
        else:
            print("ERROR: Failed to write to Redis.")
            
    except Exception as e:
        print(f"FATAL: {e}")
