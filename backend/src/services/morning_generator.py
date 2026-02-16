import sys
import os
import json
import time
from datetime import datetime

# Path setup to include backend root
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.gemini import GeminiService

def generate_morning_messages():
    print("[*] Iniciando Generador de Mensajes de Buenos Días...")
    redis = RedisService()
    gemini = GeminiService()
    
    today = datetime.now()
    # Mapeo manual de días en español
    days_map = {
        "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
        "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
    }
    day_name = days_map.get(today.strftime("%A"), today.strftime("%A"))
    today_str = today.strftime("%Y-%m-%d")
    
    # Intentar obtener apuestas del día para dar contexto
    raw_data = redis.get_daily_bets(today_str)
    bets_summary = "No hay apuestas analizadas todavía para hoy."
    has_champions = False
    
    if raw_data:
        try:
            data = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
            bets = data.get('bets', [])
            if bets:
                summaries = []
                for b in bets:
                    leagues = [s.get('league', '') for s in b.get('selections', [])]
                    match = b.get('match', 'Varios partidos')
                    summaries.append(f"- {match} ({', '.join(leagues)})")
                    if any("Champions" in l for l in leagues):
                        has_champions = True
                bets_summary = "\n".join(summaries)
        except Exception as e:
            print(f"[WARN] Error procesando contexto de apuestas: {e}")

    prompt = f"""
    Eres un Tipster experto y carismático que gestiona un canal de Telegram de élite llamado "BetAi Master".
    Tu tarea es redactar 3 versiones VARIADAS e INTELIGENTES de un mensaje de "BUENOS DÍAS" para hoy.

    CONTEXTO:
    - Hoy es: {day_name}, {today_str}
    - Apuestas del día:
    {bets_summary}
    - ¿Hay Champions League?: {"SÍ" if has_champions else "No explícitamente mencionada en las apuestas."}

    REGLAS DE ESTILO:
    1. Comienza siempre con un saludo enérgico (ej: ☕ ¡BUENOS DÍAS FAMILIA! ☀️).
    2. El primer párrafo debe motivar y mencionar el día de la semana (ej: "A por el {day_name}", "Seguimos la semana...").
    3. El segundo párrafo debe hablar de la jornada de hoy de forma profesional pero cercana. Si hay Champions o partidos importantes, menciónalos con HYPE. Si no hay apuestas específicas, habla de que el equipo está analizando mercados con valor.
    4. El tercer párrafo debe ser un "Call to Action" para que activen notificaciones o estén atentos (ej: "No os perdáis lo que viene hoy...").
    5. Usa EMOJIS variados y adecuados (⚽, 🏀, 📈, 🔔, ‼️, ✅).
    6. Formato de salida: Devuelve UNICAMENTE un ARRAY JSON con exactamente 3 strings.

    Ejemplo de salida:
    [
      "Texto versión 1...",
      "Texto versión 2...",
      "Texto versión 3..."
    ]
    Solo devuelve el JSON puro, sin bloques de código markdown.
    """

    print(f"[*] Generando con Gemini para el día: {day_name}...")
    response = gemini.generate_text(prompt)
    
    if response:
        try:
            # Limpiar posibles bloques de código
            clean_text = response.replace("```json", "").replace("```", "").strip()
            versions = json.loads(clean_text)
            
            if isinstance(versions, list) and len(versions) >= 3:
                versions = versions[:3] # Asegurar solo 3
                # Guardar en Redis con una clave específica
                # Usamos una clave que el frontend pueda consultar fácilmente
                redis.set_data(f"morning_messages:{today_str}", versions)
                print(f"[SUCCESS] 3 versiones guardadas en Redis para {today_str}")
                return True
            else:
                print(f"[ERROR] La respuesta de Gemini no es una lista de 3: {response}")
        except Exception as e:
            print(f"[ERROR] Fallo al parsear JSON de Gemini: {e}")
            print(f"Respuesta cruda: {response}")
    else:
        print("[ERROR] Gemini no devolvió ninguna respuesta.")
    
    return False

if __name__ == "__main__":
    try:
        success = generate_morning_messages()
        if not success:
            sys.exit(1)
    except Exception as e:
        print(f"[CRITICAL] Fallo en el script: {e}")
        sys.exit(1)
