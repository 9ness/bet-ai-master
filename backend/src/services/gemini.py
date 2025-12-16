try:
    import google.generativeai as genai
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False
    print("Google Generative AI not found. Using Mock AI.")

import os
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if GOOGLE_AVAILABLE and self.api_key:
            genai.configure(api_key=self.api_key)
            self.generation_config = {
                "temperature": 0.0,
                "top_p": 1,
                "top_k": 1,
                "max_output_tokens": 2048,
            }
            self.model = genai.GenerativeModel(model_name="gemini-pro", generation_config=self.generation_config)
            self.mock_mode = False
        else:
            print("Gemini disabled (No Key or No Module).")
            self.mock_mode = True
            
        self.output_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'recommendations_final.json')

    def get_recommendations(self, analyzed_data):
        print("Consulting Gemini AI...")
        
        if self.mock_mode:
            return self._mock_response(analyzed_data)

        prompt = f"""
        Act as an Expert Sports Betting Analyst.
        I will provide you with a list of matches classified into 3 categories: SAFE (Segura), VALUE (Valor), and FUNBET (Arriesgada/Diversión).

        Your task is to SELECT THE SINGLE BEST OPTION for each category from the provided list.
        If a category is empty, state "No hay recomendación clara hoy".

        INPUT DATA:
        {json.dumps(analyzed_data, indent=2)}

        OUTPUT FORMAT (Strict JSON):
        {{
            "safe": {{
                "match": "Real Madrid vs Almeria",
                "pick": "Victoria Real Madrid",
                "odd": 1.45,
                "reason": "El Madrid en casa es muy sólido..." (Keep it short, max 1 sentence)
            }},
            "value": {{
                "match": "Sevilla vs Betis", 
                "pick": "Victoria Sevilla",
                "odd": 2.10,
                "reason": "El Sevilla necesita ganar y juega con su público."
            }},
            "funbet": {{
                "match": "Girona vs Barcelona",
                "pick": "Empate",
                "odd": 3.80,
                "reason": "Derbi catalán muy igualado."
            }}
        }}
        
        Do not add markdown formatting (```json). Just return the raw JSON string.
        """

        try:
            response = self.model.generate_content(prompt)
            text_response = response.text.strip()
            # Clean up potential markdown formatting if Gemini adds it despite instructions
            if text_response.startswith("```json"):
                text_response = text_response[7:]
            if text_response.endswith("```"):
                text_response = text_response[:-3]
            
            final_json = json.loads(text_response)
            self._save(final_json)
            return final_json
            
        except Exception as e:
            print(f"Error in Gemini interaction: {e}")
            return self._mock_response(analyzed_data)

    def _save(self, data):
        with open(self.output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Recommendations saved to {self.output_file}")
            
    def _mock_response(self, data):
        print("Returning MOCK recommendations.")
        # Try to pick from data or just generic
        # Fallback to hardcoded examples if data is empty or malformed
        mock_res = {
            "safe": {
                "match": "Man City vs Burnley",
                "pick": "Victoria Man City",
                "odd": 1.15,
                "reason": "Dominio total local."
            },
            "value": {
                "match": "Real Sociedad vs Athletic", 
                "pick": "Empate",
                "odd": 3.10,
                "reason": "Derbi muy ajustado."
            },
            "funbet": {
                "match": "Luton vs Arsenal",
                "pick": "Luton gana",
                "odd": 11.0,
                "reason": "Milagro en casa."
            }
        }
        
        # Try to use real data
        if data:
            if "SAFE" in data and len(data["SAFE"]) > 0:
                mock_res["safe"] = data["SAFE"][0]
            if "VALUE" in data and len(data["VALUE"]) > 0:
                mock_res["value"] = data["VALUE"][0]
            if "FUNBET" in data and len(data["FUNBET"]) > 0:
                mock_res["funbet"] = data["FUNBET"][0]
                
        self._save(mock_res)
        return mock_res

if __name__ == "__main__":
    # Test with dummy data
    pass
