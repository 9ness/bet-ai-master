# Guia de Inicio - Quiniela AI

Este archivo documenta los pasos necesarios para configurar y arrancar el proyecto en un entorno local. El proyecto consiste en un Backend (Python) para scraping y análisis, y un Frontend (Next.js) para visualizar las recomendaciones.

## Prerrequisitos

*   **Python 3.10+**: Asegurate de tener Python instalado y añadido al PATH.
*   **Node.js 18+**: Necesario para el frontend.
*   **Cuenta de Google Cloud**: Para la API de Gemini y Google Sheets (opcional si usas API Mock).

---

## 1. Configuración del Backend

El backend se encarga de obtener los datos de los partidos, analizarlos y generar predicciones usando Gemini AI.

### Pasos:

1.  **Navegar al directorio backend**:
    ```bash
    cd backend
    ```

2.  **Crear un entorno virtual**:
    Es recomendable usar un entorno virtual para aislar las dependencias.
    ```bash
    python -m venv venv
    ```

3.  **Activar el entorno virtual**:
    *   **Windows (PowerShell)**:
        ```bash
        .\venv\Scripts\Activate
        ```
    *   **Windows (CMD)**:
        ```bash
        .\venv\Scripts\activate.bat
        ```
    *   **Mac/Linux**:
        ```bash
        source venv/bin/activate
        ```

4.  **Instalar dependencias**:
    ```bash
    pip install -r requirements.txt
    ```

5.  **Configurar Variables de Entorno**:
    Crea un archivo llamado `.env` dentro de la carpeta `backend/` y añade tu clave de API de Google Gemini:
    ```env
    GOOGLE_API_KEY=tu_api_key_de_gemini_aqui
    ```
    *(Si no tienes una API Key, el sistema usará un modo Mock con datos de prueba).*

6.  **Credenciales de Google Sheets (Opcional)**:
    Si el proyecto requiere escribir en Google Sheets, coloca tu archivo `credentials.json` (descargado de Google Cloud Console) en la **raíz del proyecto** (`bet-ai-master/`).

### Ejecución del Backend:

Para correr el script principal que genera las predicciones:

```bash
python main.py
```

Esto generará un archivo `data/recommendations_final.json` que el frontend consumirá.

---

## 2. Configuración del Frontend

El frontend es una aplicación web moderna construida con Next.js y Tailwind CSS.

### Pasos:

1.  **Navegar al directorio frontend**:
    ```bash
    cd frontend
    ```
    *(Si estabas en `backend`, ejecuta `cd ../frontend`)*

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```
    *(Si `npm install` falla por conflictos, prueba `npm install --legacy-peer-deps`)*

3.  **Arrancar el servidor de desarrollo**:
    ```bash
    npm run dev
    ```

4.  **Ver la aplicación**:
    Abre tu navegador y entra a [http://localhost:3000](http://localhost:3000).

---

## Estructura de Carpetas Clave

*   `/backend/main.py`: Punto de entrada del script de Python.
*   `/backend/src/services`: Lógica de scraping, análisis y conexión con IA.
*   `/frontend/app`: Páginas y lógica del frontend (Next.js App Router).
*   `/data`: Carpeta donde se guardan los resultados JSON generados por el backend.
