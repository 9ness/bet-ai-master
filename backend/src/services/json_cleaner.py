import json

def clean_json_matches(matches):
    """
    Recorre la lista de partidos y elimina recursivamente cualquier clave con valor None (null).
    Mofidia el objeto in-place y lo retorna.
    """
    removed_count = 0
    
    def clean_recursive(obj):
        nonlocal removed_count
        if isinstance(obj, dict):
            # Identificar claves con valor None
            keys_to_remove = [k for k, v in obj.items() if v is None]
            for k in keys_to_remove:
                del obj[k]
                removed_count += 1
            
            # Recurrir en los hijos
            for k, v in obj.items():
                if isinstance(v, (dict, list)):
                    clean_recursive(v)
                    
        elif isinstance(obj, list):
            for item in obj:
                clean_recursive(item)

    if not matches:
        return matches

    # Aseguramos que sea una lista (o dict)
    clean_recursive(matches)
    
    print(f"[CLEANER] Limpieza completada. Se eliminaron {removed_count} valores nulos/null del JSON.")
    return matches
