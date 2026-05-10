# DroneWaste

Sistema inteligente de monitoreo y gestión de residuos sólidos urbanos mediante drones autónomos desplegados en la localidad de Chapinero, Bogotá D.C.

---

## Descripcion del proyecto

DroneWaste propone una solución tecnológica al problema de desbordamiento de contenedores de residuos en zonas urbanas de alta densidad. La hipótesis central es que la recolección reactiva basada en rutas fijas genera ineficiencias operativas y ambientales: los camiones recorren trayectos predeterminados independientemente del estado real de los contenedores.

El sistema despliega una flota de tres drones autónomos sobre Chapinero que sobrevuelan la localidad de forma continua, patrullando hacia los contenedores más críticos de su zona. Cada imagen capturada puede ser procesada por un clasificador de visión artificial (MobileNetV3) entrenado localmente o por Gemini Vision como respaldo, que clasifica el nivel de llenado en cinco categorías: VACIO, BAJO, MEDIO, ALTO y DESBORDADO.

Cuando una zona acumula al menos 4 contenedores en estado crítico, el optimizador de rutas basado en OR-Tools (Google Operations Research) calcula en tiempo real la ruta más eficiente para el camión recolector, aplicando CVRP con restricciones de capacidad volumétrica (12.000 L por vehículo). Los 3 camiones operan simultáneamente, cada uno en su zona, y se auto-reinician al completar el recorrido.

---

## Arquitectura del sistema

```
[React Frontend :5173]
        │
        ├── /api/*         → Spring Boot :8080  (simulación, drones, alertas)
        ├── /ai/classify   → FastAPI Python :8000  (MobileNetV3 clasificador)
        └── /routes/solve  → FastAPI Python :8000  (OR-Tools CVRP)

[Spring Boot]  ←→  H2 in-memory DB (70 contenedores, 3 drones)
[FastAPI]      ←→  model.pt (MobileNetV3 entrenado)
```

---

## Tecnologias

| Capa | Stack |
|---|---|
| Frontend | React 19, Vite, Google Maps JavaScript API, Directions API |
| Backend | Spring Boot 3, Java 21, H2 en memoria, WebSocket STOMP |
| Microservicio IA | FastAPI (Python 3.11), MobileNetV3, OR-Tools CVRP |
| Clasificación fallback | Gemini 1.5 Flash Vision API |
| Optimización de rutas | OR-Tools CVRP (Google) + nearest-neighbor 2-opt (Java) |
| Infraestructura | Docker, Docker Compose, Nginx |

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución
- Una cuenta de Google para obtener las API keys (gratuitas)

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/samuel-gil-r/DroneWaste.git
cd DroneWaste
```

### 2. Configurar las API keys

```bash
# Windows
copy .env.example .env
notepad .env

# Mac / Linux
cp .env.example .env
nano .env
```

El archivo `.env` debe quedar así:

```env
VITE_GOOGLE_MAPS_KEY=tu_key_de_google_maps
VITE_GEMINI_KEY=tu_key_de_gemini
VITE_AI_URL=http://localhost:8000
```

#### Cómo obtener las keys

**Google Maps Key** — mapa interactivo y rutas en calles reales:
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Activar **Maps JavaScript API** y **Directions API**
3. Credenciales → Crear clave de API

**Gemini Key** — clasificador de imágenes (fallback si el modelo local no está disponible):
1. Ir a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create API Key → copiar la key

---

### 3. Levantar el sistema

```bash
docker compose up --build
```

La primera vez tarda 5-8 minutos (descarga Maven, Node, Python y OR-Tools).

El sistema está listo cuando aparezcan estos mensajes:

```
dronewaste-ai     | INFO: Application startup complete.
dronewaste-back   | Started DroneWasteApplication in 3.x seconds
dronewaste-front  | nginx: [notice] start worker processes
```

### 4. Abrir en el navegador

```
http://localhost:5173
```

---

## Comportamiento del sistema

Una vez iniciado, el sistema opera de forma completamente automática:

- **Drones** — los 3 drones patrullan hacia los contenedores ALTO/DESBORDADO de su zona
- **Contenedores** — se llenan progresivamente según su tasa individual (comercial o residencial)
- **Camiones** — cuando una zona acumula ≥ 4 contenedores críticos, el camión calcula la ruta óptima con OR-Tools y sale automáticamente
- **Recolección** — al llegar a cada contenedor, lo vacía y actualiza el backend
- **Auto-reinicio** — 12 segundos después de completar el recorrido, el camión recalcula y sale de nuevo

---

## Comandos útiles

| Comando | Descripción |
|---|---|
| `docker compose up --build` | Primera vez o después de cambios en el código |
| `docker compose up` | Arrancar sin reconstruir |
| `docker compose down` | Apagar los contenedores |
| `docker compose logs -f` | Ver logs en tiempo real |
| `docker compose logs backend -f` | Logs solo del backend Java |
| `docker compose logs ai -f` | Logs del microservicio Python |

---

## Estructura del proyecto

```
DroneWaste/
├── DroneWaste_front/     # React + Vite (puerto 5173 → Nginx :80)
├── DroneWaste_back/      # Spring Boot Java (puerto 8080)
├── DroneWaste_ai/        # FastAPI Python — clasificador + OR-Tools (puerto 8000)
│   ├── main.py           # Servidor FastAPI
│   ├── optimizer.py      # Solver CVRP con OR-Tools
│   └── model/
│       ├── train.ipynb   # Notebook de entrenamiento MobileNetV3
│       └── labels.json   # Mapeo de clases del modelo
├── docker-compose.yml    # Orquestación de los 3 servicios
├── .env.example          # Plantilla de variables de entorno
└── .env                  # Keys reales (no se sube al repositorio)
```

---

## Funcionalidades del dashboard

- **Mapa en vivo** — 70 contenedores sobre calles reales de Chapinero con nivel de llenado en tiempo real y 3 drones animados patrullando
- **Clasificador con IA** — sube una foto de contenedor; el modelo local MobileNetV3 clasifica el nivel de llenado (fallback a Gemini Vision si el modelo no está disponible)
- **Rutas inteligentes** — 3 camiones operando simultáneamente con OR-Tools CVRP, animación del recorrido, vaciado en tiempo real y auto-reinicio al completar
- **Simulación automática** — el backend simula llenado progresivo con tasas individuales por zona y genera alertas al superar umbrales críticos

---

## Entrenar el modelo de clasificación (opcional)

El clasificador de imágenes funciona con Gemini como fallback. Para usar el modelo local entrenado:

```bash
cd DroneWaste_ai
pip install -r requirements.txt
jupyter notebook model/train.ipynb
```

Ejecutar todas las celdas genera `model/model.pt`. El servidor FastAPI lo carga automáticamente al reiniciar.

---

## Autores

Proyecto desarrollado para la asignatura Transformación Digital y Soluciones Empresariales — Escuela Colombiana de Ingeniería Julio Garavito
