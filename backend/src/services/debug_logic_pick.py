import re
import sys

def test_logic(pick_text, home_score, away_score, total_corners=None):
    print(f"--- Testing Pick: '{pick_text}' ---")
    pick = pick_text.lower()
    print(f"Lowered: '{pick}'")
    
    result_str = f"{home_score}-{away_score}"
    is_win = False
    matched = False
    
    # Logic from check_api_results.py
    
    # 1. WINNER (1X2)
    if "gana" in pick or "win" in pick:
        print("Matched: WINNER")
        matched = True
        if "local" in pick or "home" in pick or "1" in pick.split():
            is_win = home_score > away_score
        elif "visitante" in pick or "away" in pick or "2" in pick.split():
            is_win = away_score > home_score

    # 1.5 DOUBLE CHANCE
    elif "doble oportunidad" in pick or "double chance" in pick or "1x" in pick or "x2" in pick or "12" in pick.split():
        print("Matched: DOUBLE CHANCE")
        matched = True
        clean = pick.replace("doble oportunidad", "").replace("double chance", "").replace("(", "").replace(")", "").strip().upper()
        if "1X" in clean or "1X" in pick.upper():
            is_win = home_score >= away_score
        elif "X2" in clean or "X2" in pick.upper():
            is_win = away_score >= home_score
        elif "12" in clean or "12" in pick.split():
            is_win = home_score != away_score
            
    # 2. GOALS / POINTS (OVER/UNDER)
    elif "más de" in pick or "over" in pick:
        print("Matched: OVER")
        matched = True
        clean_pick = pick.replace("más de", "").replace("over", "").replace("goles", "").replace("goals", "").replace("puntos", "").replace("points", "").replace("pts", "").strip()
        print(f"Cleaned: '{clean_pick}'")
        match = re.search(r'\d+(\.\d+)?', clean_pick)
        if match:
                val = float(match.group())
                print(f"Extracted Value: {val}")
        else:
                val = float(clean_pick.split()[0].replace(",", "."))
                print(f"Fallback Value: {val}")
        
        total = home_score + away_score
        is_win = total > val
        result_str += f" | {total}"
        
    elif "menos de" in pick or "under" in pick:
        print("Matched: UNDER")
        matched = True
        clean_pick = pick.replace("menos de", "").replace("under", "").replace("goles", "").replace("goals", "").replace("puntos", "").replace("points", "").replace("pts", "").strip()
        print(f"Cleaned: '{clean_pick}'")
        match = re.search(r'\d+(\.\d+)?', clean_pick)
        if match:
                val = float(match.group())
                print(f"Extracted Value: {val}")
        else:
                val = float(clean_pick.split()[0].replace(",", "."))
                print(f"Fallback Value: {val}")
                
        total = home_score + away_score
        is_win = total < val
        result_str += f" | {total}"
    
    # 3. BOTH TO SCORE
    elif "ambos marcan" in pick or "btts" in pick:
        print("Matched: BTTS")
        matched = True
        if "sí" in pick or "yes" in pick:
            is_win = home_score > 0 and away_score > 0
        else:
            is_win = home_score == 0 or away_score == 0

    # 4. HANDICAP
    elif "hándicap" in pick or "ah" in pick:
        print("Matched: HANDICAP")
        matched = True
        # ... (Handicap logic simplified for this test)

    # 5. CORNERS
    elif "córner" in pick or "corner" in pick:
        print("Matched: CORNERS")
        matched = True
        # ... (Corner logic)
        
    else:
        print("!!! NO MATCH FOUND !!!")

    print(f"Is Win: {is_win}")
    print("-" * 30)

if __name__ == "__main__":
    # Test cases from user
    test_logic("Más de 1.5 Goles", 2, 1) # Should accept, Total 3 > 1.5 -> WIN
    test_logic("Total Puntos Más de 161.5", 80, 90) # Should accept, Total 170 > 161.5 -> WIN
    
    # Control
    test_logic("Gana Local", 2, 1)
