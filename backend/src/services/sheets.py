import os
import json
import logging
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from backend.src.utils.logger import setup_logger

# Usar el logger compartido
logger = logging.getLogger()

def get_credentials():
    """Obtiene credenciales de Google Sheets."""
    # Buscar credentials.json en la raiz del proyecto (subir 2 niveles desde backend/src/services -> backend/src -> backend -> root)
    # Pero cuidado, si ejecutamos desde root, la ruta relativa depende del CWD.
    # Mejor usar ruta absoluta basada en este archivo.
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    creds_path = os.path.join(base_dir, "credentials.json")
    
    # 1. Archivo local
    if os.path.exists(creds_path):
        logger.info(f"Usando credentials.json local: {creds_path}")
        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        return ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)

    # 2. Variables de entorno
    creds_json = os.environ.get("G_SHEETS_CREDENTIALS")
    if creds_json:
        try:
            creds_dict = json.loads(creds_json)
            if "private_key" in creds_dict:
                creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
            scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
            return ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        except Exception as e:
            logger.error(f"Error parseando credenciales ENV: {e}")
            
    raise FileNotFoundError("No se encontraron credenciales de Google Sheets (ni archivo ni ENV).")

def get_client():
    creds = get_credentials()
    return gspread.authorize(creds)

def get_worksheet(client, sheet_id, sheet_name):
    sh = client.open_by_key(sheet_id)
    try:
        return sh.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        # Crear si no existe (config básica)
        if sheet_name == "Semana_Actual":
            ws = sh.add_worksheet(title="Semana_Actual", rows=20, cols=8)
            ws.append_row([
                "Jornada", "Fecha", "Local", "Visitante", 
                "Pronostico_Logico", "Justificacion_Logica", 
                "Pronostico_Sorpresa", "Justificacion_Sorpresa"
            ])
            return ws
        elif sheet_name == "Historial":
            ws = sh.add_worksheet(title="Historial", rows=100, cols=10)
            ws.append_row([
                "Jornada", "Partido", "Local", "Visitante",
                "Pronostico_Logico", "Pronostico_Sorpresa", 
                "Resultado_Real", "Acierto_Logico", "Acierto_Sorpresa", 
                "Feedback_IA"
            ])
            return ws
        raise
