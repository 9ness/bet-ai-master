import requests
import json
import os
import time
from datetime import datetime
from dotenv import load_dotenv

# --- CARGA DE VARIABLES ---
current_dir = os.path.dirname(os.path.abspath(__file__))
potential_paths = [
    os.path.join(current_dir, '../../.env'),
    os.path.join(current_dir, '../.env'),
    os.path.join(current_dir, '../../../.env')
]
for p in potential_paths:
    if os.path.exists(p):
        load_dotenv(p)
        print(f"[OK] API_KEY cargada desde: {p}")
        break

class MultiSportDataService:
    def __init__(self):
        self.api_key = os.getenv("API_KEY")
        self.call_count = 0
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.output_file = os.path.join(self.base_dir, 'data', 'test_multisport.json')
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        
        # Configuración de Endpoints
        self.urls = {
            "football": "https://v3.football.api-sports.io",
            "basketball": "https://v1.basketball.api-sports.io",
            "tennis": "https://v1.tennis.api-sports.io"
        }

    def _request(self, sport, endpoint, params=None):
        self.call_count += 1
        url = f"{self.urls[sport]}/{endpoint}"
        headers = {"x-apisports-key": self.api_key}
        try:
            resp = requests.get(url, headers=headers, params=params)
            return resp.json().get("response", [])
        except Exception as e:
            print(f" [!] Error API {sport}: {e}")
            return []

    def fetch_data(self, date_str):
        print(f"\n--- INICIANDO RECOLECCIÓN: {date_str} ---")
        results = []

        # 1. FOOTBALL (Ligas principales)
        print("[+] Buscando Fútbol...")
        # Ligas: 39 (PL), 140 (LaLiga), 135 (Serie A), 78 (Bund), 61 (Ligue 1)
        for league_id in [39, 140, 135, 78]:
            fixtures = self._request("football", "fixtures", {"date": date_str, "league": league_id})
            for f in fixtures[:3]: # Limitamos a 3 partidos por liga para la prueba
                fix_id = f['fixture']['id']
                print(f"    -> {f['teams']['home']['name']} vs {f['teams']['away']['name']}")
                
                # Pedimos Odds (Mercados: 1, 5, 8, 12 y 3/4 para Corners)
                odds_data = self._request("football", "odds", {"fixture": fix_id, "bookmaker": 8})
                cleaned_odds = self._process_odds(odds_data, "football")
                
                results.append({
                    "sport": "football",
                    "id": fix_id,
                    "league": f['league']['name'],
                    "match": f"{f['teams']['home']['name']} vs {f['teams']['away']['name']}",
                    "odds": cleaned_odds
                })

        # 2. BASKETBALL (NBA)
        print("[+] Buscando NBA...")
        games = self._request("basketball", "games", {"date": date_str, "league": 12})
        for g in games[:3]:
            game_id = g['id']
            print(f"    -> NBA: {g['teams']['home']['name']} vs {g['teams']['away']['name']}")
            odds_data = self._request("basketball", "odds", {"game": game_id, "bookmaker": 8})
            cleaned_odds = self._process_odds(odds_data, "basketball")
            results.append({
                "sport": "basketball",
                "id": game_id,
                "league": "NBA",
                "match": f"{g['teams']['home']['name']} vs {g['teams']['away']['name']}",
                "odds": cleaned_odds
            })

        # 3. TENNIS
        print("[+] Buscando Tenis...")
        t_games = self._request("tennis", "games", {"date": date_str})
        for t in t_games[:3]:
            t_id = t['id']
            print(f"    -> Tenis: {t['teams']['home']['name']} vs {t['teams']['away']['name']}")
            odds_data = self._request("tennis", "odds", {"id": t_id, "bookmaker": 8})
            cleaned_odds = self._process_odds(odds_data, "tennis")
            results.append({
                "sport": "tennis",
                "id": t_id,
                "league": t.get('league', {}).get('name', 'ATP/WTA'),
                "match": f"{t['teams']['home']['name']} vs {t['teams']['away']['name']}",
                "odds": cleaned_odds
            })

        # GUARDAR JSON
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=4, ensure_ascii=False)
        
        print(f"\n==============================")
        print(f"PRUEBA FINALIZADA")
        print(f"Llamadas API realizadas: {self.call_count}")
        print(f"JSON guardado en: {self.output_file}")
        print(f"==============================")

    def _process_odds(self, response, sport):
        if not response: return {}
        try:
            bets = response[0]["bookmakers"][0]["bets"]
            cleaned = {}
            for b in bets:
                name = b["name"]
                # FILTRO PROFESIONAL: Quitamos lo que no sirve
                if any(x in name for x in ["Correct Score", "HT/FT", "Exact Score", "Anytime Scorer"]):
                    continue
                
                # Guardamos solo el nombre del mercado y sus valores
                cleaned[name] = b["values"]
            return cleaned
        except:
            return {}

if __name__ == "__main__":
    service = MultiSportDataService()
    # Ejecutamos para HOY
    service.fetch_data(datetime.now().strftime("%Y-%m-%d"))