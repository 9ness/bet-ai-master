import sys
import os
import requests
import json

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

API_KEY = "6017827b371406c8bc2346abae77fca3"
FOOTBALL_API_URL = "https://v3.football.api-sports.io/fixtures"
BASKETBALL_API_URL = "https://v1.basketball.api-sports.io/games"

HEADERS = {
    'x-rapidapi-host': "v3.football.api-sports.io",
    'x-rapidapi-key': API_KEY
}

def check_football(fixture_id):
    url = f"{FOOTBALL_API_URL}?id={fixture_id}"
    headers = {'x-rapidapi-key': API_KEY}
    print(f"Checking Football ID {fixture_id}...")
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        if not data.get("response"):
            print("No response data")
            return
        
        match = data["response"][0]
        status = match["fixture"]["status"]["short"]
        print(f"Status: {status}")
        print(f"Details: {json.dumps(match['fixture']['status'], indent=2)}")
        print(f"Score: {match['goals']}")
    except Exception as e:
        print(f"Error: {e}")

def check_basketball(game_id):
    url = f"{BASKETBALL_API_URL}?id={game_id}"
    headers = {'x-rapidapi-key': API_KEY}
    print(f"Checking Basketball ID {game_id}...")
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        if not data.get("response"):
            print("No response data")
            return
            
        game = data["response"][0]
        status = game["status"]["short"]
        print(f"Status: {status}")
        print(f"Details: {json.dumps(game['status'], indent=2)}")
        print(f"Score: {game['scores']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if not API_KEY:
        print("Set API_KEY env var!")
    else:
        check_football(1378015)
        print("-" * 20)
        check_basketball(454493)
