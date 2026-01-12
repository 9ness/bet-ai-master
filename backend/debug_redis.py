import os
import json
from src.services.redis_service import RedisService

# Load env vars manually for script if needed, or rely on internal logic
# Actually redis_service loads .env.local automatically.

rs = RedisService()
print(f"Redis Active: {rs.is_active}")
print(f"Prefix: {rs.prefix}")

# Check keys for today 2026-01-09
pattern = f"*{rs.prefix}*2026-01-09*"
print(f"Searching for keys matching: {pattern}")
keys = rs.keys("*2026-01-09*") # The service _get_key prefixes this
print("Keys found via service.keys('*2026-01-09*'):")
print(keys)

# Also try raw search in case logic is weird
# Note: rs.keys() internally prefixes.

# Check specific key existence
target_key = "betai:daily_bets:2026-01-09"
print(f"Direct check for '{target_key}':")
try:
    # Use internal command directly to bypass _get_key double prefixing if any
    val = rs._send_command("GET", target_key)
    if val:
        print("FOUND! Length:", len(str(val)))
        # Print snippet to verify content
        print("Content snippet:", str(val)[:100])
    else:
        print("NOT FOUND")
except Exception as e:
    print(f"Error checking key: {e}")
