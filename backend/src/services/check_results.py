import os
import sys
import json
import requests
import re
from datetime import datetime

# Adjust path to allow imports from src if running from project root
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
        """Consulta la API para obtener resultado."""
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
            print(f"[ERROR] API Request failed for {fixture_id}: {e}")
            return None

    # ... (imports stay same)
    import argparse

    # ... (init and fetch_match_result stay same)

    def evaluate_pick(self, pick, result):
        """Evalúa un pick individual."""
        if not result or not result["is_finished"]:
            return "PENDING"
            
        pick = pick.upper()
        h = result["home_goals"]
        a = result["away_goals"]
        
        # 1X2
        if "(1)" in pick or "GANA LOCAL" in pick or "VICTORIA LOCAL" in pick:
            return "WON" if h > a else "LOST"
        if "(2)" in pick or "GANA VISITANTE" in pick or "VICTORIA VISITANTE" in pick:
            return "WON" if a > h else "LOST"
        if "(X)" in pick or "EMPATE" in pick:
            return "WON" if h == a else "LOST"
            
        # Over/Under
        ou_match = re.search(r'(OVER|MÁS|MENOS|UNDER)\s*(\d+\.?\d*)', pick)
        if ou_match:
            kind = ou_match.group(1)
            line = float(ou_match.group(2))
            total = h + a
            if kind in ["OVER", "MÁS"]: return "WON" if total > line else "LOST"
            if kind in ["UNDER", "MENOS", "MENOS DE"]: return "WON" if total < line else "LOST"
            
        # BTTS
        if "AMBOS MARCAN" in pick or "BTTS" in pick:
             return "WON" if h > 0 and a > 0 else "LOST"
             
        # Double Chance (1X, X2, 12)
        if "1X" in pick: return "WON" if h >= a else "LOST"
        if "X2" in pick: return "WON" if a >= h else "LOST"
        if "12" in pick: return "WON" if h != a else "LOST"

        return "PENDING"

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str, help="Fecha a comprobar (YYYY-MM-DD). Default: Ayer")
        args = parser.parse_args()

        target_date = args.date
        if not target_date:
            target_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        print(f"--- INICIANDO VERIFICACIÓN DE RESULTADOS (UPSTASH) ---")
        print(f"--- TARGET DATE: {target_date} ---")
        
        # 1. Leer Daily Bets (o History si ya existe y queremos actualizar)
        # Prioridad: Check 'daily_bets' si la fecha coincide, sino check 'bets:DATE'
        
        # Estrategia robusta:
        # A. Intentar leer `bets:{target_date}` (Key histórica guardada por Gemini)
        # B. Si no existe, revisar si `daily_bets` tiene esa fecha.
        
        redis_key = f"bets:{target_date}"
        raw_data = self.redis.get(f"bets:{target_date}")
        
        # Si no encontramos la key específica, miramos daily_bets por si acaso es "hoy/ayer" y está ahí
        if not raw_data:
            print(f"[INFO] No encontrada key especifica 'bets:{target_date}'. Revisando 'daily_bets'...")
            daily_raw = self.redis.get("daily_bets")
            if daily_raw:
                daily_json = json.loads(daily_raw)
                if daily_json.get("date") == target_date:
                    raw_data = daily_raw
                    redis_key = "daily_bets" # Actualizaremos esta
                else:
                    print(f"[WARN] 'daily_bets' es de fecha {daily_json.get('date')}, no {target_date}.")
        
        if not raw_data:
            print("[ERROR] No se encontraron datos para procesar.")
            return

        daily_data = json.loads(raw_data)
        bets_map = daily_data.get("bets", {})
        
        all_bets_finished = True
        updated_something = True # Forzamos update para guardar estados parciales
        
        # Mapeo de stakes por defecto
        default_stakes = {"safe": 6, "value": 3, "funbet": 1}

        # 2. Iterar Categorías
        for cat_name, bet_data in bets_map.items():
            if not bet_data: continue
            
            print(f"\n>>> Verificando {cat_name.upper()}...")
            stake = bet_data.get("stake", default_stakes.get(cat_name, 1))
            odd = bet_data.get("odd", 0)
            
            # --- SELECCIONES ---
            # Si no existe 'selections', migramos desde 'components' o simple
            selections = bet_data.get("selections", [])
            if not selections and bet_data.get("components"):
                selections = bet_data["components"]
            if not selections:
                # Caso Legacy: Crear selección única
                selections = [{
                    "fixture_id": bet_data.get("fixture_id"),
                    "match": bet_data.get("match"),
                    "pick": bet_data.get("pick"),
                    "odd": odd
                }]
            
            # Evaluar cada selección
            sel_results = []
            
            for sel in selections:
                fid = sel.get("fixture_id")
                pick = sel.get("pick")
                
                # Manual Override Check (si el admin ya puso status, lo respetamos? 
                # El prompt dice "El script actualiza...". Si admin fuerza, quizás deberíamos respetar 'MANUAL_' prefix?
                # Por simplicidad: script siempre verifica API. Si admin quiere forzar, debe ser post-script o flag.)
                
                res = self.fetch_match_result(fid)
                status = "PENDING"
                result_txt = "?"
                
                if res and res["is_finished"]:
                    status = self.evaluate_pick(pick, res)
                    result_txt = f"{res['home_goals']}-{res['away_goals']}"
                elif res:
                    result_txt = f"{res['status']}"
                
                # Actualizar selección
                sel["status"] = status
                sel["result"] = result_txt
                sel_results.append(status)
                
                print(f"   - ID {fid} | {pick} -> {status} ({result_txt})")

            # Guardar array actualizado
            bet_data["selections"] = selections
            
            # Determinar Estado Global
            final_status = "PENDING"
            if "LOST" in sel_results:
                final_status = "LOST"
            elif "PENDING" in sel_results:
                 final_status = "PENDING"
                 all_bets_finished = False
            else:
                final_status = "WON"

            # Calcular Profit
            profit = 0.0
            status_display = "PENDIENTE"
            
            if final_status == "LOST":
                profit = -float(stake)
                status_display = "PERDIDA"
            elif final_status == "WON":
                profit = (float(stake) * float(odd)) - float(stake)
                status_display = "GANADA"
            
            bet_data["status"] = status_display
            bet_data["profit"] = round(profit, 2)
            
            print(f"   => GLOBAL: {status_display} | {profit}u")

        # 3. Guardar en Redis
        # Guardamos SIEMPRE en la key específica de fecha para historial persistente
        history_key = f"history:{target_date}"
        self.redis.set_data(history_key, daily_data)
        print(f"[SUCCESS] Datos actualizados en '{history_key}'")

        # Si trabajábamos sobre 'daily_bets' y es la fecha correcta, actualizamos esa también
        if redis_key == "daily_bets":
            self.redis.set_data("daily_bets", daily_data)
            print("[INFO] 'daily_bets' también actualizado.")

if __name__ == "__main__":
    checker = ResultChecker()
    checker.run()
