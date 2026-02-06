
import sys
import os

# Adjust path to import src
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from src.services.bet_formatter import BetFormatter

def test_mapping():
    formatter = BetFormatter()
    
    # Sample bet with "Crvena zvezda"
    sample_bets = [
        {
            "selections": [
                {
                    "match": "Crvena zvezda vs Maccabi Tel Aviv",
                    "pick": "Hándicap Asiático Crvena zvezda -4.5",
                    "odd": 1.61,
                    "time": "2026-02-06 20:00"
                }
            ],
            "betType": "value"
        }
    ]
    
    processed = formatter.process_bets(sample_bets)
    
    sel = processed[0]["selections"][0]
    print(f"Match: {sel['match']}")
    print(f"Pick: {sel['pick']}")
    
    if "Estrella Roja" in sel["match"] and "Estrella Roja" in sel["pick"]:
        print("SUCCESS: Mapping worked!")
    else:
        print("FAILURE: Mapping failed.")

if __name__ == "__main__":
    test_mapping()
