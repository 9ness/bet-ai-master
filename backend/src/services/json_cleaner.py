import json

def remove_nulls(d):
    """
    Elimina recursivamente todas las claves con valores None (null) y cuenta cuántos.
    Retorna (dato_limpio, total_purgados)
    """
    purgados = 0
    if isinstance(d, dict):
        new_dict = {}
        for k, v in d.items():
            if v is None:
                purgados += 1
                continue
            v_cleaned, v_purgados = remove_nulls(v)
            purgados += v_purgados
            new_dict[k] = v_cleaned
        return new_dict, purgados
    elif isinstance(d, list):
        new_list = []
        for v in d:
            if v is None:
                purgados += 1
                continue
            v_cleaned, v_purgados = remove_nulls(v)
            purgados += v_purgados
            new_list.append(v_cleaned)
        return new_list, purgados
    else:
        return d, 0

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
    cleaned_data, count_purgados = remove_nulls(candidates)
        
    print(f"[CLEANER] Original: {len(matches)} | Filtrados: {len(candidates)} | Nulls purgados: {count_purgados}")
    return cleaned_data
