import os
import json
import sys

# Hack path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.src.services.redis_service import RedisService

if __name__ == "__main__":
    rs = RedisService()
    
    keys_to_check = [
        "daily_bets",
        "daily_bets:2026-01-19",
        "daily_bets:2026-01-20"
    ]

    for k in keys_to_check:
        print(f"\n--- Checking {k} ---")
        sys.stdout.flush()
        val = rs.get(k)
        if val:
            try:
                data = json.loads(val)
                print(f"Date Field: {data.get('date')}")
                print(f"Bets Count: {len(data.get('bets', []))}")
                if data.get('bets'):
                    print(f"First Bet: {data['bets'][0].get('match')}")
            except:
                print("Raw Value (Not JSON):", val[:50])
        else:
            print("NOT FOUND / NULL")
        sys.stdout.flush()
