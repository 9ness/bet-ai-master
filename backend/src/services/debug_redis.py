import sys
import os
import json
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

# Load Env
try:
    from dotenv import load_dotenv
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    load_dotenv(os.path.join(base_path, 'frontend', '.env.local'))
except: pass

from src.services.redis_service import RedisService

def check_redis_date():
    rs = RedisService()
    target_date = "2026-01-15"
    
    print(f"Checking Redis key: daily_bets:{target_date}")
    raw = rs.get(f"daily_bets:{target_date}")
    
    if not raw:
        print("KEY NOT FOUND or EMPTY")
        return

    data = json.loads(raw) if isinstance(raw, str) else raw
    bets = data.get("bets", [])
    print(f"Found {len(bets)} bets.")
    
    for i, bet in enumerate(bets):
        match_name = bet.get("match")
        status = bet.get("status")
        print(f"Bet {i+1}: {match_name} [{status}]")
        
        for sel in bet.get("selections", []):
            pick = sel.get("pick")
            sel_status = sel.get("status")
            print(f"   - {pick} ({sel.get('fixture_id')}) [{sel_status}]")
            
            # Check specifically for the reported matches
            if sel.get("fixture_id") in [1378015, 454493]:
                print(f"     *** TARGET FOUND: {pick} ***")
                print(f"     Attempts: {bet.get('check_attempts', 0)}")
                print(f"     Raw Selection: {sel}")

if __name__ == "__main__":
    check_redis_date()
