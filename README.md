# 🧠 Quiniela AI - Bet Master

Plataforma inteligente de predicción deportiva (Fútbol y Baloncesto) impulsada por IA (Gemini 3 Pro) y análisis de datos en tiempo real.

## 🚀 Características Principales

*   **Multi-Deporte**: Análisis simultáneo de Fútbol y Baloncesto (NBA/Euroliga).
*   **IA Avanzada**: Motor de decisión basado en **Gemini 3 Pro** con prompts especializados (Risk Manager & Pro Tipster).
*   **Tipos de Apuesta**:
    *   🛡️ **SAFE**: Alta probabilidad (>75%), Stake 6.
    *   💎 **VALUE**: Cuota 2.50+, Stake 3.
    *   🎉 **FUNBET**: Combinadas de alta cuota (10+), Stake 1.
*   **Admin Dashboard**: Panel de control para revisar historial, forzar análisis y gestionar apuestas manualmente.
*   **Resultados Automáticos**: Verificación periódica de resultados y cálculo de profit/loss.
*   **Social Factory**: Generación automática de guiones virales para TikTok basados en las apuestas del día.

---

## 🛠️ Stack Tecnológico

*   **Backend**: Python 3.10+
    *   `FastAPI` (o Scripts independientes ejecutados por Cron/Actions).
    *   `Redis (Upstash)`: Base de datos en tiempo real y persistencia.
    *   `Google Gemini SDK`: Generación de predicciones.
*   **Frontend**: Next.js 14+ (App Router)
    *   `Tailwind CSS` + `Lucide React`: UI moderna y responsive.
    *   `Recharts`: Gráficos de rendimiento.
*   **Infraestructura**:
    *   **GitHub Actions**: Pipelines CI/CD para ejecución automática (Daily Update, Result Check, Social Content).

---

## 📁 Estructura del Proyecto

### Backend (`/backend`)
*   `main.py`: Punto de entrada (CLI) para ejecutar flujos completos (Fetch -> Analyze -> Recommend).
*   **Services (`/src/services`)**:
    *   `fetch_odds.py`: Conexión con API-Sports (Fútbol y Basket) para obtener partidos y cuotas.
    *   `analyzer.py`: Lógica pre-procesado de datos para la IA.
    *   `gemini.py`: Cliente de Gemini que genera el JSON final de apuestas.
    *   `check_api_results.py`: Comprueba resultados de partidos terminados y actualiza Redis.
    *   `social_generator.py`: Genera captions para redes sociales leyendo de Redis.
    *   `redis_service.py`: Cliente centralizado para Upstash (HTTP).
*   **Tools**: Scripts de utilidad como `reset_attempts.py` (para depuración).

### Frontend (`/frontend`)
*   **Páginas**:
    *   `/`: Vista de usuario (Últimas apuestas).
    *   `/admin`: Panel de administración (Calendario, Historial, Herramientas).
*   **API Routes (`/app/api`)**:
    *   `/api/admin/trigger-check`: Dispara la comprobación de resultados.
    *   `/api/admin/reset-attempts`: **[NUEVO]** Resetea contadores de intentos para apuestas atascadas.
    *   `/api/social/tiktok`: Endpoint para obtener contenido generado.

---

## ⚙️ Configuración Local

### 1. Variables de Entorno
Crea un archivo `.env.local` en la raíz (o en `/frontend`) con las siguientes claves:

```env
# APIs Externas
API_KEY=tu_api_sports_key
GOOGLE_API_KEY=tu_gemini_api_key

# Base de Datos (Upstash Redis)
# NOTA: Usar versión REST (HTTP) para compatibilidad total
UPSTASH_REDIS_REST_URL=https://tu-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=tu_token_upstash
REDIS_PREFIX=betai:

# Configuración App
NEXT_PUBLIC_ADMIN_MODE=true  # Opcional para ver UI Admin local
```

### 2. Backend (Python)
```bash
cd backend
python -m venv venv
# Activar entorno (Windows: .\venv\Scripts\Activate | Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt

# Ejecutar manualmente un análisis
python main.py --mode all
```

### 3. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# Visitar http://localhost:3000
```

---

## 🤖 Workflows Automáticos (GitHub Actions)

El proyecto funciona de forma autónoma gracias a los workflows definidos en `.github/workflows`:

1.  **Daily Analysis**: Se ejecuta cada mañana. Obtiene partidos, analiza con IA y guarda en Redis (`daily_bets:YYYY-MM-DD`).
2.  **Check Results**: Se ejecuta periódicamente. Verifica si los partidos han terminado y actualiza el estado (`WON`/`LOST`) y el profit.
3.  **Social Content**: Se ejecuta tras el análisis. Genera textos para TikTok y los guarda en Redis (`tiktokfactory`).

---

## 🛡️ Admin Tools & Debugging

Desde el panel `/admin` (o usando scripts), puedes gestionar el sistema:

*   **Resetear Intentos**: Si una apuesta se queda en `PENDING` por errores de API tras varios intentos, usa el botón "Reset Pendientes" en el calendario para reiniciar el contador.
*   **Fix Status**: Scripts como `check_api_results.py` tienen lógica de "auto-healing" para corregir inconsistencias en los estados.

---

Developed with ❤️ by **Bet AI Master Team**.
