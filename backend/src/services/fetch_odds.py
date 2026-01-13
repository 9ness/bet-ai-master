import requests
import json
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
potential_paths = [
    os.path.join(current_dir, '../../../../../.env.local'),
    os.path.join(current_dir, '../../../../.env.local'),
    os.path.join(current_dir, '../../../.env.local'), 
    os.path.join(current_dir, '../../../../../.env'),
    os.path.join(current_dir, '../../../.env')
]
for p in potential_paths:
    if os.path.exists(p):
        load_dotenv(p)
        print(f"[OK] Variables de entorno cargadas desde: {os.path.abspath(p)}")
        break

class SportsDataService:
    def __init__(self):
        self.api_key = os.getenv("API_KEY")
        self.headers = {"x-apisports-key": self.api_key}
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.output_file = os.path.join(self.base_dir, 'data', 'matches_today.json')
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        
        # Configuration
        self.configs = {
            "football": {
                "url": "https://v3.football.api-sports.io",
                "leagues": [39, 140, 135, 78, 61, 2, 3], # Top 5 + UEFA
                "markets": [1, 4, 5, 7, 8, 12, 45, 87], # Final Whitelist
                "bookmaker": 8 # Bet365 for Football
            },
            "basketball": {
                "url": "https://v1.basketball.api-sports.io",
                "leagues": [12], # NBA
                "markets": [2, 3, 4, 5, 15, 100, 101], # Final Whitelist
                "bookmaker": 4 # Bet365 for Basketball
            }
        }



    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def _normalize_key(self, text):
        text = str(text).lower()
        if "home/draw" in text: return "1X"
        if "home/away" in text: return "12"
        if "draw/away" in text: return "X2"
        if text == "yes": return "yes"
        if text == "no": return "no"
        return text.replace(" ", "_").replace(".", "_").replace("/", "_")

    def fetch_matches(self):
        if not self.api_key:
            print("[ERROR] No API Key found.")
            return []

        # Time Window Calculation (Today 12:00 -> Tomorrow 05:00)
        now = datetime.now()
        start_dt = now.replace(hour=12, minute=0, second=0, microsecond=0)
        end_dt = (now + timedelta(days=1)).replace(hour=5, minute=0, second=0, microsecond=0)
        
        start_ts = start_dt.timestamp()
        end_ts = end_dt.timestamp()
        
        # Double Fetch Dates
        dates_to_fetch = [now.strftime("%Y-%m-%d"), (now + timedelta(days=1)).strftime("%Y-%m-%d")]
        
        print(f"\n[*] INICIANDO RECOLECCIÓN (Ventana: {start_dt} -> {end_dt})")
        
        all_matches = []
        
        for date_str in dates_to_fetch:
            print(f"  > Consultando fecha: {date_str}")
            
            # 1. Fetch Football
            all_matches.extend(self._fetch_sport("football", date_str, start_ts, end_ts))
            
            # 2. Fetch Basketball
            all_matches.extend(self._fetch_sport("basketball", date_str, start_ts, end_ts))
        
        # Save to Disk
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(all_matches, f, indent=4, ensure_ascii=False)
            
        print(f"\n[SUCCESS] Total partidos guardados: {len(all_matches)}")
        print(f"Archivo: {self.output_file}")
        
        return all_matches

    def _fetch_sport(self, sport, date_str, min_ts, max_ts):
        config = self.configs[sport]
        base_url = config["url"]
        whitelist_markets = config["markets"]
        bookmaker_id = config["bookmaker"]
        
        matches_found = []
        endpoint = "fixtures" if sport == "football" else "games"
        
        print(f"  [>] Consultando API ({sport}) para: {date_str}")
        
        try:
            # OPTIMIZATION: Call by Date only (1 Call instead of N Leagues)
            params = {"date": date_str, "timezone": "Europe/Madrid"}
            
            url_list = f"{base_url}/{endpoint}"
            resp = requests.get(url_list, headers=self.headers, params=params)
            
            items = resp.json().get("response", [])
            total_on_date = len(items)
            
            passed_filter_count = 0
            
            for item in items:
                # 1. League Filter REMOVED (User requested Global Scan)
                
                # Extract Metadata
                if sport == "football":
                    lid = item["league"]["id"]
                    match_ts = item["fixture"]["timestamp"]
                    fix_id = item["fixture"]["id"]
                    home = item["teams"]["home"]["name"]
                    away = item["teams"]["away"]["name"]
                    league_name = item["league"]["name"]
                else: 
                    # Basketball structure
                    lid = item["league"]["id"] if "league" in item else 12 
                    if "league" in item and "id" in item["league"]:
                        lid = item["league"]["id"]
                    else:
                        lid = -1
                        
                    match_ts = item["timestamp"]
                    fix_id = item["id"]
                    home = item["teams"]["home"]["name"]
                    away = item["teams"]["away"]["name"]
                    league_name = item["league"]["name"] if "league" in item else "NBA"

                # 2. Timestamp Filter (The "Jornada Deportiva")
                if not (min_ts <= match_ts <= max_ts):
                    continue

                passed_filter_count += 1
                print(f"       [+] Candidato: {home} vs {away} ({datetime.fromtimestamp(match_ts).strftime('%H:%M')})")

                # Fetch Odds (Filtered)
                odds = self._get_odds(sport, base_url, fix_id, whitelist_markets, bookmaker_id)
                
                if not odds: continue
                        
                match_entry = {
                    "sport": sport, 
                    "id": fix_id,
                    "date": date_str, 
                    "timestamp": match_ts, 
                    "startTime": datetime.fromtimestamp(match_ts).strftime('%Y-%m-%d %H:%M'),
                    "home": home,
                    "away": away,
                    "league": league_name,
                    "odds": odds
                }
                matches_found.append(match_entry)
                time.sleep(0.1) 
            
            print(f"      -> Encontrados {total_on_date} partidos totales en API. {passed_filter_count} entran en Jornada Deportiva.")

        except Exception as e:
            print(f"    [!] Error fetching {sport} for {date_str}: {e}")

        return matches_found

    def _get_odds(self, sport, base_url, fixture_id, whitelist, bookmaker_id):
        try:
            url_odds = f"{base_url}/odds"
            param_key = "fixture" if sport == "football" else "game"
            
            # Dynamic Bookmaker ID
            resp = requests.get(url_odds, headers=self.headers, params={param_key: fixture_id, "bookmaker": bookmaker_id})
            data = resp.json()
            
            if not data.get("response"): return {}
            
            bookmakers = data["response"][0]["bookmakers"]
            if not bookmakers: return {}
            
            target_bookmaker = bookmakers[0]
            
            cleaned_odds = {}
            
            for bet in target_bookmaker["bets"]:
                mid = bet["id"]
                name = bet["name"]
                
                # WHITELIST CHECK
                if mid not in whitelist:
                    continue
                
                market_values = {}
                for v in bet["values"]:
                    raw_label = str(v["value"])
                    key = self._normalize_key(raw_label)
                    market_values[key] = float(v["odd"])
                
                slug = self._get_market_slug(mid, name, sport)
                cleaned_odds[slug] = market_values
                
            return cleaned_odds

        except Exception as e:
            return {}

    def _get_market_slug(self, mid, default_name, sport):
        # FOOTBALL IDs
        if sport == 'football':
            if mid == 1: return "1x2"
            if mid == 4: return "asian_handicap" # User Updated: Was odd_even, now Asian Handicap
            if mid == 5: return "goals_over_under"
            if mid == 7: return "ht_ft" 
            if mid == 8: return "btts"
            if mid == 12: return "double_chance"
            if mid == 45: return "corners"
            if mid == 87: return "total_shots_on_goal" # User Updated: Was Combo, now Shots on Goal
            
        # BASKETBALL IDs
        if sport == 'basketball':
            if mid == 2: return "asian_handicap" 
            if mid == 3: return "total_points" 
            if mid == 4: return "asian_corners" 
            if mid == 5: return "over_under_1st_half" # User Added: Over/Under 1st Half
            if mid == 15: return "ht_ft" 
            # 100/101 are likely Props or Quarters.
            
        return default_name.lower().replace(" ", "_").replace("/", "_")

if __name__ == "__main__":
    service = SportsDataService()
    service.fetch_matches()
