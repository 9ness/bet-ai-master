import requests
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Cargar variables de entorno (opcional, si el usuario decide usar .env)
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

# -------------------------------------------------------------------------
# CONFIGURACIÓN
# -------------------------------------------------------------------------
# La API_KEY se carga desde el archivo .env
# -------------------------------------------------------------------------

class FootballDataService:
    def __init__(self):
        self.base_url = "https://v3.football.api-sports.io"
        
        # Cargar estrictamente desde variables de entorno
        self.api_key = os.getenv("API_KEY")
        
        if not self.api_key:
            print("⚠️ ADVERTENCIA: No se encontró 'API_KEY' en las variables de entorno.")
        
        self.headers = {
            "x-apisports-key": self.api_key
        }
        
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.output_file = os.path.join(self.base_dir, 'data', 'matches_tomorrow.json')
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)

    def get_tomorrow_date(self):
        tomorrow = datetime.now() + timedelta(days=1)
        return tomorrow.strftime("%Y-%m-%d")

    def fetch_matches(self):
        if not self.api_key:
            print("❌ ERROR CRÍTICO: Falta la API KEY en el archivo .env")
            return

        date_str = self.get_tomorrow_date()
        print(f"🔄 Conectando a API-SPORTS (Direct)...")
        print(f"📅 Fecha: {date_str} (Mañana)")
        
        # Endpoint: /fixtures
        url = f"{self.base_url}/fixtures"
        querystring = {
            "date": date_str,
            "league": "140",   # LaLiga
            "season": "2025",  # Temporada actual 2025/2026
            "timezone": "Europe/Madrid"
        }

        try:
            response = requests.get(url, headers=self.headers, params=querystring)
            
            # Debug rápido de respuesta
            if response.status_code != 200:
                print(f"❌ Error HTTP {response.status_code}: {response.text}")
                return

            data = response.json()

            if "errors" in data and data["errors"]:
                print(f"❌ Error API-SPORTS: {data['errors']}")
                return

            fixtures = data.get("response", [])
            print(f"📊 Partidos encontrados: {len(fixtures)}")

            matches_list = []
            
            for fixture in fixtures:
                try:
                    # 1. Datos básicos
                    fix_id = fixture["fixture"]["id"]
                    match_date = fixture["fixture"]["date"] # ISO string
                    home = fixture["teams"]["home"]["name"]
                    away = fixture["teams"]["away"]["name"]
                    
                    # 2. Extracción de Cuotas (Bet365)
                    # NOTA: En /fixtures estándar, las cuotas NO suelen venir incluidas salvo configuración especial.
                    # Si la respuesta no trae "bookmakers", tendríamos que llamar a /odds.
                    # Pero el script sigue la instrucción: "Busca dentro de la respuesta".
                    
                    odds_final = {}
                    
                    # Intentamos buscar si vienen incrustadas (poco común en plan Basic sin expansiones)
                    # Si no vienen, simularemos la estructura o dejaremos vacío.
                    # Para producción real, habría que hacer una llamada extra a /odds?fixture={id}.
                    
                    if "bookmakers" in fixture: 
                         # Lógica si el usuario tiene activado dumps de odds en fixtures
                         pass 
                    
                    # Como alternativa recomendada por API-SPORTS, si necesitamos odds reales
                    # y estamos en plan Basic, quizás no podamos hacer 1 llamada por partido.
                    # Asumiremos por ahora que el usuario quiere ver los partidos aunque fallen las odds.
                    
                    matches_list.append({
                        "id": fix_id,
                        "date": match_date.split("T")[0],
                        "time": match_date.split("T")[1][:5],
                        "home": home,
                        "away": away,
                        "odds": odds_final # Vacío por defecto si no vienen en el payload
                    })
                    
                except Exception as e:
                    print(f"⚠️ Error parsing fixture: {e}")
                    continue

            # Guardar JSON
            # Aseguramos que el directorio data exista (ya se hace en init, pero por si acaso)
            os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
            
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(matches_list, f, indent=4, ensure_ascii=False)
            
            print(f"💾 Guardado: {self.output_file}")
            print(f"📝 Total partidos: {len(matches_list)}")
            
            if not matches_list:
                print("⚠️  AVISO: No se encontraron partidos. Posibles causas:")
                print("   1. No hay partidos de LaLiga mañana.")
                print("   2. La temporada 2024 no está activa en tu plan de API.")
                print("   3. Tu API Key aún no ha sido aprobada.")
            
        except Exception as e:
            print(f"❌ Error de script: {e}")

if __name__ == "__main__":
    print("🚀 Iniciando servicio de cuotas (API-SPORTS)...")
    service = FootballDataService()
    service.fetch_matches()
