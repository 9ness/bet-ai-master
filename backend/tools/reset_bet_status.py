import sys
import os
import json
import argparse
from datetime import datetime

# Add parent directory to path to find src
sys.path.append(os.path.join(os.path.dirname(__file__), '../'))

# Load Env
try:
    from dotenv import load_dotenv
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    load_dotenv(os.path.join(base_path, 'frontend', '.env.local'))
except: pass

from src.services.redis_service import RedisService

def reset_bet_status(match_query, date_str=None):
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
        
    rs = RedisService()
    key = f"daily_bets:{date_str}"
    print(f"[*] Buscando en: {key}")
    
    raw = rs.get(key)
    if not raw:
        print(f"[!] No hay datos para la fecha {date_str}")
        # Try yesterday just in case
        return

    data = json.loads(raw) if isinstance(raw, str) else raw
    bets = data.get("bets", [])
    modified = False
    found = False
    
    for bet in bets:
        match_name = bet.get("match", "")
        # Check if query matches match name
        if match_query.lower() in match_name.lower():
            found = True
            print(f"--- Encontrado: {match_name} ---")
            print(f"    Estado Actual: {bet.get('status')}")
            print(f"    Intentos Actuales: {bet.get('check_attempts')}")
            
            # FORCE RESET
            bet["status"] = "PENDING"
            bet["check_attempts"] = 0
            bet["profit"] = 0
            # Reset selections
            for sel in bet.get("selections", []):
                sel["status"] = "PENDING"
                sel["result"] = None
            
            print(f"    => RESETEADO a PENDING (Intentos: 0)")
            modified = True

    if modified:
        rs.set_data(key, data)
        print("[SUCCESS] Redis actualizado correctamente.")
    elif not found:
        print(f"[!] No se encontró ningún partido que contenga '{match_query}'")
    else:
        print("[*] Se encontraron partidos pero no se modificaron (Error lógico?)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Forzar reset de estado de apuesta en Redis")
    parser.add_argument("match", help="Nombre parcial del partido (ej: 'Milan')")
    parser.add_argument("--date", help="Fecha YYYY-MM-DD (Default: Hoy)", default=None)
    
    args = parser.parse_args()
    reset_bet_status(args.match, args.date)
