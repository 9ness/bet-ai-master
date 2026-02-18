
from src.services.redis_service import RedisService

rs = RedisService()
if rs.is_active:
    # Usuario dijo: "futbol ahora mismo tenemos 12/100 y basket 10/100"
    # Por tanto, remaining = 100 - used
    
    # Futbol: 12 usados -> 88 restantes
    rs.set("api_usage:football:remaining", 88)
    
    # Basket: 10 usados -> 90 restantes
    rs.set("api_usage:basketball:remaining", 90)
    
    print("Valores de prueba inyectados en Redis:")
    print("Football Remaining: 88 (Used 12)")
    print("Basketball Remaining: 90 (Used 10)")
else:
    print("Redis no activo, no se pudieron inyectar valores.")
