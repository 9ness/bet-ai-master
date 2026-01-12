import os
import json
import requests
from datetime import datetime

try:
    from dotenv import load_dotenv
    # Load .env.local from project root PARENT (Since .env.local is one level up from bet-ai-master)
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    # Try project root
    dotenv_path = os.path.join(base_path, '.env.local')
    if not os.path.exists(dotenv_path):
        # Try frontend folder
        dotenv_path = os.path.join(base_path, 'frontend', '.env.local')
    
    if not os.path.exists(dotenv_path):
        # Try parent of project root
        dotenv_path = os.path.join(os.path.dirname(base_path), '.env.local')
    
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
        print(f"[Redis] Env loaded from {dotenv_path}")
except ImportError:
    pass

class RedisService:
    def __init__(self):
        # Support both UPSTASH specific and generic REDIS env vars (for GitHub Actions)
        # Prioritize UPSTASH vars if local, but REDIS_URL is standard in workflows
        self.url = os.getenv("REDIS_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
        self.token = os.getenv("REDIS_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
        self.prefix = os.getenv("REDIS_PREFIX", "betai:")
        
        if self.url and self.token:
            print(f"[Redis] Configurado modo HTTP (Upstash REST). Prefix: '{self.prefix}'")
            self.is_active = True 
        else:
            print(f"[Redis] FALTA CONFIGUTACIÓN. URL={bool(self.url)}, TOKEN={bool(self.token)}")
            self.is_active = False

    def _get_key(self, key_part):
        # Ensure we don't double prefix if someone passes an already prefixed key accidentally
        if key_part.startswith(self.prefix):
            return key_part
        return f"{self.prefix}{key_part}"

    def _send_command(self, command, *args):
        if not self.is_active: return None
        try:
            full_url = f"{self.url}"
            headers = {"Authorization": f"Bearer {self.token}"}
            # Upstash format: ["COMMAND", "arg1", "arg2"]
            cmd_list = [command] + list(args)
            resp = requests.post(full_url, headers=headers, json=cmd_list)
            data = resp.json()
            if "error" in data:
                print(f"[Redis] Error Upstash: {data['error']}")
                return None
            return data.get("result")
        except Exception as e:
            print(f"[Redis] Exception: {e}")
            return None

    def save_daily_bets(self, date_str, bets_data):
        if not self.is_active: return
        
        # STRUCTURE: List of bets
        redis_obj = {
            "date": date_str,
            # "created_at": datetime.now().isoformat(), # User didn't ask for this but good to have? "is_real" requested.
            "is_real": True,
            "bets": []
        }

        stakes = { "safe": 6, "value": 3, "funbet": 1 }

        # bets_data is likely { "safe": {...}, "value": {...} }
        for bet_type_key, data in bets_data.items():
            if not data: continue
            
            bet_type = bet_type_key.lower() # Enforce lowercase for comparison
            
            # Extract selections
            selections = data.get("selections", data.get("components", []))
            
            # Ensure selections have status PENDING
            if selections:
                for sel in selections:
                    if "status" not in sel: sel["status"] = "PENDING"
            
            # Build Bet Object
            bet_entry = {
                "betType": bet_type, # Mandatory field
                "type": bet_type,    # Legacy support if needed
                "stake": stakes.get(bet_type, 1),
                "total_odd": data.get("odd", 0),
                "pick": data.get("pick", ""),
                "match": data.get("match", ""),
                "reason": data.get("reason", data.get("analysis", "")), # Map reason
                "status": "PENDING",
                "profit": 0,
                "is_real": True,
                "selections": selections
            }
            redis_obj["bets"].append(bet_entry)

        # Automatic prefixing via _get_key to 'betai:daily_bets:YYYY-MM-DD'
        # User Rule: "Usa exclusivamente la llave betai:daily_bets:YYYY-MM-DD"
        full_date_key = self._get_key(f"daily_bets:{date_str}")
        json_data = json.dumps(redis_obj)
        self._send_command("SET", full_date_key, json_data)
        print(f"[Redis] Guardado OK (Standardized List): {full_date_key}")

        # SINCRONIZACIÓN MAESTRA (Rule: Sync if today)
        today_str = datetime.now().strftime("%Y-%m-%d")
        if date_str == today_str:
            master_key = self._get_key("daily_bets")
            self._send_command("SET", master_key, json_data)
            print(f"[Redis] Sincronización Maestra OK: {master_key}")

    # Helper for Check Results
    def get(self, key):
        # Ensure key is prefixed
        full_key = self._get_key(key)
        return self._send_command("GET", full_key)
    
    @property
    def client(self):
         return self 

    # Mocking redis-py methods used in check_results.py
    def set(self, key, value):
        full_key = self._get_key(key)
        return self._send_command("SET", full_key, value)
    
    def hset(self, key, mapping):
        full_key = self._get_key(key)
        # HSET key field value [field value ...]
        args = []
        for k, v in mapping.items():
            args.extend([k, v])
        return self._send_command("HSET", full_key, *args)

    def hget(self, key, field):
        full_key = self._get_key(key)
        return self._send_command("HGET", full_key, field)
    
    def ping(self):
        return self._send_command("PING")

    def keys(self, pattern):
        full_pattern = self._get_key(pattern)
        return self._send_command("KEYS", full_pattern)

    def set_data(self, key, data):
        """
        Guarda datos genéricos en Redis serializados como JSON.
        Clave: string
        Data: dict/list -> JSON
        """
        if not self.is_active:
            print(f"[Redis] Ignorado (Inactivo): SET {key}")
            return False
            
        try:
            # Aseguramos que la data sea JSON
            json_val = json.dumps(data)
            # Usamos el método interno set que ya maneja el prefijo
            self.set(key, json_val)
            print(f"[Redis] set_data OK: {key}")
            return True
        except Exception as e:
            print(f"[Redis] Error en set_data para {key}: {e}")
            return False

    def log_status(self, script_name, status, message=""):
        key = self._get_key("status:last_run")
        data = {
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "script": script_name,
            "status": status, # SUCCESS / ERROR
            "message": str(message)
        }
        self.set("status:last_run", json.dumps(data))
        print(f"[LOG] Status logged to Redis: {status} ({script_name})")
