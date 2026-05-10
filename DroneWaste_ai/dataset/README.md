# Dataset — DroneWaste Clasificador de Contenedores

## Estructura requerida

```
dataset/
├── VACIO/        ← imágenes de contenedores 0–10% llenos
├── BAJO/         ← 10–33%
├── MEDIO/        ← 33–66%
├── ALTO/         ← 66–90%
└── DESBORDADO/   ← 90–100% (desbordando)
```

Formatos aceptados: `.jpg`, `.jpeg`, `.png`, `.webp`

## ¿Cuántas imágenes necesito?

| Mínimo por clase | Recomendado | Ideal |
|---|---|---|
| 50 | 200 | 500+ |

Con 50 imágenes por clase el modelo ya puede aprender. Con 200+ la precisión mejora notablemente.

## Fuentes recomendadas

### 1. TACO Dataset (gratis, anotado)
- Web: http://tacodataset.org/
- Contiene fotos reales de basura. Necesitas recortar/filtrar por nivel de llenado.

### 2. Google Images / DuckDuckGo
Busca términos como:
- `"trash can empty"` → VACIO
- `"garbage bin half full"` → MEDIO
- `"overflowing trash can"` → DESBORDADO
- `"recycling bin full"` → ALTO

Descarga manualmente 50-100 por clase.

### 3. Imágenes sintéticas con el simulador
El simulador de DroneWaste genera niveles de llenado. Puedes hacer screenshots del mapa
con cada contenedor en distintos estados y usarlos como dataset.

### 4. Kaggle
Datasets útiles:
- "garbage classification" → ~2500 imágenes de residuos
- "waste classification" → varias versiones

## Tips de calidad

- Varía ángulos (frontal, 30°, 45°, cenital — simula dron a 30m)
- Varía iluminación (día, noche, nublado)
- Varía tipos de contenedor (metálico, plástico, calle)
- Elimina imágenes borrosas o con watermarks
- No mezcles clases dudosas (un contenedor 65% va en MEDIO, no en ALTO)
