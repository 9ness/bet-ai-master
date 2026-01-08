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
        self.api_key = os.getenv("GOOGLE_API_KEY")
        # ... (Rest of init) ...

    # ... (get_today_date stays same) ...

    def get_recommendations(self, analyzed_data):
        # ... (Start of method) ...
        
        prompt = f"""
        Estás operando en modo Risk Manager & Pro Tipster.
        
        # ... (Objective / Data sections same) ...

        INSTRUCCIONES DE RAZONAMIENTO:
        - REGLA CRÍTICA DE UNICIDAD: NO repitas la misma selección exacta (Market + Pick) en más de una categoría (Safe, Value, Funbet). Si "Victoria Arsenal" está en Safe, NO puede aparecer en Value ni en Funbet. Busca mercados alternativos si te gusta el equipo (e.g., Over goles, Corners) para diversificar el riesgo de un solo fallo.
        - REGLA FUNBET: Cada selección individual incluida en la Funbet debe tener una cuota mínima de 1.10.
        - En el campo 'reason', justifica por qué la selección cumple con los criterios.
        - EXTRAE LA HORA del partido ("time") y inclúyela en el JSON.
        - EXTRAE EL ID DEL PARTIDO ("fixture_id") de los datos de entrada para cada selección. ES CRÍTICO.

        INPUT DATA:
        {json.dumps(analyzed_data, indent=2)}

        OUTPUT FORMAT (Strict JSON):
        {{
            "safe": {{
                "match": "Equipo A vs Equipo B",
                "time": "21:00",
                "fixture_id": 123456,
                "pick": "Gana Local",
                "odd": 1.65,
                "reason": "..."
            }},
            "value": {{
                "match": "...", 
                "time": "18:30",
                "fixture_id": 789012,
                "pick": "...",
                "odd": 2.80,
                "reason": "...",
                "components": [
                    {{ "match": "A vs B", "fixture_id": 111, "pick": "...", "odd": 1.40 }},
                    {{ "match": "C vs D", "fixture_id": 222, "pick": "...", "odd": 2.00 }}
                ]
            }},
            "funbet": {{
                "match": "Combinada...",
                "time": "16:00", 
                "pick": "...",
                "components": [
                    {{ "match": "A vs B", "time": "16:00", "fixture_id": 333, "pick": "...", "odd": 1.20 }},
                    {{ "match": "C vs D", "time": "18:00", "fixture_id": 444, "pick": "...", "odd": 1.30 }}
                ],
                "odd": 15.40,
                "reason": "..."
            }}
        }}
        """

        try:
            # ... (Generation and parsing logic same) ...
            
            # Estructura Final Envolvente
            final_output = {
                "date": today_str,
                "is_real": True,
                "bets": bets_json
            }
            
            self._save(final_output)
            # Redis Save
            self.redis.save_daily_bets(today_str, bets_json)
            
            return final_output
            
        except Exception as e:
            # ... (Error handling) ...
            return self._mock_response(today_str)

    def _save(self, data):
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"[OK] Archivo guardado en: {self.output_file}")
            
    def _mock_response(self, date_str):
        print("Generando datos MOCK de respaldo.")
        mock_data = {
            "date": date_str,
            "is_real": False,
            "bets": {
                "safe": {
                    "match": "Manchester City vs Burnley (MOCK)",
                    "pick": "Victoria Man City",
                    "odd": 1.15,
                    "reason": "1. City invicto en casa. 2. Burnley sin victorias fuera."
                },
                "value": {
                    "match": "Sevilla vs Betis (MOCK)", 
                    "pick": "Empate",
                    "odd": 3.10,
                    "reason": "1. Derby muy disputado. 2. Ambos equipos en racha similar."
                },
                "funbet": {
                    "match": "Combinada Demo (MOCK)",
                    "pick": "Gana City + Gana Sevilla + Over 2.5",
                    "components": [
                         {"match": "City vs Burnley", "pick": "Gana City"},
                         {"match": "Sevilla vs Betis", "pick": "Empate"},
                         {"match": "Barca vs Getafe", "pick": "Over 2.5"}
                    ],
                    "odd": 14.50,
                    "reason": "1. Favoritos claros. 2. Alta probabilidad de goles en Barca."
                }
            }
        }
        self._save(mock_data)
        return mock_data

if __name__ == "__main__":
    pass
