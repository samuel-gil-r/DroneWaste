"""
Descarga waste-bin-fill-level-detect2 de Roboflow via REST API y convierte
las anotaciones de detección a imágenes de clasificación por clase.

Uso:
    python dataset/download_roboflow.py --key TU_API_KEY

Dataset: https://universe.roboflow.com/image-data-mlcpz/waste-bin-fill-level-detect2-lxsf4-u3odm
"""

import sys
sys.stdout.reconfigure(encoding="utf-8")

import argparse
import io
import shutil
import zipfile
from pathlib import Path

import requests
import yaml
from PIL import Image

WORKSPACE = "image-data-mlcpz"
PROJECT   = "waste-bin-fill-level-detect2-lxsf4-u3odm"
VERSION   = 1
FORMAT    = "yolov8"

CLASS_MAP = {
    "empty":       "VACIO",
    "half-full":   "MEDIO",
    "half_full":   "MEDIO",
    "halfull":     "MEDIO",
    "half full":   "MEDIO",
    "full":        "ALTO",
    "overflowing": "DESBORDADO",
    "overflow":    "DESBORDADO",
    "overfull":    "DESBORDADO",
}

DATASET_DIR = Path(__file__).parent
TMP_DIR     = DATASET_DIR / "_roboflow_tmp"
PADDING     = 0.05


def download_zip(api_key: str) -> Path:
    # Paso 1: pedir URL de descarga
    print("Solicitando URL de descarga a Roboflow...")
    url = f"https://api.roboflow.com/{WORKSPACE}/{PROJECT}/{VERSION}/{FORMAT}?api_key={api_key}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()

    export = data.get("export", {})
    link   = export.get("link")
    if not link:
        raise RuntimeError(f"Roboflow no devolvió link de descarga. Respuesta: {data}")

    print(f"Descargando ZIP ({export.get('size', '?')} bytes)...")
    r2 = requests.get(link, timeout=120, stream=True)
    r2.raise_for_status()

    zip_path = TMP_DIR / "dataset.zip"
    TMP_DIR.mkdir(exist_ok=True)
    with open(zip_path, "wb") as f:
        for chunk in r2.iter_content(chunk_size=8192):
            f.write(chunk)

    print("Extrayendo ZIP...")
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(TMP_DIR)

    zip_path.unlink()
    return TMP_DIR


def find_yaml(base: Path) -> Path | None:
    for p in base.rglob("data.yaml"):
        return p
    for p in base.rglob("*.yaml"):
        return p
    return None


def load_class_names(dataset_path: Path) -> dict[int, str]:
    yaml_file = find_yaml(dataset_path)
    if not yaml_file:
        # Listar lo que hay para debug
        files = list(dataset_path.rglob("*"))[:20]
        print("Archivos encontrados:", [str(f) for f in files])
        raise FileNotFoundError("No se encontro data.yaml en el dataset descargado")

    print(f"YAML encontrado: {yaml_file}")
    with open(yaml_file, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    names = data.get("names", [])
    if isinstance(names, list):
        return {i: name for i, name in enumerate(names)}
    return {int(k): v for k, v in names.items()}


def crop_and_save(img_path: Path, label_path: Path,
                  class_names: dict[int, str], counter: dict):
    try:
        img = Image.open(img_path).convert("RGB")
    except Exception:
        return
    W, H = img.size

    if not label_path.exists():
        return

    lines = label_path.read_text(encoding="utf-8").strip().splitlines()
    for line in lines:
        parts = line.strip().split()
        if len(parts) < 5:
            continue

        cls_idx = int(parts[0])
        cx, cy, bw, bh = map(float, parts[1:5])

        x1 = max(0, int((cx - bw / 2 - PADDING) * W))
        y1 = max(0, int((cy - bh / 2 - PADDING) * H))
        x2 = min(W, int((cx + bw / 2 + PADDING) * W))
        y2 = min(H, int((cy + bh / 2 + PADDING) * H))

        if x2 - x1 < 32 or y2 - y1 < 32:
            continue

        raw_name    = class_names.get(cls_idx, "").lower().strip()
        drone_class = CLASS_MAP.get(raw_name)
        if not drone_class:
            continue

        out_dir = DATASET_DIR / drone_class
        out_dir.mkdir(exist_ok=True)
        n = counter.get(drone_class, 0)
        img.crop((x1, y1, x2, y2)).save(out_dir / f"rf_{n:05d}.jpg", "JPEG", quality=90)
        counter[drone_class] = n + 1


def convert(dataset_path: Path) -> dict:
    class_names = load_class_names(dataset_path)
    print(f"Clases: {class_names}")

    counter: dict = {}
    for split in ("train", "valid", "test"):
        for img_dir in dataset_path.rglob(f"{split}/images"):
            label_dir = img_dir.parent / "labels"
            imgs = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
            print(f"  Split '{split}': {len(imgs)} imagenes")
            for img_path in imgs:
                label_path = label_dir / (img_path.stem + ".txt")
                crop_and_save(img_path, label_path, class_names, counter)
    return counter


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key", required=True, help="Roboflow API key")
    args = parser.parse_args()

    dataset_path = download_zip(args.key)
    print(f"\nDataset en: {dataset_path}")

    print("\nConvirtiendo a imagenes de clasificacion...")
    counter = convert(dataset_path)

    print("\n" + "=" * 50)
    print("RESULTADO:")
    grand = 0
    for cls in ["VACIO", "BAJO", "MEDIO", "ALTO", "DESBORDADO"]:
        d = DATASET_DIR / cls
        n = len(list(d.glob("*.[jJpP][pPnN][gG]*"))) if d.exists() else 0
        rf_n = counter.get(cls, 0)
        status = "OK" if n >= 100 else ("pocas" if n > 0 else "VACIA")
        print(f"  {cls:>12}: {n:>4} total  (+{rf_n} Roboflow)  [{status}]")
        grand += n
    print(f"  {'TOTAL':>12}: {grand:>4}")

    print("\nEliminando archivos temporales...")
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    print("Listo. Vuelve a ejecutar model/train.ipynb para reentrenar.")


if __name__ == "__main__":
    main()
