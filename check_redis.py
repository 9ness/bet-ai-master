import os
import redis
import json
from datetime import datetime
from dotenv import load_dotenv

# Load env from .env in backend root
load_dotenv(dotenv_path='backend/.env')

url = os.getenv('UPSTASH_REDIS_REST_URL')
token = os.getenv('UPSTASH_REDIS_REST_TOKEN')

print(f"Connecting to Redis...")
# Use redis-py with url
r = redis.Redis.from_url(url.replace('https://', 'rediss://').replace('http://', 'redis://') if url.startswith('http') else url, password=token)

today = datetime.now().strftime("%Y-%m-%d")
key = f"betai:daily_bets:{today}"
print(f"Fetching key: {key}")

data = r.get(key)
if data:
    try:
        json_data = json.loads(data)
        print("Data Type:", type(json_data))
        if isinstance(json_data, dict):
             # OLD structure or wrapper?
             print("Data Keys:", json_data.keys())
             if 'bets' in json_data:
                 print("Checking first bet in 'bets'...")
                 bets = json_data['bets']
                 if len(bets) > 0:
                     print("First Bet Selections:", json.dumps(bets[0].get('selections', 'NO SELECTIONS'), indent=2))
        elif isinstance(json_data, list):
             # NEW structure
             print("Data is LIST. Checking first item...")
             if len(json_data) > 0:
                 print("First Bet Selections:", json.dumps(json_data[0].get('selections', 'NO SELECTIONS'), indent=2))
    except Exception as e:
        print("JSON Error:", e)
else:
    print("No data found for key.")
