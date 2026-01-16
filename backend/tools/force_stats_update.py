import sys
import os

# Add backend root to path (bet-ai-master/backend)
sys.path.append(os.path.join(os.path.dirname(__file__), '../'))

from src.services.redis_service import RedisService
from src.services.check_api_results import update_monthly_stats

if __name__ == "__main__":
    print("--- FORCING STATS UPDATE ---")
    rs = RedisService()
    if rs.is_active:
        # Force update for current month
        update_monthly_stats(rs, "2026-01")
        print("Update complete!")
    else:
        print("FATAL: Redis not active.")
