import sys
import os
import json
import time
from datetime import datetime

# Path setup to include backend root
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.gemini import GeminiService

def generate_viral_caption():
    console_log("🚀 Iniciando Generador de Captions para TikTok...")
    
    redis = RedisService()
    gemini = GeminiService()
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    # Use the specific accessor for Hash structure
    raw_data = redis.get_daily_bets(today_str)
    if raw_data:
        try:
             data = json.loads(raw_data)
        except:
             data = None
    
    if not data:
        console_log("❌ No se encontraron apuestas para hoy. Saliendo.")
        return

    # Extract relevant info for the prompt
    bets_summary = []
    
    # Process bets list
    raw_bets = data.get('bets', [])
    # Also check legacy safe/value/funbet structure if array is empty
    if not raw_bets:
        if 'safe' in data: raw_bets.append(data['safe'])
        if 'value' in data: raw_bets.append(data['value'])
        if 'funbet' in data: raw_bets.append(data['funbet'])

    for bet in raw_bets:
        bet_type = bet.get('betType', 'Unknown')
        
        # Determine if it's a parlay (multiple selections)
        selections = bet.get('selections', [])
        if not selections and bet.get('match'):
             # Single bet structure
             selections = [{
                 'match': bet['match'],
                 'pick': bet['pick'],
                 'reason': bet.get('reason', ''),
                 'league': bet.get('league', ''),
                 'date': bet.get('date', '')
             }]
        
        for sel in selections:
            bets_summary.append({
                "match": sel.get('match', 'Unknown'),
                "pick": sel.get('pick', 'Unknown'),
                "analysis": sel.get('reason', 'No analysis provided'),
                "league": sel.get('league', ''),
                "date": sel.get('date', '')
            })

    console_log(f"📝 Preparando prompt con {len(bets_summary)} selecciones...")

    # Construct Viral Prompt
    prompt_text = f"""
    Eres un Analista Deportivo VIRAL de TikTok con millones de seguidores.
    Tu tarea es crear los metadatos para un vídeo presentando la tarjeta de apuestas de hoy.

    DATOS DE ENTRADA:
    {json.dumps(bets_summary, indent=2)}

    GUÍA DE ESTILO:
    1. **TONO**: Hype, Enérgico, pero inteligente.
    2. **SEGURIDAD (CRÍTICO)**:
       - PROHIBIDO usar palabras como: "Apuesta", "Bet", "Dinero", "Ganar", "Gambling", "Profit". TikTok penaliza esto.
       - En su lugar, usa: "La clave", "La selección", "El movimiento", "Nos gusta", "Vemos interesante".
    3. **VISUAL**:
       - Usa la BANDERA del país de los equipos o la competición en el título del partido.
       - Usa CÍRCULOS DE COLORES (🔴🔵, ⚪⚫, 🟡🔵) para representar a los equipos en el texto.
       - Sé creativo con los emoticonos, no repitas siempre el mismo formato.
    4. **ESTRUCTURA**:
       - **GANCHO**: Mensaje corto impactante.
       - **PARTIDOS**:
         `[Emoji Bandera] PARTIDO (EN MAYÚSCULAS) [Emoji Deporte]`
         `[Análisis Narrativo con Storytelling, mencionando "ritmo", "necesidad", "bajas". Usa colores de equipos.]`

    FORMATO DE SALIDA:
    Debes devolver un objeto JSON VÁLIDO con exactamente estas dos claves:
    {{
        "title": "TÍTULO (SIN PALABRAS PROHIBIDAS)",
        "description": "Texto completo..."
    }}
    Solo JSON puro.
    """

    response_text = gemini.generate_text(prompt_text)
    
    if response_text:
        try:
            # Clean potential markdown
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            result = json.loads(clean_text)
            
            console_log("✅ Caption generado con éxito!")
            
            # Save to Redis
            output_payload = {
                "date": today_str,
                "updated_at": datetime.now().isoformat(),
                "title": result.get("title", "TIKTOK BETS"),
                "description": result.get("description", "")
            }
            
            # Save to 'betai:tiktokfactory'
            redis.set_data("tiktokfactory", output_payload)
            console_log("💾 Guardado en Redis key: betai:tiktokfactory")
            
        except json.JSONDecodeError:
            console_log("❌ Error al parsear la respuesta JSON de Gemini.")
            console_log(f"Respuesta cruda: {response_text}")
            
    else:
        console_log("⚠️ Fallo al generar el caption.")

def console_log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

if __name__ == "__main__":
    try:
        generate_viral_caption()
        rs = RedisService()
        if rs.is_active: rs.log_status("Social Generator", "SUCCESS", "Completed")
    except Exception as e:
        print(f"[CRITICAL] Social Generator Failed: {e}")
        rs = RedisService()
        if rs.is_active: rs.log_status("Social Generator", "ERROR", str(e))
