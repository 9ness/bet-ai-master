
import sys
import os
import json
import re
from datetime import datetime

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from src.services.redis_service import RedisService

def fix_corruption(date_str=None):
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")

    print(f"[*] Starting Corruption Fix for {date_str}...")
    rs = RedisService()
    
    data_raw = rs.get_daily_bets(date_str)
    if not data_raw:
        print("No bets found.")
        return

    if isinstance(data_raw, str):
        bets_data = json.loads(data_raw)
    else:
        bets_data = data_raw

    # Unwrap
    if isinstance(bets_data, dict) and "bets" in bets_data:
        target_list = bets_data["bets"]
    elif isinstance(bets_data, list):
         target_list = bets_data
    else:
         target_list = []

    count = 0
    
    # Specific fix patterns
    # 1. "FenerbHándicap Asiáticoce" -> "Fenerbahce"
    # 2. Any other mid-word substitution of "Hándicap Asiático"
    
    for bet in target_list:
        for sel in bet.get("selections", []):
            pick = sel.get("pick", "")
            
            # Correction 1: Specific known casew
            if "FenerbHándicap Asiáticoce" in pick:
                new_pick = pick.replace("FenerbHándicap Asiáticoce", "Fenerbahce")
                print(f"[FIX] Replaced '{pick}' -> '{new_pick}'")
                sel["pick"] = new_pick
                count += 1
                
            # Correction 2: Generic mid-word "Hándicap Asiático"
            # Regex: Look for Letter + "Hándicap Asiático" + Letter
            # This reverses the "AH" replacement that happened inside a word
            # Original was likely "AH".
            
            # This regex finds "Hándicap Asiático" that is immediately preceded by a word char 
            # OR immediately followed by a word char.
            # We replace "Hándicap Asiático" back to "AH" in those cases? 
            # Or if it was "FenerbAHce", yes we want "Fenerbahce".
            # If it was "MyTeamAH", we want "MyTeamAH".
            # So yes, reverting to "AH" in these specific corruption cases is safer.
            
            # Pattern: (\w)(Hándicap Asiático) or (Hándicap Asiático)(\w)
            # Actually, the corruption replaces "AH" with "Hándicap Asiático".
            # So we check if "Hándicap Asiático" is surrounded by letters.
            
            # Check prefix
            matches = list(re.finditer(r'(\w)(Hándicap Asiático)', sel["pick"]))
            for m in matches:
                # Found a letter before the phrase
                print(f"[DETECTED] Partial corruption match in: {sel['pick']}")
                # We can try to just replace the phrase with "AH" globally in this string if it looks suspicious
                # But safer to just replace specific knowns if possible.
                # Let's do a replace of the exact substring match
                
            # Let's simple naive replace for the known failure mode which involves Fenerbahce usually.
            # Or any other team ending in AH or starting with AH.
            # "Utah" -> "UtHándicap Asiático"
            # "Noah" -> "NoHándicap Asiático"
            
            if "Hándicap Asiático" in sel["pick"]:
                 # If it is like "UtHándicap Asiático", replace with "Utah" (restore AH)
                 # Regex: (?<=\w)Hándicap Asiático
                 p2 = re.sub(r'(?<=\w)Hándicap Asiático', 'AH', sel["pick"])
                 # Regex: Hándicap Asiático(?=\w)
                 p2 = re.sub(r'Hándicap Asiático(?=\w)', 'AH', p2)
                 
                 if p2 != sel["pick"]:
                     print(f"[GENERIC FIX] '{sel['pick']}' -> '{p2}'")
                     sel["pick"] = p2
                     count += 1
                     
            # Also fix "Hándicap" plain if it corrupted "AH"
            # "UtHándicap" -> "Utah"
            # But "Hándicap" is a valid word. "Asian Hándicap".
            # Only fix if inside a word.
            if "Hándicap" in sel["pick"]:
                 p3 = re.sub(r'(?<=\w)Hándicap(?=\w)', 'AH', sel["pick"]) # Middle
                 p3 = re.sub(r'(?<=\w)Hándicap\b', 'AH', p3) # End of word check? No wait. "UtHándicap" -> "UtAH"
                 # Be careful not to replace " Asian Hándicap" -> " Asian AH" (Space before is fine)
                 
                 # Only replace if preceded by a letter
                 p3 = re.sub(r'(?<=[a-zA-Z])Hándicap', 'AH', p3)
                 
                 if p3 != sel["pick"]:
                      # Double check we didn't break "Asian Hándicap" where Asian ends in n.
                      # "Asian Hándicap" -> "AsiaAHándicap"? No.
                      # "Asian" ends in 'n'. So 'n' is a letter.
                      # So "Asian Hándicap" would become "Asian AH". Which is actually fine/better than corruption?
                      # But "Hándicap" is valid Spanish.
                      # Let's stick to the specific "Hándicap Asiático" correction first as that's the massive one.
                      pass

    if count > 0:
        # Save
        if isinstance(bets_data, dict):
             rs.save_daily_bets(date_str, bets_data["bets"])
        else:
             rs.save_daily_bets(date_str, target_list)
        print(f"[SUCCESS] Fixed {count} corrupted picks.")
    else:
        print("[OK] No corruption found.")

if __name__ == "__main__":
    fix_corruption()
