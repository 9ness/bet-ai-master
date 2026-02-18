
import json
import os
import time
import sys
from datetime import datetime, timedelta

# Path setup to include backend root
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

# Mock RedisService import if needed, or rely on project structure
try:
    from src.services.redis_service import RedisService
    rs = RedisService()
    print("[INFO] Connected to Redis via Service")
except ImportError:
    print("[WARN] RedisService not found. Trying to mock or fail.")
    # Assuming we run this from 'backend' dir, so 'src' is available
    sys.exit(1)

today = datetime.now().strftime("%Y-%m-%d")
history_key = f"execution_history:{today}"

if rs.is_active:
    # Clear existing history for today to avoid duplicates in debug
    # rs.delete(history_key) -> Not implemented in RedisService
    # Use raw command:
    full_hkey = rs._get_key(history_key)
    rs._send_command("DEL", full_hkey)
    
    events = [
        # Recolector (08:00 - 08:05)
        {"script": "daily_bet_update.yml", "status": "START", "time": "08:00:00"},
        {"script": "daily_bet_update.yml", "status": "SUCCESS", "time": "08:05:30"},
        
        # Analizador (08:10 - 08:15)
        {"script": "ai_analysis.yml", "status": "START", "time": "08:10:00"},
        {"script": "ai_analysis.yml", "status": "SUCCESS", "time": "08:15:45"},
    
        # Analizador Stakazo (08:16 - 08:20)
        {"script": "ai_analysis_stakazo.yml", "status": "START", "time": "08:16:00"},
        {"script": "ai_analysis_stakazo.yml", "status": "SUCCESS", "time": "08:20:00"},

        # Social (09:00 - 09:02)
        {"script": "generate_social_content.yml", "status": "START", "time": "09:00:00"},
        {"script": "generate_social_content.yml", "status": "SUCCESS", "time": "09:02:10"},
    
        # Comprobador (Varias ejecuciones)
        {"script": "check_results_cron.yml", "status": "START", "time": "10:00:00"},
        {"script": "check_results_cron.yml", "status": "SUCCESS", "time": "10:01:00"},
        
        {"script": "check_results_cron.yml", "status": "START", "time": "14:00:00"},
        {"script": "check_results_cron.yml", "status": "SUCCESS", "time": "14:01:00"},
        
        {"script": "check_results_cron.yml", "status": "START", "time": "18:00:00"},
        # {"script": "check_results_cron.yml", "status": "SUCCESS", "time": "18:01:00"},
    
        # Viral (REMOVED - Future event)
    ]
    
    print(f"[INFO] Seeding {history_key} with {len(events)} events...")
    
    for evt in events:
        # Add timestamps
        evt["timestamp"] = time.time()
        evt["message"] = "Debug Event"
        rs.rpush(history_key, json.dumps(evt))
    
    # Also set Scripts Status for the 'Steps' view (Summary)
    # Using 'betai:status:scripts' hash
    
    def set_status(script, status, time_str):
        # RedisService logs status to HSET 'status:scripts'
        # Calculate timestamp based on today + time_str
        now = datetime.now()
        h, m = map(int, time_str.split(':'))
        dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
        formatted_date = dt.strftime("%Y-%m-%d %H:%M:%S")
        
        data = {
            "date": formatted_date,
            "script": script,
            "status": status,
            "message": f"Manual Set {time_str}"
        }
        
        # 1. Global Last Run
        rs.set("status:last_run", json.dumps(data))
        
        # 2. Per-Script Status
        key_hash = rs._get_key("status:scripts")
        rs._send_command("HSET", key_hash, script, json.dumps(data))
        print(f"[LOG] Manually set status for {script} at {formatted_date}")
        
    set_status("daily_bet_update.yml", "SUCCESS", "07:42") # +1h = 08:42
    set_status("ai_analysis.yml", "SUCCESS", "07:44") # +1h = 08:44
    set_status("ai_analysis_stakazo.yml", "SUCCESS", "08:15") 
    set_status("generate_social_content.yml", "SUCCESS", "09:02") # +1h = 10:02
    set_status("check_results_cron.yml", "SUCCESS", "14:01") # +1h = 15:01
    
    # CLEAR Future Event Status
    key_hash = rs._get_key("status:scripts")
    rs._send_command("HDEL", key_hash, "tiktok_viral_automated.yml")
    print("[LOG] Cleared status for tiktok_viral_automated.yml (Future)")
    
    print("[DONE] Timeline seeded.")
else:
    print("[ERROR] Redis is not active.")
