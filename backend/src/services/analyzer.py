import json
import os

class Analyzer:
    def __init__(self):
        # CORR: Leer matches_tomorrow.json
        self.input_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'matches_today.json')
        
    def analyze(self):
        print("Preparing match data for AI...")
        if not os.path.exists(self.input_file):
            print(f"No data found at {self.input_file}. Run scraper (fetch_odds) first.")
            return []

        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                matches = json.load(f)
            
            print(f"Loaded {len(matches)} matches for analysis.")
            return matches # Pass all matches to Gemini
        except Exception as e:
            print(f"Error reading match data: {e}")
            return []

if __name__ == "__main__":
    a = Analyzer()
    res = a.analyze()
    print(json.dumps(res, indent=2))
