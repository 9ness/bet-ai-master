import json
import os
import sys

# Agregar root al path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.src.services.redis_service import RedisService

def migrate():
    # Path hardcoded valid for this env
    json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'public', 'data', 'daily_bets.json')
    
    if not os.path.exists(json_path):
        print(f"[ERROR] No existe {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    date_str = data.get("date")
    bets_data = data.get("bets")

    if not date_str or not bets_data:
        print("[ERROR] JSON inválido o incompleto.")
        return

    print(f"[*] Migrando datos de {date_str} a Redis...")
    
    redis_service = RedisService()
    redis_service.save_daily_bets(date_str, bets_data)
    
    print("[SUCCESS] Migración completada.")

if __name__ == "__main__":
    migrate()
