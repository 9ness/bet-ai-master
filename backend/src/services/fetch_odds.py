import requests
import json
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from src.services.api_client import call_api, verify_ip

current_dir = os.path.dirname(os.path.abspath(__file__))
potential_paths = [
    os.path.join(current_dir, '../../../../../.env.local'),
    os.path.join(current_dir, '../../../../.env.local'),
    os.path.join(current_dir, '../../../.env.local'), 
    os.path.join(current_dir, '../../../frontend/.env.local'), # Support frontend .env.local
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
                "leagues": [
                    39, 40, 41, 42, 45, 48,          # Inglaterra: PL, Championship, FA Cup, EFL
                    140, 141, 143,                   # España: LaLiga, Segunda, Copa del Rey
                    135, 136, 137,                   # Italia: Serie A, B, Copa
                    78, 79,                          # Alemania: Bundesliga 1, 2
                    61, 62,                          # Francia: Ligue 1, 2
                    88, 89,                          # Países Bajos: Eredivisie, Eerste
                    94, 203, 529, 253,               # Portugal, Turquía, Arabia, MLS
                    13, 103, 113, 144, 197,          # Dinamarca, Noruega, Suecia, Bélgica, Grecia
                    2, 3, 848,                       # UCL, UEL, UECL
                    71, 128, 262, 265, 292           # Brasil, Argentina, México, Chile, Corea
                ], # Expanded Whitelist
                "markets": [1, 4, 5, 6, 7, 8, 10, 12, 16, 17, 25, 27, 28, 45, 50, 57, 58, 59, 80, 82, 83, 87, 92, 173, 212, 215],
                "bookmaker": 8 
            },
            "basketball": {
                "url": "https://v1.basketball.api-sports.io",
                "leagues": [12, 116, 117, 120, 194, 52, 40, 104, 45, 198, 26, 202, 2, 161, 152, 210, 167, 195, 411], # Updated Whitelist
                "markets": [1, 2, 3, 4, 5, 7, 14, 15, 38, 39, 40, 83, 100, 101, 103, 109],
                "bookmaker": 4
            }
        }

    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def _verify_ip(self):
        """Verifica y loguea la IP externa actual usando el proxy."""
        verify_ip()

    def _call_api(self, url, params=None):
        """
        Realiza la petición usando el cliente centralizado.
        """
        return call_api(url, params=params, extra_headers=self.headers)

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
        self.calls_football = 0
        self.calls_basketball = 0
        
        # 0. Verificar IP antes de empezar
        self._verify_ip()
        
        
        for date_str in dates_to_fetch:
            print(f"  > Consultando fecha: {date_str}")
            
            # 1. Fetch Football
            all_matches.extend(self._fetch_sport("football", date_str, start_ts, end_ts))
            
            # 2. Fetch Basketball
            all_matches.extend(self._fetch_sport("basketball", date_str, start_ts, end_ts))
        
        # Save to Disk
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(all_matches, f, indent=4, ensure_ascii=False)
            
        total_calls = self.calls_football + self.calls_basketball
        print(f"\n[FINISH] Total partidos guardados: {len(all_matches)}")
        print(f"[CONSUMO] Fútbol: {self.calls_football} | Basket: {self.calls_basketball} | Total: {total_calls}")
        print(f"Archivo: {self.output_file}")
        
        return all_matches

    def _fetch_sport(self, sport, date_str, min_ts, max_ts):
        config = self.configs[sport]
        base_url = config["url"]
        target_leagues = config["leagues"]
        whitelist_markets = config["markets"]
        bookmaker_id = config["bookmaker"]
        
        matches_found = []
        endpoint = "fixtures" if sport == "football" else "games"
        
        print(f"  [>] Consultando API ({sport}) para: {date_str}")
        
        try:
            # OPTIMIZATION: Call by Date only (1 Call instead of N Leagues)
            params = {"date": date_str, "timezone": "Europe/Madrid"}
            
            url_list = f"{base_url}/{endpoint}"
            # resp = requests.get(url_list, headers=self.headers, params=params)
            resp = self._call_api(url_list, params=params)
            
            # Count Initial Call
            if sport == "football": self.calls_football += 1
            else: self.calls_basketball += 1
            
            items = resp.json().get("response", [])
            total_on_date = len(items)
            
            # Validate Empty Response
            if total_on_date == 0:
                print(f"      [WARN] Respuesta vacía de API para {date_str}.")
            
            passed_filter_count = 0
            
            for item in items:
                # 1. Extract Metadata
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

                # 2. League Filter (Whitelist Check)
                if lid not in target_leagues:
                    continue

                # 3. Timestamp Filter (The "Jornada Deportiva")
                if not (min_ts <= match_ts <= max_ts):
                    continue

                passed_filter_count += 1
                # print(f"       [+] Candidato: {home} vs {away} ({datetime.fromtimestamp(match_ts).strftime('%H:%M')})")

                # Fetch Odds (Filtered)
                odds = self._get_odds(sport, base_url, fix_id, whitelist_markets, bookmaker_id)
                
                # Count Odds Call
                if sport == "football": self.calls_football += 1
                else: self.calls_basketball += 1
                        
                match_entry = {
                    "sport": sport, 
                    "id": fix_id,
                    "date": date_str, 
                    "timestamp": match_ts, 
                    "startTime": (datetime.fromtimestamp(match_ts) + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M'),
                    "home": home,
                    "away": away,
                    "league": league_name,
                    "league_id": lid, 
                    "country": item["league"]["country"] if sport == "football" else item.get("country", {}).get("name"),
                    "odds": odds
                }
                matches_found.append(match_entry)
                time.sleep(0.1) 
            
            print(f"      -> Encontrados {total_on_date} partidos totales. {passed_filter_count} pasan filtros (Liga+Hora).")

        except Exception as e:
            print(f"    [!] Error fetching {sport} for {date_str}: {e}")
            raise e

        return matches_found

    def _get_odds(self, sport, base_url, fixture_id, whitelist, bookmaker_id):
        try:
            url_odds = f"{base_url}/odds"
            param_key = "fixture" if sport == "football" else "game"
            
            # Dynamic Bookmaker ID
            # resp = requests.get(url_odds, headers=self.headers, params={param_key: fixture_id, "bookmaker": bookmaker_id})
            resp = self._call_api(url_odds, params={param_key: fixture_id, "bookmaker": bookmaker_id})
            data = resp.json()
            
            # Initialize with NULLs for strict schema
            cleaned_odds = self._init_empty_odds(sport)

            if not data.get("response"): return cleaned_odds
            
            bookmakers = data["response"][0]["bookmakers"]
            if not bookmakers: return cleaned_odds
            
            target_bookmaker = bookmakers[0]
            
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

    def _init_empty_odds(self, sport):
        # Create empty structure with all expected keys as null
        empty = {}
        if sport == "football":
            keys = [
                    "1x2", "asian_handicap", "over_under", "goals_over_under_h1", "ht_ft", "btts", 
                    "exact_score", "double_chance", "home_total_goals", "away_total_goals", 
                    "result_total_goals", "home_clean_sheet", "away_clean_sheet", "corners", 
                    "asian_goal_line", "home_corners", "away_corners", "own_goal", "cards", 
                    "home_cards", "away_cards", "total_shots_on_goal", "player_anytime_scorer", 
                    "fouls", "player_assist", "player_total_shots"
                    ]
        else: # basketball
            keys = ["3way_result", "home_away", "asian_handicap", "over_under",
                    "over_under_1st_half", "double_chance", "result_q1", "ht_ft", 
                    "result_q2", "result_q3", "result_q4", "race_to_20", "total_home", 
                    "total_away", "race_to_30", "winning_margin_3w"]
        
        for k in keys:
            empty[k] = None
        return empty

    def _get_market_slug(self, mid, default_name, sport):
        # FOOTBALL IDs
        if sport == 'football':
            if mid == 1: return "1x2"
            if mid == 4: return "asian_handicap"
            if mid == 5: return "over_under"
            if mid == 6: return "goals_over_under_h1"
            if mid == 7: return "ht_ft" 
            if mid == 8: return "btts"
            if mid == 10: return "exact_score"
            if mid == 12: return "double_chance"
            if mid == 16: return "home_total_goals"
            if mid == 17: return "away_total_goals"
            if mid == 25: return "result_total_goals"
            if mid == 27: return "home_clean_sheet"
            if mid == 28: return "away_clean_sheet"
            if mid == 45: return "corners"
            if mid == 50: return "asian_goal_line"
            if mid == 57: return "home_corners"
            if mid == 58: return "away_corners"
            if mid == 59: return "own_goal"
            if mid == 80: return "cards"
            if mid == 82: return "home_cards"
            if mid == 83: return "away_cards"
            if mid == 87: return "total_shots_on_goal"
            if mid == 92: return "player_anytime_scorer"
            if mid == 173: return "fouls"
            if mid == 212: return "player_assist"           
            if mid == 215: return "player_total_shots"
             
        # BASKETBALL IDs
        if sport == 'basketball':
            if mid == 1: return "3way_result"        # Gana Local/Empate/Visitante
            if mid == 2: return "home_away"          # El estándar: Gana Local o Visitante (Money Line)
            if mid == 3: return "asian_handicap"     # Hándicap principal
            if mid == 4: return "over_under"         # PUNTOS TOTALES (Este es el que suele variar)
            if mid == 5: return "over_under_1st_half"
            if mid == 7: return "double_chance"
            if mid == 14: return "result_q1"
            if mid == 15: return "ht_ft"             # Descanso / Final
            if mid == 38: return "result_q2"
            if mid == 39: return "result_q3"
            if mid == 40: return "result_q4"
            if mid == 83: return "race_to_20"
            if mid == 100: return "total_home"       # Puntos individuales Local
            if mid == 101: return "total_away"       # Puntos individuales Visitante
            if mid == 103: return "race_to_30"
            if mid == 109: return "winning_margin_3w"
            
        return default_name.lower().replace(" ", "_").replace("/", "_")

if __name__ == "__main__":
    service = SportsDataService()
    service.fetch_matches()
