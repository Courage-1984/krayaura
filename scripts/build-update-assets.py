"""Web-ready media for the client's "Krayaura Website Update" (amendments PDF).

Reads the supplied source folder and writes only resized / trimmed copies:

  public/media/covers/mia.jpg (+ .webp, .avif), covers/sm/mia.jpg
  public/media/brand/mia-hero.jpg, share-mia.jpg (JPEG for OG)
  public/media/audio/mia/NN.mp3                    30s preview clips
  public/media/about/aN.jpg, aN-sm.jpg
  public/media/portfolio/professional/NN.jpg
  public/media/portfolio/Krayaura-Professional-Portfolio.pdf  (compressed)
  src/data/mia.json, portfolio.json

The M.I.A. wordmark is no longer produced here. `python scripts/build-fonts.py`
writes `src/fonts/a-dripping-marker.woff2` from `Updated fonts/`.

Requires Pillow (+ pillow-avif-plugin), PyMuPDF, ffmpeg / ffprobe.
Optional: Ghostscript (gswin64c) for smaller PDF.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.optimize_image import export_raster, fit_long_side, fit_width  # noqa: E402

Image.MAX_IMAGE_PIXELS = None

root = Path(__file__).resolve().parent.parent
src = root / "Krayaura Website Update" / "Assets"
pub = root / "public" / "media"

ffmpeg = shutil.which("ffmpeg")
ffprobe = shutil.which("ffprobe")
if not (ffmpeg and ffprobe):
    raise SystemExit("ffmpeg / ffprobe are required (audio clips)")

PORTFOLIO_RENDER = 1400
HERO_LONG = 1600


def compress_pdf(src_pdf: Path, dest_pdf: Path) -> None:
    dest_pdf.parent.mkdir(parents=True, exist_ok=True)
    gs = shutil.which("gswin64c") or shutil.which("gswin32c") or shutil.which("gs")
    before = src_pdf.stat().st_size
    if gs:
        subprocess.run(
            [
                gs,
                "-sDEVICE=pdfwrite",
                "-dCompatibilityLevel=1.4",
                "-dPDFSETTINGS=/ebook",
                "-dNOPAUSE",
                "-dQUIET",
                "-dBATCH",
                f"-sOutputFile={dest_pdf}",
                str(src_pdf),
            ],
            check=True,
        )
    else:
        doc = fitz.open(src_pdf)
        doc.save(dest_pdf, garbage=4, deflate=True, clean=True)
        doc.close()
    after = dest_pdf.stat().st_size
    print(dest_pdf.relative_to(root), f"{after // 1024}KB (was {before // 1024}KB)")


# ── M.I.A. cover ────────────────────────────────────────────────────────────────────────────────────
cover = Image.open(src / "M.I.A Album Cover Files" / "Designs" / "MIA-COVER.jpg").convert("RGB")
export_raster(fit_width(cover, 1200), pub / "covers" / "mia.jpg")
(pub / "covers" / "sm").mkdir(parents=True, exist_ok=True)
export_raster(fit_width(cover, 480), pub / "covers" / "sm" / "mia.jpg")
export_raster(fit_long_side(cover, HERO_LONG), pub / "brand" / "mia-hero.jpg", jpeg_q=82)

share = Image.new("RGB", (1200, 630), (0, 0, 0))
share.paste(cover.resize((630, 630), Image.LANCZOS), (285, 0))
export_raster(share, pub / "brand" / "share-mia.jpg", jpeg_q=86)

# ── M.I.A. tracks ───────────────────────────────────────────────────────────────────────────────────
TRACKS = [
    ("Where Are You?", ["LeratoApple"], None),
    ("Division", ["HeIsGem"], None),
    ("Last Time", [], None),
    ("What Do I Say?", ["Bongz_G"], None),
    ("The Recipe", [], None),
    ("Missing Piece (Interlude)", [], None),
    ("Show Off Every Side", [], "Co-produced by Miso"),
    ("I'm So Hypnotized", [], None),
    ("Where You Been At?", [], None),
    ("Distance", [], None),
    ("We Need Some Drums", ["Kieth Haynes"], None),
    ("Am I Paranoid?", [], None),
    ("Think About You", ["Michelle Wella", "Jupiter Collins"], None),
    ("Breathing Through My Rhymes", [], None),
]
CLIP_SECONDS = 30
audio_src = src / "MIA Album"
audio_out = pub / "audio" / "mia"
if audio_out.exists():
    shutil.rmtree(audio_out)
audio_out.mkdir(parents=True)


def probe_seconds(path: Path) -> float:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return float(out)


tracks = []
for n, (title, features, note) in enumerate(TRACKS, start=1):
    f = next(audio_src.glob(f"{n}. *"))
    dur = probe_seconds(f)
    start = 15 if dur > 70 else 0
    length = min(CLIP_SECONDS, dur - start)
    dest = audio_out / f"{n:02d}.mp3"
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(start),
            "-t",
            str(length),
            "-i",
            str(f),
            "-vn",
            "-af",
            f"afade=t=in:d=0.25,afade=t=out:st={max(0, length - 1.5):.2f}:d=1.5",
            "-ac",
            "2",
            "-ar",
            "44100",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "96k",
            str(dest),
        ],
        check=True,
    )
    print(dest.relative_to(root), f"{dest.stat().st_size // 1024}KB", f"(full track {dur:.0f}s)")
    tracks.append(
        {
            "n": n,
            "title": title,
            "features": features,
            "note": note,
            "durationMs": round(dur * 1000),
            "preview": f"audio/mia/{n:02d}.mp3",
        }
    )

(root / "src" / "data").mkdir(parents=True, exist_ok=True)
(root / "src" / "data" / "mia.json").write_text(
    json.dumps({"date": "2026-11-06", "cover": "covers/mia.jpg", "tracks": tracks}, indent=2) + "\n",
    encoding="utf-8",
)

# ── About carousel photos ────────────────────────────────────────────────────────────────────────────
about_out = pub / "about"
about_out.mkdir(parents=True, exist_ok=True)
legacy = sorted((src / "About Section Pictures").glob("A*.jpg"))
if legacy:
    for f in legacy:
        name = f.stem.lower()
        im = Image.open(f).convert("RGB")
        export_raster(fit_long_side(im, 1600), about_out / f"{name}.jpg")
        export_raster(fit_long_side(im, 900), about_out / f"{name}-sm.jpg", jpeg_q=80)

prelaunch = root / "FINAL-PRE-LAUNCH-UPDATES" / "About us Pictures"
PRELAUNCH_MAP = [
    ("A5.jpg", "a6"),
    ("A6.jpg", "a7"),
    ("A8.jpg", "a8"),
    ("A9.JPG", "a9"),
    ("A10.CR3", "a10"),
]
if prelaunch.is_dir():
    for src_name, dest in PRELAUNCH_MAP:
        f = prelaunch / src_name
        if not f.exists():
            continue
        if f.suffix.lower() == ".cr3":
            try:
                import rawpy

                with rawpy.imread(str(f)) as raw:
                    rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=True, output_bps=8)
                im = Image.fromarray(rgb)
            except ImportError:
                print(f"Skip {f.name}: install rawpy for CR3 conversion", file=sys.stderr)
                continue
        else:
            im = Image.open(f).convert("RGB")
        export_raster(fit_long_side(im, 1600), about_out / f"{dest}.jpg")
        export_raster(fit_long_side(im, 900), about_out / f"{dest}-sm.jpg", jpeg_q=80)

# ── Professional Portfolio (PDF) → page images + compressed PDF ─────────────────────────────────────
pdf_path = src / "Design Portfolio's" / "Professional Portfolio.pdf"
pf_out = pub / "portfolio" / "professional"
if pf_out.exists():
    shutil.rmtree(pf_out)
pf_out.mkdir(parents=True)
doc = fitz.open(pdf_path)
images = []
for i, page in enumerate(doc, start=1):
    zoom = PORTFOLIO_RENDER / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    name = f"{i:02d}.jpg"
    w, h = export_raster(im, pf_out / name, jpeg_q=82)
    images.append(
        {"src": f"portfolio/professional/{name}", "w": w, "h": h, "caption": f"Page {i} of {len(doc)}"}
    )
    if i == 1:
        export_raster(fit_width(im, 900), pf_out / "cover.jpg", jpeg_q=84)
doc.close()

pdf_dest = pub / "portfolio" / "Krayaura-Professional-Portfolio.pdf"
compress_pdf(pdf_path, pdf_dest)

(root / "src" / "data" / "portfolio.json").write_text(
    json.dumps({"professional-portfolio": {"images": images, "description": None}}, indent=2) + "\n",
    encoding="utf-8",
)
print("portfolio pages:", len(images))
print("done")
