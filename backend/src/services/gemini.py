import google.generativeai as genai
GOOGLE_AVAILABLE = True

import os
import json
import re
from datetime import datetime
from src.services.redis_service import RedisService

# Load Env (Shared Logic)
try:
    from dotenv import load_dotenv
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    dotenv_path = os.path.join(base_path, '.env.local')
    if not os.path.exists(dotenv_path): dotenv_path = os.path.join(base_path, 'frontend', '.env.local')
    if not os.path.exists(dotenv_path): dotenv_path = os.path.join(os.path.dirname(base_path), '.env.local')
    if os.path.exists(dotenv_path): load_dotenv(dotenv_path)
except ImportError: pass

class GeminiService:
    def __init__(self):
        self.redis = RedisService()
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        if not self.api_key:
            raise ValueError("FALTA CONFIGURAR API KEY EN GITHUB SECRETS")
        
        # SDK Initialization
        if GOOGLE_AVAILABLE:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-3-pro-preview')
            print(f"[INIT] Gemini Service initialized. Model: gemini-3-pro-preview")
        else:
            print("[WARN] Google SDK not available.")

    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def get_recommendations(self, analyzed_data):
        today_str = datetime.now().strftime("%Y-%m-%d")
        print(f"Generando recomendaciones para: {today_str}")
        
        prompt = f"""
            Estás operando en modo Risk Manager & Pro Tipster Multi-Sport (Football & Basketball/NBA).
            Tu objetivo es analizar los datos proporcionados y generar las 3 mejores apuestas del día (SAFE, VALUE, FUNBET).

            IMPORTANTE: Tienes datos de Fútbol y de Baloncesto (NBA/Europa). Evalúa AMBOS deportes por igual. No ignores los partidos de madrugada si presentan mejores oportunidades que el fútbol.

            INSTRUCCIONES DE ANÁLISIS:
            1. FÚTBOL: Usa ID 45 (Corners) y ID 87 (ShotsOnGoal). Prioriza Over de Goles/Corners si los remates son altos.
            2. BALONCESTO: Usa ID 15 (HT/FT) y ID 5 (Puntos 1ª Mitad). Verifica el Injury Report mediante búsqueda.

            REGLAS DE SELECCIÓN Y STAKE:
            1. SAFE (La Segura): Cuota total 1.50 - 2.00. Probabilidad > 75%. STAKE FIJO: 6.
            2. VALUE (De Valor): Cuota total 2.50 - 3.50. STAKE FIJO: 3.
            3. FUNBET (Arriesgada): Cuota total 10.00 - 20.00. STAKE FIJO: 1. 
            - REGLA FUNBET: Puedes combinar mercados. Para llegar a cuota 10+, usa selecciones con cuota individual entre 1.10 y 1.50.

            REGLAS DE FORMATO (STRICT JSON):
            - Devuelve UNICAMENTE un ARRAY JSON `[...]`.
            - El campo "reason" debe ser técnico (ej: "Basado en ID 87...").
            - MUY IMPORTANTE: Aunque tú propongas la "total_odd", el sistema la recalculará matemáticamente por código basándose en tus "selections".

            SCHEMA OBLIGATORIO:
            {{
                "betType": "safe", // "safe", "value", "funbet"
                "type": "safe",
                "sport": "football", // o "basketball"
                "startTime": "YYYY-MM-DD HH:mm",
                "match": "Título Descriptivo",
                "pick": "Resumen del Pick",
                "stake": 6, // 6 para safe, 3 para value, 1 para funbet
                "total_odd": 0.0, // Deja en 0.0, el código lo calculará
                "estimated_units": 0.0, // Deja en 0.0, el código lo calculará
                "reason": "Análisis detallado incluyendo datos de remates o bajas NBA.",
                "selections": [
                    {{
                        "fixture_id": 123456,
                        "sport": "football",
                        "league": "Nombre Liga",
                        "match": "Equipo A vs Equipo B",
                        "time": "YYYY-MM-DD HH:mm",
                        "pick": "Mercado específico",
                        "odd": 1.55
                    }}
                ]
            }}

            INPUT DATA:
            {json.dumps(analyzed_data, indent=2)}
            """

        try:
            if not GOOGLE_AVAILABLE:
                return None

            # 1. Generate Content (Standard SDK)
            response = self.model.generate_content(prompt)
            
            # 2. Extract JSON
            # New SDK response structure: response.text should work
            text_response = response.text
            # Clean markdown code blocks if present
            text_response = text_response.replace('```json', '').replace('```', '')
            
            start_idx = text_response.find('[')
            end_idx = text_response.rfind(']') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No Valid JSON LIST found in Gemini response")
                
            json_str = text_response[start_idx:end_idx]
            
            # 3. Parse JSON -> This is the list of bets
            bets_list = json.loads(json_str) 
            
            # --- BACKEND RECALCULATION (Strict Enforcing) ---
            for bet in bets_list:
                # 1. Enforce Fixed Stake
                b_type = bet.get("betType", "safe").lower()
                if "safe" in b_type: fixed_stake = 6
                elif "value" in b_type: fixed_stake = 3
                elif "funbet" in b_type: fixed_stake = 1
                else: fixed_stake = 6 # Default fallback
                
                bet["stake"] = fixed_stake
                
                # 2. Recalculate Total Odd (Mathematical Truth)
                selections = bet.get("selections", [])
                calc_odd = 1.0
                for sel in selections:
                    try:
                        odd_val = float(sel.get("odd", 1.0))
                        calc_odd *= odd_val
                    except: pass
                
                calc_odd = round(calc_odd, 2)
                bet["total_odd"] = calc_odd
                
                # 3. Calculate Units
                # Formula: Stake * (Odd - 1)
                est_units = fixed_stake * (calc_odd - 1)
                bet["estimated_units"] = round(est_units, 2)
            # ------------------------------------------------ 
            
            # Estructura Final Envolvente
            final_output = {
                "date": today_str,
                "is_real": True,
                "bets": bets_list
            }
            
            print("[LOG] Data generated successfully. Returning to main flow.")
            return final_output
            
        except Exception as e:
            print(f"[ERROR] Failed to generate recommendations: {e}")
            return None

if __name__ == "__main__":
    pass
