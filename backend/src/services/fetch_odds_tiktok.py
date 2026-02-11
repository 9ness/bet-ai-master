import requests
import json
import os
import sys
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add backend root to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.api_client import call_api, verify_ip

current_dir = os.path.dirname(os.path.abspath(__file__))
potential_paths = [
    os.path.join(current_dir, '../../../../../.env.local'),
    os.path.join(current_dir, '../../../../.env.local'),
    os.path.join(current_dir, '../../../.env.local'), 
    os.path.join(current_dir, '../../../frontend/.env.local'),
    os.path.join(current_dir, '../../../../../.env'),
    os.path.join(current_dir, '../../../.env')
]
for p in potential_paths:
    if os.path.exists(p):
        load_dotenv(p)
        break

class SportsDataServiceTikTok:
    def __init__(self):
        self.api_key = os.getenv("API_KEY")
        self.headers = {"x-apisports-key": self.api_key}
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        # Output file just for debugging/backup, main storage is Redis
        self.output_file = os.path.join(self.base_dir, 'data', 'matches_tiktok.json')
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        
        self.configs = {
            "football": {
                "url": "https://v3.football.api-sports.io",
                "leagues": [
                    # PRINCIPALES (Top 5 + Eredivisie + Portugal + Copas)
                    39, 140, 135, 78, 61, 88, 94, 253, 
                    13, 103, 2, 3, 848, 11, 71, 128, 130, 262, 265,
                    137, 143, 45, 48, # Copa Italia, Copa del Rey, FA Cup, EFL Cup
                    # SECUNDARIAS (2ª Divisiones Importantes - Relleno si faltan principales)
                    40, 41, 42,       # Championship, League One, League Two
                    141,              # LaLiga 2
                    136,              # Serie B
                    79,               # 2. Bundesliga
                    62                # Ligue 2
                ],
                "markets": [1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 16, 17, 21, 25, 27, 28, 31, 45, 50, 54, 57, 58, 59, 80, 82, 83, 87, 173],
                "bookmaker": 8 
            }
        }
        
        self.league_name_mapping = {
            "Eerste Divisie": "Eredivisie"
        }

    def _verify_ip(self):
        verify_ip()

    def _call_api(self, url, params=None):
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

        # Target: TOMORROW
        # Filter: Tomorrow 17:45 - Tomorrow 23:59
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        
        # Define Time Window
        start_dt = tomorrow.replace(hour=17, minute=45, second=0, microsecond=0)
        end_dt = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        start_ts = start_dt.timestamp()
        end_ts = end_dt.timestamp()
        
        target_date_str = tomorrow.strftime("%Y-%m-%d")
        
        print(f"\n[*] INICIANDO RECOLECCIÓN TIKTOK (Fecha: {target_date_str})")
        print(f"[*] Ventana Horaria: {start_dt.strftime('%H:%M')} -> {end_dt.strftime('%H:%M')}")
        
        all_matches = []
        self.calls_football = 0
        
        # 0. Verificar IP (Proxy Residencial)
        self._verify_ip()
        
        # 1. Fetch Football Only
        all_matches.extend(self._fetch_sport("football", target_date_str, start_ts, end_ts))
            
        # Save to Disk for debugging
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(all_matches, f, indent=4, ensure_ascii=False)

        # Save to Redis (HASH Structure)
        # Key: betai:raw_matches:YYYY-MM_tiktok
        # Field: YYYY-MM-DD
        from src.services.redis_service import RedisService
        rs = RedisService()
        
        month_key = tomorrow.strftime("%Y-%m")
        # Removing 'betai:' manual prefix to rely on RedisService auto-prefixing
        # New Format: raw_matches_tiktok:YYYY-MM
        redis_hash_key = f"raw_matches_tiktok:{month_key}"
        
        # FIX: RedisService.hset expects (key, mapping_dict)
        rs.client.hset(redis_hash_key, {target_date_str: json.dumps(all_matches)})
        
        print(f"[REDIS] Guardado en Hash {rs._get_key(redis_hash_key)} -> Field {target_date_str}")
            
        print(f"\n[FINISH] Total partidos guardados: {len(all_matches)}")
        print(f"[CONSUMO] Fútbol: {self.calls_football}")
        
        return all_matches

    def _fetch_sport(self, sport, date_str, min_ts, max_ts):
        config = self.configs[sport]
        base_url = config["url"]
        target_leagues = config["leagues"]
        whitelist_markets = config["markets"]
        bookmaker_id = config["bookmaker"]
        
        matches_found = []
        endpoint = "fixtures"
        
        print(f"  [>] Consultando API ({sport}) para: {date_str}")
        
        try:
            params = {"date": date_str, "timezone": "Europe/Madrid"}
            url_list = f"{base_url}/{endpoint}"
            resp = self._call_api(url_list, params=params)
            
            self.calls_football += 1
            
            items = resp.json().get("response", [])
            total_on_date = len(items)
            
            if total_on_date == 0:
                print(f"      [WARN] Respuesta vacía de API para {date_str}.")
            
            # 1. First Pass: Identify Candidates (No Extra API Cost)
            candidates = []
            for item in items:
                lid = item["league"]["id"]
                match_ts = item["fixture"]["timestamp"]
                
                # League Filter
                if lid not in target_leagues: continue
                # Time Filter
                if not (min_ts <= match_ts <= max_ts): continue
                
                candidates.append(item)
            
            print(f"      [INFO] Partidos encontrados: {total_on_date}")
            print(f"      [INFO] Candidatos TOTALES (Filtro Liga + Hora): {len(candidates)}")
            
            # --- PRIORITY LOGIC ---
            # Priorizamos ligas principales. Si faltan, rellenamos con secundarias hasta 14 partidos.
            PRIORITY_LEAGUES = [
                39, 140, 135, 78, 61, 88, 94, 253, 
                13, 103, 2, 3, 848, 11, 71, 128, 130, 262, 265,
                137, 143, 45, 48
            ]
            
            # Sort: Priority leagues first (True comes before False in reverse sort? No, True=1, False=0. Reverse=True puts Priority first)
            candidates.sort(key=lambda x: x["league"]["id"] in PRIORITY_LEAGUES, reverse=True)
            
            # Limit to 14 Matches (14 * 2 calls = 28 calls + 1 init = 29 calls < 30 Limit)
            final_candidates = candidates[:14]
            print(f"      [INFO] Selección FINAL: {len(final_candidates)} partidos (Priorizando ligoas top).")

            # 2. Second Pass: Process Candidates (Expensive API Calls)
            processed_count = 0
            
            for item in final_candidates:
                # SAFETY LIMIT: Max 30 calls total (Estricto)
                if self.calls_football >= 30:
                    print(f"      [LIMIT] Se ha alcanzado el límite estricto de llamadas (30). Deteniendo...")
                    print(f"      [STATS] Procesados {processed_count} de {len(final_candidates)} candidatos seleccionados.")
                    break

                # Extract Metadata
                lid = item["league"]["id"]
                match_ts = item["fixture"]["timestamp"]
                fix_id = item["fixture"]["id"]
                home = item["teams"]["home"]["name"]
                home_id = item["teams"]["home"]["id"]
                away = item["teams"]["away"]["name"]
                away_id = item["teams"]["away"]["id"]
                league_name = item["league"]["name"]
                league_name = self.league_name_mapping.get(league_name, league_name)
                
                referee = item["fixture"].get("referee")
                venue_obj = item["fixture"].get("venue", {})
                venue = f"{venue_obj.get('name', '')}, {venue_obj.get('city', '')}".strip(', ')
                round_name = item["league"].get("round")

                # (Filters are already passed)
                
                # Fetch Odds (Filtered)
                odds = self._get_odds(sport, base_url, fix_id, whitelist_markets, bookmaker_id)
                self.calls_football += 1
                print(f"      [API] Usadas: {self.calls_football}/30 (Odds) | Partido: {home} vs {away}")
                        
                match_entry = {
                    "sport": sport, 
                    "id": fix_id,
                    "date": date_str, 
                    "timestamp": match_ts, 
                    "startTime": (datetime.fromtimestamp(match_ts)).strftime('%Y-%m-%d %H:%M'),
                    "home": home,
                    "home_id": home_id,
                    "away": away,
                    "away_id": away_id,
                    "league": league_name,
                    "league_id": lid,
                    "country": item["league"]["country"],
                    "referee": referee,
                    "venue": venue,
                    "round": round_name,
                    "odds": odds
                }

                # Predictions (DISABLED)
                match_entry["predictions"] = None

                # H2H
                raw_h2h = self._fetch_headtohead(home_id, away_id, sport)
                match_entry["h2h"] = self._process_h2h(raw_h2h, sport)
                self.calls_football += 1
                print(f"      [API] Usadas: {self.calls_football}/30 (H2H)")
                
                matches_found.append(match_entry)
                processed_count += 1
                
                # Small delay to respect rate limits if needed
                time.sleep(0.05)

        except Exception as e:
            print(f"    [!] Error fetching {sport} for {date_str}: {e}")
            raise e

        return matches_found

    def _get_odds(self, sport, base_url, fixture_id, whitelist, bookmaker_id):
        # ... (Same logic as fetch_odds.py) ...
        # Reusing the exact same logic but implemented here to be standalone
        try:
            url_odds = f"{base_url}/odds"
            param_key = "fixture"
            priority_bookmakers = [8, 11, 6, 3, 2]

            resp = self._call_api(url_odds, params={param_key: fixture_id})
            data = resp.json()
            cleaned_odds = self._init_empty_odds(sport)

            if not data.get("response"): return cleaned_odds
            
            all_bookmakers = data["response"][0]["bookmakers"]
            if not all_bookmakers: return cleaned_odds
            
            bm_map = {b["id"]: b for b in all_bookmakers}
            
            def fill_from_bookmaker(bm_id):
                if bm_id not in bm_map: return
                bm = bm_map[bm_id]
                for bet in bm["bets"]:
                    mid = bet["id"]
                    name = bet["name"]
                    if mid not in whitelist: continue
                    slug = self._get_market_slug(mid, name, sport)
                    if cleaned_odds.get(slug) is None:
                        market_values = {}
                        for v in bet["values"]:
                            raw_label = str(v["value"])
                            key = self._normalize_key(raw_label)
                            market_values[key] = float(v["odd"])
                        cleaned_odds[slug] = market_values

            for p_id in priority_bookmakers:
                fill_from_bookmaker(p_id)
                
            return cleaned_odds
        except Exception as e:
            return {}

    def _init_empty_odds(self, sport):
        empty = {}
        keys = [
            "1x2", "asian_handicap", "over_under", "goals_over_under_h1", "ht_ft", "btts", 
            "exact_score", "double_chance", "home_total_goals", "away_total_goals", 
            "result_total_goals", "home_clean_sheet", "away_clean_sheet", "corners", 
            "asian_goal_line", "home_corners", "away_corners", "own_goal", "cards", 
            "home_cards", "away_cards", "total_shots_on_goal", "player_anytime_scorer", 
            "fouls", "player_assist", "player_total_shots",
            "draw_no_bet", "second_half_winner", "asian_handicap_corners", 
            "win_to_nil", "btts_1st_half", "multi_goals"
        ]
        for k in keys:
            empty[k] = None
        return empty

    def _get_market_slug(self, mid, default_name, sport):
        if mid == 1: return "1x2"
        if mid == 3: return "draw_no_bet"
        if mid == 4: return "asian_handicap"
        if mid == 5: return "over_under"
        if mid == 6: return "goals_over_under_h1"
        if mid == 7: return "ht_ft" 
        if mid == 8: return "btts"
        if mid == 10: return "exact_score"
        if mid == 11: return "second_half_winner"
        if mid == 12: return "double_chance"
        if mid == 13: return "asian_handicap_corners"
        if mid == 16: return "home_total_goals"
        if mid == 17: return "away_total_goals"
        if mid == 21: return "win_to_nil"
        if mid == 25: return "result_total_goals"
        if mid == 27: return "home_clean_sheet"
        if mid == 28: return "away_clean_sheet"
        if mid == 31: return "btts_1st_half"
        if mid == 45: return "corners"
        if mid == 50: return "asian_goal_line"
        if mid == 54: return "multi_goals"
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
        return default_name.lower().replace(" ", "_").replace("/", "_")

    def _fetch_predictions(self, fixture_id):
        try:
            url = f"{self.configs['football']['url']}/predictions"
            resp = self._call_api(url, params={"fixture": fixture_id})
            data = resp.json()
            return data.get("response", [])
        except Exception as e:
            return []

    def _fetch_headtohead(self, home_id, away_id, sport="football"):
        try:
            base_url = self.configs[sport]["url"]
            endpoint = "fixtures/headtohead"
            resp = self._call_api(f"{base_url}/{endpoint}", params={"h2h": f"{home_id}-{away_id}"})
            data = resp.json()
            raw_h2h = data.get("response", [])
            
            if not raw_h2h: return []
            
            filtered = []
            for match in raw_h2h:
                status = match.get("fixture", {}).get("status", {}).get("short")
                if status not in ["FT", "AET", "PEN"]:
                    continue
                filtered.append(match)
            
            def get_date(m):
                return m["fixture"]["date"]
                
            filtered.sort(key=get_date, reverse=True)
            return filtered[:10]
            
        except Exception as e:
            return []

    def _process_predictions(self, raw_data):
        if not raw_data: return None
        try:
            main = raw_data[0]
            preds = main.get("predictions", {})
            teams = main.get("teams", {})
            comparison = main.get("comparison", {})
            league = main.get("league", {})
            
            def get_team_stats(side):
                team_data = teams.get(side, {})
                league_data = team_data.get("league", {})
                last_5 = team_data.get("last_5", {})
                return {
                    "last_5_form": last_5.get("form"),
                    "last_5_att": last_5.get("att"),
                    "last_5_def": last_5.get("def"),
                    "last_5_goals": last_5.get("goals"),
                    "fixtures": league_data.get("fixtures", {}),
                    "goals": league_data.get("goals", {}),
                    "clean_sheet": league_data.get("clean_sheet", {}),
                    "failed_to_score": league_data.get("failed_to_score", {}),
                    "cards": league_data.get("cards", {}),
                    "biggest": league_data.get("biggest", {})
                }

            return {
                "winner_code": preds.get("winner", {}).get("name"),
                "winner_comment": preds.get("winner", {}).get("comment"),
                "advice": preds.get("advice"),
                "under_over": preds.get("under_over"),
                "win_percent": preds.get("percent"),
                "goals_prediction": preds.get("goals"),
                "comparison": comparison,
                "home_team": get_team_stats("home"),
                "away_team": get_team_stats("away"),
                "league_context": {
                    "name": league.get("name"),
                    "country": league.get("country"),
                    "season": league.get("season")
                }
            }
        except Exception as e:
            return None

    def _process_h2h(self, filtered_h2h, sport="football"):
        if not filtered_h2h: return []
        processed = []
        for match in filtered_h2h:
            try:
                date_str = match["fixture"]["date"][:10]
                home = match["teams"]["home"]["name"]
                away = match["teams"]["away"]["name"]
                home_goals = match['goals']['home']
                away_goals = match['goals']['away']
                score = f"{home_goals}-{away_goals}"
                league_name = match["league"]["name"]

                processed.append({
                    "date": date_str,
                    "league": league_name,
                    "match": f"{home} vs {away}",
                    "score": score,
                    "home_goals": home_goals,
                    "away_goals": away_goals
                })
            except: continue
        return processed

if __name__ == "__main__":
    service = SportsDataServiceTikTok()
    service.fetch_matches()
