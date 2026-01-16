import sys
import os
import json
import time
import requests
import re
from datetime import datetime, timedelta

# Add parent directory to path to import services
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService

# ENV LOADING
try:
    from dotenv import load_dotenv
    # Look for .env.local in common paths (Root, Frontend, etc.)
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend/src/services -> backend
    possible_paths = [
        os.path.join(base_path, '.env.local'),
        os.path.join(base_path, '../.env.local'),
        os.path.join(base_path, '../frontend/.env.local'),
        os.path.join(base_path, 'frontend/.env.local') # Just in case structure is flat
    ]
    
    env_loaded = False
    for p in possible_paths:
        if os.path.exists(p):
            load_dotenv(p)
            # print(f"[INIT] Loaded env from {p}")
            env_loaded = True
            break
except ImportError:
    pass

# API CONFIG
API_KEY = os.getenv("API_KEY")
FOOTBALL_API_URL = "https://v3.football.api-sports.io/fixtures"
BASKETBALL_API_URL = "https://v1.basketball.api-sports.io/games"

HEADERS = {
    'x-rapidapi-host': "v3.football.api-sports.io",
    'x-rapidapi-key': API_KEY
}

# --- HELPERS ---

def get_football_result(fixture_id):
    """
    Fetches match details from API-Football.
    Returns a dict with relevant stats or None if not finished/error.
    """
    url = f"{FOOTBALL_API_URL}?id={fixture_id}"
    # Headers for football specifically usually just need key, but let's be safe
    headers = {
        'x-rapidapi-key': API_KEY
    }
    
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        
        if not data.get("response"):
            return None
            
        match = data["response"][0]
        status = match["fixture"]["status"]["short"]
        
        # Only process if finished
        if status not in ["FT", "AET", "PEN"]:
            return {"status": "PENDING"}

        # Extract Goals
        goals_home = match["goals"]["home"]
        goals_away = match["goals"]["away"]
        
        # Extract Stats (Corners, Cards)
        corners = None # Init as None to distinguish 0 from missing
        cards = 0
        
        stat_found = False
        if match.get("statistics"):
            for team_stats in match["statistics"]:
                # Mark that we have stats
                stat_found = True
                for stat in team_stats.get("statistics", []):
                    if stat["type"] == "Corner Kicks" and stat["value"] is not None:
                        if corners is None: corners = 0
                        corners += int(stat["value"])
                    if stat["type"] in ["Yellow Cards", "Red Cards"] and stat["value"] is not None:
                        cards += int(stat["value"])
        
        # If we found stats block but no specific Corner stat, it might be 0, or data provider omission.
        # Safest is: if stat_found is True, assume we have data.
        if stat_found and corners is None: corners = 0
                        
        return {
            "status": "FINISHED",
            "home_score": goals_home,
            "away_score": goals_away,
            "corners": corners,
            "cards": cards
        }
    except Exception as e:
        print(f"[ERROR] Football API ID {fixture_id}: {e}")
        return None

def get_basketball_result(game_id):
    """
    Fetches match details from API-Basketball.
    """
    url = f"{BASKETBALL_API_URL}?id={game_id}"
    headers = {
        'x-rapidapi-key': API_KEY
    }
    
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        
        if not data.get("response"):
            return None
            
        game = data["response"][0]
        status = game["status"]["short"]
        
        if status not in ["FT", "AOT"]:
            return {"status": "PENDING"}

        scores = game["scores"]
        home_total = scores["home"]["total"]
        away_total = scores["away"]["total"]
        
        return {
            "status": "FINISHED",
            "home_score": home_total,
            "away_score": away_total
        }
        
    except Exception as e:
        print(f"[ERROR] Basketball API ID {game_id}: {e}")
        return None

