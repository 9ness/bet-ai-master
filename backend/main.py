from src.services.fetch_odds import FootballDataService
from src.services.analyzer import Analyzer
from src.services.gemini import GeminiService
from src.services.redis_service import RedisService
import sys
import os

import json
import argparse
from src.services.fetch_odds import FootballDataService

def main():
    parser = argparse.ArgumentParser(description='Bet AI Master Logic')
    parser.add_argument('--mode', type=str, default='all', choices=['all', 'fetch', 'analyze'], help='Mode of operation: fetch, analyze, or all')
    args = parser.parse_args()
    
    print(f"--- BETTING ADVISOR AI STARTED (Mode: {args.mode}) ---")
    
    # Initialize Redis early for caching
    rs = RedisService()
    
    # 1. FETCH ODDS (API SPORTS)
    if args.mode in ['all', 'fetch']:
        service = FootballDataService()
        today_str = service.get_today_date()
        raw_matches_key = f"raw_matches:{today_str}"
        
        print("Step 1: Fetching Live Data from API...")
        
        # Check Redis Cache first
        cached_matches = rs.get(raw_matches_key) if rs.is_active else None
        
        if cached_matches:
            print(f"[CACHE] Match data found in Redis ({raw_matches_key}). Using cached data.")
            matches = json.loads(cached_matches)
            # Ensure data is on disk for Analyzer (compat)
            with open(service.output_file, 'w', encoding='utf-8') as f:
                json.dump(matches, f, indent=4, ensure_ascii=False)
        else:
            print("[API] Fetching fresh data from API-Sports...")
            matches = service.fetch_matches()
            if matches and rs.is_active:
                rs.set_data(raw_matches_key, matches)
                print(f"[CACHE] Saved raw matches to Redis: {raw_matches_key}")

        if not matches and args.mode == 'fetch':
            print("No matches found.")
        elif not matches and args.mode == 'all':
            print("No matches found. Aborting.")
            return

    # 2. ANALYZE & 3. GEMINI
    if args.mode in ['all', 'analyze']:
        print("\nStep 2: Analyzing Data...")
        analyzer = Analyzer()
        analysis_result = analyzer.analyze()
        
        print("\nStep 3: AI Selection...")
        gemini = GeminiService()
        recommendations = gemini.get_recommendations(analysis_result)
        
        if recommendations:
            from datetime import datetime
            today_key = f"daily_bets:{datetime.now().strftime('%Y-%m-%d')}"
            
            print(f"\nStep 4: Saving to Redis (Cloud)...")
            print(f"[REDIS] Intentando guardar análisis en la clave: {today_key}")
            print(f"[DATOS] Contenido del JSON a guardar: {json.dumps(recommendations, indent=2, ensure_ascii=False)}")
            
            rs = RedisService()
            # Saving to specific date key AND "daily_bets" (pointer to latest) to ensure backward compat or specific date access
            # User specifically asked for unconditional overwrite.
            success = rs.set_data(today_key, recommendations)
            
            # CRITICAL: Also save formatted data for the Calendar/History
            date_str = datetime.now().strftime("%Y-%m-%d")
            rs.save_daily_bets(date_str, recommendations['bets'])
            
            # Also update the 'latest' pointer if needed, or just relying on date.
            # Assuming frontend reads from a specific endpoint or by date. 
            # If frontend reads "daily_bets", we should update that too or user means the specific key IS the main one.
            # User instruction: "Confirma que la clave usada sea exactamente 'daily_bets:YYYY-MM-DD'"
            
            if success:
                print(f"[SUCCESS] Las apuestas se han guardado en Redis correctamente bajo la clave {today_key} y bets:{date_str}.")
            else:
                print("[WARNING] No se pudo guardar en Redis. Verifica logs.")
        else:
            print("[ERROR] No se obtuvieron recomendaciones de Gemini. Abortando guardado.")
            exit(1) # Fail the workflow if AI fails

    print("\n--- PROCESS COMPLETED SUCCESSFULLY ---")
    # print(f"Check results in: {os.path.abspath(os.path.join('data', 'daily_bets.json'))}") # Ya no es la fuente de verdad

if __name__ == "__main__":
    try:
        main()
        # Log success
        rs = RedisService()
        if rs.is_active: rs.log_status("Daily Analysis", "SUCCESS", "Completed")
    except Exception as e:
        print(f"[CRITICAL] Main Script Failed: {e}")
        rs = RedisService()
        if rs.is_active: rs.log_status("Daily Analysis", "ERROR", str(e))
        exit(1)
