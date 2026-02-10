import sys
import os
import json
import time
from datetime import datetime, timedelta

# Path setup to include backend root
sys.path.append(os.path.join(os.path.dirname(__file__), '../../'))

from src.services.redis_service import RedisService
from src.services.gemini import GeminiService

def generate_viral_caption_tiktok():
    console_log("🚀 Iniciando Generador de Captions TIKTOK (VIRAL MODE - MAÑANA)...")
    
    redis = RedisService()
    gemini = GeminiService()
    
    # Target: TOMORROW
    now = datetime.now()
    tomorrow = now + timedelta(days=1)
    target_date_str = tomorrow.strftime("%Y-%m-%d")
    
    # Use the specific accessor for Hash structure (New Format: daily_bets:YYYY-MM_tiktok -> Field: YYYY-MM-DD)
    month_key = tomorrow.strftime("%Y-%m")
    redis_hash_key = f"daily_bets:{month_key}_tiktok"
    
    console_log(f"🔍 Buscando apuestas en Hash: '{redis._get_key(redis_hash_key)}' Field: '{target_date_str}'")
    
    raw_data = redis.client.hget(redis_hash_key, target_date_str)
    
    if raw_data:
        try:
             data = json.loads(raw_data)
        except:
             data = None
    else:
        data = None
    
    if not data:
        console_log(f"❌ No se encontraron apuestas VIRALES para {target_date_str}. Saliendo.")
        return

    # Extract relevant info for the prompt
    bets_summary = []
    
    # Process bets list (New Format is list of bets in "bets" key)
    raw_bets = data.get('bets', [])

    for bet in raw_bets:
        # Determine selections (Standardize for single or multiple)
        selections = bet.get('selections', [])
        if not selections and bet.get('match'):
             selections = [{
                 'match': bet['match'],
                 'pick': bet['pick'],
                 'reason': bet.get('reason', {}), # Object in tiktok mode
                 'league': bet.get('league', ''),
                 'date': bet.get('date', '')
             }]
        
        for sel in selections:
            # Flatten for the prompt
            analysis = sel.get('reason', 'No analysis provided')
            # If reason is object (TikTok mode), stringify or extract content
            if isinstance(analysis, dict):
                 blocks = analysis.get('blocks', [])
                 analysis = " ".join([b.get('content', '') for b in blocks])

            bets_summary.append({
                "match": sel.get('match', 'Unknown'),
                "pick": sel.get('pick', 'Unknown'),
                "analysis": analysis,
                "league": sel.get('league', ''),
                "date": sel.get('date', '')
            })

    console_log(f"📝 Preparando prompt VIRAL con {len(bets_summary)} selecciones clave...")

    # Construct Viral Prompt - EXACT STYLE GUIDE + TOMORROW CONTEXT
    prompt_text = f"""
    Eres un Analista Deportivo VIRAL de TikTok con millones de seguidores.
    Tu tarea es crear los metadatos para un vídeo presentando la tarjeta de apuestas para MAÑANA ({target_date_str}).

    DATOS DE ENTRADA:
    {json.dumps(bets_summary, indent=2)}

    GUÍA DE ESTILO (ESTRICTA):
    1. **TONO**: Hype, Enérgico, pero inteligente.
    2. **SEGURIDAD (CRÍTICO)**:
       - PROHIBIDO usar palabras como: "Apuesta", "Bet", "Dinero", "Ganar", "Gambling", "Profit". TikTok penaliza esto.
       - En su lugar, usa: "La clave", "La selección", "El movimiento", "Nos gusta", "Vemos interesante", "Jugada Maestra".
    3. **VISUAL**:
       - Usa la BANDERA del país de los equipos o la competición en el título del partido.
       - Usa CÍRCULOS DE COLORES (🔴🔵, ⚪⚫, 🟡🔵) para representar a los equipos en el texto.
       - Sé creativo con los emoticonos, no repitas siempre el mismo formato.
    4. **ESTRUCTURA**:
       - **GANCHO**: Mensaje corto impactante sobre "Anticiparse a mañana" o "La jugada de mañana".
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
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            result = json.loads(clean_text)
            
            console_log("✅ Caption VIRAL generado con éxito!")
            
            output_payload = {
                "date": target_date_str,
                "updated_at": datetime.now().isoformat(),
                "title": result.get("title", f"TIKTOK {target_date_str}"),
                "description": result.get("description", "")
            }
            
            # Save to 'betai:tiktokfactory_tomorrow'
            redis.set_data("tiktokfactory_tomorrow", output_payload)
            console_log("💾 Guardado en Redis key: betai:tiktokfactory_tomorrow")
            
        except json.JSONDecodeError:
            console_log("❌ Error al parsear la respuesta JSON.")
            console_log(f"Respuesta cruda: {response_text}")
            
    else:
        console_log("⚠️ Fallo al generar el caption.")

def console_log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

if __name__ == "__main__":
    generate_viral_caption_tiktok()
