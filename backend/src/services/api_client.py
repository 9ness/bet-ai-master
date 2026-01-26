import os
import requests
import time

# Configuración de Seguridad
EXPECTED_RESIDENTIAL_IP = "213.220.23.151"
_IP_VERIFIED = False

def call_api(url, method="GET", params=None, data=None, extra_headers=None, timeout=30, is_verification=False):
    """
    Cliente centralizado para peticiones a la API con soporte de proxy Residencial/ISP.
    Incluye lógica de reintentos y headers de seguridad.
    """
    global _IP_VERIFIED

    # Seguridad: Si no hemos verificado la IP y no es una llamada de verificación, forzar verificación.
    if not _IP_VERIFIED and not is_verification:
        verify_ip()

    proxy_url = os.getenv("PROXY_URL")
    if not proxy_url:
        print("[CRITICAL] PROXY_URL no está configurada. Abortando para proteger la IP real.")
        raise ValueError("PROXY_URL missing")

    proxies = {
        "http": proxy_url,
        "https": proxy_url
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
    }
    if extra_headers:
        headers.update(extra_headers)

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1:
                print(f"      [REINTENTO {attempt}/{max_retries}] Conectando a {url}...")
                time.sleep(2)

            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=data,
                proxies=proxies,
                headers=headers,
                timeout=timeout
            )
            response.raise_for_status()
            return response
        except Exception as e:
            print(f"      [PROXY-ERROR] Intento {attempt} fallido para {url}: {e}")
            if attempt == max_retries:
                print(f"      [CRITICAL] Fallaron todos los intentos con la IP Residencial.")
                raise e
    return None

def verify_ip():
    """Verifica la IP externa actual a través del proxy de forma obligatoria."""
    global _IP_VERIFIED
    try:
        print("[INIT] Verificando IP Residencial Obligatoria...")
        # Forzamos is_verification=True para evitar bucle infinito
        resp = call_api("https://api.ipify.org?format=json", is_verification=True)
        data = resp.json()
        current_ip = data.get('ip')
        
        if current_ip == EXPECTED_RESIDENTIAL_IP:
            print(f"[INIT-OK] IP Residencial VALIDADA: {current_ip}")
            _IP_VERIFIED = True
            return True
        else:
            print(f"[CRITICAL-SECURITY] IP DETECTADA ({current_ip}) NO COINCIDE CON LA RESIDENCIAL ({EXPECTED_RESIDENTIAL_IP})")
            print("[ABORT] Cancelando todas las operaciones para evitar fugas de IP.")
            raise RuntimeError(f"Security Breach: Detected IP {current_ip} is not the residential one.")
            
    except Exception as e:
        print(f"[INIT-CRITICAL] Error fatal al verificar IP Residencial: {e}")
        raise RuntimeError("No se pudo establecer conexión segura por Proxy Residencial. Abortando.")

