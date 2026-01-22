import sys
import os
import json
import time
import math
from datetime import datetime

# Importamos la SDK para especificar el modelo y bloquear herramientas
# Imports de Google eliminados
# from google import genai
# from google.genai import types

# Path setup
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.bet_formatter import BetFormatter

def load_system_prompt(filename="system_prompt_analizador.txt"):
    """Carga el prompt maestro desde la carpeta tools."""
    try:
        base_path = os.path.dirname(__file__)
        prompt_path = os.path.normpath(os.path.join(base_path, "../../tools/", filename))
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"[FATAL] No se encontró el prompt en: {prompt_path}")
        sys.exit(1)

def analyze():
    print("--- REANALYSIS SCRIPT STARTED (GEMINI 3 PRO - MODO ACTUARIAL) ---")
    
    # 1. Inicialización de Servicios
    try:
        rs = RedisService()
        # [MODIFIED] Se ha eliminado la dependencia de Google GenAI por solicitud del usuario.
        # Este archivo ya no realiza llamadas al motor de Google.
        model_name = 'DISABLED-MANUAL-MODE'
        
    except Exception as e:
        print(f"[FATAL] Service Init Failed: {e}")
        return

    # 2. Obtención de datos
    today_str = datetime.now().strftime("%Y-%m-%d")
    raw_json = rs.get_raw_matches(today_str)
    
    if not raw_json:
        print(f"[ERROR] No hay datos para {today_str}.")
        return

    raw_matches = json.loads(raw_json)
    fixture_map = {str(m.get("id")): m for m in raw_matches if m.get("id")}

    # 3. [DISABLED] Carga de Prompt y Preparación AI
    # system_prompt = load_system_prompt()
    # full_prompt = f"{system_prompt}\n\nINPUT DATA JSON:\n{json.dumps(raw_matches, indent=2)}"

    valid_bets = []
    
    # 4. [DISABLED] Loop de Intentos (AI Gen)
    print("[-] AI Analysis logic has been disabled in analyze_old.py by user request.")
    print("[-] To use AI analysis, please use main.py with the GeminiService.")
    
    # Si se quisiera inyectar lógica manual, iría aquí.
    # Por ahora, valid_bets queda vacío para evitar errores.

    if not valid_bets: return

    # 6. Formatter y Cálculos (Se delega la limpieza al Formatter)
    try:
        formatter = BetFormatter()
        final_output = formatter.process_bets(valid_bets)
    except Exception as e:
        final_output = valid_bets

    for bet in final_output:
        odds = [float(s.get("odd", 1.0)) for s in bet["selections"]]
        if not odds: continue
        total_odd = round(math.prod(odds), 2)
        bet["total_odd"] = total_odd
        bet["odd"] = total_odd
        bt = bet.get("betType", "safe").lower()
        bet["stake"] = 6 if "safe" in bt else (3 if "value" in bt else 1)
        bet["estimated_units"] = round(bet["stake"] * (total_odd - 1), 2)

    # 7. Guardado
    rs.save_daily_bets(today_str, final_output)
    print(f"[SUCCESS] Análisis completado con {model_name}.")
    
    try:
        from src.services.telegram_generator import generate_messages_from_analysis
        generate_messages_from_analysis(today_str)
    except: pass

if __name__ == "__main__":
    analyze()