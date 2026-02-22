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
                    13, 103, 113, 144, 197,          # Libertadores, Noruega, Suecia, Bélgica, Grecia
                    2, 3, 848, 11,                   # UCL, UEL, UECL, Sudamericana
                    71, 128, 130, 262, 265, 292      # Brasil, Argentina (Liga+Copa), México, Chile, Corea
                ], # Expanded Whitelist
                # "markets": [1, 4, 5, 6, 7, 8, 10, 12, 16, 17, 25, 27, 28, 45, 50, 57, 58, 59, 80, 82, 83, 87, 92, 173, 212, 215],
                "markets": [1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 16, 17, 21, 25, 27, 28, 31, 45, 50, 54, 57, 58, 59, 80, 82, 83, 87, 173],
                "bookmaker": 8 
            },
            "basketball": {
                "url": "https://v1.basketball.api-sports.io",
                "leagues": [12, 116, 117, 120, 194, 52, 40, 104, 45, 198, 26, 202, 2, 161, 152, 210, 167, 195, 411], # Updated Whitelist
                "markets": [1, 2, 3, 4, 5, 7, 10, 12, 14, 15, 38, 39, 40, 65, 83, 100, 101, 103, 109, 112],
                "bookmaker": 4
            }
        }
        
        # Mapeo de nombres de ligas para normalización
        self.league_name_mapping = {
            "Eerste Divisie": "Eredivisie"
        }
        self.api_remaining = "Unknown"

    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def _verify_ip(self):
        """Verifica y loguea la IP externa actual usando el proxy."""
        verify_ip()

    def _call_api(self, url, params=None, sport=None):
        """
        Realiza la petición usando el cliente centralizado.
        """
        resp = call_api(url, params=params, extra_headers=self.headers)
        if resp:
            # Monitor Real API Quota (ignoring cached responses)
            elapsed = resp.elapsed.total_seconds()
            
            # Buscamos el header de cuota restante (intentamos varios nombres comunes de API-Sports)
            headers = resp.headers
            remaining = headers.get("remaining") or \
                        headers.get("x-ratelimit-requests-remaining-day") or \
                        headers.get("x-apisports-remaining") or \
                        headers.get("x-ratelimit-requests-remaining") # Fallback al minuto si no hay día
            
            if remaining:
                # [REGLA ACTUALIZADA]
                # Guardamos en variables específicas del deporte para el log final
                if sport == "football":
                    self.api_remaining_football = remaining
                elif sport == "basketball":
                    self.api_remaining_basketball = remaining
                
                # Para compatibilidad con otros métodos
                self.api_remaining = remaining
                
                # Gestión de contadores
                is_real_call = elapsed > 0.001
                if sport == "football":
                    self.internal_football += 1
                    if is_real_call: self.billed_football += 1
                elif sport == "basketball":
                    self.internal_basketball += 1
                    if is_real_call: self.billed_basketball += 1

                if sport:
                    try:
                        if not hasattr(self, 'rs'):
                            from src.services.redis_service import RedisService
                            self.rs = RedisService()
                        
                        if self.rs.is_active:
                            # 1. Obtener Límite Real
                            limit = int(headers.get("x-ratelimit-requests-limit-day") or 
                                        headers.get("x-ratelimit-requests-limit") or 
                                        headers.get("x-apisports-limit") or 
                                        headers.get("x-ratelimit-limit") or 100)

                            # 2. Actualizamos "Restantes" y "Límite" en Redis siempre
                            self.rs.set(f"api_usage:{sport}:last_updated", datetime.now().strftime("%Y-%m-%d"))
                            self.rs.set(f"api_usage:{sport}:remaining", remaining)
                            self.rs.set(f"api_usage:{sport}:limit", limit)
                            
                            # 3. Actualizamos el "Historial" solo si es una llamada física real
                            if is_real_call:
                                used = max(0, limit - int(remaining))
                                today = datetime.now().strftime("%Y-%m-%d")
                                history_key = f"api_usage:history:{today}"
                                self.rs.hset(history_key, {sport: used})
                        else:
                            print(f"      [REDIS-WARN] Redis no activo, no se pudo actualizar cuota.")
                    except Exception as e:
                        print(f"      [REDIS-ERROR] Error actualizando cuota: {e}")
            else:
                # Log de depuración si no hay header en una llamada real
                if elapsed > 0.001:
                    print(f"      [DEBUG-QUOTA] Ningún header de cuota encontrado en llamada real.")
                    print(f"      [DEBUG-HEADERS] Headers: {list(resp.headers.keys())}")
        
        return resp

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
        
        # 0. Inicializar contadores
        self.billed_football = 0
        self.billed_basketball = 0
        self.internal_football = 0
        self.internal_basketball = 0
        
        # [FIX] Inicializar lista balanceada para todos los deportes y fechas
        all_matches = []
        
        # 1. Verificar IP antes de empezar
        self._verify_ip()
        
        for date_str in dates_to_fetch:
            print(f"  > Consultando fecha: {date_str}")
            
            # 2. Fetch Football
            all_matches.extend(self._fetch_sport("football", date_str, start_ts, end_ts))
            
            # 3. Fetch Basketball
            all_matches.extend(self._fetch_sport("basketball", date_str, start_ts, end_ts))
        
        # Save to Disk
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(all_matches, f, indent=4, ensure_ascii=False)
            
        print(f"\n[FINISH] Total partidos guardados: {len(all_matches)}")
        print(f"[RECUENTO INTERNO] Fútbol: {self.internal_football} | Basket: {self.internal_basketball}")
        print(f"[CONSUMO API REAL] Fútbol: {self.billed_football} | Basket: {self.billed_basketball}")
        
        # Mostrar restantes específicos si están disponibles
        rem_f = self.api_remaining_football if hasattr(self, 'api_remaining_football') else "Unknown"
        rem_b = self.api_remaining_basketball if hasattr(self, 'api_remaining_basketball') else "Unknown"
        print(f"[RESTANTE REPORTADO] Fútbol: {rem_f}/100 | Basket: {rem_b}/100")
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
            params = {"date": date_str, "timezone": "Europe/Madrid"}
            
            url_list = f"{base_url}/{endpoint}"
            resp = self._call_api(url_list, params=params, sport=sport)
            
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
                    home_id = item["teams"]["home"]["id"]
                    away = item["teams"]["away"]["name"]
                    away_id = item["teams"]["away"]["id"]
                    league_name = item["league"]["name"]
                    # [USER FIX] Desambiguación Serie A (Italia vs Brasil)
                    if lid == 71 and league_name == "Serie A":
                        league_name = "Brasileirão Betano"

                    # [USER FIX] Eerste Divisie (2nd Div) vs Eredivisie
                    if lid == 89 or league_name == "Eerste Divisie":
                        league_name = "Keuken Kampioen Divisie"
                    
                    league_name = self.league_name_mapping.get(league_name, league_name)
                    # Metadata Context
                    referee = item["fixture"].get("referee")
                    venue_obj = item["fixture"].get("venue", {})
                    venue = f"{venue_obj.get('name', '')}, {venue_obj.get('city', '')}".strip(', ')
                    round_name = item["league"].get("round")
                else: 
                    lid = item["league"]["id"] if "league" in item else 12 
                    if "league" in item and "id" in item["league"]:
                        lid = item["league"]["id"]
                    else:
                        lid = -1
                        
                    match_ts = item["timestamp"]
                    fix_id = item["id"]
                    home = item["teams"]["home"]["name"]
                    home_id = item["teams"]["home"]["id"]
                    away = item["teams"]["away"]["name"]
                    away_id = item["teams"]["away"]["id"]
                    league_name = item["league"]["name"] if "league" in item else "NBA"
                    league_name = self.league_name_mapping.get(league_name, league_name)
                    
                    # Basketball Metadata - Venue
                    venue = None
                    if "country" in item and hasattr(item["country"], "get"):
                         # Sometimes venue is deep, but API-Basketball standard is often at root or valid in country? 
                         # Actually check standard docs or generic location. 
                         # For now, if venue exists in root or similar to football
                         pass
                    
                    # Check for venue in root or similar
                    # Note: API-Basketball structure is similar. 'venue' key might exist.
                    venue = None
                    # Attempt safe extraction if structure is similar to football (often it is not exactly same, check docs or defaults)
                    # Use generic get just in case
                    # Fix: User asked to capture 'venue' if available in item.
                    # API-Basketball 'games' endpoint items usually don't have 'venue' directly, but let's try generic 'venue' or 'country'.
                    # User said "si está disponible en el objeto item".
                    if "venue" in item:
                        # If it's a dictionary
                        if isinstance(item["venue"], dict):
                             venue = f"{item['venue'].get('name', '')}, {item['venue'].get('city', '')}".strip(', ')
                        # If it's a string
                        elif isinstance(item["venue"], str):
                            venue = item["venue"]

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
                        
                match_entry = {
                    "sport": sport, 
                    "id": fix_id,
                    "date": date_str, 
                    "timestamp": match_ts, 
                    "startTime": (datetime.fromtimestamp(match_ts) + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M'),
                    "home": home,
                    "home_id": home_id,
                    "away": away,
                    "away_id": away_id,
                    "league": league_name,
                    "league_id": lid,
                    "country": item["league"]["country"] if sport == "football" else item.get("country", {}).get("name"),
                    "referee": referee if sport == "football" else None,
                    "venue": venue, # Now available for both if extracted
                    "round": round_name if sport == "football" else None,
                    "odds": odds
                }

                # NEW: Fetch H2H and Predictions
                # Football: Predictions + H2H
                if sport == "football":
                    # Fetch Predictions (Season context)
                    raw_preds = self._fetch_predictions(fix_id)
                    match_entry["predictions"] = self._process_predictions(raw_preds)

                # Both Sports: Head to Head (History context)
                if sport in ["football", "basketball"]:
                    raw_h2h = self._fetch_headtohead(home_id, away_id, sport)
                    match_entry["h2h"] = self._process_h2h(raw_h2h, sport)
                
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
            
            # PRIORITY FALLBACK LOOP
            # 8: Bet365, 11: 1xBet, 6: Bwin, 3: Betsson, 2: Marathonbet
            # Expanded for Basketball: [8, 11, 2, 4, 1, 6, 3]
            if sport == 'basketball':
                priority_bookmakers = [8, 11, 2, 4, 1, 6, 3]
            else:
                priority_bookmakers = [8, 11, 6, 3, 2]

            # Allow fetching ALL bookmakers (remove 'bookmaker' param)
            resp = self._call_api(url_odds, params={param_key: fixture_id}, sport=sport)
            data = resp.json()
            
            # Initialize with NULLs for strict schema
            cleaned_odds = self._init_empty_odds(sport)

            if not data.get("response"): return cleaned_odds
            
            all_bookmakers = data["response"][0]["bookmakers"]
            if not all_bookmakers: return cleaned_odds
            
            # Map ID -> Bookmaker Object
            bm_map = {b["id"]: b for b in all_bookmakers}
            
            # Helper to try filling gaps
            def fill_from_bookmaker(bm_id):
                if bm_id not in bm_map: return
                bm = bm_map[bm_id]
                
                for bet in bm["bets"]:
                    mid = bet["id"]
                    name = bet["name"]
                    
                    if mid not in whitelist: continue
                    
                    slug = self._get_market_slug(mid, name, sport)
                    
                    # Fill ONLY if currently None (First Come First Serve logic based on priority loop)
                    if cleaned_odds.get(slug) is None:
                        market_values = {}
                        for v in bet["values"]:
                            raw_label = str(v["value"])
                            key = self._normalize_key(raw_label)
                            market_values[key] = float(v["odd"])
                        cleaned_odds[slug] = market_values

            # Retrieve Metadata from priority list
            for p_id in priority_bookmakers:
                fill_from_bookmaker(p_id)
                
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
                    "fouls", "player_assist", "player_total_shots",
                    # New Markets
                    "draw_no_bet", "second_half_winner", "asian_handicap_corners", 
                    "win_to_nil", "btts_1st_half", "multi_goals"
                    ]
        else: # basketball
            keys = ["3way_result", "home_away", "asian_handicap", "over_under",
                    "over_under_1st_half", "double_chance", "result_q1", "ht_ft", 
                    "result_q2", "result_q3", "result_q4", "race_to_20", "total_home", 
                    "total_away", "race_to_30", "winning_margin_3w",
                    # New Markets
                    "handicap_1st_half", "highest_scoring_quarter", "team_points_total"]
        
        for k in keys:
            empty[k] = None
        return empty

    def _get_market_slug(self, mid, default_name, sport):
        # FOOTBALL IDs
        if sport == 'football':
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
             
        # BASKETBALL IDs
        if sport == 'basketball':
            if mid == 1: return "3way_result"        # Gana Local/Empate/Visitante
            if mid == 2: return "home_away"          # El estándar: Gana Local o Visitante (Money Line)
            if mid == 3: return "asian_handicap"     # Hándicap principal
            if mid == 4: return "over_under"         # PUNTOS TOTALES (Este es el que suele variar)
            if mid == 5: return "over_under_1st_half"
            if mid == 7: return "double_chance"
            if mid == 10: return "handicap_1st_half"
            if mid == 12: return "over_under_1st_half" # Mapping as requested, may overlap ID 5
            if mid == 14: return "result_q1"
            if mid == 15: return "ht_ft"             # Descanso / Final
            if mid == 38: return "result_q2"
            if mid == 39: return "result_q3"
            if mid == 40: return "result_q4"
            if mid == 65: return "highest_scoring_quarter"
            if mid == 83: return "race_to_20"
            if mid == 100: return "total_home"       # Puntos individuales Local
            if mid == 101: return "total_away"       # Puntos individuales Visitante
            if mid == 103: return "race_to_30"
            if mid == 109: return "winning_margin_3w"
            if mid == 112: return "team_points_total"
            
        return default_name.lower().replace(" ", "_").replace("/", "_")

    def _fetch_predictions(self, fixture_id):
        """Fetches predictions/analysis for a given fixture."""
        try:
            url = f"{self.configs['football']['url']}/predictions"
            resp = self._call_api(url, params={"fixture": fixture_id}, sport="football")
            data = resp.json()
            return data.get("response", [])
        except Exception as e:
            print(f"      [!] Error fetching predictions for {fixture_id}: {e}")
            return []

    def _fetch_headtohead(self, home_id, away_id, sport="football"):
        """
        Fetches H2H matches, returning last 10.
        """
        try:
            base_url = self.configs[sport]["url"]
            endpoint = "fixtures/headtohead" if sport == "football" else "games"
            
            # API-Basketball uses 'h2h' param just like Football?
            # User provided: https://v1.basketball.api-sports.io/games?h2h=728-722
            # Yes, param is 'h2h'.
            
            resp = self._call_api(f"{base_url}/{endpoint}", params={"h2h": f"{home_id}-{away_id}"}, sport=sport)
            data = resp.json()
            raw_h2h = data.get("response", [])
            
            if not raw_h2h: return []
            
            filtered = []
            for match in raw_h2h:
                # check status
                if sport == "football":
                    status = match.get("fixture", {}).get("status", {}).get("short")
                else:
                    status = match.get("status", {}).get("short")
                    
                if status not in ["FT", "AET", "PEN"]:
                    continue
                filtered.append(match)
                    
            # Sort by date desc (most recent first)
            # Football: fixture.date, Basketball: date
            def get_date(m):
                if sport == "football": return m["fixture"]["date"]
                return m.get("date", "1900-01-01")
                
            filtered.sort(key=get_date, reverse=True)
            
            # Return last 10
            return filtered[:10]
            
        except Exception as e:
            print(f"      [!] Error fetching H2H for {home_id}-{away_id} ({sport}): {e}")
            return []

    def _process_predictions(self, raw_data):
        """
        Extracts key insights from the predictions API response.
        """
        if not raw_data: return None
        
        try:
            main = raw_data[0]
            preds = main.get("predictions", {})
            teams = main.get("teams", {})
            comparison = main.get("comparison", {})
            league = main.get("league", {})
            
            # Helper to extract team league stats safely
            def get_team_stats(side):
                team_data = teams.get(side, {})
                league_data = team_data.get("league", {})
                last_5 = team_data.get("last_5", {})
                
                return {
                    "last_5_form": last_5.get("form"),
                    "last_5_att": last_5.get("att"),
                    "last_5_def": last_5.get("def"),
                    "last_5_goals": last_5.get("goals"),
                    "fixtures": league_data.get("fixtures", {}), # { played, wins, draws, loses }
                    "goals": league_data.get("goals", {}),       # { for: {total, avg}, against: {total, avg} }
                    "clean_sheet": league_data.get("clean_sheet", {}),
                    "failed_to_score": league_data.get("failed_to_score", {}),
                    "cards": league_data.get("cards", {}),       # { yellow, red }
                    "biggest": league_data.get("biggest", {})    # { streak, wins, loses, goals }
                }

            return {
                "winner_code": preds.get("winner", {}).get("name"),
                "winner_comment": preds.get("winner", {}).get("comment"),
                "advice": preds.get("advice"),
                "under_over": preds.get("under_over"),
                "win_percent": preds.get("percent"),
                "goals_prediction": preds.get("goals"),
                "comparison": comparison, # { form, att, def, h2h, goals, poisson_distribution, total }
                "home_team": get_team_stats("home"),
                "away_team": get_team_stats("away"),
                "league_context": {
                    "name": league.get("name"),
                    "country": league.get("country"),
                    "season": league.get("season")
                }
            }
        except Exception as e:
            print(f"      [!] Error processing predictions: {e}")
            return None

    def _process_h2h(self, filtered_h2h, sport="football"):
        """
        Simplifies the H2H list to only show Date, Score, Status, and League.
        """
        if not filtered_h2h: return []
        
        processed = []
        for match in filtered_h2h:
            try:
                if sport == "football":
                    date_str = match["fixture"]["date"][:10] # YYYY-MM-DD
                    home = match["teams"]["home"]["name"]
                    away = match["teams"]["away"]["name"]
                    home_goals = match['goals']['home']
                    away_goals = match['goals']['away']
                    score = f"{home_goals}-{away_goals}"
                    league_name = match["league"]["name"]
                else: # basketball
                    date_str = match.get("date", "")[:10]
                    home = match["teams"]["home"]["name"]
                    away = match["teams"]["away"]["name"]
                    # Basketball uses 'scores' -> 'home' -> 'total'
                    home_goals = match.get("scores", {}).get("home", {}).get("total")
                    away_goals = match.get("scores", {}).get("away", {}).get("total")
                    score = f"{home_goals}-{away_goals}"
                    league_name = match.get("league", {}).get("name", "Unknown")

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
    from src.services.redis_service import RedisService
    rs = RedisService()
    try:
        rs.log_script_execution("daily_bet_update.yml", "START", "Iniciando recolección de cuotas...")
        service = SportsDataService()
        service.fetch_matches()
        rs.log_script_execution("daily_bet_update.yml", "SUCCESS", "Recolección finalizada.")
    except Exception as e:
        rs.log_script_execution("daily_bet_update.yml", "FAILURE", str(e))
        print(f"[FATAL] Script failed: {e}")
