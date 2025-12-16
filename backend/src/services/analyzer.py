import json
import os

class Analyzer:
    def __init__(self):
        self.input_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'matches_raw.json')
        
    def analyze(self):
        print("Analyzing matches...")
        if not os.path.exists(self.input_file):
            print("No data found. Run scraper first.")
            return {}

        with open(self.input_file, 'r', encoding='utf-8') as f:
            matches = json.load(f)

        recommendations = {
            "SAFE": [],
            "VALUE": [],
            "FUNBET": []
        }

        for m in matches:
            odds = m.get('odds', {})
            o1 = float(odds.get('1', 0))
            oX = float(odds.get('X', 0))
            o2 = float(odds.get('2', 0))
            
            home = m['home']
            away = m['away']
            match_str = f"{home} vs {away}"

            # LOGIC: SAFE (1.30 - 1.60)
            # Check Home Win or Away Win in range
            if 1.30 <= o1 <= 1.60:
                recommendations["SAFE"].append({
                    "match": match_str,
                    "pick": f"Victoria {home}",
                    "odd": o1,
                    "reason": "Cuota estable para favorito en casa."
                })
            elif 1.30 <= o2 <= 1.60:
                recommendations["SAFE"].append({
                    "match": match_str,
                    "pick": f"Victoria {away}",
                    "odd": o2,
                    "reason": "Cuota estable para favorito visitante."
                })

            # LOGIC: VALUE (1.70 - 2.20, Home Favorite ideally)
            if 1.70 <= o1 <= 2.20:
                recommendations["VALUE"].append({
                    "match": match_str,
                    "pick": f"Victoria {home}",
                    "odd": o1,
                    "reason": "Buen valor para el local."
                })

            # LOGIC: FUNBET (High odds or combinable)
            # For now, simpler logic: Simple Draw or High Odd Underdog
            if oX > 3.20:
                recommendations["FUNBET"].append({
                    "match": match_str,
                    "pick": "Empate",
                    "odd": oX,
                    "reason": "Empate muy pagado, posible sorpresa."
                })
            elif o1 > 4.00 or o2 > 4.00:
                 # Check output format
                 pick = f"Victoria {home}" if o1 > 4.00 else f"Victoria {away}"
                 odd = o1 if o1 > 4.00 else o2
                 recommendations["FUNBET"].append({
                    "match": match_str,
                    "pick": pick,
                    "odd": odd,
                    "reason": "Sorpresa de alta rentabilidad."
                })

        # Sort by best fit logic (simplistic for now)
        # We want only the BEST one for each category if we strictly follow the '3 cards' rule, 
        # but the analyzer should probably return a few options for Gemini to pick.
        
        return recommendations

if __name__ == "__main__":
    a = Analyzer()
    res = a.analyze()
    print(json.dumps(res, indent=2))
