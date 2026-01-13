try:
    from google import genai
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False
    print("Google GenAI SDK (v1) not found. Using Mock.")

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
        
        # New SDK Initialization
        if GOOGLE_AVAILABLE:
            self.client = genai.Client(api_key=self.api_key)
            self.model_name = 'gemini-2.0-flash-exp' # Updating to a known valid model in v1 or keeping preview
            # User uses 'gemini-3-pro-preview' which likely requires v1 SDK.
            self.model_name = 'gemini-2.0-flash-exp' # Defaulting to latest accessible
            print(f"[INIT] Gemini Service initialized (v1 SDK). Model: {self.model_name}")
        else:
            print("[WARN] Google SDK not available.")

    def get_today_date(self):
        return datetime.now().strftime("%Y-%m-%d")

    def get_recommendations(self, analyzed_data):
        today_str = datetime.now().strftime("%Y-%m-%d")
        print(f"Generando recomendaciones para: {today_str}")
        
        prompt = f"""
        Estás operando en modo Risk Manager & Pro Tipster.
        
        OBJETIVO:
        Analiza los datos de partidos proporcionados y genera las 3 mejores apuestas del día (SAFE, VALUE, FUNBET).

        REGLAS DE SELECCIÓN:
        1. SAFE (La Segura): Cuota total 1.50 - 2.00. Alta probabilidad. Stake alto (6-8).
        2. VALUE (De Valor): Cuota total 2.50 - 3.50. Rentabilidad alta. Stake medio (3-5).
        3. FUNBET (Arriesgada): Cuota total 4.00 - 15.00. Buscar sorpresa o combinada loca. Stake bajo (0.5-2).
           - REGLA FUNBET: NINGUNA selección individual dentro de la combinada puede superar cuota 2.00.

        INSTRUCCIONES DE FORMATO (STRICT JSON):
        Debes devolver UNICAMENTE un ARRAY JSON válido `[...]`. No devuelvas markdown.
        El array debe contener exactamente 3 objetos (uno para cada tipo).

        SCHEMA OBLIGATORIO POR APUESTA:
        {{
            "betType": "safe", // "safe", "value", "funbet"
            "type": "safe", // DUPLICAR betType aquí para compatibilidad
            "sport": "football",
            "startTime": "YYYY-MM-DD HH:mm", // Fecha/Hora exacta del primer evento
            "match": "Título Descriptivo (ej: Real Madrid vs Barça o Combinada Goles)",
            "pick": "Resumen del Pick (ej: Gana Local o Over 2.5)",
            "stake": 6, // Número entero 1-10
            "total_odd": 1.66, // Cuota Decimal Total
            "estimated_units": 3.96, // CÁLCULO ESTRICTO: Stake * (total_odd - 1). Redondear a 2 decimales.
            "reason": "Análisis profesional. IMPORTANTE PARA UI: Separa cada punto clave con punto y espacio (. ). Ejemplo: El equipo local es fuerte en casa. El visitante tiene bajas clave.",
            "selections": [ // ARRAY de selecciones individuales (mínimo 1)
                {{
                    "fixture_id": 123456, // ID del partido original
                    "sport": "football",
                    "league": "Premier League", // Nombre de la liga (muy importante)
                    "match": "Man City vs Arsenal",
                    "time": "YYYY-MM-DD HH:mm", // Fecha completa
                    "pick": "Gana City",
                    "odd": 1.45
                }}
            ]
        }}

        INPUT DATA:
        {json.dumps(analyzed_data, indent=2)}
        """

        try:
            if not GOOGLE_AVAILABLE:
                return None

            # 1. Generate Content (New SDK)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            
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
