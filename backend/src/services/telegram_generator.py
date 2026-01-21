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
    # Use get_daily_bets to support Hash Storage
    # rs.get_daily_bets returns dict/list/None
    raw_bets_data = rs.get_daily_bets(date_str)
    
    if not raw_bets_data:
        print(f"[ERROR] No analysis found for date: {date_str}")
        return False

    # Extract Bets List
    bets = []
    if isinstance(raw_bets_data, dict):
        # Could be full day object or just dict wrapper
        bets = raw_bets_data.get("bets", [])
    elif isinstance(raw_bets_data, list):
        bets = raw_bets_data
    elif isinstance(raw_bets_data, str):
         try:
             parsed = json.loads(raw_bets_data)
             if isinstance(parsed, dict): bets = parsed.get("bets", [])
             elif isinstance(parsed, list): bets = parsed
         except: pass

    if not bets:
        print(f"[WARNING] No bets found in analysis for {date_str}.")
        return False
        
    # Proceed (we have bets list)
    # 2. Logic from old redis_service (Message Formatting)

    # Proceed (we have bets list)
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
        
        # New Formatting Logic
        # 1. League Header
        # If single selection, use its league. If multiple, try to find common or list "Multiple"
        leagues = list(set([s.get('league', 'Desconocida') for s in selections]))
        if len(leagues) == 1:
            league_text = f"🏆 {leagues[0]}"
        else:
            league_text = "🏆 Varios Torneos"

        # 2. Selections Block
        matches_lines = []
        sport_icons = {"football": "⚽", "basketball": "🏀", "tennis": "🎾", "default": "🏅"}
        
        for sel in selections:
            sport = sel.get('sport', 'football').lower()
            icon = sport_icons.get(sport, sport_icons["default"])
            match_name = sel.get('match', 'Unknown')
            pick = sel.get('pick', 'Pick')
            
            # Format: 
            # (Sport Icon) (Match)
            # 👉🏼 Selection
            
            block = f"{icon} {match_name}\n👉🏼 {pick}"
            matches_lines.append(block)
        
        # Join multiple selections with a newline gap
        matches_block = "\n\n".join(matches_lines)
        
        if not matches_block:
            matches_block = "No selections data."

        # Format Analysis Text
        raw_reason = bet.get('reason', 'Sin análisis')
        formatted_reason = raw_reason

        # Only format if it's a long block of text and likely needs bullet points
        if len(raw_reason) > 30 and '.' in raw_reason:
            segments = [s.strip() for s in raw_reason.split('.') if len(s.strip()) > 3]
            if len(segments) > 0:
                bullet_lines = []
                for seg in segments:
                    line = seg if seg.endswith('.') else f"{seg}."
                    bullet_lines.append(f"🟢 {line}")
                formatted_reason = "\n\n".join(bullet_lines)

        # 3. Construct Final Message
        msg = (
            f"{league_text}\n\n"
            f"{matches_block}\n\n"
            f"📊 Cuota {bet.get('total_odd', 1.0)}   | 📈 STAKE {bet.get('stake', 1)}\n"
            f"🏠 Apuesta realizada en Bet365\n"
            f"🔞 Apuesta con responsabilidad.\n\n"
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

    # --- NEW: MONTHLY STATS REPORT ---
    # Generates a card for the current month's stats (up to today)
    try:
        month_str = date_str[:7] # YYYY-MM
        stats_key = f"stats:{month_str}"
        stats_raw = rs.get(stats_key)
        
        if stats_raw:
            stats = json.loads(stats_raw)
            total_profit = stats.get("total_profit", 0)
            yield_val = stats.get("yield", 0)
            win_rate = stats.get("win_rate", 0) # or win_rate_days
            days = stats.get("days_operated", 0)
            
            # Format
            icon_profit = "✅" if total_profit >= 0 else "🔻"
            month_name = datetime.strptime(month_str, "%Y-%m").strftime("%B %Y").upper() # locale warning, English default maybe
            
            msg = (
                f"📊 *REPORTE MENSUAL - {month_str}* 📊\n\n"
                f"{icon_profit} *Profit:* {total_profit} u\n"
                f"📈 *Yield:* {yield_val}%\n"
                f"🎯 *Win Rate:* {win_rate}%\n"
                f"📅 *Días Operados:* {days}\n\n"
                f"🧠 *BetAiMaster Analytics*"
            )
            
            stats_item = {
                "id": str(uuid.uuid4()),
                "tipo": "REPORTE MENSUAL",
                "bet_type_key": "monthly_report", # Special key for coloring
                "enviado": False,
                "mensaje": msg,
                "timestamp": datetime.now().isoformat()
            }
            telegram_items.append(stats_item)
            print(f"[Telegram] Monthly Report generated for {month_str}")
            
    except Exception as e:
        print(f"[WARN] Failed to generate monthly report: {e}")

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
