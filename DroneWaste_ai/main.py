import base64
import io
import json
import logging
from pathlib import Path
from typing import Any

import torch
import torchvision.transforms as T
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

from optimizer import solve_cvrp

logger = logging.getLogger(__name__)

app = FastAPI(title="DroneWaste AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MODEL_PATH = Path("model/model.pt")
LABELS_PATH = Path("model/labels.json")

with open(LABELS_PATH) as f:
    LABELS: dict[str, str] = json.load(f)

# Metadata fija por clase para justificación y acción recomendada
_META = {
    "VACIO":      {"nivel_pct": 5,  "prioridad": "Baja",    "accion": "Sin acción requerida.",                       "tiempo": "> 48h"},
    "BAJO":       {"nivel_pct": 20, "prioridad": "Baja",    "accion": "Incluir en próxima ruta normal.",             "tiempo": "24-48h"},
    "MEDIO":      {"nivel_pct": 50, "prioridad": "Media",   "accion": "Programar recolección en ruta prioritaria.",  "tiempo": "12-24h"},
    "ALTO":       {"nivel_pct": 78, "prioridad": "Alta",    "accion": "Recolección en las próximas 4 horas.",        "tiempo": "< 4h"},
    "DESBORDADO": {"nivel_pct": 97, "prioridad": "Crítica", "accion": "Recolección inmediata — desbordamiento activo.", "tiempo": "< 1h"},
}

# Transforms idénticos a los usados en entrenamiento
_transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# Carga del modelo (opcional — el servidor arranca aunque no exista model.pt)
_model: torch.jit.ScriptModule | None = None
if MODEL_PATH.exists():
    _model = torch.jit.load(str(MODEL_PATH), map_location="cpu")
    _model.eval()
    print(f"[DroneWaste AI] Modelo cargado desde {MODEL_PATH}")
else:
    print(f"[DroneWaste AI] AVISO: {MODEL_PATH} no encontrado. Ejecuta model/train.ipynb primero.")


class ClassifyRequest(BaseModel):
    image: str       # base64 puro (sin prefijo data:...)
    mime_type: str = "image/jpeg"


class ClassifyResponse(BaseModel):
    estado: str
    nivel_pct: int
    confianza: int
    justificacion: str
    prioridad: str
    accion_recomendada: str
    tiempo_estimado: str


@app.get("/health")
def health():
    try:
        import ortools  # noqa: F401
        ortools_ok = True
    except ImportError:
        ortools_ok = False
    return {"status": "ok", "model_loaded": _model is not None, "ortools": ortools_ok}


# ── OR-Tools CVRP ────────────────────────────────────────────────────────────

class DepotModel(BaseModel):
    lat: float
    lng: float

class RouteRequest(BaseModel):
    containers: list[dict[str, Any]]
    depot: DepotModel
    num_vehicles: int = 1
    capacity_l: int = 12_000
    time_limit_s: int = 3

@app.post("/routes/solve")
def routes_solve(req: RouteRequest):
    try:
        result = solve_cvrp(
            containers=req.containers,
            depot={"lat": req.depot.lat, "lng": req.depot.lng},
            num_vehicles=req.num_vehicles,
            capacity_l=req.capacity_l,
            time_limit_s=req.time_limit_s,
        )
        return result
    except ImportError:
        raise HTTPException(status_code=503, detail="OR-Tools no instalado. Ejecuta: pip install ortools")
    except Exception as e:
        logger.error("Error en CVRP solver: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    if _model is None:
        raise HTTPException(
            status_code=503,
            detail="Modelo no entrenado. Ejecuta model/train.ipynb para generar model.pt y reinicia el servidor.",
        )

    try:
        img_bytes = base64.b64decode(req.image)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Imagen inválida: {e}")

    tensor = _transform(img).unsqueeze(0)

    with torch.no_grad():
        logits = _model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        class_idx = int(probs.argmax().item())
        confidence = int(probs[class_idx].item() * 100)

    estado = LABELS[str(class_idx)]
    meta = _META[estado]

    return ClassifyResponse(
        estado=estado,
        nivel_pct=meta["nivel_pct"],
        confianza=confidence,
        justificacion=(
            f"Clasificación MobileNetV3 — nivel estimado {meta['nivel_pct']}%."
            f" Confianza del modelo: {confidence}%."
            f" Clase predicha: {estado}."
        ),
        prioridad=meta["prioridad"],
        accion_recomendada=meta["accion"],
        tiempo_estimado=meta["tiempo"],
    )
