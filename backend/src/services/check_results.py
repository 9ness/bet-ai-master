import argparse
import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
import google.generativeai as genai

# Gestión de rutas y entorno
current_file_path = os.path.abspath(__file__)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))
env_path = os.path.join(project_root, 'frontend', '.env.local')

# Carga .env.local si existe (Local), si no, usa variables de sistema (GitHub)
if os.path.exists(env_path):
    load_dotenv(env_path)

if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.services.redis_service import RedisService

# Configuración de API (Soporta múltiples nombres de variable)
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("API_KEY")
genai.configure(api_key=api_key)

GEMINI_MODEL = "models/gemini-2.0-flash"

class AIChecker:
    def __init__(self):
        self.redis = RedisService()
        # Herramienta de búsqueda en formato diccionario para máxima compatibilidad
        self.model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            tools=[{"google_search": {}}]
        )

    def get_results_via_ai(self, matches_to_check, date):
        prompt = f"""
        TAREA: Auditoría de resultados deportivos.
        FECHA EVENTOS: {date}
        FECHA ACTUAL: {datetime.now().strftime('%Y-%m-%d')}

        INSTRUCCIONES:
        1. USA GOOGLE SEARCH para encontrar marcadores y estadísticas.
        2. Prohibido inventar. Si el dato no existe: status "PENDING".
        3. Si el pick menciona "Corners" o "Tiros", extrae el total numérico.

        LISTA DE EVENTOS:
        {json.dumps(matches_to_check, indent=2)}

        RESPUESTA JSON ESTRICTA:
        {{
          "fixture_id_string": {{
            "status": "WON" | "LOST" | "PENDING",
            "score_final": "2-1",
            "corners_total": 10,
            "shots_total": 8
          }}
        }}
        """
        try:
            response = self.model.generate_content(prompt)
            txt = response.text
            if "```json" in txt:
                txt = txt.split("```json")[1].split("```")[0]
            return json.loads(txt.strip())
        except Exception as e:
            print(f"Error Auditoría: {e}")
            return {}

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str)
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        daily_key = f"betai:daily_bets:{target_date}"
        raw_data = self.redis.get(daily_key)
        if not raw_data: return

        daily_data = json.loads(raw_data)
        bets_list = daily_data.get("bets", [])
        to_verify = []

        for bet in bets_list:
            for sel in bet.get("selections", []):
                if sel.get("status") == "PENDING":
                    to_verify.append({
                        "fixture_id": str(sel["fixture_id"]),
                        "match": sel["match"],
                        "pick": sel["pick"]
                    })

        if not to_verify: return

        results_map = self.get_results_via_ai(to_verify, target_date)
        total_day_profit = 0

        for bet in bets_list:
            sel_stats = []
            for sel in bet.get("selections", []):
                res = results_map.get(str(sel["fixture_id"]))
                if res:
                    sel["status"] = res["status"]
                    pick_text = sel["pick"].lower()
                    if "corners" in pick_text and res.get("corners_total"):
                        sel["result"] = f"Corners: {res['corners_total']}"
                    elif ("tiros" in pick_text or "shots" in pick_text) and res.get("shots_total"):
                        sel["result"] = f"Tiros a puerta: {res['shots_total']}"
                    else:
                        sel["result"] = res.get("score_final", "N/A")
                sel_stats.append(sel.get("status", "PENDING"))

            if "LOST" in sel_stats:
                bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_stats) and len(sel_stats) > 0:
                bet["status"] = "WON"
            else:
                bet["status"] = "PENDING"

            stake = float(bet.get("stake", 0))
            odd = float(bet.get("total_odd", 0))
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -abs(stake)
            else:
                bet["profit"] = 0
            total_day_profit += bet["profit"]

        daily_data["day_profit"] = round(total_day_profit, 2)
        daily_data["bets"] = bets_list
        self.redis.set_data(f"daily_bets:{target_date}", daily_data)
        if target_date == datetime.now().strftime("%Y-%m-%d"):
            self.redis.set_data("daily_bets", daily_data)

if __name__ == "__main__":
    AIChecker().run()