import json
import re
import os
import sys
from datetime import datetime

# Add src to path if running directly
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from src.services.redis_service import RedisService

class BetFormatter:
    def __init__(self):
        self.PICK_TRANSLATIONS = {
            "Player Total Shots": "Remates Totales:",
            "Player Shots on Goal": "Tiros a Puerta:",
            "Player Assist": "Asistencia:",  "Player Goals": "Goles:",
            "Home": "Local", "Away": "Visitante", "Win": "Gana", "Draw": "Empate",
            "Over": "Más de", "Under": "Menos de", "Yes": "Sí", "No": "No",
            "Goals": "Goles", "Points": "Puntos", "Handicap": "Hándicap",
            "Shots on Goal": "Tiros a Puerta:", 
            "Gananer": "Ganador", "Winner": "Ganador",
            "Asian Hándicap": "Hándicap Asiático", "AH": "Hándicap Asiático",
            "Double Chance": "Doble Oportunidad",
            "(ML)": "(Prórroga incluída)",
            "BTTS": "Ambos marcan:", "Corners": "Córners",
            "to win": "gana", "To Win": "Gana"
        }
        
    def clean_team_name(self, name):
        if not name: return "Desconocido"
        name = str(name).replace("(Home)", "").replace("(Away)", "").replace("(Local)", "").replace("(Visitante)", "")
        if name.endswith(" Home"): name = name[:-5]
        if name.endswith(" Away"): name = name[:-5]
        return name.strip()

    def translate_pick(self, pick_text, home_team=None, away_team=None):
        if not pick_text: return pick_text
        p = str(pick_text).strip()
        
        # Specific Cleanups requested by user
        p = p.replace("Match Ganador:", "").replace("Match Winner:", "").replace("Ganador del Partido:", "").strip()
        
        # 1X2 Logic
        if p == "1" and home_team: return f"Gana {home_team}"
        if p == "2" and away_team: return f"Gana {away_team}"
        if p == "X": return "Empate"
        
        # Specific Cleanups for Double Chance
        # "Doble Oportunidad: X2 (Empate or Team)" -> "Empate o Team"
        if "Doble Oportunidad" in p and "(" in p and ")" in p:
            # Extract content inside parens
            start = p.find("(")
            end = p.rfind(")")
            if start != -1 and end != -1:
                content = p[start+1:end]
                # Clean 'or' to 'o'
                content = content.replace(" or ", " o ")
                # If content is just "Local/Empate" style, keep it. 
                return content
        
        # Dictionary Translation
        for eng, esp in self.PICK_TRANSLATIONS.items():
            # Always use word boundaries to avoid corruption (e.g. "Hannover" -> "HannMás de")
            # Escape the key safely
            pattern_str = r'\b' + re.escape(eng) + r'\b'
            
            # Use appropriate case sensitivity based on whether the key was capitalized in the manual check
            # Though realistically, IGNORECASE is usually safer for all these betting terms as long as we have boundaries.
            # Let's stick to the previous logic's intent but robust:
            
            if eng in p:
                 p = re.sub(pattern_str, esp, p)
            elif eng.lower() in p.lower():
                 p = re.sub(pattern_str, esp, p, flags=re.IGNORECASE)
                
        # Final cleanup for " or " -> " o " in general if skipped
        p = p.replace(" or ", " o ")
                
        return p

    def process_bets(self, bets_list):
        """
        Main entry point to format a list of bets.
        """
        if not bets_list: return []
        
        processed_bets = []
        for bet in bets_list:
            new_selections = []
            
            # 1. Process Selections
            raw_selections = bet.get("selections", [])
            for sel in raw_selections:
                # Basic Translation & Cleaning
                home = ""
                away = ""
                if "vs" in sel.get("match", ""):
                    parts = sel["match"].split("vs")
                    home = parts[0].strip()
                    away = parts[1].strip()
                
                sel["pick"] = self.translate_pick(sel.get("pick", ""), home, away)
                new_selections.append(sel)
            
            # 2. Sort Selections by Time
            # Assumes format "YYYY-MM-DD HH:mm"
            new_selections.sort(key=lambda x: x.get("time", "9999"))

            # Update selections in bet
            bet["selections"] = new_selections
            
            # Recalculate Total Odd 
            odds = [float(s.get("odd", 1.0)) for s in new_selections]
            import math
            bet["total_odd"] = round(math.prod(odds), 2)
            # Compatibility with RedisService which expects 'odd'
            bet["odd"] = bet["total_odd"]
            
            processed_bets.append(bet)
            
        # 3. Sort Final Bets List
        # Priority: Safe > Value > Funbet > Others, then by Time
        TYPE_PRIORITY = {
            "safe": 1,
            "value": 2,
            "funbet": 3
        }
        
        def get_bet_sort_key(b):
            # 1. Type Priority
            b_type = str(b.get("betType", "other")).lower()
            type_rank = TYPE_PRIORITY.get(b_type, 99)
            
            # 2. Time
            # Use 'time' field if exists at top level (unlikely for new structure but safe)
            if "time" in b and b["time"]: 
                time_val = b["time"]
            else:
                # Otherwise use first selection time (already sorted)
                sels = b.get("selections", [])
                if sels and "time" in sels[0]: 
                    time_val = sels[0]["time"]
                else:
                    time_val = "9999"
            
            return (type_rank, time_val)

        processed_bets.sort(key=get_bet_sort_key)
            
        return processed_bets

def manual_run(date_str=None):
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
        
    print(f"[*] Starting Manual Bet Formatting for {date_str}...")
    rs = RedisService()
    if not rs.is_active:
        print("[!] Redis not active.")
        return

    # 1. Get Bets
    # Use new method that supports Hash
    data_raw = rs.get_daily_bets(date_str) 
    
    if not data_raw:
        print(f"[!] No bets found for {date_str} (Checked Hash & Legacy)")
        return

    # get_daily_bets returns dict or list directly, no need to json.loads unless string
    if isinstance(data_raw, str):
        bets_data = json.loads(data_raw)
    else:
        bets_data = data_raw

    # Handle both full object structure or direct list
    if isinstance(bets_data, dict) and "bets" in bets_data:
        target_list = bets_data["bets"]
        wrapper = True
    elif isinstance(bets_data, list):
         target_list = bets_data
         wrapper = False
    else:
         # Maybe it is a dict but represents a single bet? Unlikely. 
         # Or it's the wrapper but empty?
         target_list = []
         wrapper = True

    # 2. Process
    formatter = BetFormatter()
    formatted_list = formatter.process_bets(target_list)
    
    # 3. Save Back
    if wrapper:
        bets_data["bets"] = formatted_list
        # Logic to preserve other fields if needed, but here we just update bets
        rs.save_daily_bets(date_str, formatted_list)
    else:
        rs.save_daily_bets(date_str, formatted_list)
        
    print(f"[SUCCESS] Bets formatted and saved for {date_str}")

if __name__ == "__main__":
    # Allow date arg
    target_date = sys.argv[1] if len(sys.argv) > 1 else None
    manual_run(target_date)
