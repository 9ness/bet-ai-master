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
        selections = bet.get("selections", [])
        
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
        
        # 1. Pre-process: Clean asterisks and replace technical terms
        import re
        clean_reason = raw_reason.replace('*', '')
        clean_reason = re.sub(r'BTTS', 'ambos marcan', clean_reason, flags=re.IGNORECASE)

        # 2. Extract exactly the 3 main points based on start of line/string
        # This prevents breaking on 'St.' or decimals like '1.83'
        segments = re.split(r'(?:\A|\n)\s*([123][\.\)])\s+', clean_reason)
        
        if len(segments) > 1:
            final_lines = []
            # We skip segments[0] as it's text before the first point (usually empty or noise)
            for i in range(1, len(segments), 2):
                num = segments[i]
                content = segments[i+1].strip() if (i+1) < len(segments) else ""
                if content:
                    # Clean up: remove internal newlines to keep each point as a single compact block
                    content = content.replace('\n', ' ').replace('  ', ' ')
                    
                    # Logic to bold the title (up to the colon)
                    title_match = re.match(r'^([^:]+:)(.*)', content)
                    if title_match:
                        title = title_match.group(1)
                        rest = title_match.group(2)
                        final_lines.append(f"🟢 <b>{num} {title}</b>{rest}")
                    else:
                        final_lines.append(f"🟢 <b>{num}</b> {content}")
            
            formatted_reason = "\n\n".join(final_lines)
        else:
            # Fallback if no specific points found
            formatted_reason = f"🟢 {clean_reason.strip().replace('\n', ' ')}"

        # 3. Stake formatting (ensure integer)
        raw_stake = bet.get('stake', 1)
        try:
            stake_val = int(float(raw_stake))
        except:
            stake_val = raw_stake

        # 4. Construct Final Message
        msg = (
            f"{league_text}\n\n"
            f"{matches_block}\n\n"
            f"📊 <b>Cuota {bet.get('total_odd', 1.0)}   | 📈 STAKE {stake_val}</b>\n"
            f"🏠 Apuesta realizada en Bet365\n"
            f"🔞 Apuesta con responsabilidad.\n\n"
            f"🧠 <b>Análisis de BetAiMaster:</b>\n"
            f"<blockquote>{formatted_reason}</blockquote>"
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
                f"📊 <b>REPORTE MENSUAL - {month_str}</b> 📊\n\n"
                f"{icon_profit} <b>Profit:</b> {total_profit} u\n"
                f"📈 <b>Yield:</b> {yield_val}%\n"
                f"🎯 <b>Win Rate:</b> {win_rate}%\n"
                f"📅 <b>Días Operados:</b> {days}\n\n"
                f"🧠 <b>BetAiMaster Analytics</b>"
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
