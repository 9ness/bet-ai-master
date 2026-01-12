import argparse
import os
import sys
import json
import requests
import re
from datetime import datetime, timedelta # Corregido: añadido timedelta

# Ajustar path para imports
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
        
    def fetch_match_result(self, fixture_id):
        if not fixture_id: return None
        url = f"{self.base_url}/fixtures?id={fixture_id}"
        try:
            resp = requests.get(url, headers=self.headers)
            if resp.status_code == 200:
                data = resp.json()
                if not data["response"]: return None
                fixture = data["response"][0]
                status = fixture["fixture"]["status"]["short"]
                goals = fixture["goals"]
                return {
                    "status": status,
                    "home_goals": goals["home"] if goals["home"] is not None else 0,
                    "away_goals": goals["away"] if goals["away"] is not None else 0,
                    "is_finished": status in ["FT", "AET", "PEN"],
                    "fixture_id": fixture_id
                }
            return None
        except Exception as e:
            print(f"[ERROR] API failed: {e}")
            return None

    def evaluate_pick(self, pick, result):
        if not result or not result["is_finished"]: return "PENDING"
        pick = pick.upper()
        h, a = result["home_goals"], result["away_goals"]
        
        if any(x in pick for x in ["(1)", "GANA LOCAL"]): return "WON" if h > a else "LOST"
        if any(x in pick for x in ["(2)", "GANA VISITANTE"]): return "WON" if a > h else "LOST"
        if any(x in pick for x in ["(X)", "EMPATE"]): return "WON" if h == a else "LOST"
        
        ou_match = re.search(r'(OVER|MÁS|UNDER|MENOS)\s*(\d+\.?\d*)', pick)
        if ou_match:
            kind, line = ou_match.group(1), float(ou_match.group(2))
            total = h + a
            if kind in ["OVER", "MÁS"]: return "WON" if total > line else "LOST"
            if kind in ["UNDER", "MENOS"]: return "WON" if total < line else "LOST"
            
        if "AMBOS MARCAN" in pick or "BTTS" in pick: return "WON" if h > 0 and a > 0 else "LOST"
        if "1X" in pick: return "WON" if h >= a else "LOST"
        if "X2" in pick: return "WON" if a >= h else "LOST"
        return "PENDING"

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str, help="YYYY-MM-DD")
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"--- PROCESANDO FECHA: {target_date} ---")
        
        # CLAVES CORRECTAS CON PREFIJO betai:
        daily_key = f"betai:daily_bets:{target_date}"
        history_key = f"betai:history:{target_date}"
        
        raw_data = self.redis.get(daily_key)
        if not raw_data:
            print(f"[ERROR] No hay datos en {daily_key}")
            return

        daily_data = json.loads(raw_data)
        bets = daily_data.get("bets", []) # Ahora manejamos el formato de Array que usa tu web
        day_total_profit = 0

        for bet in bets:
            if bet.get("status") in ["WON", "LOST"]: continue
            
            print(f"Verificando {bet['type']}...")
            bet_selections = bet.get("selections", [])
            sel_results = []

            for sel in bet_selections:
                if sel.get("status") in ["WON", "LOST"]:
                    sel_results.append(sel["status"])
                    continue
                
                res = self.fetch_match_result(sel.get("fixture_id"))
                status = "PENDING"
                if res and res["is_finished"]:
                    status = self.evaluate_pick(sel.get("pick"), res)
                    sel["status"] = status
                sel_results.append(status)

            # Lógica de Cascada
            if any(s == "LOST" for s in sel_results):
                bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_results) and len(sel_results) > 0:
                bet["status"] = "WON"
            else:
                bet["status"] = "PENDING"

            # Cálculo de Profit real
            stake = float(bet.get("stake", 0))
            odd = float(bet.get("total_odd", 0))
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -stake
            else:
                bet["profit"] = 0
            
            day_total_profit += bet["profit"]

        daily_data["day_profit"] = round(day_total_profit, 2)
        
        # GUARDADO EN CLAVES CORRECTAS
        self.redis.set_data(daily_key, daily_data)
        self.redis.set_data(history_key, daily_data)
        print(f"[SUCCESS] {daily_key} actualizado. Profit: {day_total_profit}")

if __name__ == "__main__":
    ResultChecker().run()