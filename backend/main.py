from src.services.scraper import Scraper
from src.services.analyzer import Analyzer
from src.services.gemini import GeminiService
import sys
import os

def main():
    print("--- BETTING ADVISOR AI STARTED ---")
    
    # 1. SCRAPE
    scraper = Scraper()
    print("Step 1: Scraping/Generating Data...")
    matches = scraper.get_matches()
    if not matches:
        print("No matches found. Aborting.")
        return

    # 2. ANALYZE
    print("\nStep 2: Analyzing Data...")
    analyzer = Analyzer()
    analysis_result = analyzer.analyze()
    
    # 3. GEMINI SELECTION
    print("\nStep 3: AI Selection...")
    gemini = GeminiService()
    gemini.get_recommendations(analysis_result)
    
    print("\n--- PROCESS COMPLETED SUCCESSFULLY ---")
    print(f"Check results in: {os.path.abspath(os.path.join('data', 'recommendations_final.json'))}")

if __name__ == "__main__":
    main()
