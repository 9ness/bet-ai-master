import sys
import os
import json

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

# Import the class directly
from src.services.bet_formatter import BetFormatter

def test_logic():
    print("--- DEBUGGING BET FORMATTER LOGIC ---")
    
    # 1. The confusing input (Value Bet) form User
    input_bet = {
      "betType": "value",
      "sport": "football",
      "match": "AZ Alkmaar vs Excelsior",
      "pick": "AZ Gana y Más de 3.5 Goles",
      "selections": [
        {
          "fixture_id": 1381003,
          "match": "AZ Alkmaar vs Excelsior",
          "pick": "Result & Total Goles: Local & Más de 3.5",
          "odd": 2.62
        }
      ]
    }
    
    print(f"[INPUT] Selections Count: {len(input_bet['selections'])}")
    print(f"[INPUT] Pick: {input_bet['selections'][0]['pick']}")
    
    # 2. Process
    formatter = BetFormatter()
    output_list = formatter.process_bets([input_bet])
    output_bet = output_list[0]
    
    print("\n--- OUTPUT ---")
    print(f"[OUTPUT] Selections Count: {len(output_bet['selections'])}")
    for i, sel in enumerate(output_bet['selections']):
        print(f"  Sel {i+1}: {sel['pick']} (Odd: {sel.get('odd')})")
        
    if len(output_bet['selections']) > 1:
        print("\n[FAIL] THE CODE IS SPLITTING THE BET!")
    else:
        print("\n[PASS] The code preserved the single selection.")

if __name__ == "__main__":
    test_logic()
