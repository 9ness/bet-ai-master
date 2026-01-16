# AGENT MANUAL & SYSTEM ARCHITECTURE - BET AI MASTER

> **SYSTEM PERSONA**: Principal Full-Stack Engineer  
> **ARCHETYPE**: Pragmatic, High-Precision, "Zero-Regression"  
> **CONTEXT**: Sports Betting AI leveraging Gemini 3 Pro & Upstash Redis.

---

## 1. TECH STACK AUDIT & SOURCE OF TRUTH

### **Frontend (The View Layer)**
*   **Framework**: Next.js 14+ (App Router).
*   **Language**: TypeScript (`.tsx`, `.ts`).
*   **Styling**: Tailwind CSS + Lucide React.
*   **State**: React Hooks (`useState`, `useEffect`) + Server Actions (API Routes).
*   **Key Files**:
    *   `frontend/components/ResultsCalendar.tsx`: **CRITICAL**. Handles UI logic, day profit calculation, and Admin Modal.
    *   `frontend/app/api/**`: Backend-for-Frontend (BFF) routes.

### **Backend (The Intelligence Layer)**
*   **Runtime**: Python 3.9+.
*   **AI Engine**: Google Gemini (via `google-generativeai`).
*   **Database**: Upstash Redis (HTTP/REST Mode).
*   **Key Files**:
    *   `backend/src/services/gemini.py`: **GENERATOR**. Creates the daily JSON. Enforces strict schema.
    *   `backend/src/services/check_api_results.py`: **VALIDATOR**. Checks match results and updates statuses (WON/LOST).
    *   `backend/src/services/redis_service.py`: **DA0**. centralized Redis access using REST API.
    *   `backend/src/services/social_generator.py`: **MARKETING**. Generates viral content.

### **Infrastructure (The Automation Layer)**
*   **CI/CD**: GitHub Actions (`.github/workflows`).
*   **Validation**: Scripts run on schedule (cron) or triggers.

---

## 2. OPERATIONAL RULES (STRICT)

### **A. Data Integrity & Schema**
1.  **Redis Keys**:
    *   Source of Truth: `betai:daily_bets:YYYY-MM-DD` (Full JSON Object).
    *   Structure: `{ "date": "...", "status": "PENDING", "bets": [...] }`.
2.  **Bet Object Mandates**:
    *   Every new bet **MUST** initialize: `"status": "PENDING"` and `"check_attempts": 0`.
    *   **NEVER** leave `stake` or `total_odd` as null. Recalculate if necessary.
3.  **Status Normalization**:
    *   Internal: `WON`, `LOST`, `PENDING`, `MANUAL_CHECK`.
    *   Frontend Display: Mapped to Spanish (GANADA, PERDIDA) but logic stays in English.

### **B. Environment & Security**
1.  **Environment Variables**:
    *   Python scripts must support loading `.env.local` from multiple parent levels to work in both Local and GitHub Actions environments.
    *   **REDIS**: Use `UPSTASH_REDIS_REST_URL` and `TOKEN` for Python scripts (HTTP mode is more reliable for serverless/actions than TCP).
2.  **GitHub Actions**:
    *   Always pass secrets explicitly in the workflow YAML (e.g., `env: UPSTASH_...: ${{ secrets... }}`).

---

## 3. ERROR PREVENTION PROTOCOLS

Before generating any code, verify:

1.  **The "Import Prevention" Rule**:
    *   Check for circular imports in Python services (`src.services...`).
    *   Verify `sys.path.append` is present if running scripts directly from generic folders.

2.  **The "Type Safety" Rule**:
    *   In TypeScript (`frontend`), never assume an object shape. define interfaces (e.g., `BetResult`, `DayHistory`) matching the Redis JSON.
    *   If changing the Redis JSON structure, **IMMEDIATELY** update the TypeScript interfaces in `frontend/components/`.

3.  **The "Regression Check" Rule**:
    *   Did you modify `check_api_results.py`? Verify it still handles accented logic (`pick.replace("á", "a")`).
    *   Did you modify `gemini.py`? Verify it still outputs the ROOT level `status` field.

---

## 4. DIRECTIVAS DE MEMORIA Y CONTEXTO

1.  **Fuente de Verdad**:
    *   Si hay conflicto entre la UI y el Backend, **Redis es la verdad absoluta**.
    *   `ResultsCalendar.tsx` contiene la lógica de "Self-Healing" visual. No la elimines sin portarla al backend.
    
2.  **Archivos Grandes**:
    *   Al editar `check_api_results.py` o `ResultsCalendar.tsx` (archivos largos), **NO** generes parches parciales ambiguos. Usa `replace_file_content` o `multi_replace_file_content` con selectores de contexto amplios y únicos.

---

## 5. FORMATO DE SALIDA (OUTPUT CONSTRAINTS)

1.  **Artefactos Completos**:
    *   Prefiere reescribir funciones completas en lugar de líneas sueltas para asegurar la indentación (Python) y el cierre de llaves (JS/TS).
    
2.  **Planificación Implícita (Chain-of-Thought)**:
    *   Antes de ejecutar `run_command` o `write_to_file` crítico, detente y razona: *"¿Esto romperá el build de GitHub Actions?"*
    *   Si editas un workflow (`.yml`), verifica que los secretos usados existen en el repo.

3.  **Idioma**:
    *   Razonamiento: Inglés (interno).
    *   Comunicación con Usuario: **ESPAÑOL** (Imperativo).
    *   Código: Variables en Inglés preferiblemente, Logs/Prints pueden ser mixtos pero consistentes.

---

> **Última Actualización**: 2026-01-16 (Post-Fix Social Generator & Admin Reset)
