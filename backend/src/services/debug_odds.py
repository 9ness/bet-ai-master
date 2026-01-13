import sys
import os
import json
import requests
from dotenv import load_dotenv

# Load Env
# Strict Path
env_path = r"c:\Users\ness4\Proyectos_Personales\BET AI Master\bet-ai-master\frontend\.env.local"

print(f"Loading env from: {env_path}")
load_dotenv(env_path)

API_KEY = os.getenv("API_KEY") or os.getenv("NEXT_PUBLIC_API_FOOTBALL_KEY")
if not API_KEY:
    print("ERROR: API KEY NOT FOUND")
    sys.exit(1)
    
print(f"API Key: {API_KEY[:5]}...")

def check_odds_nba(game_id):
    url = "https://v1.basketball.api-sports.io/odds"
    headers = {
        'x-rapidapi-host': "v1.basketball.api-sports.io",
        'x-rapidapi-key': API_KEY
    }
    params = {"game": game_id, "bookmaker": 4} # Bet365
    
    print(f"Querying NBA Odds for Game {game_id}...")
    try:
        resp = requests.get(url, headers=headers, params=params)
        data = resp.json()
        
        if not data.get("response"):
            print("Response Empty.")
            return

        bookmakers = data["response"][0]["bookmakers"]
        if not bookmakers:
            print("No bookmakers.")
            return
            
        bets = bookmakers[0]["bets"]
        print("Available Market IDs:")
        for b in bets:
             print(f"ID: {b['id']} Name: {b['name']}")
             
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_odds_nba(470040)
