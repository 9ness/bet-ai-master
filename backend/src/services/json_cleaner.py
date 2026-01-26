import json

def remove_nulls(d):
    """
    Elimina recursivamente todas las claves con valores None (null).
    Útil para reducir el tamaño del JSON enviado a la IA.
    """
    if isinstance(d, dict):
        return {
            k: v for k, v in ((k, remove_nulls(v)) for k, v in d.items())
            if v is not None
        }
    elif isinstance(d, list):
        return [v for v in (remove_nulls(v) for v in d) if v is not None]
    else:
        return d

def clean_json_matches(matches):
    """
    Limpia los partidos que no tienen cuotas o datos esenciales y 
    purga todos los valores null para ahorrar tokens.
    """
    if not matches:
        return []
    
    # 1. Filtrado básico de partidos inútiles
    candidates = []
    for m in matches:
        # Si no tiene ID o nombre de equipos, no sirve para analizar
        home = m.get("home") or m.get("home_team")
        away = m.get("away") or m.get("away_team")
        
        if not m.get("id") or not home or not away:
            continue
            
        # Si no tiene cuotas válidas, Gemini no puede apostar
        odds = m.get("odds")
        if not odds or not any(v is not None for v in odds.values()):
            continue
            
        candidates.append(m)
        
    # 2. Eliminación recursiva de nulls (Efecto "Null Eliminator")
    cleaned = remove_nulls(candidates)
        
    print(f"[CLEANER] Original: {len(matches)} | Filtrados: {len(candidates)} | Nulls purgados: OK")
    return cleaned
