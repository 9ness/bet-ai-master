import json
import os
import sys

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.src.services.redis_service import RedisService

def seed_data():
    r = RedisService()
    if not r.is_active:
        print("Redis not connected. Check .env.local")
        return

    print("Seeding test data for Jan 1-5, 2026...")

    # Data Configuration
    days = [
        # Day 1: WON (+8.3)
        {
            "date": "2026-01-01",
            "bets": [
                {"type": "safe", "stake": 6, "total_odd": 1.80, "status": "WON", "profit": 4.80, "match": "Liverpool vs Chelsea", "pick": "Gana Liverpool"},
                {"type": "value", "stake": 3, "total_odd": 2.50, "status": "WON", "profit": 4.50, "match": "Brighton vs Wolves", "pick": "Over 2.5 + Gana Brighton",
                 "picks_detail": [
                     {"match": "Brighton vs Wolves", "pick": "Over 2.5", "status": "SUCCESS"},
                     {"match": "Brighton vs Wolves", "pick": "Gana Brighton", "status": "SUCCESS"}
                 ]},
                {"type": "funbet", "stake": 1, "total_odd": 15.0, "status": "LOST", "profit": -1.00, "match": "Combinada Loca", "pick": "8 Partidos",
                 "picks_detail": [
                     {"match": "Arsenal vs Chelsea", "pick": "Gana Arsenal", "status": "SUCCESS"},
                     {"match": "Man Utd vs Liverpool", "pick": "Over 2.5", "status": "SUCCESS"},
                     {"match": "Real Madrid vs Barca", "pick": "Gana Madrid", "status": "FAIL"},
                     {"match": "Juve vs Milan", "pick": "Empate", "status": "SUCCESS"}
                 ]}
            ]
        },
        # Day 2: WON (+3.2)
        {
            "date": "2026-01-02",
            "bets": [
                {"type": "safe", "stake": 6, "total_odd": 1.70, "status": "WON", "profit": 4.20, "match": "Real Madrid vs Getafe", "pick": "Gana Madrid"},
                {"type": "value", "stake": 3, "total_odd": 2.80, "status": "LOST", "profit": -3.00, "match": "Sevilla vs Betis", "pick": "Empate"},
                {"type": "funbet", "stake": 1, "total_odd": 12.0, "status": "WON", "profit": 11.00, "match": "La Quiniela", "pick": "Partidazo",
                 "picks_detail": [
                     {"match": "Betis vs Sevilla", "pick": "Empate", "status": "SUCCESS"},
                     {"match": "Valencia vs Villarreal", "pick": "Gana Valencia", "status": "SUCCESS"},
                     {"match": "Athletic vs Sociedad", "pick": "Over 1.5", "status": "SUCCESS"}
                 ]} 
            ] 
        },
        # Day 3: LOST (-2.8) - Safe Won (low), Value Lost, Funbet Lost
        {
            "date": "2026-01-03",
            "bets": [
                {"type": "safe", "stake": 6, "total_odd": 1.20, "status": "WON", "profit": 1.20, "match": "City vs Burnley", "pick": "Gana City"},
                {"type": "value", "stake": 3, "total_odd": 3.10, "status": "LOST", "profit": -3.00, "match": "Valencia vs Levante", "pick": "Gana Levante"},
                {"type": "funbet", "stake": 1, "total_odd": 20.0, "status": "LOST", "profit": -1.00, "match": "Combinada Riesgo", "pick": "Todo o Nada",
                 "picks_detail": [
                     {"match": "Bayern vs Dortmund", "pick": "Gana Bayern", "status": "SUCCESS"},
                     {"match": "PSG vs OM", "pick": "Red Card Yes", "status": "FAIL"}
                 ]}
            ]
        },
        # Day 4: WON (+1.8)
        {
            "date": "2026-01-04",
            "bets": [
                {"type": "safe", "stake": 6, "total_odd": 1.80, "status": "WON", "profit": 4.80, "match": "Barça vs Atletico", "pick": "Gana Barça"},
                {"type": "value", "stake": 3, "total_odd": 2.20, "status": "LOST", "profit": -3.00, "match": "Bilbao vs Real", "pick": "Over 3.5"},
                {"type": "funbet", "stake": 1, "total_odd": 10.0, "status": "PENDING", "profit": 0, "match": "Pendiente", "pick": "En Juego"} 
            ]
        },
        # Day 5: LOST (-10.0) - All Lost
        {
            "date": "2026-01-05",
            "bets": [
                {"type": "safe", "stake": 6, "total_odd": 1.60, "status": "LOST", "profit": -6.00, "match": "Bayern vs Dortmund", "pick": "Gana Bayern"},
                {"type": "value", "stake": 3, "total_odd": 2.50, "status": "LOST", "profit": -3.00, "match": "PSG vs Lyon", "pick": "Empate"},
                {"type": "funbet", "stake": 1, "total_odd": 18.0, "status": "LOST", "profit": -1.00, "match": "Mega Combi", "pick": "15 Partidos"}
            ]
        }
    ]

    total_month_profit = 0

    for day in days:
        date_str = day["date"]
        # Calculate Day Profit
        day_profit = sum(b["profit"] for b in day["bets"])
        total_month_profit += day_profit
        
        # Structure for History
        history_obj = {
            "date": date_str,
            "day_profit": round(day_profit, 2),
            "bets": day["bets"]
        }
        
        # Save to Redis
        key = r._get_key(f"history:{date_str}")
        r.set(key, json.dumps(history_obj))
        print(f"[SEED] Saved {key}. Profit: {day_profit:.2f}")

    # Set Monthly Stats
    stats_key = r._get_key("stats:2026-01")
    r.hset(stats_key, {
        "total_profit": round(total_month_profit, 2),
        "last_update": "2026-01-08T12:00:00"
    })
    print(f"[SEED] Updated {stats_key}. Total Profit: {total_month_profit:.2f}")

if __name__ == "__main__":
    seed_data()
