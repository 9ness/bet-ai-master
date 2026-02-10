import sys
import os
import json
import time
import math
from datetime import datetime, timedelta

import google.generativeai as genai

# Path setup
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.bet_formatter import BetFormatter
from src.services.json_cleaner import clean_json_matches

def load_system_prompt(filename="system_prompt_tiktok.txt"):
    try:
        # Look in backend root (../../ from here)
        base_path = os.path.join(os.path.dirname(__file__), '../../')
        msg_path = os.path.normpath(os.path.join(base_path, filename))
        
        if os.path.exists(msg_path):
            with open(msg_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        raise FileNotFoundError(f"Could not find {filename} at {msg_path}")

    except Exception as e:
        print(f"[FATAL] System Prompt missing: {e}")
        sys.exit(1)

def analyze_tiktok():
    print("--- TIKTOK VIRAL ANALYSIS STARTED ---")
    
    rs = RedisService()
    try:
        _analyze_logic(rs)
    except Exception as e:
        print(f"[FATAL] TikTok Analysis failed: {e}")
        raise e

def _analyze_logic(rs):
    # 1. Initialization
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY no encontrada")
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-3-pro-preview') # Using smart model for complex reasoning
        print("[INIT] Model configured")
        
    except Exception as e:
        print(f"[FATAL] Service Init Failed: {e}")
        return

    # 2. Fetch Data (TOMORROW)
    now = datetime.now()
    tomorrow = now + timedelta(days=1)
    target_date_str = tomorrow.strftime("%Y-%m-%d")
    month_key = tomorrow.strftime("%Y-%m")
    
    print(f"\n[STEP 1] Fetching Data for TikTok (Date: {target_date_str})...")
    
    # Try Redis specifically for TikTok key (HASH: betai:raw_matches:YYYY-MM_tiktok)
    # Removing 'betai:' manual prefix to rely on RedisService auto-prefixing
    raw_key = f"raw_matches:{month_key}_tiktok"
    redis_hash_key = rs._get_key(raw_key)
    
    print(f"[DEBUG] Fetching HASH Key: '{redis_hash_key}' | Field: '{target_date_str}'")
    
    # Use direct _send_command to avoid wrapper confusion
    raw_json = rs._send_command("HGET", redis_hash_key, target_date_str)
    
    if not raw_json:
        print(f"[ERROR] No raw matches found for {target_date_str}_tiktok in key {redis_hash_key}.")
        # Debug: Check if hash exists at all
        exists = rs._send_command("KEYS", redis_hash_key)
        print(f"[DEBUG] Key Exists Check: {exists}")
        return

    raw_matches = json.loads(raw_json)
    if not raw_matches:
        print(f"[ERROR] Matches list is empty.")
        return
        
    print(f"[DATA] Loaded {len(raw_matches)} matches.")
    
    # Clean Data
    raw_matches = clean_json_matches(raw_matches)
    
    fixture_map = {str(m.get("id")): m for m in raw_matches if m.get("id")}

    # 3. Prompt
    system_instruction = load_system_prompt()
    full_prompt = f"""
{system_instruction}

INPUT DATA (MATCHES FOR {target_date_str}):
{json.dumps(raw_matches, indent=2)}
"""

    valid_bets = None
    
    # 4. Generate
    for i in range(3):
        print(f"[*] Gemini Attempt {i+1}...")
        try:
            response = model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    response_mime_type='application/json'
                )
            )
            
            text = response.text.strip()
            if text.startswith("```json"): text = text[7:-3]
            if text.startswith("```"): text = text[3:-3]
            
            candidates = json.loads(text)
            
            # Helper to map back details and calculate odds
            for bet in candidates:
                # Ensure selections have details
                odds_list = []
                for sel in bet.get("selections", []):
                    source = fixture_map.get(str(sel.get("fixture_id")))
                    if source:
                        sel.update({
                            "match": f"{source.get('home')} vs {source.get('away')}",
                            "league": source.get("league", "Desconocida"),
                            "sport": source.get("sport", "football"),
                            "time": source.get("startTime")
                        })
                    
                    # Collect odd for calculation
                    try:
                        odds_list.append(float(sel.get("odd", 1.0)))
                    except: pass
                
                # Calculate Total Odd
                if odds_list:
                    bet["total_odd"] = round(math.prod(odds_list), 2)
                else:
                    bet["total_odd"] = 0
            
            valid_bets = candidates
            break
        except Exception as e:
            print(f"[!] Generate failed: {e}")
            time.sleep(2)

    if not valid_bets: 
        print("[ERROR] Failed to generate bets.")
        return

    # 5. Save
    # We save to a specific TikTok key: 'daily_bets:YYYY-MM-DD_tiktok'
    # We do NOT use the standard 'daily_bets' key to avoid overwriting the main app data.
    
    output_payload = {
        "date": target_date_str,
        "generated_at": datetime.now().isoformat(),
        "bets": valid_bets
    }
    
    today = datetime.now()
    month_key = tomorrow.strftime("%Y-%m")
    
    # Save to HASH: daily_bets:YYYY-MM_tiktok
    # Field: YYYY-MM-DD
    redis_hash_key = f"daily_bets:{month_key}_tiktok"
    
    rs.client.hset(redis_hash_key, target_date_str, json.dumps(output_payload))
    
    print(f"[SUCCESS] Saved {len(valid_bets)} viral bets to Redis Hash: {rs._get_key(redis_hash_key)} -> Field: {target_date_str}")

if __name__ == "__main__":
    analyze_tiktok()
