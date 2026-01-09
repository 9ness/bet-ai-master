try:
    import google.generativeai as genai
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False
    print("Google Generative AI not found. Using Mock AI.")

import os
import json
import re
from datetime import datetime
from src.services.redis_service import RedisService

# ... (Environment loading logic stays same) ...

class GeminiService:
    def __init__(self):
        self.redis = RedisService()
        if not self.api_key:
            print("[WARNING] GOOGLE_API_KEY no encontrada.")
        
        if GOOGLE_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            # Using 'gemini-3-pro-preview' as the absolute best model for analysis available in the list
            self.model = genai.GenerativeModel('gemini-3-pro-preview') 
            print("[INIT] Gemini Service initialized with model: gemini-3-pro-preview (Deep Analysis Mode)")
        else:
            self.model = None
            print("[WARNING] Gemini disabled (No API Key or Library).")

    # ... (get_today_date stays same) ...

    def get_recommendations(self, analyzed_data):
        today_str = datetime.now().strftime("%Y-%m-%d")
        print(f"Generando recomendaciones para: {today_str}")
        
        prompt = f"""
        Estás operando en modo Risk Manager & Pro Tipster.
        
        # ... (Objective / Data sections same) ...

        INSTRUCCIONES DE RAZONAMIENTO:
        - REGLA CRÍTICA DE UNICIDAD: NO repitas la misma selección exacta.
        - REGLA FUNBET: Cuota mínima 1.10 por selección.
        - ESTRUCTURA 'SELECTIONS': Para CADA apuesta (Safe, Value, Funbet), DEBES generar un array "selections" que contenga CADA evento individual.
          - Si es una apuesta simple, "selections" tendrá 1 elemento.
          - Si es combinada, "selections" tendrá todos los eventos.
          - Cada selección debe tener: "fixture_id", "match", "pick", "odd".

        INPUT DATA:
        {json.dumps(analyzed_data, indent=2)}

        OUTPUT FORMAT (Strict JSON):
        {{
            "safe": {{
                "match": "Equipo A vs Equipo B",
                "time": "21:00",
                "selections": [
                    {{ "fixture_id": 123456, "match": "A vs B", "pick": "Gana Local", "odd": 1.65 }}
        {{
            "safe": {{
                "match": "Real Madrid vs Barcelona",
                "time": "21:00",
                "selections": [
                    {{ "fixture_id": 123456, "match": "Real Madrid vs Barcelona", "pick": "Gana Local", "odd": 1.65, "status": "PENDING" }}
                ],
                "pick": "Gana Local",
                "odd": 1.65,
                "reason": "...",
                "status": "PENDING"
            }},
            "value": {{
                "match": "Título Combinada o Partido", 
                "time": "18:30",
                "selections": [
                    {{ "fixture_id": 111, "match": "A vs B", "pick": "...", "odd": 1.40, "status": "PENDING" }},
                    {{ "fixture_id": 222, "match": "C vs D", "pick": "...", "odd": 2.00, "status": "PENDING" }}
                ],
                "pick": "Pick Resumen",
                "odd": 2.80,
                "reason": "...",
                "status": "PENDING"
            }},
            "funbet": {{
                "match": "Combinada Loca",
                "time": "16:00", 
                "selections": [
                    {{ "fixture_id": 333, "match": "A vs B", "pick": "...", "odd": 1.20, "status": "PENDING" }},
                    {{ "fixture_id": 444, "match": "C vs D", "pick": "...", "odd": 1.30, "status": "PENDING" }}
                ],
                "pick": "Resumen Picks",
                "odd": 15.40,
                "reason": "...",
                "status": "PENDING"
            }}
        }}
        """

        try:
            # 1. Generate Content
            response = self.model.generate_content(prompt)
            
            # 2. Extract JSON
            text_response = response.text
            # Clean markdown code blocks if present
            text_response = text_response.replace('```json', '').replace('```', '')
            
            start_idx = text_response.find('{')
            end_idx = text_response.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No Valid JSON found in Gemini response")
                
            json_str = text_response[start_idx:end_idx]
            
            # 3. Parse JSON -> This is 'bets_json'
            bets_json = json.loads(json_str) 
            
            # Estructura Final Envolvente
            final_output = {
                "date": today_str,
                "is_real": True,
                "bets": bets_json
            }
            
            print("[LOG] Data generated successfully. Returning to main flow.")
            return final_output
            
        except Exception as e:
            print(f"[ERROR] Failed to generate recommendations: {e}")
            # Raise exception to fail the workflow instead of returning mock data
            # User wants to avoid saving false data.
            return None

if __name__ == "__main__":
    pass
