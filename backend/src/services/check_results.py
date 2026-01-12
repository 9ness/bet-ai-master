import argparse
import os
import sys
import json
import re
import google.generativeai as genai
from datetime import datetime, timedelta

# --- CONFIGURACIÓN DE RUTAS ---
current_file_path = os.path.abspath(__file__)
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file_path)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from src.services.redis_service import RedisService

# --- CONFIGURACIÓN DEL MODELO PRO ---
# Usamos el modelo más avanzado con razonamiento superior
GEMINI_MODEL = "models/gemini-3-pro-preview"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class AIChecker:
    def __init__(self):
        self.redis = RedisService()
        # Configuramos el modelo Pro
        self.model = genai.GenerativeModel(model_name=GEMINI_MODEL)

    def get_results_via_ai(self, matches_to_check, date):
        """
        Pide a Gemini 3 Pro una auditoría con razonamiento lógico.
        """
        prompt = f"""
        Actúa como un Auditor Senior de Apuestas Deportivas con acceso a datos en tiempo real.
        Fecha de los eventos: {date}.
        Fecha actual: {datetime.now().strftime('%Y-%m-%d')}.

        TAREA:
        Verifica los resultados finales de los siguientes eventos y decide si el 'pick' es WON o LOST.

        LISTA DE EVENTOS:
        {json.dumps(matches_to_check, indent=2)}

        PROTOCOLO DE RAZONAMIENTO PARA CADA PARTIDO:
        1. Identifica el marcador final oficial (incluyendo prórroga si aplica).
        2. Verifica el pick:
           - "X2": Gana visitante o Empate.
           - "1X": Gana local o Empate.
           - "Ambos Marcan/BTTS": ¿Ambos equipos hicieron al menos 1 gol?
           - "Over/Under": ¿La suma de goles supera o es inferior a la línea?
        3. Presta especial atención a goles de último minuto (90'+).

        RESPONDE ÚNICAMENTE CON UN JSON PURO:
        {{
          "fixture_id": {{
            "status": "WON" | "LOST",
            "score": "Resultado exacto (ej: 1-1)",
            "analysis": "Breve razonamiento del porqué del resultado"
          }}
        }}
        """
        
        try:
            # Temperatura 0 para evitar alucinaciones y forzar precisión
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(temperature=0)
            )
            
            # Limpiar Markdown si existiera
            clean_json = re.sub(r'```json|```', '', response.text).strip()
            return json.loads(clean_json)
        except Exception as e:
            print(f"❌ Error crítico en Gemini 3 Pro: {e}")
            return {}

    def run(self):
        parser = argparse.ArgumentParser()
        parser.add_argument("--date", type=str)
        args = parser.parse_args()

        target_date = args.date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"🧠 INICIANDO AUDITORÍA PRO ({GEMINI_MODEL}) - FECHA: {target_date}")
        
        daily_key = f"betai:daily_bets:{target_date}"
        raw_data = self.redis.get(daily_key)
        
        if not raw_data:
            print(f"⚠️ No hay datos en Redis para {target_date}")
            return

        daily_data = json.loads(raw_data)
        bets_input = daily_data.get("bets", [])
        bets_list = list(bets_input.values()) if isinstance(bets_input, dict) else bets_input

        # Recopilar todo lo pendiente
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
            print("✅ Nada pendiente de verificar.")
            return

        print(f"🔍 Gemini 3 Pro analizando {len(to_verify)} selecciones...")
        results_map = self.get_results_via_ai(to_verify, target_date)

        total_day_profit = 0
        for bet in bets_list:
            sel_stats = []
            print(f"\n--- Apuesta {bet.get('type', '').upper()} ---")
            
            for sel in bet.get("selections", []):
                res = results_map.get(str(sel["fixture_id"]))
                if res:
                    sel["status"] = res["status"]
                    sel["result"] = res["score"]
                    print(f"   📊 {sel['match']}: {res['score']} -> {res['status']}")
                    print(f"      💡 Razón: {res.get('analysis', 'Sin detalles')}")
                
                sel_stats.append(sel.get("status", "PENDING"))

            # Lógica de Cascada
            if "LOST" in sel_stats:
                bet["status"] = "LOST"
            elif all(s == "WON" for s in sel_stats) and len(sel_stats) > 0:
                bet["status"] = "WON"
            else:
                bet["status"] = "PENDING"

            # Profit
            stake = float(bet.get("stake", 0))
            odd = float(bet.get("total_odd", 0))
            if bet["status"] == "WON":
                bet["profit"] = round(stake * (odd - 1), 2)
            elif bet["status"] == "LOST":
                bet["profit"] = -stake
            else:
                bet["profit"] = 0
            
            total_day_profit += bet["profit"]

        # Guardar resultados
        daily_data["day_profit"] = round(total_day_profit, 2)
        daily_data["bets"] = bets_list
        
        # Save to Daily Bets (Key: betai:daily_bets:YYYY-MM-DD)
        self.redis.set_data(f"daily_bets:{target_date}", daily_data)
        
        # Save to History (Key: betai:history:YYYY-MM-DD)
        self.redis.set_data(f"history:{target_date}", daily_data)
        
        # Sync Master Key if Today (Key: betai:daily_bets)
        today_now = datetime.now().strftime("%Y-%m-%d")
        if target_date == today_now:
            self.redis.set_data("daily_bets", daily_data)
            print(f"🔄 Master Key 'daily_bets' synced.")
        
        print(f"\n💰 BALANCE FINAL: {daily_data['day_profit']}u")

if __name__ == "__main__":
    AIChecker().run()