import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from src.services.redis_service import RedisService

def restore_data():
    data = {
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
      "reason": "Análisis de Vulnerabilidad Estructural: Watford presenta una solidez defensiva en casa (Vicarage Road) muy superior al rendimiento visitante del Portsmouth. La cuota 1.73 refleja una probabilidad del 58%, pero los métricos de xG (Goles Esperados) recientes de Watford sugieren una probabilidad real cercana al 65%, ofreciendo un ligero margen de valor en una selección 'Safe'. Portsmouth llega con bajas métricas de posesión en campo rival.",
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
      "reason": "Dinámica Ofensiva y Edge: AZ Alkmaar (cuota base 1.33) enfrenta a la defensa más permisiva de la liga. La discrepancia clave está en la línea de goles: el mercado espera goles (Over 2.5 @ 1.40), pero subestima la capacidad de AZ de cubrir la línea por sí mismo. Al combinar Victoria + Over 3.5 (2.62), atacamos la alta probabilidad de un 3-1 o 4-0, capitalizando la necesidad de AZ de mejorar su diferencial de goles. El 'Pace' del partido será dictado por AZ, forzando un escenario de transiciones rotas ideal para goleada.",
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
      "reason": "Acumulador táctico de 'Pequeñas Certezas'. Mezclamos la superioridad técnica del Barcelona y la solidez local del Southampton en fútbol, con hándicaps ajustados en baloncesto europeo donde equipos como Turk Telekom y Besiktas tienen ventajas de roster significativas (Usage Rate y Profundidad) frente a sus rivales de hoy. Cada selección individual tiene un riesgo controlado (cuota < 1.50) para maximizar la probabilidad compuesta.",
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
    rs.save_daily_bets("2026-01-21", data["bets"])
    print("[SUCCESS] Data restored manually.")

if __name__ == "__main__":
    restore_data()
