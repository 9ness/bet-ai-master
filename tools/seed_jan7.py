import json
import os
import sys
from dotenv import load_dotenv

# Add root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# EXPLICIT LOAD
env_path_1 = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', '.env.local')
env_path_2 = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env.local')

if os.path.exists(env_path_1):
    load_dotenv(env_path_1)
    print(f"Loaded {env_path_1}")
elif os.path.exists(env_path_2):
    load_dotenv(env_path_2)
    print(f"Loaded {env_path_2}")

from backend.src.services.redis_service import RedisService

def seed_jan7_data():
    r = RedisService()
    if not r.is_active:
        print("Redis not connected. Check .env.local")
        # FORCE DEBUG
        print(f"URL: {os.getenv('UPSTASH_REDIS_REST_URL')}") 
        return

    print("Cleaning up Test Data (Jan 1-5)...")
    
    # 1. CLEANUP
    for d in range(1, 6):
        date_str = f"2026-01-0{d}"
        key_hist = f"history:{date_str}"
        key_bets = f"bets:{date_str}"
        
        # RedisService methods (get/set) apply prefix automatically now via _get_key
        # Wait, clean deletion needs standard redis 'DEL' command
        # RedisService doesn't have delete method exposed directly clearly.
        # But `_send_command` is available.
        # And `_get_key` handles prefixing.
        
        # We need to construct the full key for display, but send proper command
        # Since r.set uses _get_key, let's just use _send_command with cleaned key handling
        # Or better, let's just set them to empty or add a delete method helper?
        # Simpler: use _send_command("DEL", r._get_key(key_hist)) ?
        
        # Let's inspect redis_service again. _get_key is public-ish.
        full_key_hist = r._get_key(key_hist)
        full_key_bets = r._get_key(key_bets)
        
        # Using raw access might be needed if DEL isn't wrapped
        r._send_command("DEL", full_key_hist)
        r._send_command("DEL", full_key_bets)
        print(f"[DEL] Deleted {full_key_hist} and {full_key_bets}")

    # Reset Stats
    stats_key_month = "stats:2026-01"
    full_stats_key = r._get_key(stats_key_month)
    r._send_command("DEL", full_stats_key)
    print(f"[DEL] Deleted {full_stats_key} (Resetting stats)")

    print("-" * 30)
    print("Seeding CONFIRMED Data for Jan 7, 2026...")

    # 2. SEED JAN 7
    target_date = "2026-01-07"
    
    bets_data = [
        {
            "type": "safe",
            "match": "Parma vs Inter",
            "pick": "Gana Inter",
            "stake": 6,
            "total_odd": 1.35,
            "status": "WON", # Converted from 'SUCCESS'
            "profit": 2.10
        },
        {
            "type": "value",
            "match": "Lazio vs Fiorentina",
            "pick": "Empate (X)",
            "stake": 3,
            "total_odd": 2.98,
            "status": "WON",
            "profit": 5.94
        },
        {
            "type": "funbet",
            "match": "Combinada Italiana + Inglesa",
            "pick": "Combi (Lazio 1-1, City Over 3.5)",
            "stake": 1,
            "total_odd": 9.25, # Corrected from 15.00
            "status": "LOST",
            "profit": -1.00,
            "picks_detail": [
                {"match": "Lazio vs Fiorentina", "pick": "Marcador Exacto 1-1", "status": "FAIL"},
                {"match": "Man City vs ...", "pick": "Over 3.5 Goals", "status": "FAIL"}
            ]
        }
    ]

    day_profit = 7.04
    
    history_obj = {
        "date": target_date,
        "day_profit": day_profit,
        "bets": bets_data
    }
    
    # Save History
    r.set(f"history:{target_date}", json.dumps(history_obj))
    print(f"[SEED] Saved history:{target_date} | Profit: +{day_profit}u")

    # 3. UPDATE STATS
    # New profit is just today's profit since we verified reset
    r.hset(stats_key_month, {
        "total_profit": day_profit,
        "last_update": "2026-01-08T13:00:00"
    })
    print(f"[SEED] Updated {stats_key_month} | Total Profit: +{day_profit}u")

if __name__ == "__main__":
    seed_jan7_data()
