import argparse
import os
import sys
import json
import re
import google.generativeai as genai
from google.generativeai import protos # IMPORTACIÓN CRÍTICA
from datetime import datetime, timedelta

# Configuración de rutas
current_file_path = os.path.abspath(__file__)
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from src.services.redis_service import RedisService

# Modelo 2.5 Pro (Confirmado en tu lista de modelos)
GEMINI_MODEL = "models/gemini-2.5-pro"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class AIChecker:
    def __init__(self):
        self.redis = RedisService()
        
        # DEFINICIÓN CORRECTA DE LA HERRAMIENTA PARA LA LIBRERÍA LEGACY
        # Usamos MODE_DYNAMIC para que la IA decida cuándo necesita buscar en Google
        tool_search = protos.Tool(
            google_search_retrieval=protos.GoogleSearchRetrieval(
                dynamic_retrieval_config=protos.DynamicRetrievalConfig(
                    mode=protos.DynamicRetrievalConfig.Mode.MODE_DYNAMIC,
                    dynamic_threshold=0.1 # Umbral bajo para forzar la búsqueda
                )
            )
        )

        self.model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            tools=[tool_search]
        )

    def get_results_via_ai(self, matches_to_check, date):
        """
        Consulta fáctica usando búsqueda web real mediante Protos.
        """
        prompt = f"""
        TAREA: Auditoría fáctica de resultados deportivos.
        FECHA DE LOS EVENTOS: {date}
        FECHA ACTUAL: {datetime.now().strftime('%Y-%m-%d')}

        INSTRUCCIONES:
        1. USA TU HERRAMIENTA DE BÚSQUEDA para encontrar marcadores y estadísticas.
        2. Prohibido inventar. Si el dato no existe: status "PENDING".
        3. Extrae: marcador final, total de corners y total de tiros a puerta (si aplica al pick).

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
            # Temperatura 0 para máxima precisión fáctica
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(temperature=0)
            )
            txt = response.text
            if "```json" in txt:
                txt = txt.split("```json")[1].split("```")[0]
            return json.loads(txt.strip())
        except Exception as e:
            print(f"❌ Error en Auditoría IA: {e}")
            return {}

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str)
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"🧠 AUDITORÍA PRO ACTIVA (Google Search Mode) - FECHA: {target_date}")
        
        daily_key = f"betai:daily_bets:{target_date}"
        raw_data = self.redis.get(daily_key)
        
        if not raw_data:
            print(f"⚠️ No hay datos para {target_date}")
            return

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

        if not to_verify:
            print("✅ Auditoría completada.")
            return

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

            # Lógica de resolución
            if "LOST" in sel_stats:
                bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_stats):
                bet["status"] = "WON"
            else:
                bet["status"] = "PENDING"

            stake = float(bet.get("stake", 0))
            total_odd = float(bet.get("total_odd", 0))
            
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (total_odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -abs(stake)
            else:
                bet["profit"] = 0
            
            total_day_profit += bet.get("profit", 0)

        # Persistir en Redis
        daily_data["day_profit"] = round(total_day_profit, 2)
        daily_data["bets"] = bets_list
        self.redis.set_data(f"daily_bets:{target_date}", daily_data)
        
        if target_date == datetime.now().strftime("%Y-%m-%d"):
            self.redis.set_data("daily_bets", daily_data)
        
        print(f"💰 BALANCE FINAL ACTUALIZADO: {daily_data['day_profit']}u")

if __name__ == "__main__":
    AIChecker().run()