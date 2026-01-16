import sys
import os
import json

sys.path.append(os.path.join(os.path.dirname(__file__), '../'))
from src.services.redis_service import RedisService

if __name__ == "__main__":
    rs = RedisService()
    raw = rs.get("daily_bets:2026-01-15")
    if not raw:
        print("NO DATA")
    else:
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            print(f"DATE: {data.get('date')}")
            print(f"PROFIT: {data.get('day_profit')}")
            print("BETS:")
            for b in data.get('bets', []):
                print(f" - {b.get('betType')} | {b.get('match')} | Status: {b.get('status')} | Profit: {b.get('profit')}")
        except Exception as e:
            print(f"ERROR: {e}")
            print(raw)
