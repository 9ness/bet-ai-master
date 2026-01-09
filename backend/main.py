from src.services.fetch_odds import FootballDataService
from src.services.analyzer import Analyzer
from src.services.gemini import GeminiService
from src.services.redis_service import RedisService
import sys
import os

import argparse

def main():
    parser = argparse.ArgumentParser(description='Bet AI Master Logic')
    parser.add_argument('--mode', type=str, default='all', choices=['all', 'fetch', 'analyze'], help='Mode of operation: fetch, analyze, or all')
    args = parser.parse_args()
    
    print(f"--- BETTING ADVISOR AI STARTED (Mode: {args.mode}) ---")
    
    # 1. FETCH ODDS (API SPORTS)
    if args.mode in ['all', 'fetch']:
        service = FootballDataService()
        print("Step 1: Fetching Live Data from API...")
        matches = service.fetch_matches()
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
            print("\nStep 4: Saving to Redis (Cloud)...")
            rs = RedisService()
            success = rs.set_data("daily_bets", recommendations)
            if success:
                print("[SUCCESS] Las apuestas se han guardado en Redis correctamente.")
            else:
                print("[WARNING] No se pudo guardar en Redis. Verifica logs.")
        else:
            print("[ERROR] No se obtuvieron recomendaciones de Gemini.")

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
