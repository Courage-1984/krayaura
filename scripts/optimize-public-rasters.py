"""Generate WebP/AVIF (+ tuned JPEG) for existing public/media JPEGs; apply max-edge trims."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.optimize_image import export_raster, fit_long_side  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "public" / "media"

HERO_WIDTHS = (640, 960, 1280, 1600)
HERO_RE = re.compile(r"^brand/mia-hero-\d+\.jpg$")


def long_side_cap(rel: str) -> int | None:
    if rel == "brand/mia-hero.jpg":
        return 1600
    if rel.startswith("portfolio/professional/"):
        return 1400
    if "behance/" in rel and rel.endswith("/cover.jpg"):
        return 720
    if "behance/" in rel:
        return 1400
    if rel.startswith("about/") and "-sm" in rel:
        return 900
    if rel.startswith("about/"):
        return 1600
    return None


def skip_walk(rel: str) -> bool:
    if HERO_RE.match(rel):
        return True
    stem_sm = Path(rel).name.endswith("-sm.jpg")
    if stem_sm and (rel.startswith("portfolio/") or "behance/" in rel):
        return True
    return False


def wants_thumb(rel: str) -> bool:
    if rel.startswith("portfolio/professional/") and not rel.endswith("-sm.jpg"):
        return True
    if "behance/" in rel and not rel.endswith("/cover.jpg") and not rel.endswith("-sm.jpg"):
        return True
    return False


def main() -> None:
    if not MEDIA.exists():
        raise SystemExit("public/media missing")
    extras_only = "--extras-only" in sys.argv
    count = 0
    extras = 0
    for jpg in sorted(MEDIA.rglob("*.jpg")):
        rel = jpg.relative_to(MEDIA).as_posix()
        if skip_walk(rel):
            continue
        im = Image.open(jpg).convert("RGB")
        cap = long_side_cap(rel)
        if cap:
            work = fit_long_side(im, cap)
        else:
            work = im
        if not extras_only:
            export_raster(work, jpg)
            count += 1

        if rel == "brand/mia-hero.jpg":
            src = work if cap else im
            for w in HERO_WIDTHS:
                if w == 1600:
                    continue
                dest = MEDIA / f"brand/mia-hero-{w}.jpg"
                export_raster(fit_long_side(src.copy(), w), dest)
                extras += 1

        if wants_thumb(rel):
            dest = jpg.with_name(f"{jpg.stem}-sm.jpg")
            export_raster(fit_long_side(work.copy(), 720), dest)
            extras += 1

    print(f"optimized {count} JPEG trees under public/media (+{extras} extra widths/thumbs)")


if __name__ == "__main__":
    main()
