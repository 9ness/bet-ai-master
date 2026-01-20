import sys
import os
import json
import uuid
import argparse
from datetime import datetime

# Add project root to path to import services
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService

def generate_messages_from_analysis(date_str):
    print(f"[*] Starting Telegram Message Generation for {date_str}...")
    
    rs = RedisService()
    if not rs.is_active:
        print("[ERROR] Redis is not active.")
        return False

    # 1. Fetch Daily Analysis
    daily_key = f"daily_bets:{date_str}"
    
    # Try getting from Redis directly via service wrapper (which prefixes)
    # The redundant check is because sometimes keys are stored with prefix included or not in older logic
    raw_data = rs.get(daily_key)
    
    if not raw_data:
        # Fallback try without prefix if the service adds it automatically
        # But rs.get adds prefix. Let's try raw command if needed or assume standard key
        print(f"[ERROR] No analysis found for key: {daily_key}")
        # Try finding it in the full list of keys? No, strict key requirement.
        return False

    try:
        data = json.loads(raw_data)
    except Exception as e:
        print(f"[ERROR] Failed to parse JSON for {daily_key}: {e}")
        return False

    bets = data.get("bets", [])
    if not bets:
        print(f"[WARNING] No bets found in analysis for {date_str}.")
        # We proceed to save empty list or handle it? Better to return False to avoid wiping store if it's an error.
        # But if it's genuinely empty, we might want to update.
        # Let's assume strict validation -> No bets = No telegram messages.
        return False

    # 2. Logic from old redis_service (Message Formatting)
    telegram_items = []
    
    type_map = {
        "safe": {"icon": "🛡️", "title": "LA APUESTA SEGURA"},
        "value": {"icon": "⚡", "title": "LA APUESTA DE VALOR"},
        "funbet": {"icon": "💣", "title": "LA FUNBET"}
    }

    for bet in bets:
        b_type = bet.get("betType", "safe").lower()
        info = type_map.get(b_type, type_map["safe"])
        
        matches_lines = []
        selections = bet.get("selections", [])
        
        # Format selections
        for sel in selections:
            match_line = f"⚽ {sel.get('match', 'Unknown')}\n🎯 {sel.get('pick', 'Pick')} @ {sel.get('odd', 1.0)}"
            matches_lines.append(match_line)
        
        matches_block = "\n\n".join(matches_lines)
        
        if not matches_block:
            matches_block = "No selections data."

        # Format Analysis Text
        raw_reason = bet.get('reason', 'Sin análisis')
        formatted_reason = raw_reason

        # Only format if it's a long block of text
        if len(raw_reason) > 30 and '.' in raw_reason:
            # Split by ". " to identify sentences, filtering empty strings
            # Utilizing a simple split strategy.
            segments = [s.strip() for s in raw_reason.split('.') if len(s.strip()) > 3]
            
            if len(segments) > 0:
                bullet_lines = []
                for seg in segments:
                    # Add period back if missing
                    line = seg if seg.endswith('.') else f"{seg}."
                    bullet_lines.append(f"🟢 {line}")
                
                formatted_reason = "\n\n".join(bullet_lines)

        msg = (
            f"{matches_block}\n\n"
            f"📊 *Cuota Total:* {bet.get('total_odd', 1.0)}\n"
            f"💰 *Stake:* {bet.get('stake', 1)}/10\n\n"
            f"🧠 *Análisis de BetAiMaster:*\n"
            f"{formatted_reason}"
        )

        item = {
            "id": str(uuid.uuid4()),
            "tipo": info["title"].replace("LA ", ""),
            "bet_type_key": b_type,
            "enviado": False,
            "mensaje": msg,
            "timestamp": datetime.now().isoformat()
        }
        telegram_items.append(item)

    # 3. Store in Telegram Queue (Managing Retention)
    store_key = "telegram_store" # Service adds prefix
    
    # Get current store to check dates
    # Assuming helper to get all hash keys/values not readily available in simple wrapper, 
    # we rely on specific commands.
    # We will use keys command? No, HGETALL.
    # Since rs._send_command is internal, we use rs.client logic if available or extend it.
    # In previous step we added logic to redis_service but now we are externalizing it.
    # We can use rs._send_command ("HGETALL", rs._get_key(store_key))
    
    full_store_key = rs._get_key(store_key)
    current_store_raw = rs._send_command("HGETALL", full_store_key)

    current_dates = []
    if current_store_raw and isinstance(current_store_raw, list):
        # Upstash REST: ["key", "val", "key", "val"]
        for i in range(0, len(current_store_raw), 2):
            current_dates.append(current_store_raw[i])
    elif current_store_raw and isinstance(current_store_raw, dict):
         # Standard Redis Py returning dict
         current_dates = list(current_store_raw.keys())
    
    # Retention Rule: Max 2
    if len(current_dates) >= 2 and date_str not in current_dates:
        current_dates.sort()
        # If we have 2 or more, and adding a NEW one, remove oldest to make space
        # But wait, if we have 2 (e.g. Yesterday, Today) and we are updating Today, we don't delete.
        # If we have Yesterday, DayBeforeYesterday, and adding Today -> Delete DayBeforeYesterday.
        # Let's keep strict 2.
        while len(current_dates) >= 2:
            oldest = current_dates[0]
            if oldest == date_str: 
                break # Don't delete self if re-generating
            rs._send_command("HDEL", full_store_key, oldest)
            print(f"[Telegram] Retention Cleanup: Removed {oldest}")
            current_dates.pop(0)

    # Save New Data
    payload_json = json.dumps(telegram_items)
    rs._send_command("HSET", full_store_key, date_str, payload_json)
    
    print(f"[SUCCESS] Generated and stored {len(telegram_items)} messages for {date_str}.")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Telegram Message Generator')
    parser.add_argument('--date', type=str, help='Date to process (YYYY-MM-DD). Defaults to today.', default=datetime.now().strftime("%Y-%m-%d"))
    
    args = parser.parse_args()
    
    try:
        success = generate_messages_from_analysis(args.date)
        if not success:
            sys.exit(1)
    except Exception as e:
        print(f"[CRITICAL] Generator Failed: {e}")
        sys.exit(1)
