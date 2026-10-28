"""Resize + export raster assets as JPEG (fallback), WebP, and AVIF at ~80–90% perceptual quality."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

try:
    import pillow_avif  # noqa: F401 — registers AVIF with Pillow
except ImportError:
    pass

Image.MAX_IMAGE_PIXELS = None

JPEG_Q = 84
WEBP_Q = 85
AVIF_Q = 50


def fit_long_side(im: Image.Image, long_side: int) -> Image.Image:
    scale = long_side / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


def fit_width(im: Image.Image, width: int) -> Image.Image:
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    return im


def export_raster(
    im: Image.Image,
    dest_jpg: Path,
    *,
    jpeg_q: int = JPEG_Q,
    webp_q: int = WEBP_Q,
    avif_q: int = AVIF_Q,
    jpeg_only: bool = False,
    quiet: bool = False,
) -> tuple[int, int]:
    """Write ``dest_jpg`` and, unless ``jpeg_only``, sibling ``.webp`` / ``.avif`` files."""
    dest_jpg.parent.mkdir(parents=True, exist_ok=True)
    rgb = im.convert("RGB")
    rgb.save(dest_jpg, quality=jpeg_q, optimize=True, progressive=True)
    stem = dest_jpg.with_suffix("")
    if not jpeg_only:
        rgb.save(stem.with_suffix(".webp"), format="WEBP", quality=webp_q, method=6)
        try:
            rgb.save(stem.with_suffix(".avif"), format="AVIF", quality=avif_q)
        except OSError:
            pass
    if not quiet:
        parts = [f"{dest_jpg} {rgb.width}x{rgb.height} jpg={dest_jpg.stat().st_size // 1024}KB"]
        for ext in (".webp", ".avif"):
            p = stem.with_suffix(ext)
            if p.exists():
                parts.append(f"{ext[1:]}={p.stat().st_size // 1024}KB")
        print(" ".join(parts))
    return rgb.size


def export_from_path(
    src: Path,
    dest_jpg: Path,
    *,
    width: int | None = None,
    long_side: int | None = None,
    **kwargs,
) -> tuple[int, int]:
    im = Image.open(src).convert("RGB")
    if long_side is not None:
        im = fit_long_side(im, long_side)
    elif width is not None:
        im = fit_width(im, width)
    return export_raster(im, dest_jpg, **kwargs)
