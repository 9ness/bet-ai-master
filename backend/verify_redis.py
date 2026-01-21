import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))
from src.services.redis_service import RedisService

def verify():
    rs = RedisService()
    key = "betai:daily_bets:2026-01-21"
    raw = rs.get(key)
    if not raw:
        print("No data found")
        return

    data = json.loads(raw)
    bets = data.get("bets", [])
    
    print(f"Total Bets: {len(bets)}")
    for i, bet in enumerate(bets):
        sels = bet.get("selections", [])
        print(f"Bet {i} ({bet.get('betType')}): {len(sels)} selections")
        for s in sels:
             print(f" - {s.get('pick')} (Odd: {s.get('odd')})")

if __name__ == "__main__":
    verify()
