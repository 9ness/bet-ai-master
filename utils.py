import os
import requests

def call_api(url, method="GET", data=None):
    """
    Cliente centralizado para peticiones a la API con soporte de proxy ISP.
    """
    # Recupera la URL del proxy desde los Secrets de GitHub
    proxy_url = os.getenv("PROXY_URL")
    
    proxies = {
        "http": proxy_url,
        "https": proxy_url
    }
    
    # Headers para parecer un navegador real y evitar bloqueos
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
    }

    try:
        response = requests.request(
            method=method,
            url=url,
            json=data,
            proxies=proxies,
            headers=headers,
            timeout=25 # Tiempo de espera ampliado para proxies
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error en la conexión con la IP 213.220.23.151: {e}")
        return None