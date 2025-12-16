import logging
import sys

def setup_logger():
    """Configura el logger para escribir SOLO en stdout (consola)."""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Limpiar handlers existentes para evitar duplicados o escritura en fichero
    if logger.handlers:
        logger.handlers = []
        
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    return logger
