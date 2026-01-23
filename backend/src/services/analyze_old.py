import sys
import os
import json
import time
import math
from datetime import datetime

# Usamos la librería estándar que ya tienes instalada y funciona (como en gemini.py)
import google.generativeai as genai

# Path setup
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.bet_formatter import BetFormatter
from src.services.json_cleaner import clean_json_matches

def load_system_prompt(filename="system_prompt_analizador.txt"):
    """Carga el prompt maestro desde la carpeta del proyecto."""
    try:
        # Intentar rutas relativas comunes
        base_paths = [
            os.path.join(os.path.dirname(__file__), '../../'), # Root backend/src/services/../../ -> backend
            os.path.join(os.path.dirname(__file__), '../../../'), # Root bet-ai-master
        ]
        
        content = None
        for base in base_paths:
            msg_path = os.path.normpath(os.path.join(base, filename))
            if os.path.exists(msg_path):
                with open(msg_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                break
        
        if not content:
            # Fallback: intentar leer desde el directorio actual o hardcoded
            if os.path.exists(filename):
                with open(filename, 'r', encoding='utf-8') as f:
                    content = f.read()
            else:
                # Si no encuentra el archivo, usar el texto plano de emergencia o fallar
                print(f"[WARN] No se encontró {filename}, buscando en rutas alternativas...")
                # Intentar ruta absoluta basada en estructura conocida
                abs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../system_prompt_analizador.txt'))
                if os.path.exists(abs_path):
                     with open(abs_path, 'r', encoding='utf-8') as f:
                        content = f.read()
        
        if not content:
            raise FileNotFoundError(f"Could not find {filename}")
            
        return content

    except Exception as e:
        print(f"[FATAL] System Prompt missing: {e}")
        sys.exit(1)

def analyze():
    print("--- REANALYSIS SCRIPT STARTED (GEMINI NO-SEARCH MODE) ---")
    
    # 1. Inicialización
    try:
        rs = RedisService()
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY no encontrada")
            
        genai.configure(api_key=api_key)
        # Usamos el modelo estándar
        model = genai.GenerativeModel('gemini-3-pro-preview') 
        print("[INIT] Model configured (No Search Tools)")
        
    except Exception as e:
        print(f"[FATAL] Service Init Failed: {e}")
        return

    # 2. Obtención de datos
    print(f"\n[STEP 1] Fetching Data...")
    today_str = datetime.now().strftime("%Y-%m-%d")
    raw_json = rs.get_raw_matches(today_str) or rs.get(f"raw_matches:{today_str}")
    
    if not raw_json:
        print(f"[ERROR] No raw matches found for {today_str}.")
        return

    raw_matches = json.loads(raw_json)
    print(f"[DATA] Loaded {len(raw_matches)} matches.")
    
    # --- CLEANING STEP ---
    raw_matches = clean_json_matches(raw_matches)
    # ---------------------
    
    fixture_map = {str(m.get("id")): m for m in raw_matches if m.get("id")}

    # 3. Preparación del Prompt
    system_instruction = load_system_prompt()
    full_prompt = f"""
{system_instruction}

INPUT DATA (MATCHES):
{json.dumps(raw_matches, indent=2)}
"""

    valid_bets = None
    
    # 4. Generación
    for i in range(3):
        print(f"[*] Gemini Attempt {i+1}...")
        try:
            # Llamada simple SIN herramientas de búsqueda
            response = model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                    response_mime_type='application/json'
                )
            )
            
            # Limpieza básica
            text = response.text.strip()
            if text.startswith("```json"): text = text[7:-3]
            if text.startswith("```"): text = text[3:-3]
            
            # Parse JSON
            start = text.find('[')
            end = text.rfind(']')
            if start != -1 and end != -1:
                candidates = json.loads(text[start:end+1])
            else:
                candidates = json.loads(text)
                
            # Post-procesamiento IDs
            for bet in candidates:
                real_selections = []
                for sel in bet.get("selections", []):
                    source = fixture_map.get(str(sel.get("fixture_id")))
                    if source:
                        sel.update({
                            "match": f"{source.get('home')} vs {source.get('away')}",
                            "league": source.get("league", "Desconocida"),
                            "sport": source.get("sport", "football"),
                            "time": source.get("startTime")
                        })
                        real_selections.append(sel)
                bet["selections"] = real_selections

            valid_bets = candidates
            break
        except Exception as e:
            print(f"[!] Generate failed: {e}")
            time.sleep(2)

    if not valid_bets: 
        print("[ERROR] Failed to generate bets.")
        return

    # 5. Guardado y Formateo
    try:
        formatter = BetFormatter()
        print("[*] Formatting bets...")
        final_output = formatter.process_bets(valid_bets)
    except:
        final_output = valid_bets

    # Calcular cuotas finales
    for bet in final_output:
        odds = [float(s.get("odd", 1.0)) for s in bet.get("selections", [])]
        if odds:
            bet["total_odd"] = round(math.prod(odds), 2)
            bt = bet.get("betType", "safe").lower()
            bet["stake"] = 6 if "safe" in bt else (3 if "value" in bt else 1)
            bet["estimated_units"] = round(bet["stake"] * (bet["total_odd"] - 1), 2)

    rs.save_daily_bets(today_str, final_output)
    print(f"[SUCCESS] Saved {len(final_output)} bets to Redis.")

    # Telegram
    try:
        from src.services.telegram_generator import generate_messages_from_analysis
        generate_messages_from_analysis(today_str)
    except: pass

if __name__ == "__main__":
    analyze()