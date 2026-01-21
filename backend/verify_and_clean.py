import json
import sys
import os
import math

# Add src to path just for RedisService
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from src.services.redis_service import RedisService

# --- INLINE FORMATTER (Guaranteed Clean) ---
class InlineFormatter:
    def __init__(self):
        self.TRANS_MAP = {
            "Home": "Local", "Away": "Visitante", "Win": "Gana", "Draw": "Empate",
            "Over": "Más de", "Under": "Menos de", "Yes": "Sí", "No": "No",
            "Goals": "Goles", "Points": "Puntos", "Handicap": "Hándicap",
            "Match Ganador:": "", "Match Winner:": "",
            "(ML)": "(Prórroga incluída)",
            "Double Chance": "Doble Oportunidad"
        }

    def clean_name(self, pick):
        if not pick: return ""
        p = str(pick).strip()
        
        # 1. Dictionary Replace
        for k, v in self.TRANS_MAP.items():
            if k in p: 
                p = p.replace(k, v)
        
        # 2. Specific Double Chance Fix
        if "Doble Oportunidad" in p and "(" in p:
             p = p.replace(" or ", " o ")
             # Extract inner if needed, but let's stick to simple text clean
             start = p.find("(")
             end = p.rfind(")")
             if start != -1 and end != -1:
                 p = p[start+1:end]

        # 3. Final " or " fix
        p = p.replace(" or ", " o ")
        return p.strip()

    def process(self, bets):
        for b in bets:
            # Sort selections by time
            b["selections"].sort(key=lambda x: x.get("time", "9999"))
            
            for s in b["selections"]:
                s["pick"] = self.clean_name(s.get("pick"))
                
        return bets

# --- DIAGNOSTIC RUN ---
def check_and_run():
    print("--- DIAGNOSTIC START ---")
    rs = RedisService()
    key = "betai:daily_bets:2026-01-21"
    raw = rs.get(key)
    
    if not raw:
        print("[ERROR] No data found in Redis.")
        return

    data = json.loads(raw)
    bets = data.get("bets", [])
    
    # 1. CHECK INPUT STATE
    print(f"[INPUT CHECK] Found {len(bets)} bets.")
    for i, b in enumerate(bets):
        sels = b.get("selections", [])
        print(f"  > Bet {i} Type: {b.get('betType')} | Selections: {len(sels)}")
        for s in sels:
            print(f"    - {s.get('pick')} (Odd: {s.get('odd')})")
            
        if b.get("betType") == "value" and len(sels) > 1:
            print("    [!!!] ALERT: INPUT DATA IS ALREADY SPLIT!")

    # 2. PROCESS
    print("\n[PROCESSING] Running InlineFormatter...")
    fmt = InlineFormatter()
    clean_bets = fmt.process(bets)
    
    # 3. CHECK OUTPUT STATE
    print(f"\n[OUTPUT CHECK] Checking results...")
    is_safe = True
    for i, b in enumerate(clean_bets):
        sels = b.get("selections", [])
        print(f"  > Bet {i} Type: {b.get('betType')} | Selections: {len(sels)}")
        if b.get("betType") == "value" and len(sels) > 1:
             print("    [!!!] CRITICAL: LOGIC SPLIT THE BET!")
             is_safe = False

    # 4. SAVE ONLY IF SAFE
    if is_safe:
        # Wrap back
        data["bets"] = clean_bets
        # Direct SET to avoid Service logic interference
        rs.client.set_data("daily_bets:2026-01-21", data)
        print("\n[SUCCESS] Clean data saved to Redis.")
    else:
        print("\n[ABORT] Did not save because result was split.")

if __name__ == "__main__":
    check_and_run()
