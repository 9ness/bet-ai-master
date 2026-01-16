import sys
import os
import json
from datetime import datetime

# Add parent directory
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

# Load Env
try:
    from dotenv import load_dotenv
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    load_dotenv(os.path.join(base_path, 'frontend', '.env.local'))
except: pass

from src.services.redis_service import RedisService

def reset_attempts():
    rs = RedisService()
    # Check specific date or today/yesterday
    target_date = "2026-01-15" 
    
    print(f"--- Resetting Attempts for {target_date} ---")
    raw = rs.get(f"daily_bets:{target_date}")
    
    if not raw:
        print("No data found.")
        return

    data = json.loads(raw) if isinstance(raw, str) else raw
    bets = data.get("bets", [])
    modified = False
    
    for bet in bets:
        # FORCE RESET FOR TARGET MATCHES
        match_name = bet.get("match", "")
        if "Como" in match_name or "Paris" in match_name or "Monaco" in match_name:
            print(f"FORCE RESETTING: {match_name}")
            bet["status"] = "PENDING"
            bet["check_attempts"] = 0
            bet["profit"] = 0
            # Reset selections too
            for sel in bet.get("selections", []):
                sel["status"] = "PENDING"
                sel["result"] = None
            modified = True
            
        # Reset attempts if it's not finalized (or even if it is MANUAL_CHECK)
        elif bet.get("status") in ["PENDING", "MANUAL_CHECK"]:
            print(f"Resetting bet: {bet.get('match')}")
            bet["check_attempts"] = 0
            if bet.get("status") == "MANUAL_CHECK":
                 bet["status"] = "PENDING"
            modified = True
            
    if modified:
        rs.set_data(f"daily_bets:{target_date}", data)
        print("Redis updated successfully.")
    else:
        print("No bets needed resetting.")

if __name__ == "__main__":
    reset_attempts()