def check_bets():
    print("--- AUTOMATED RESULT CHECKER STARTED ---")
    
    if not API_KEY:
        print("[FATAL] API_KEY not found in env.")
        return

    rs = RedisService()
    if not rs.is_active:
        print("[FATAL] Redis not active.")
        return

    # Check Today and Yesterday (for late night games)
    dates_to_check = [
        datetime.now().strftime("%Y-%m-%d"),
        (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    ]
    
    total_updates = 0

    for date_str in dates_to_check:
        print(f"[*] Checking bets for date: {date_str}")
        
        # Get raw data
        raw_data = rs.get(f"daily_bets:{date_str}")
        if not raw_data:
            print(f"   - No data found for {date_str}")
            continue
            
        try:
            day_data = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
        except:
            print(f"   - Error parsing JSON for {date_str}")
            continue
            
        if not day_data.get("bets"):
            continue
            
        bets_modified = False
        
        for bet in day_data["bets"]:
            # Skip if already finalized with NEW statuses
            # We allow 'WIN', 'LOSS', 'PENDING' to be re-checked to update format/fix bugs
            if bet.get("status") in ["WON", "LOST", "PUSH", "VOID", "MANUAL_CHECK"]:
                continue
                
            # GLOBAL CHECK: Only proceed if ALL selections are resolved or we find a loser
            selections = bet.get("selections", [])
            if not selections: continue
            
            # Reset logic flags
            all_won = True
            any_lost = False
            pending_count = 0
            
            # Check attempts (Global for bet)
            check_attempts = bet.get("check_attempts", 0)
            
            # --- PROCESS SELECTIONS ---
            for sel in selections:
                # Same for selections: Only skip if strictly WON/LOST (New Schema)
                # EXCEPTION: Re-check Double Chance to fix previous bug
                pick_lower = sel.get("pick", "").lower()
                is_dc = "doble" in pick_lower or "double" in pick_lower or "1x" in pick_lower or "x2" in pick_lower or "12" in pick_lower
                
                if sel.get("status") in ["WON", "LOST", "PUSH", "VOID"] and not is_dc:
                    if sel["status"] == "LOST": any_lost = True
                    if sel["status"] != "WON": all_won = False
                    continue
                    
                # Check Time Constraint (+3 hours margin)
                try:
                    match_time = datetime.strptime(sel["time"], "%Y-%m-%d %H:%M")
                    if datetime.now() < match_time + timedelta(hours=3):
                        # Too early
                        pending_count += 1
                        all_won = False
                        continue
                except:
                    # Parse error, skip safe
                    continue
                
                # --- CALL API ---
                fid = sel.get("fixture_id")
                sport = sel.get("sport", "football").lower()
                
                print(f"   -> Checking {sport} ID {fid} ({sel['match']})...")
                
                data = None
                if sport == "football":
                    data = get_football_result(fid)
                elif sport == "basketball":
                    data = get_basketball_result(fid)
                    
                if not data or data.get("status") == "PENDING":
                    # API No Data or Match not finished despite > 3h
                    pending_count += 1
                    all_won = False
                    
                    # Increment check attempts for this failure
                    check_attempts += 1
                    bet["check_attempts"] = check_attempts
                    bets_modified = True
                    print(f"      [WARN] Data unavail/pending. Attempt {check_attempts}/3")
                    continue
                    
                # --- EVALUATE WIN/LOSS ---
                # --- LOGIC ENGINE ---
                pick = sel["pick"].lower()
                # Normalize accents manually to avoid encoding hell
                pick = pick.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
                
                home_score = data["home_score"]
                away_score = data["away_score"]
                
                is_win = False
                result_str = f"{home_score}-{away_score}"
                
                try:
                    # 1. WINNER (1X2)
                    if "gana" in pick or "win" in pick:
                        if "local" in pick or "home" in pick or "1" in pick.split():
                            is_win = home_score > away_score
                        elif "visitante" in pick or "away" in pick or "2" in pick.split():
                            is_win = away_score > home_score

                    # 1.5 DOUBLE CHANCE (Doble Oportunidad)
                    elif "doble oportunidad" in pick or "double chance" in pick or "1x" in pick or "x2" in pick or "12" in pick.split():
                        # Normalized check
                        clean = pick.replace("doble oportunidad", "").replace("double chance", "").replace("(", "").replace(")", "").strip().upper()
                        
                        # Logic
                        if "1X" in clean or "1X" in pick.upper():
                            # Home Win OR Draw
                            is_win = home_score >= away_score
                        elif "X2" in clean or "X2" in pick.upper():
                            # Away Win OR Draw
                            is_win = away_score >= home_score
                        elif "12" in clean or "12" in pick.split():
                            # Home OR Away (No Draw)
                            is_win = home_score != away_score
                            
                    # 2. GOALS / POINTS (OVER/UNDER)
                    elif "más de" in pick or "mas de" in pick or "over" in pick:
                        # Clean string: "más de 3.5 goles" -> "3.5"
                        clean_pick = pick.replace("más de", "").replace("over", "").replace("goles", "").replace("goals", "").replace("puntos", "").replace("points", "").replace("pts", "").strip()
                        # Extract first valid number
                        match = re.search(r'\d+(\.\d+)?', clean_pick)
                        if match:
                             val = float(match.group())
                        else:
                             # Fallback
                             val = float(clean_pick.split()[0].replace(",", "."))
                        
                        total = home_score + away_score
                        is_win = total > val
                        # Add totals to result
                        if sport == "basketball":
                            result_str += f" | {total} Pts"
                        else:
                            result_str += f" | {total} Goles"
                        
                    elif "menos de" in pick or "under" in pick:
                        clean_pick = pick.replace("menos de", "").replace("under", "").replace("goles", "").replace("goals", "").replace("puntos", "").replace("points", "").replace("pts", "").strip()
                        match = re.search(r'\d+(\.\d+)?', clean_pick)
                        if match:
                             val = float(match.group())
                        else:
                             val = float(clean_pick.split()[0].replace(",", "."))
                             
                        total = home_score + away_score
                        is_win = total < val
                        if sport == "basketball":
                            result_str += f" | {total} Pts"
                        else:
                            result_str += f" | {total} Goles"
                    
                    # 3. BOTH TO SCORE (Football)
                    elif "ambos marcan" in pick or "btts" in pick:
                        if "sí" in pick or "yes" in pick:
                            is_win = home_score > 0 and away_score > 0
                        else:
                            is_win = home_score == 0 or away_score == 0

                    # 4. HANDICAP (Basket mainly)
                    elif "hándicap" in pick or "handicap" in pick or "ah" in pick:
                        # Normalize: "Local AH +3.5" -> remove words -> "+3.5"
                        # Parsing logic: Find the number in the string (can be negative or positive)
                        # Regex to find number like +3.5, -4.5, 5.5
                        match_num = re.search(r'[-+]?\d*\.?\d+', pick.split(' ')[-1])
                        if match_num:
                            line = float(match_num.group())
                        else:
                            # Fallback if pick structure is unexpectedly complex
                            parts = pick.replace("hándicap", "").replace("asiático", "").replace("ah", "").split()
                            line = float(parts[-1])
                        
                        # Apply Handicap
                        if "local" in pick or "home" in pick or "1" in pick.split():
                            # Bet on Home with Line
                            # Adjusted Home Score = Home + Line
                            adj_home = home_score + line
                            is_win = adj_home > away_score
                            
                            diff = adj_home - away_score
                            sign = "+" if diff > 0 else ""
                            result_str += f" | {sign}{round(diff, 1)}"
                            
                        elif "visitante" in pick or "away" in pick or "2" in pick.split():
                            # Bet on Away with Line
                            adj_away = away_score + line
                            is_win = adj_away > home_score
                            
                            diff = adj_away - home_score
                            sign = "+" if diff > 0 else ""
                            result_str += f" | {sign}{round(diff, 1)}"

                    # 5. CORNERS (Football)
                    elif "córner" in pick or "corner" in pick:
                        total_corners = data.get("corners")
                        if total_corners is not None:
                             result_str += f" | {total_corners} Córners"
                        
                        if "más de" in pick or "over" in pick:
                            clean_pick = pick.replace("más de", "").replace("over", "").replace("córners", "").replace("corners", "").strip()
                            val = float(clean_pick.split()[0].replace(",", "."))
                            if total_corners is not None:
                                is_win = total_corners > val
                            else:
                                raise ValueError("No Corner Data")

                except Exception as e:
                    print(f"      [WARN] Logic Parsing Error for '{pick}': {e}")
                    # Skip auto-eval if we can't parse logic
                    pending_count += 1
                    all_won = False
                    continue

                # --- UPDATE SELECTION ---
                status_str = "WON" if is_win else "LOST"
                print(f"      => Result: {status_str} ({result_str})")
                
                sel["status"] = status_str
                sel["result"] = result_str
                bets_modified = True
                
                if not is_win: any_lost = True
                if not is_win: all_won = False

            # --- UPDATE BET STATUS (Compound) ---
            old_status = bet.get("status")
            new_status = old_status
            
            # Check Retry Limit
            if check_attempts >= 3 and new_status == "PENDING" and pending_count > 0:
                 new_status = "MANUAL_CHECK"
                 print(f"      [!] Max attempts reached ({check_attempts}). Marked as MANUAL_CHECK.")

            if any_lost:
                new_status = "LOST"
                bet["profit"] = -1 * bet["stake"]
            elif all_won and pending_count == 0:
                new_status = "WON"
                bet["profit"] = round(bet["estimated_units"], 2)
            
            if new_status != old_status:
                bet["status"] = new_status
                bets_modified = True
        
        # --- SAVE IF MODIFIED ---
        if bets_modified:
            # Recalculate Day Profit
            day_profit = 0
            for b in day_data["bets"]:
                # Check for WON/LOST (Standard) and potentially legacy WIN/LOSS just in case
                if b.get("status") in ["WON", "LOST", "WIN", "LOSS", "GANADA", "PERDIDA"]:
                    day_profit += b.get("profit", 0)
            
            day_data["day_profit"] = round(day_profit, 2)
            
            # Save to Specific Date Key
            rs.set_data(f"daily_bets:{date_str}", day_data)
            
            # --- SYNC MASTER KEY (betai:daily_bets) ---
            # We must verify if the master key is currently holding THIS date's data.
            # If so, we must update it to reflect the changes (active view).
            try:
                master_json = rs.get("daily_bets")
                if master_json:
                    master_data = json.loads(master_json) if isinstance(master_json, str) else master_json
                    
                    if master_data.get("date") == date_str:
                        # The master key is displaying this day's bets. Sync it.
                        import copy
                        mirror = copy.deepcopy(day_data)
                        rs.set_data("daily_bets", mirror)
                        print(f"      [SYNC] Master Key 'daily_bets' updated for {date_str}")
            except Exception as e:
                print(f"      [WARN] Failed to sync master key: {e}")
                
            print(f"[SUCCESS] Updated results for {date_str}. Day Profit: {day_profit}")
            total_updates += 1
        else:
            print(f"[*] No changes for {date_str}")

    rs.log_status("Check Results", "SUCCESS" if total_updates > 0 else "IDLE", f"Updated {total_updates} days")

if __name__ == "__main__":
    check_bets()
