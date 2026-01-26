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
        
        # --- 1. ESTRUCTURA ÚNICA (Full Data) ---
        full_day_data = {
            "date": date_str,
            "is_real": True,
            "day_profit": 0, # Should be calculated or 0 initially
            "status": "PENDING",
            "bets": []
        }

        stakes = { "safe": 6, "value": 3, "funbet": 1 }

        # Transform bets
        # Transform bets
        for data in bets_data:
            if not data: continue
            
            # Identify Type from the data itself (List item)
            bet_type = data.get("betType", "unknown").lower()
            
            # Compatibility: Logic for both direct 'selections' or older 'components'
            original_selections = data.get("selections", data.get("components", []))
            
            # Normalize Selections
            normalized_selections = []
            if original_selections:
                for sel in original_selections:
                    norm_sel = {
                        "fixture_id": sel.get("fixture_id"),
                        "sport": sel.get("sport", "Football"), # Default
                        "league": sel.get("league", "Unknown"),
                        "match": sel.get("match", "Unknown vs Unknown"),
                        "time": sel.get("time", "00:00"),
                        "pick": sel.get("pick", ""),
                        "odd": float(sel.get("odd", 0)),
                        "status": "PENDING",
                        "result": None # Null explicitly
                    }
                    normalized_selections.append(norm_sel)

            # Determine Stake
            stake = float(data.get("stake", stakes.get(bet_type, 1)))
            odd = float(data.get("odd", 0))

            # Build Strict Bet Object
            bet_entry = {
                "betType": bet_type,
                "sport": data.get("sport", "Football"),
                "startTime": data.get("startTime", "00:00"), 
                "match": data.get("match", "Multi-Bet"),
                "pick": data.get("pick", "Combination"),
                "stake": stake,
                "total_odd": odd,
                "estimated_units": round(stake * (odd - 1), 2) if odd > 1 else 0, # Corrected calc: stake * (odd-1)
                "reason": data.get("reason", data.get("analysis", "")),
                "status": "PENDING",
                "profit": 0, 
                "selections": normalized_selections
            }
            full_day_data["bets"].append(bet_entry)

        # --- 2. SAVE FULL DATA (Monthly Hash) ---
        # "Guarda el JSON completo en betai:daily_bets:YYYY-MM -> field YYYY-MM-DD"
        year_month = date_str[:7] # YYYY-MM
        hash_key = self._get_key(f"daily_bets:{year_month}")
        
        self._send_command("HSET", hash_key, date_str, json.dumps(full_day_data))
        print(f"[Redis] Guardado FULL MENSUAL OK: {hash_key} -> {date_str}")

        # --- 3. SMART MIRROR LOGIC (Master Key) ---
        # "Crea una copia en daily_bets (Legacy View) pero establece como null campos dinámicos"
        
        import copy
        mirror_data = copy.deepcopy(full_day_data)
        
        # Nullify fields for Mirror
        mirror_data["day_profit"] = None
        mirror_data["status"] = None
        
        for bet in mirror_data["bets"]:
            bet["profit"] = None
            bet["status"] = None 
            for sel in bet["selections"]:
                sel["result"] = None
                sel["status"] = None

        # Save Mirror to Master Key
        master_key = self._get_key("daily_bets")
        self._send_command("SET", master_key, json.dumps(mirror_data))
        print(f"[Redis] Espejo Inteligente (Nullified) Guardado OK: {master_key}")

    # --- SPECIFIC ACCESSORS FOR HASH STRUCT ---
    def get_daily_bets(self, date_str):
        """ Retrieves bets for a specific date from the Monthly Hash """
        if not self.is_active: return None
        year_month = date_str[:7]
        hash_key = self._get_key(f"daily_bets:{year_month}")
        # HGET key field
        return self._send_command("HGET", hash_key, date_str)

    def save_raw_matches(self, date_str, matches_data):
        """ Save raw matches to Monthly Hash """
        if not self.is_active: return
        year_month = date_str[:7]
        hash_key = self._get_key(f"raw_matches:{year_month}")
        self._send_command("HSET", hash_key, date_str, json.dumps(matches_data))
        print(f"[Redis] Raw Matches Saved to {hash_key} -> {date_str}")

    def get_raw_matches(self, date_str):
        """ Get raw matches from Monthly Hash """
        if not self.is_active: return None
        year_month = date_str[:7]
        hash_key = self._get_key(f"raw_matches:{year_month}")
        return self._send_command("HGET", hash_key, date_str)

    def get_month_bets(self, year_month):
        """ Get ALL bets for a month (HGETALL) """
        if not self.is_active: return None
        hash_key = self._get_key(f"daily_bets:{year_month}")
        res = self._send_command("HGETALL", hash_key)
        if isinstance(res, list):
             # Upstash/Redis REST via request sometimes returns [k,v,k,v] list
             # We need to dict it
             return dict(zip(res[::2], res[1::2]))
        return res

    # Helper for Check Results (Generic)
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

    # --- TELEGRAM MODULE ---
    def save_telegram_queue(self, date_str, bets_data):
        """
        Genera y guarda los mensajes formateados para Telegram.
        Regla de Retención: Mantiene máximo 2 fechas en el Hash 'betai:telegram_store'.
        """
        if not self.is_active: return

        import uuid
        
        # 1. Recuperar Store actual (Hash)
        store_key = self._get_key("telegram_store")
        # HGETALL en Upstash REST devuelve array intercalado
        current_store_raw = self._send_command("HGETALL", store_key)
        
        current_dates = []
        if current_store_raw and isinstance(current_store_raw, list):
            # Keys en índices pares: 0, 2, 4...
            for i in range(0, len(current_store_raw), 2):
                current_dates.append(current_store_raw[i])
        
        # Lógica de Retención: Mantener máximo 2 fechas
        if len(current_dates) >= 2 and date_str not in current_dates:
            current_dates.sort()
            oldest = current_dates[0]
            self._send_command("HDEL", store_key, oldest)
            print(f"[Redis/Telegram] Limpieza: Borrada fecha antigua {oldest}")

        # 2. Generar Payloads para el día actual
        telegram_items = []
        type_map = {
            "safe": {"icon": "🛡️", "title": "LA APUESTA SEGURA"},
            "value": {"icon": "⚡", "title": "LA APUESTA DE VALOR"},
            "funbet": {"icon": "💣", "title": "LA FUNBET"}
        }

        for bet in bets_data:
            b_type = bet.get("betType", "safe").lower()
            info = type_map.get(b_type, type_map["safe"])
            
            matches_lines = []
            for sel in bet.get("selections", []):
                match_line = f"⚽ {sel.get('match')}\n🎯 {sel.get('pick')} @ {sel.get('odd')}"
                matches_lines.append(match_line)
            
            matches_block = "\n\n".join(matches_lines)
            
            msg = (
                f"{info['icon']} *{info['title']}*\n\n"
                f"{matches_block}\n\n"
                f"📊 *Cuota Total:* {bet.get('total_odd')}\n"
                f"💰 *Stake:* {bet.get('stake')}/10\n\n"
                f"🧠 *Análisis de BetAiMaster:*\n"
                f"_{bet.get('reason')}_"
            )

            item = {
                "id": str(uuid.uuid4()),
                "tipo": info["title"].replace("LA ", ""),
                "bet_type_key": b_type,
                "enviado": False,
                "mensaje": msg,
                "timestamp": datetime.now().isoformat()
            }
            telegram_items.append(item)

        # 3. Guardar en Hash (Field = date_str)
        payload_json = json.dumps(telegram_items)
        self._send_command("HSET", store_key, date_str, payload_json)
        print(f"[Redis/Telegram] Guardados {len(telegram_items)} mensajes para {date_str}")

    def log_status(self, script_name, status, message=""):
        # 1. Global Last Run (Legacy Compatibility)
        data = {
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "script": script_name,
            "status": status, # SUCCESS / ERROR
            "message": str(message)
        }
        self.set("status:last_run", json.dumps(data))

        # 2. Per-Script Status (Hash Store)
        # Allows frontend to show status for each specific action card
        key_hash = self._get_key("status:scripts")
        self._send_command("HSET", key_hash, script_name, json.dumps(data))

        print(f"[LOG] Status logged to Redis: {status} ({script_name})")
