import argparse
import os
import sys
import json
import re
import google.generativeai as genai
from datetime import datetime, timedelta

# --- CORRECCIÓN CRÍTICA DE RUTAS ---
# Obtenemos la ruta absoluta de la carpeta 'backend'
current_file_path = os.path.abspath(__file__) # .../backend/src/services/check_results.py
services_dir = os.path.dirname(current_file_path) # .../backend/src/services
src_dir = os.path.dirname(services_dir) # .../backend/src
backend_root = os.path.dirname(src_dir) # .../backend

# Insertamos la raíz del backend en el primer lugar de búsqueda
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Ahora la importación no fallará
try:
    from src.services.redis_service import RedisService
except ModuleNotFoundError:
    # Plan B: Si se ejecuta desde el root del repositorio
    sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
    from src.services.redis_service import RedisService

# --- CONFIGURACIÓN IA ---
GEMINI_MODEL = "models/gemini-3-flash-preview"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class AIChecker:
    def __init__(self):
        self.redis = RedisService()
        self.model = genai.GenerativeModel(GEMINI_MODEL)

    def get_results_via_ai(self, matches_to_check, date):
        prompt = f"""
        Eres un verificador deportivo profesional. Fecha: {date}.
        TAREA: Busca los resultados finales y determina si el 'pick' se cumplió.
        
        PARTIDOS A VERIFICAR:
        {json.dumps(matches_to_check, indent=2)}

        REGLAS:
        1. Responde SOLO con un JSON puro.
        2. Formato: {{"ID": {{"status": "WON"|"LOST"|"PENDING", "score": "X-X"}}}}
        3. ID debe coincidir con el fixture_id enviado.
        """
        try:
            response = self.model.generate_content(prompt)
            clean_json = re.sub(r'```json|```', '', response.text).strip()
            return json.loads(clean_json)
        except Exception as e:
            print(f"❌ Error Gemini: {e}")
            return {}

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str)
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"🤖 IA CHECKER ({GEMINI_MODEL}) - FECHA: {target_date}")
        
        daily_key = f"betai:daily_bets:{target_date}"
        raw_data = self.redis.get(daily_key)
        
        if not raw_data:
            print(f"⚠️ No hay datos en {daily_key}")
            return

        daily_data = json.loads(raw_data)
        bets_input = daily_data.get("bets", [])
        bets_list = list(bets_input.values()) if isinstance(bets_input, dict) else bets_input

        to_verify = []
        for bet in bets_list:
            if bet.get("status") in ["WON", "LOST"]: continue
            for sel in bet.get("selections", []):
                if sel.get("status") == "PENDING":
                    to_verify.append({
                        "fixture_id": str(sel["fixture_id"]),
                        "match": sel["match"],
                        "pick": sel["pick"]
                    })

        if not to_verify:
            print("✅ Nada pendiente.")
            return

        results_map = self.get_results_via_ai(to_verify, target_date)

        total_day_profit = 0
        for bet in bets_list:
            sel_stats = []
            for sel in bet.get("selections", []):
                res = results_map.get(str(sel["fixture_id"]))
                if res:
                    sel["status"] = res["status"]
                    sel["result"] = res["score"]
                sel_stats.append(sel.get("status", "PENDING"))

            # Cascada
            if "LOST" in sel_stats: bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_stats) and len(sel_stats) > 0: bet["status"] = "WON"
            else: bet["status"] = "PENDING"

            # Profit
            stake, odd = float(bet.get("stake", 0)), float(bet.get("total_odd", 0))
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -stake
            else:
                bet["profit"] = 0
            
            total_day_profit += bet["profit"]

        daily_data["day_profit"] = round(total_day_profit, 2)
        daily_data["bets"] = bets_list
        
        self.redis.set_data(daily_key, daily_data)
        self.redis.set_data(f"betai:history:{target_date}", daily_data)
        print(f"💰 Profit final: {daily_data['day_profit']}u")

if __name__ == "__main__":
    AIChecker().run()