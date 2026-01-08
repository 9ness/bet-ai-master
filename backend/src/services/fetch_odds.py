import requests
import json
import os
import time
from datetime import datetime
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

class FootballDataService:
    def __init__(self):
        self.base_url = "https://v3.football.api-sports.io"
        self.api_key = os.getenv("API_KEY")
        self.headers = {"x-apisports-key": self.api_key}
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.output_file = os.path.join(self.base_dir, 'data', 'matches_today.json')
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        self.priority_leagues = [39, 140, 135, 78, 61, 2, 3] # Top 5 + UEFA

    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def _normalize_key(self, text):
        text = text.lower()
        if "home/draw" in text: return "1X"
        if "home/away" in text: return "12"
        if "draw/away" in text: return "X2"
        if text == "yes": return "yes"
        if text == "no": return "no"
        return text.replace(" ", "_").replace(".", "_").replace("/", "_")

    def fetch_matches(self):
        if not self.api_key:
            return []

        date_str = self.get_today_date()
        print(f"[*] Buscando partidos prioritarios para HOY: {date_str}")
        
        # 1. Obtener Partidos
        url_fixtures = f"{self.base_url}/fixtures"
        params_fix = {"date": date_str, "status": "NS", "timezone": "Europe/Madrid"}
        
        try:
            resp = requests.get(url_fixtures, headers=self.headers, params=params_fix)
            all_fixtures = resp.json().get("response", [])
            top_matches = [f for f in all_fixtures if f["league"]["id"] in self.priority_leagues]
            if len(top_matches) < 5:
                top_matches.extend([f for f in all_fixtures if f["league"]["id"] not in self.priority_leagues][:10])
            targets = top_matches[:10]
            print(f"[*] Seleccionados {len(targets)} partidos.")

            # 2. Obtener FORMA (Standings)
            unique_leagues = list(set([m["league"]["id"] for m in targets]))
            team_forms = {} 
            
            print(f"[*] Obteniendo estado de forma de {len(unique_leagues)} ligas...")
            for lid in unique_leagues:
                try:
                    season = next((x["league"]["season"] for x in targets if x["league"]["id"] == lid), 2025)
                    url_stand = f"{self.base_url}/standings"
                    r_st = requests.get(url_stand, headers=self.headers, params={"league": lid, "season": season})
                    if r_st.status_code == 200:
                        standings = r_st.json().get("response", [])
                        if standings:
                            for group in standings[0]["league"]["standings"]:
                                for team_entry in group:
                                    tid = team_entry["team"]["id"]
                                    form = team_entry.get("form", "?????")[-5:] 
                                    team_forms[tid] = form
                    time.sleep(0.2)
                except Exception as e:
                    print(f"    [!] Error fetching standings logic: {e}")

            detailed_matches = []
            
            # 3. Bucle Principal (Odds + H2H)
            for match in targets:
                fix_id = match["fixture"]["id"]
                home = match["teams"]["home"]
                away = match["teams"]["away"]
                
                print(f"    -> Procesando {home['name']} vs {away['name']}...")
                
                match_data = {
                    "id": fix_id,
                    "date": date_str,
                    "home": home["name"],
                    "away": away["name"],
                    "league": match["league"]["name"],
                    "context": {
                        "home_form": team_forms.get(home["id"], "N/A"),
                        "away_form": team_forms.get(away["id"], "N/A"),
                        "h2h": []
                    },
                    "odds": {
                        "1x2": {}, "goals": {}, "btts": {}, "double_chance": {}, 
                        "ht_ft": {}, "corners": {}, "correct_score": {} # ID 10
                    }
                }

                # 3.1 Fetch H2H
                try:
                    url_h2h = f"{self.base_url}/fixtures/headtohead"
                    p_h2h = {"h2h": f"{home['id']}-{away['id']}", "last": 5}
                    r_h2h = requests.get(url_h2h, headers=self.headers, params=p_h2h)
                    if r_h2h.status_code == 200:
                        hist = r_h2h.json().get("response", [])
                        scores = []
                        for h in hist:
                            s = h["goals"]
                            scores.append(f"{h['teams']['home']['name']} {s['home']}-{s['away']} {h['teams']['away']['name']}")
                        match_data["context"]["h2h"] = scores
                    time.sleep(0.1)
                except:
                    pass

                # 3.2 Fetch Odds
                try:
                    url_odds = f"{self.base_url}/odds"
                    r_odds = requests.get(url_odds, headers=self.headers, params={"fixture": fix_id, "bookmaker": "1"})
                    if r_odds.status_code == 200 and r_odds.json().get("response"):
                        bets = r_odds.json()["response"][0]["bookmakers"][0]["bets"]
                        for bet in bets:
                            mid = bet["id"]
                            vals = bet["values"]
                            
                            if mid == 1: # 1x2
                                for v in vals:
                                    if "Home" in str(v["value"]): match_data["odds"]["1x2"]["home"] = v["odd"]
                                    elif "Draw" in str(v["value"]): match_data["odds"]["1x2"]["draw"] = v["odd"]
                                    elif "Away" in str(v["value"]): match_data["odds"]["1x2"]["away"] = v["odd"]
                            elif mid == 5: # Goals
                                for v in vals: match_data["odds"]["goals"][self._normalize_key(str(v["value"]))] = v["odd"]
                            elif mid == 8: # BTTS
                                for v in vals: match_data["odds"]["btts"][self._normalize_key(str(v["value"]))] = v["odd"]
                            elif mid == 12: # DC
                                for v in vals: match_data["odds"]["double_chance"][self._normalize_key(str(v["value"]))] = v["odd"]
                            elif mid == 13: # HT/FT
                                map_hf = {"Home/Home":"1/1","Home/Draw":"1/X","Home/Away":"1/2","Draw/Home":"X/1","Draw/Draw":"X/X","Draw/Away":"X/2","Away/Home":"2/1","Away/Draw":"2/X","Away/Away":"2/2"}
                                for v in vals: match_data["odds"]["ht_ft"][map_hf.get(str(v["value"]), str(v["value"]))] = v["odd"]
                            elif mid == 45: # Corners
                                for v in vals: match_data["odds"]["corners"][self._normalize_key(str(v["value"]))] = v["odd"]
                            elif mid == 10: # Correct Score
                                for v in vals:
                                    score_key = str(v["value"]).replace(":", "-") 
                                    match_data["odds"]["correct_score"][score_key] = v["odd"]
                                    
                    time.sleep(0.1)
                except Exception as e:
                    print(f"Error odds: {e}")

                detailed_matches.append(match_data)

            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(detailed_matches, f, indent=4, ensure_ascii=False)
            
            print(f"[OK] {len(detailed_matches)} partidos con CONTEXTO+ODDS guardados.")
            return detailed_matches

        except Exception as e:
            print(f"[X] Error General: {e}")
            return []

if __name__ == "__main__":
    service = FootballDataService()
    service.fetch_matches()
