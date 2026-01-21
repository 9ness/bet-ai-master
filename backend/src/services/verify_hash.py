import sys
import os
import json
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService

def verify():
    print("--- VERIFYING REDIS HASH LOGIC ---")
    rs = RedisService()
    if not rs.is_active:
        print("[ERR] Redis not active")
        return

    # test date far in future
    date_str = "2099-01-01"
    year_month = "2099-01"
    
    data = {
        "date": date_str,
        "bets": [{"test": "true"}]
    }
    
    # 1. Save
    print(f"1. Saving to {date_str}...")
    rs.save_daily_bets(date_str, [{"betType": "safe", "stake": 1, "selection": []}])
    
    # 2. Read with new accessor
    print(f"2. Reading {date_str}...")
    read_data = rs.get_daily_bets(date_str)
    
    if read_data:
        print("[OK] Data read success")
        print(read_data)
    else:
        print("[ERR] Data read failed")
        
    # 3. Read Raw Hash (Raw Check)
    print("3. Checking Raw Hash...")
    raw = rs._send_command("HGET", rs._get_key(f"daily_bets:{year_month}"), date_str)
    if raw:
        print(f"[OK] Raw Key betai:daily_bets:{year_month} -> {date_str} exists")
    else:
        print(f"[ERR] Raw Key missing")

    # 4. Cleanup
    print("4. Cleaning up...")
    rs._send_command("HDEL", rs._get_key(f"daily_bets:{year_month}"), date_str)
    print("Done.")

if __name__ == "__main__":
    verify()
