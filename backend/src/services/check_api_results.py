import sys
import os
import json
import time
import requests
from datetime import datetime, timedelta

# Add parent directory to path to import services
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService

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
            # Skip if already resolved (WIN/LOSS/PUSH/MANUAL_CHECK)
            if bet.get("status") in ["WIN", "LOSS", "PUSH", "VOID", "MANUAL_CHECK"]:
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
                # Skip if selection already final
                if sel.get("status") in ["WIN", "LOSS", "PUSH", "VOID"]:
                    if sel["status"] == "LOSS": any_lost = True
                    if sel["status"] != "WIN": all_won = False
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
                pick = sel["pick"].lower()
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
                            
                    # 2. GOALS / POINTS (OVER/UNDER)
                    elif "más de" in pick or "over" in pick:
                        val = float(pick.split()[-1].replace(",", "."))
                        total = home_score + away_score
                        is_win = total > val
                        if sport == "basketball":
                            result_str += f" | {total} Pts"
                        else:
                            result_str += f" | {total} Goles"
                        
                    elif "menos de" in pick or "under" in pick:
                        val = float(pick.split()[-1].replace(",", "."))
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
                    elif "hándicap" in pick:
                        parts = pick.replace("hándicap", "").replace("asiático", "").split()
                        line = float(parts[-1])
                        
                        margin = home_score - away_score
                        
                        if "local" in pick or "home" in pick:
                            cover = margin + line
                            is_win = cover > 0
                            sign = "+" if cover > 0 else ""
                            result_str += f" | {sign}{round(cover, 1)}"
                            
                        elif "visitante" in pick or "away" in pick:
                            cover = -margin + line
                            is_win = cover > 0
                            sign = "+" if cover > 0 else ""
                            result_str += f" | {sign}{round(cover, 1)}"

                    # 5. CORNERS (Football)
                    elif "córner" in pick or "corner" in pick:
                        total_corners = data.get("corners")
                        if total_corners is not None:
                             result_str += f" | {total_corners} Córners"
                        
                        if "más de" in pick or "over" in pick:
                            val = float(pick.split()[-1])
                            if total_corners is not None:
                                is_win = total_corners > val
                            else:
                                raise ValueError("No Corner Data")

                except Exception as e:
                    print(f"      [WARN] Logic Parsing Error for '{pick}': {e}")
                    pending_count += 1
                    all_won = False
                    continue

                # --- UPDATE SELECTION ---
                status_str = "WIN" if is_win else "LOSS"
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
                new_status = "LOSS"
                bet["profit"] = -1 * bet["stake"]
            elif all_won and pending_count == 0:
                new_status = "WIN"
                bet["profit"] = round(bet["estimated_units"], 2)
            
            if new_status != old_status:
                bet["status"] = new_status
                bets_modified = True
        
        # --- SAVE IF MODIFIED ---
        if bets_modified:
             # Recalculate Day Profit
            day_profit = 0
            for b in day_data["bets"]:
                if b.get("status") in ["WIN", "LOSS"]:
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
