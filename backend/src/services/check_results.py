import argparse
import os
import sys
import json
import requests
import re
from datetime import datetime, timedelta

# Ajustar path para permitir importaciones desde src
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
        """Consulta la API para obtener el resultado del partido."""
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
            print(f"[ERROR] API Request failed: {e}")
            return None

    def evaluate_pick(self, pick, result):
        """Evalúa si un pronóstico es acertado basado en el resultado."""
        if not result or not result["is_finished"]:
            return "PENDING"
            
        pick = pick.upper()
        h = result["home_goals"]
        a = result["away_goals"]
        
        # Lógica para 1X2
        if any(x in pick for x in ["(1)", "GANA LOCAL", "VICTORIA LOCAL"]):
            return "WON" if h > a else "LOST"
        if any(x in pick for x in ["(2)", "GANA VISITANTE", "VICTORIA VISITANTE"]):
            return "WON" if a > h else "LOST"
        if any(x in pick for x in ["(X)", "EMPATE"]):
            return "WON" if h == a else "LOST"
            
        # Lógica para Over/Under
        ou_match = re.search(r'(OVER|MÁS|MENOS|UNDER)\s*(\d+\.?\d*)', pick)
        if ou_match:
            kind = ou_match.group(1)
            line = float(ou_match.group(2))
            total = h + a
            if kind in ["OVER", "MÁS"]: return "WON" if total > line else "LOST"
            if kind in ["UNDER", "MENOS"]: return "WON" if total < line else "LOST"
            
        # Ambos Marcan
        if "AMBOS MARCAN" in pick or "BTTS" in pick:
             return "WON" if h > 0 and a > 0 else "LOST"
             
        # Doble Oportunidad
        if "1X" in pick: return "WON" if h >= a else "LOST"
        if "X2" in pick: return "WON" if a >= h else "LOST"
        if "12" in pick: return "WON" if h != a else "LOST"

        return "PENDING"

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str, help="Fecha YYYY-MM-DD. Default: Ayer")
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"--- INICIANDO VERIFICACIÓN: {target_date} ---")
        
        daily_key = f"betai:daily_bets:{target_date}"
        history_key = f"betai:history:{target_date}"
        
        raw_data = self.redis.get(daily_key)
        if not raw_data:
            print(f"[ERROR] No hay datos en Redis para la clave: {daily_key}")
            return

        daily_data = json.loads(raw_data)
        
        # FIX: Manejar si 'bets' es un Diccionario o una Lista
        bets_input = daily_data.get("bets", [])
        if isinstance(bets_input, dict):
            print("[INFO] Detectado formato diccionario en 'bets'. Convirtiendo...")
            bets_list = list(bets_input.values())
        else:
            bets_list = bets_input

        day_total_profit = 0

        for bet in bets_list:
            # Normalizar status para evitar errores de mayúsculas/minúsculas
            current_status = bet.get("status", "PENDING").upper()
            
            # Saltamos si ya está marcada como finalizada
            if current_status in ["WON", "LOST", "GANADA", "PERDIDA"]:
                print(f"[SKIP] Apuesta {bet.get('type')} ya finalizada ({current_status}).")
                day_total_profit += float(bet.get("profit", 0))
                continue
            
            print(f"\n>>> Verificando {bet.get('type', 'desconocida').upper()}...")
            selections = bet.get("selections", [])
            sel_results = []

            for sel in selections:
                if sel.get("status") in ["WON", "LOST"]:
                    sel_results.append(sel["status"])
                    continue

                res = self.fetch_match_result(sel.get("fixture_id"))
                status = "PENDING"
                if res and res["is_finished"]:
                    status = self.evaluate_pick(sel.get("pick"), res)
                    sel["status"] = status
                    sel["result"] = f"{res['home_goals']}-{res['away_goals']}"
                sel_results.append(status)

            # Lógica de Cascada para el estado Global de la apuesta
            if any(s == "LOST" for s in sel_results):
                bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_results) and len(sel_results) > 0:
                bet["status"] = "WON"
            else:
                bet["status"] = "PENDING"

            # Cálculo de Profit (Stake * (Odd - 1))
            stake = float(bet.get("stake", 0))
            odd = float(bet.get("total_odd", 0))
            
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -stake
            else:
                bet["profit"] = 0
            
            day_total_profit += bet["profit"]
            print(f"    Resultado: {bet['status']} | Profit: {bet['profit']}u")

        # Actualizar datos globales del día
        daily_data["day_profit"] = round(day_total_profit, 2)
        daily_data["bets"] = bets_list # Guardamos siempre como lista para estandarizar

        # Guardado en Redis
        self.redis.set_data(daily_key, daily_data)
        self.redis.set_data(history_key, daily_data)
        
        print(f"\n[SUCCESS] Actualización completada para {target_date}")
        print(f"Profit Total del día: {daily_data['day_profit']}u")

if __name__ == "__main__":
    ResultChecker().run()