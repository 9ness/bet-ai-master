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
            self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
            print(f"[INIT] Gemini Service initialized. Model: gemini-2.0-flash-exp")
        else:
            print("[WARN] Google SDK not available.")

    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def get_recommendations(self, analyzed_data):
        today_str = datetime.now().strftime("%Y-%m-%d")
        print(f"Generando recomendaciones para: {today_str}")
        
        prompt = f"""
        Estás operando en modo Risk Manager & Pro Tipster Multi-Sport (Football & Basketball/NBA).
        Tu objetivo es analizar los datos y generar las 3 mejores apuestas del día (SAFE, VALUE, FUNBET).

        INSTRUCCIONES DE ANÁLISIS POR DEPORTE:

        1. FÚTBOL (Lógica de Ataque):
        - Usa el ID 45 (Corners) y el ID 87 (Total ShotOnGoal).
        - REGLA: Si un equipo tiene promedios altos de remates (ID 87), prioriza picks de Goles o Corners.
        - Usa el ID 7 (HT/FT) para buscar valor en favoritos que dominan desde el inicio.

        2. BALONCESTO/NBA (Lógica de Estrellas y Ritmo):
        - Usa el ID 15 (HT/FT) y el ID 5 (O/U 1st Half).
        - OBLIGATORIO: Antes de decidir, usa tu capacidad de búsqueda para verificar el "Injury Report" del día. 
        - Si una estrella (ej: Curry, LeBron, Doncic) es baja, penaliza el Hándicap (ID 3) de ese equipo.
        - Si el ID 5 (Puntos 1ª mitad) es alto, busca picks de "Over" total.

        REGLAS DE SELECCIÓN:
        1. SAFE: Cuota 1.50 - 2.00. Probabilidad > 75%. Stake 6-8.
        2. VALUE: Cuota 2.5 - 3.50. Basada en anomalías estadísticas (ej: cuota alta de corners en partido de muchos remates). Si no ves ninguna cuota
        alta clara, haz una combinada de diferentes mercados con alta probabilidad para llegar a la cuota indicada. Stake 3-5.
        3. FUNBET: Cuota 10.00 - 15.00. Combinada de varios mercados (puedes repetir diferentes mercados del mismo evento). Ninguna cuota individual > 1.50. Stake 0.5-2.

        REGLAS DE FORMATO (STRICT JSON):
        - Devuelve ÚNICAMENTE un ARRAY JSON `[...]`.
        - El campo "estimated_units" DEBE ser exacto: Stake * (total_odd - 1).
        - El campo "reason" debe ser una explicación técnica que mencione los datos (ej: "Basado en los 12 remates a puerta promediados (ID 87)...").

        SCHEMA OBLIGATORIO:
        {{
            "betType": "safe",
            "type": "safe",
            "sport": "football", // o "basketball"
            "startTime": "YYYY-MM-DD HH:mm",
            "match": "Título Descriptivo",
            "pick": "Resumen del Pick",
            "stake": 6,
            "total_odd": 1.66,
            "estimated_units": 3.96,
            "reason": "Análisis detallado. Menciona bajas si las encuentras en internet.",
            "selections": [
                {{
                    "fixture_id": 123456,
                    "sport": "football",
                    "league": "Nombre Liga",
                    "match": "Equipo A vs Equipo B",
                    "time": "YYYY-MM-DD HH:mm",
                    "pick": "Mercado específico (ej: Over 9.5 Corners)",
                    "odd": 1.45
                }}
            ]
        }}

        INPUT DATA (Incluye IDs de Corners, Tiros y HT/FT):
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
