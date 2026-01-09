import os
import sys
import json
import requests
import re
from datetime import datetime, timedelta

# Adjust path to allow imports from src if running from project root
# This assumes the script is located at `project_root/backend/src/services/check_results.py`
# and we want to add `project_root/backend` to the Python path.
script_dir = os.path.dirname(__file__)
backend_path = os.path.abspath(os.path.join(script_dir, '..', '..'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from src.services.redis_service import RedisService

class ResultChecker:
    def __init__(self):
        self.redis = RedisService()
        self.api_key = os.getenv("API_KEY")
        self.base_url = "https://v3.football.api-sports.io"
        self.headers = {"x-apisports-key": self.api_key}

        yesterday = datetime.now() - timedelta(days=1)
        return yesterday.strftime("%Y-%m-%d")

    def _fetch_fixture_result(self, fixture_id):
        try:
            url = f"{self.base_url}/fixtures"
            params = {"id": fixture_id}
            resp = requests.get(url, headers=self.headers, params=params)
            
            if resp.status_code != 200:
                print(f"[API] Error {resp.status_code} fetching fixture {fixture_id}")
                return None
            
            data = resp.json().get("response", [])
            if not data: return None
            
            match = data[0]
            status = match["fixture"]["status"]["short"]
            
            if status not in ["FT", "AET", "PEN"]:
                print(f"[API] Fixture {fixture_id} not finished (Status: {status})")
                return None # Match not finished
                
            goals = match["goals"]
            score = match["score"]
            
            return {
                "home": goals["home"],
                "away": goals["away"],
                "status": status,
                "winner": "HOME" if goals["home"] > goals["away"] else "AWAY" if goals["away"] > goals["home"] else "DRAW"
            }
        except Exception as e:
            print(f"[API] Exception fetching fixture {fixture_id}: {e}")
            return None

    def _judge_pick(self, pick, result):
        if not result: return "PENDING"
        
        pick_upper = pick.upper()
        h = result["home"]
        a = result["away"]
        total_goals = h + a

        # HEURISTICS
        
        # 1. WINNER (1X2)
        if "GANA LOCAL" in pick_upper or "GANA ARSENAL" in pick_upper or "GANA MILAN" in pick_upper or "WIN HOME" in pick_upper or "(1)" in pick:
            return "SUCCESS" if result["winner"] == "HOME" else "FAIL"
        
        if "GANA VISITANTE" in pick_upper or "WIN AWAY" in pick_upper or "(2)" in pick:
            return "SUCCESS" if result["winner"] == "AWAY" else "FAIL"
            
        if "EMPATE" in pick_upper or "DRAW" in pick_upper or "(X)" in pick:
            return "SUCCESS" if result["winner"] == "DRAW" else "FAIL"

        # 2. DOUBLE CHANCE
        if "1X" in pick_upper:
            return "SUCCESS" if result["winner"] in ["HOME", "DRAW"] else "FAIL"
        if "X2" in pick_upper:
            return "SUCCESS" if result["winner"] in ["AWAY", "DRAW"] else "FAIL"
        if "12" in pick_upper:
            return "SUCCESS" if result["winner"] in ["HOME", "AWAY"] else "FAIL"

        # 3. OVER/UNDER GOALS
        # Extract number like 1.5, 2.5
        goal_match = re.search(r'(OVER|MÁS|UNDER|MENOS).*?(\d+\.\d+)', pick_upper)
        if goal_match:
            line_type = goal_match.group(1) # OVER/MÁS or UNDER/MENOS
            line_val = float(goal_match.group(2))
            
            if "OVER" in line_type or "MÁS" in line_type:
                return "SUCCESS" if total_goals > line_val else "FAIL"
            if "UNDER" in line_type or "MENOS" in line_type:
                return "SUCCESS" if total_goals < line_val else "FAIL"

        # 4. BTTS (Ambos Marcan)
        if "AMBOS MARCAN" in pick_upper or "BTTS" in pick_upper:
            return "SUCCESS" if h > 0 and a > 0 else "FAIL"

        # Fallback if too complex or specific team name not parsed
        # If simpler specific team wins are detected:
        if "GANA" in pick_upper:
            # Simple heuristic: if home won check if pick has home team characteristics? 
            # Too risky without getting team names from DB. 
            # Rely on the "(1)" or "(2)" usually put by Gemini in safe bets.
            pass

        print(f"[JUDGE] Could not auto-judge pick: '{pick}'")
        return "UNKNOWN"

    def process_pending_results(self):
        print(f"[*] Scanning for pending bets...")
        
        # 1. Find all bet keys
        # keys() method was added to RedisService
        all_bet_keys = self.redis.keys("bets:*")
        
        if not all_bet_keys:
            print("[*] No bet keys found in Redis.")
            return

        print(f"[*] Found {len(all_bet_keys)} days with bets.")
        
        # Sort keys to process chronologically
        all_bet_keys.sort()

        for full_bet_key in all_bet_keys:
            # Extract date from Key (assuming betai:bets:YYYY-MM-DD or similar)
            # Find YYYY-MM-DD pattern
            match = re.search(r'bets:(\d{4}-\d{2}-\d{2})', full_bet_key)
            if not match:
                continue
            
            target_date = match.group(1)
            
            # Check if History already exists
            # We check if 'history:DATE' exists.
            # If strictly existing, we skip.
            # RedisService.get will prefix automatically.
            history_key = f"history:{target_date}"
            if self.redis.get(history_key):
                # History exists, meaning results were confirmed. Skip.
                # print(f"    [SKIP] {target_date} already has history.")
                continue
                
            print(f"\n[>] Processing PENDING date: {target_date}")
            self._process_date(target_date, full_bet_key)

    def _process_date(self, target_date, full_bet_key):
        raw_data = self.redis.client.get(full_bet_key)
        if not raw_data: return

        data = json.loads(raw_data)
        bets = data.get("bets", [])
        
        day_profit = 0
        winning_bets = 0
        
        processed_bets = []
        all_matches_finished = True # Flag to track if we can close the day

        print(f"    Checking {len(bets)} bets...")

        for bet in bets:
            # Re-implement judging logic for the bet
            # If any match in the bet is not finished, we cannot finalize the day
            
            fid_list = bet.get("fixture_ids", [])
            pick_text = bet.get("pick", "")
            
            outcome = "UNKNOWN"
            params_missing = False
            match_pending = False
            
            # Simplified Logic for Single Bets (Safe/Value usually)
            if len(fid_list) == 1:
                res = self._fetch_fixture_result(fid_list[0])
                if not res:
                     # API Error or Match not found/started
                     # If fetching returned None because of error, strictly safer to wait.
                     # But _fetch_fixture_result returns None if error OR not finished/FT status.
                     # We need to distinguish? 
                     # The current _fetch_fixture_result prints error.
                     # Let's assume ANY None means we can't judge.
                     print(f"       [!] Match {fid_list[0]} result unavailable/pending.")
                     match_pending = True
                else:
                    outcome = self._judge_pick(pick_text, res)
                    print(f"       Match {fid_list[0]}: {res['status']} -> {outcome}")
            
            elif len(fid_list) > 1:
                 # Combo Logic - Pending Refactor
                 # For now, just mark UNKNOWN but allow day to close if we want?
                 # User said "Si la API no devuelve resultado final... omitir día".
                 # So if any match is PENDING, we skip saving history.
                 # How to check combo matches statuses? 
                 # We need to loop fixtures.
                 for fid in fid_list:
                     res = self._fetch_fixture_result(fid)
                     if not res:
                         print(f"       [!] Combo Match {fid} result unavailable/pending.")
                         match_pending = True
                         break
                 
                 if not match_pending:
                     # If all finished, we currently mark UNKNOWN/LOST/WON based on logic?
                     # Existing logic was weak for combos. 
                     # Let's assume manual review or strictly "PENDING" in code if we can't judge?
                     # For this task, main goal is RETROACTIVE checking.
                     # If matches finished, we mark success/fail if we can, or UNKNOWN.
                     pass

            if match_pending:
                all_matches_finished = False
                # No need to check other bets, we can't close the day. 
                # But let's verify all matches for completeness or break early?
                # Optimization: Break early for this DAY.
                print(f"    [WAIT] Day {target_date} has pending matches. Skipping history save.")
                return

            # Determine Status
            status = "PENDING"
            if not match_pending:
                 # Check judgement
                 if len(fid_list) == 1:
                     if outcome == "SUCCESS": status = "WON"
                     elif outcome == "FAIL": status = "LOST"
                     else: status = "UNKNOWN"
                 else:
                     # Combo fallback
                     status = "UNKNOWN" 
            
            # Calc Profit
            stake = bet["stake"]
            odd = bet["total_odd"]
            profit = 0
            
            if status == "WON":
                profit = stake * (odd - 1)
            elif status == "LOST":
                profit = -stake
            
            if status == "WON" or status == "LOST":
                day_profit += profit
            
            processed_bets.append({
                **bet,
                "status": status,
                "profit": round(profit, 2)
            })

        # End of Loop
        if not all_matches_finished:
            print(f"    [WAIT] Day {target_date} incomplete. Retrying later.")
            return

        # Double check if we have unknown statuses that prevent closing?
        # User wants "States Pending".
        # If we save History, the day becomes "Closed" (Green/Red/Gray in calendar).
        # Should we save History for partially unknown days? 
        # Existing logic saved history even if UNKNOWN.
        # Let's stick to: If API returns results for all matches, SAVE HISTORY.
        
        # Save History
        history_key = f"history:{target_date}"
        self.redis.set(history_key, json.dumps({
            "date": target_date,
            "bets": processed_bets,
            "day_profit": round(day_profit, 2)
        }))
        print(f"    [OK] History saved for {target_date}. Profit: {day_profit:.2f}u")

        # Update Stats (Monthly)
        month_key = f"stats:{target_date[:7]}"
        # We need to add profit carefully. 
        # Since we are processing retroactively, simply adding to current stats is risky IF we re-run?
        # No, because we check `if self.redis.get(history_key): continue`.
        # So we only add ONCE.
        
        full_month_key = self.redis._get_key(month_key)
        current_profit = float(self.redis.client.hget(full_month_key, "total_profit") or 0)
        new_profit = current_profit + day_profit
        
        self.redis.client.hset(full_month_key, mapping={
             "total_profit": round(new_profit, 2),
             "last_update": datetime.now().isoformat()
        })
        print(f"    [STATS] Updated {month_key} -> {new_profit:.2f}u")

if __name__ == "__main__":
    checker = ResultChecker()
    try:
        checker.process_pending_results()
        # Log Success
        checker.redis.log_status("Check Results", "SUCCESS", "Execution completed.")
    except Exception as e:
        print(f"[CRITICAL] Script Failed: {e}")
        checker.redis.log_status("Check Results", "ERROR", str(e))
        exit(1)
