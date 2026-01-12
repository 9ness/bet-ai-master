import os
import json
import argparse
import google.generativeai as genai
from datetime import datetime, timedelta
from src.services.redis_service import RedisService

# Configuración del modelo más avanzado disponible
GEMINI_MODEL = "models/gemini-3-flash-preview"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class AIChecker:
    def __init__(self):
        self.redis = RedisService()
        # Activamos el modelo con capacidad de búsqueda (grounding)
        self.model = genai.GenerativeModel(GEMINI_MODEL)

    def get_results_via_ai(self, matches_to_check, date):
        """
        Pide a Gemini 3 que verifique los resultados usando Google Search.
        """
        prompt = f"""
        Eres un verificador oficial de resultados deportivos. 
        Fecha de los eventos: {date}
        
        TAREA:
        Busca los resultados finales de estos eventos y determina si el 'pick' (pronóstico) se cumplió (WON) o no (LOST).
        
        LISTA DE EVENTOS:
        {json.dumps(matches_to_check, indent=2)}

        REGLAS ESTRICTAS:
        1. Responde ÚNICAMENTE con un objeto JSON.
        2. El formato debe ser: {{"fixture_id": {{"status": "WON"|"LOST"|"PENDING", "score": "X-X"}}}}
        3. Si el partido no ha terminado o no hay datos, usa "PENDING".
        4. "WON" si se cumple el pick, "LOST" si no.
        """
        
        try:
            # En Gemini 3, la búsqueda está integrada en la generación
            response = self.model.generate_content(prompt)
            # Limpiar posibles bloques de código Markdown
            clean_json = response.text.replace('```json', '').replace('```', '').strip()
            return json.loads(clean_json)
        except Exception as e:
            print(f"❌ Error consultando a Gemini: {e}")
            return {}

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str)
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"🤖 IA CHECKER INICIADO ({GEMINI_MODEL}) - FECHA: {target_date}")
        
        daily_key = f"betai:daily_bets:{target_date}"
        raw_data = self.redis.get(daily_key)
        
        if not raw_data:
            print(f"⚠️ No hay datos para {target_date}")
            return

        daily_data = json.loads(raw_data)
        bets_input = daily_data.get("bets", [])
        
        # Normalizar a lista
        bets_list = list(bets_input.values()) if isinstance(bets_input, dict) else bets_input

        # 1. Recopilar qué hay que preguntar
        to_verify = []
        for bet in bets_list:
            if bet.get("status") in ["WON", "LOST"]: continue
            for sel in bet.get("selections", []):
                if sel.get("status") == "PENDING":
                    to_verify.append({
                        "fixture_id": sel["fixture_id"],
                        "match": sel["match"],
                        "pick": sel["pick"]
                    })

        if not to_verify:
            print("✅ Nada pendiente de verificar.")
            return

        # 2. Obtener veredicto de la IA
        print(f"🔍 Consultando resultados de {len(to_verify)} eventos...")
        results_map = self.get_results_via_ai(to_verify, target_date)

        # 3. Aplicar resultados y lógica de cascada
        day_profit = 0
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
            elif all(s == "WON" for s in sel_stats): bet["status"] = "WON"
            else: bet["status"] = "PENDING"

            # Profit
            stake, odd = float(bet.get("stake", 0)), float(bet.get("total_odd", 0))
            if bet["status"] == "WON": bet["profit"] = round(stake * (odd - 1), 2)
            elif bet["status"] == "LOST": bet["profit"] = -stake
            else: bet["profit"] = 0
            
            day_total_profit = day_profit + bet["profit"]

        daily_data["day_profit"] = round(day_total_profit, 2)
        daily_data["bets"] = bets_list
        
        # 4. Guardar
        self.redis.set_data(daily_key, daily_data)
        self.redis.set_data(f"betai:history:{target_date}", daily_data)
        print(f"💰 Proceso IA terminado. Profit del día: {daily_data['day_profit']}u")

if __name__ == "__main__":
    AIChecker().run()