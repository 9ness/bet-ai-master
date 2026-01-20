import os
import json
import sys

# Hack path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.src.services.redis_service import RedisService

if __name__ == "__main__":
    rs = RedisService()
    
    # SOURCE: Yesterday (19th) - The "Historical" one user updated
    source_key = "daily_bets:2026-01-19"
    
    # TARGET: Master
    target_key = "daily_bets"
    
    print(f"Reading {source_key}...")
    source_val = rs.get(source_key)
    
    if not source_val:
        print(f"ERROR: Source {source_key} not found!")
        sys.exit(1)
        
    print(f"Source found. Length: {len(source_val)}")
    
    # WRITE to Target
    print(f"Overwriting {target_key}...")
    # rs.set_data handles prefix internally if we use set_data? 
    # But read used get(). let's use client directly or set_data.
    # set_data expects a generic object and json.dumps it. 
    # source_val IS already a string (json).
    # So we should use _send_command or just rs.client.set if available.
    
    # Decode to ensure it's valid dict, then re-encode via set_data to be safe
    try:
        data = json.loads(source_val)
        # Ensure date matches? User might want to display "Yesterday's" bets as "Today's" highlight?
        # No, just mirror it.
        rs.set_data(target_key, data)
        print("SUCCESS: Synced.")
    except Exception as e:
        print(f"FAILED: {e}")
