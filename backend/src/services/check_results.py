import argparse
import os
import sys
import json
import re
import google.generativeai as genai
from datetime import datetime, timedelta

# Configuración de rutas
current_file_path = os.path.abspath(__file__)
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from src.services.redis_service import RedisService

# Configuración del Modelo (1.5 Pro es el más estable para búsqueda web)
GEMINI_MODEL = "models/gemini-2.5-pro"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class AIChecker:
    def __init__(self):
        self.redis = RedisService()
        # Herramienta de búsqueda activada obligatoriamente
        self.model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            tools=[{"google_search_retrieval": {}}]
        )

    def get_results_via_ai(self, matches_to_check, date):
        """
        Consulta a Gemini usando Google Search para auditar resultados.
        """
        prompt = f"""
        TAREA: Auditoría fáctica de resultados deportivos.
        FECHA: {date}
        
        INSTRUCCIONES:
        1. USA GOOGLE SEARCH para encontrar los resultados reales.
        2. PROHIBIDO INVENTAR. Si no hay datos, status es "PENDING".
        3. Para cada partido, identifica:
           - El marcador final (ej: 2-1).
           - Si el 'pick' menciona "Corners", busca el número total.
           - Si el 'pick' menciona "Tiros a puerta", busca el número total.

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
            print(f"❌ Error en Auditoría IA: {e}")
            return {}

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str)
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"🧠 AUDITORÍA PRO ACTIVA - FECHA: {target_date}")
        
        daily_key = f"betai:daily_bets:{target_date}"
        raw_data = self.redis.get(daily_key)
        
        if not raw_data:
            print(f"⚠️ No hay datos para {target_date}")
            return

        daily_data = json.loads(raw_data)
        bets_list = daily_data.get("bets", [])

        # Extraer pendientes
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
            print("✅ Todo auditado.")
            return

        results_map = self.get_results_via_ai(to_verify, target_date)

        total_day_profit = 0
        for bet in bets_list:
            sel_stats = []
            
            for sel in bet.get("selections", []):
                res = results_map.get(str(sel["fixture_id"]))
                if res:
                    sel["status"] = res["status"]
                    
                    # Lógica de asignación al campo 'result'
                    pick_text = sel["pick"].lower()
                    score = res.get("score_final", "")
                    
                    if "corners" in pick_text and res.get("corners_total"):
                        sel["result"] = f"Corners: {res['corners_total']}"
                    elif ("tiros" in pick_text or "shots" in pick_text) and res.get("shots_total"):
                        sel["result"] = f"Tiros a puerta: {res['shots_total']}"
                    else:
                        sel["result"] = score if score else "N/A"
                
                sel_stats.append(sel.get("status", "PENDING"))

            # Estado de la apuesta (Cascada)
            if "LOST" in sel_stats:
                bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_stats):
                bet["status"] = "WON"
            else:
                bet["status"] = "PENDING"

            # Financiero
            stake = float(bet.get("stake", 0))
            total_odd = float(bet.get("total_odd", 0))
            
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (total_odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -abs(stake)
            else:
                bet["profit"] = 0
            
            total_day_profit += bet.get("profit", 0)

        # Persistir
        daily_data["day_profit"] = round(total_day_profit, 2)
        daily_data["bets"] = bets_list
        self.redis.set_data(f"daily_bets:{target_date}", daily_data)
        
        print(f"💰 BALANCE FINAL: {daily_data['day_profit']}u")

if __name__ == "__main__":
    AIChecker().run()