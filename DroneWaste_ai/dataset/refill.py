"""Descarga imágenes adicionales para las clases con pocas imágenes."""
import sys
sys.stdout.reconfigure(encoding="utf-8")

from icrawler.builtin import BingImageCrawler
from pathlib import Path

DATASET_DIR = Path(__file__).parent

EXTRA_QUERIES = {
    "VACIO": [
        "clean rubbish bin empty",
        "empty dustbin road",
        "new empty waste bin",
        "empty litter bin park",
        "empty public trash receptacle",
    ],
    "BAJO": [
        "litter bin little trash",
        "trash can few items inside",
        "rubbish bin barely used",
        "waste bin beginning to fill",
    ],
    "ALTO": [
        "full rubbish bin street",
        "garbage can packed full",
        "trash bin completely full lid open",
        "full public dustbin",
        "waste container full to brim",
    ],
}

for cls, queries in EXTRA_QUERIES.items():
    out = DATASET_DIR / cls
    out.mkdir(exist_ok=True)
    before = len(list(out.glob("*.[jJpPwW][pPnNbB][gGeEpP]*")))
    print(f"\n{cls} ({before} actuales):")
    for q in queries:
        print(f"  '{q}'")
        c = BingImageCrawler(storage={"root_dir": str(out)}, log_level=50)
        try:
            c.crawl(keyword=q, max_num=60, min_size=(150, 150), file_idx_offset="auto")
        except Exception as e:
            print(f"  error: {e}")
    after = len(list(out.glob("*.[jJpPwW][pPnNbB][gGeEpP]*")))
    print(f"  {before} -> {after} imagenes (+{after-before})")
