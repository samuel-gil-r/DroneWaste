# DroneWaste

Sistema inteligente de monitoreo y gestión de residuos sólidos urbanos mediante drones autónomos desplegados en la localidad de Chapinero, Bogotá D.C.

---

## Descripcion del proyecto

DroneWaste propone una solución tecnológica al problema de desbordamiento de contenedores de residuos en zonas urbanas de alta densidad. La hipótesis central es que la recolección reactiva basada en rutas fijas genera ineficiencias operativas y ambientales: los camiones recorren trayectos predeterminados independientemente del estado real de los contenedores, lo que resulta en recogidas innecesarias o en contenedores que permanecen desbordados durante horas.

El sistema despliega una flota de tres drones autónomos sobre Chapinero que sobrevuelan la localidad de forma continua, capturando imágenes de los 30 contenedores distribuidos en los corredores de Carrera 7, Carrera 11 y Carrera 13. Cada imagen es procesada por un módulo de visión artificial basado en MobileNetV3 embebido en una Raspberry Pi 4 a bordo del dron, que clasifica el nivel de llenado del contenedor en cinco categorías: VACIO, BAJO, MEDIO, ALTO y DESBORDADO.

Cuando un contenedor supera el umbral crítico, el sistema de optimización D-VRP (Drone-assisted Vehicle Routing Problem) calcula en tiempo real la ruta más eficiente para el camión recolector asignado a esa zona, aplicando el algoritmo nearest-neighbor con mejora 2-opt. Esto permite reducir los kilómetros recorridos y las emisiones de CO2 respecto a la recolección por ruta fija.

El backend expone los datos en tiempo real mediante WebSocket STOMP y una API REST, mientras que el frontend presenta un dashboard interactivo con mapa oscuro de Chapinero, animación de drones, indicadores de estado y simulación del proceso de recolección.

---

## Arquitectura del sistema

```
Drones (MobileNetV3 + Raspberry Pi 4)
        |
        v
Backend Spring Boot 3  <-->  H2 in-memory DB
        |
   API REST + WebSocket STOMP
        |
        v
Frontend React + Google Maps
        |
   Gemini Vision API (clasificacion de imagenes)
```

---

## Tecnologias

| Capa | Stack |
|---|---|
| Frontend | React 18, Vite, Google Maps JavaScript API, Directions API |
| Backend | Spring Boot 3, Java 21, H2 en memoria, WebSocket STOMP |
| Inteligencia Artificial | Gemini 1.5 Flash Vision API |
| Algoritmo de rutas | D-VRP con nearest-neighbor y mejora 2-opt |
| Infraestructura | Docker, Docker Compose, Nginx |

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecucion
- Una cuenta de Google para obtener las API keys (ambas gratuitas)

---

## Instalacion y ejecucion

### 1. Clonar el repositorio

```bash
git clone https://github.com/samuel-gil-r/DroneWaste.git
cd DroneWaste
```

### 2. Configurar las API keys

Copia el archivo de ejemplo y editalo con tus keys:

```bash
# Windows
copy .env.example .env
notepad .env

# Mac / Linux
cp .env.example .env
nano .env
```

El archivo `.env` debe quedar asi:

```
VITE_GOOGLE_MAPS_KEY=tu_key_de_google_maps
VITE_GEMINI_KEY=tu_key_de_gemini
```

#### Como obtener las keys

**Google Maps Key** — para el mapa interactivo y las rutas:
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear un proyecto o seleccionar uno existente
3. Activar Maps JavaScript API y Directions API
4. Ir a Credenciales → Crear credencial → Clave de API

**Gemini Key** — para el clasificador de imagenes con IA:
1. Ir a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Hacer clic en Create API Key
3. Copiar la key generada

---

### 3. Levantar el sistema con Docker

```bash
docker compose up --build
```

La primera vez tarda entre 3 y 5 minutos mientras descarga las imagenes base de Maven, Node y Nginx.

Cuando aparezcan estos mensajes el sistema esta listo:

```
dronewaste-back   | Started DroneWasteApplication in 3.x seconds
dronewaste-front  | nginx: [notice] start worker processes
```

### 4. Abrir en el navegador

```
http://localhost:5173
```

---

## Comandos utiles

| Comando | Descripcion |
|---|---|
| `docker compose up --build` | Primera vez o despues de cambios en el codigo |
| `docker compose up` | Arrancar sin reconstruir |
| `docker compose down` | Apagar los contenedores |
| `docker compose logs -f` | Ver logs en tiempo real |

---

## Estructura del proyecto

```
DroneWaste/
├── DroneWaste_front/     # React + Vite (puerto 5173)
├── DroneWaste_back/      # Spring Boot (puerto 8080)
├── docker-compose.yml    # Orquestacion de contenedores
├── .env.example          # Plantilla de variables de entorno
└── .env                  # Keys reales (no se sube al repositorio)
```

---

## Funcionalidades del dashboard

- **Mapa en vivo** — 30 contenedores sobre calles reales de Chapinero con nivel de llenado en tiempo real, 3 drones animados y deteccion de escaneo por proximidad
- **Clasificador con IA** — Carga una foto de un contenedor y Gemini Vision analiza y clasifica su nivel de llenado con descripcion tecnica
- **Rutas D-VRP** — Calculo de rutas optimas para camiones recolectores con animacion del recorrido, vaciado de contenedores en tiempo real y KPIs de eficiencia
- **Simulacion automatica** — El backend simula el llenado progresivo de contenedores con tasas individuales por tipo de zona (comercial o residencial) y genera alertas cuando se supera el umbral critico

---

## Autores

Proyecto desarrollado para la asignatura Transformación Digital y Soluciones Empresariales — Escuela Colombiana de Ingenieria Julio Garavito
