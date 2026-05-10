"""
Descarga imágenes para cada clase de nivel de llenado de contenedor.
Usa icrawler con Bing Image Search — no requiere API key ni cuenta.

Uso:
    cd DroneWaste_ai
    pip install icrawler
    python dataset/download_dataset.py

Resultado: ~150-250 imágenes por clase en dataset/VACIO/, dataset/BAJO/, etc.
Después de descargar, REVISA las imágenes y elimina las que no correspondan.
"""

import sys
sys.stdout.reconfigure(encoding="utf-8")

from icrawler.builtin import BingImageCrawler
from pathlib import Path

# ── Consultas de búsqueda por clase ──────────────────────────────────────────
# Cada query descarga hasta IMAGES_PER_QUERY imágenes
QUERIES: dict[str, list[str]] = {
    "VACIO": [
        "empty trash can street outdoor",
        "empty garbage bin sidewalk",
        "clean empty waste container outdoor",
        "empty recycling bin street",
    ],
    "BAJO": [
        "trash can slightly used outdoor",
        "garbage bin quarter full street",
        "waste bin low amount trash",
    ],
    "MEDIO": [
        "trash can half full outdoor",
        "garbage bin half full street",
        "waste container medium fill level",
        "trash bin halfway full",
    ],
    "ALTO": [
        "trash can almost full outdoor",
        "garbage bin nearly full street",
        "full waste container outdoor",
        "trash can nearly overflowing",
    ],
    "DESBORDADO": [
        "overflowing trash can street",
        "garbage bin overflowing sidewalk",
        "overflowing waste bin outdoor",
        "trash overflow street",
        "garbage piling up around bin",
    ],
}

IMAGES_PER_QUERY = 60    # Bing suele entregar 40-60 reales por query
DATASET_DIR      = Path(__file__).parent  # carpeta dataset/


def download_class(class_name: str, queries: list[str]) -> int:
    out_dir = DATASET_DIR / class_name
    out_dir.mkdir(exist_ok=True)

    existing = len(list(out_dir.glob("*.[jJpPwW][pPnNbB][gGeEpP]*")))
    print(f"\n── {class_name} ({existing} ya existentes) ──────────────────────")

    for query in queries:
        print(f"  Descargando: '{query}'")
        crawler = BingImageCrawler(
            storage={"root_dir": str(out_dir)},
            log_level=50,   # silencia logs internos de icrawler
        )
        try:
            crawler.crawl(
                keyword=query,
                max_num=IMAGES_PER_QUERY,
                min_size=(150, 150),     # descarta miniaturas muy pequeñas
                file_idx_offset="auto",  # no sobreescribe imágenes previas
            )
        except Exception as e:
            print(f"  ⚠ Error en '{query}': {e}")

    total = len(list(out_dir.glob("*.[jJpPwW][pPnNbB][gGeEpP]*")))
    print(f"  Total {class_name}: {total} imágenes")
    return total


def main():
    print("DroneWaste — Descarga de Dataset de Imágenes")
    print("=" * 50)
    print(f"Destino: {DATASET_DIR.resolve()}\n")

    totals: dict[str, int] = {}
    for class_name, queries in QUERIES.items():
        totals[class_name] = download_class(class_name, queries)

    print("\n" + "=" * 50)
    print("RESUMEN:")
    grand_total = 0
    for cls, n in totals.items():
        status = "✓" if n >= 50 else ("⚠ pocas" if n > 0 else "✗ VACÍA")
        print(f"  {cls:>12}: {n:>4} imágenes  {status}")
        grand_total += n
    print(f"  {'TOTAL':>12}: {grand_total:>4} imágenes")

    print("""
PRÓXIMOS PASOS:
  1. Revisa las imágenes descargadas y elimina las incorrectas
     (fotos de personas, logos, interiores que no sean contenedores)
  2. Asegúrate de tener al menos 50 imágenes por clase
  3. Abre model/train.ipynb y ejecuta todas las celdas
""")


if __name__ == "__main__":
    main()
