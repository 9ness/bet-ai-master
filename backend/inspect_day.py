
import sys
import os
import json
from datetime import datetime

# Add parent to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'src/services'))

from services.redis_service import RedisService

def inspect_day(date_str):
    rs = RedisService()
    if not rs.is_active:
        print("Redis unavailable")
        return

    print(f"--- INSPECTION FOR {date_str} ---")
    
    for cat in ["daily_bets", "daily_bets_stakazo"]:
        print(f"\nCategory: {cat}")
        raw = rs.get_daily_bets(date_str, category=cat)
        if not raw and cat == "daily_bets":
             raw = rs.get(f"daily_bets:{date_str}")
        
        if not raw:
            print("  No data found.")
            continue
            
        data = json.loads(raw) if isinstance(raw, str) else raw
        bets = data.get("bets", [])
        print(f"  Total Bets: {len(bets)}")
        
        for i, bet in enumerate(bets):
            match_title = bet.get("match", "Unknown")
            status = bet.get("status")
            print(f"  Bet #{i}: {match_title} | Status: {status}")
            
            for j, sel in enumerate(bet.get("selections", [])):
                s_match = sel.get("match")
                s_pick = sel.get("pick")
                s_status = sel.get("status")
                s_time = sel.get("time")
                print(f"    - Sel #{j}: {s_match} ({s_pick}) | Status: {s_status} | Time: {s_time}")

if __name__ == "__main__":
    inspect_day("2026-02-04")
