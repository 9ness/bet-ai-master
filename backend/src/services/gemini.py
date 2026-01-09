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
            # ... (Generation and parsing logic same) ...
            
            # Estructura Final Envolvente
            final_output = {
                "date": today_str,
                "is_real": True,
                "bets": bets_json
            }
            
            self._save(final_output)
            # La subida a Redis se manejará principalmente en main.py mediante set_data("daily_bets", ...)
            # Pero mantenemos la compatibilidad si este método espera guardar historial
            # self.redis.save_daily_bets(today_str, bets_json) # Comentado si queremos centralizar en main.py o lo dejamos como log. 
            # El usuario pide guardar en redis en main.py. 
            # Dejaré el return limpio.

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
                    "reason": "1. City invicto en casa. 2. Burnley sin victorias fuera.",
                    "status": "PENDING",
                    "selections": [{ "match": "Manchester City vs Burnley", "pick": "Victoria Man City", "odd": 1.15, "fixture_id": 999001, "status": "PENDING" }]
                },
                "value": {
                    "match": "Sevilla vs Betis (MOCK)", 
                    "pick": "Empate",
                    "odd": 3.10,
                    "reason": "1. Derby muy disputado. 2. Ambos equipos en racha similar.",
                    "status": "PENDING",
                    "selections": [{ "match": "Sevilla vs Betis", "pick": "Empate", "odd": 3.10, "fixture_id": 999002, "status": "PENDING" }]
                },
                "funbet": {
                    "match": "Combinada Demo (MOCK)",
                    "pick": "Gana City + Gana Sevilla + Over 2.5",
                    "selections": [
                         {"match": "City vs Burnley", "pick": "Gana City", "odd": 1.15, "fixture_id": 999001, "status": "PENDING"},
                         {"match": "Sevilla vs Betis", "pick": "Empate", "odd": 3.10, "fixture_id": 999002, "status": "PENDING"},
                         {"match": "Barca vs Getafe", "pick": "Over 2.5", "odd": 1.90, "fixture_id": 999003, "status": "PENDING"}
                    ],
                    "odd": 14.50,
                    "reason": "1. Favoritos claros. 2. Alta probabilidad de goles en Barca.",
                    "status": "PENDING"
                }
            }
        }
        self._save(mock_data)
        return mock_data

if __name__ == "__main__":
    pass
