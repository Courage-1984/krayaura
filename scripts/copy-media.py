"""Build web-sized media in public/media from the source files in assets/.

Originals stay in assets/; only resized copies ship. Requires Pillow (+ pillow-avif-plugin for AVIF).
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.optimize_image import export_from_path, export_raster, fit_long_side  # noqa: E402

root = Path(__file__).resolve().parent.parent
pub = root / "public" / "media"
(pub / "covers").mkdir(parents=True, exist_ok=True)
(pub / "brand").mkdir(parents=True, exist_ok=True)

COVER_SIZE = 1200  # lightbox ≤ 640px — 2× DPR safe
GALLERY_LONG_SIDE = 1400
BEHANCE_COVER = 720


def slug(name: str) -> str:
    stem, ext = name.rsplit(".", 1)
    s = stem.lower().replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return f"{s}.{ext.lower()}"


(pub / "covers" / "sm").mkdir(parents=True, exist_ok=True)

cover_sources = sorted((root / "assets" / "new_images" / "covers").glob("*"))
cover_sources += sorted((root / "assets" / "itunes_covers").glob("*"))
done = set()
for f in cover_sources:
    name = slug(f.name)
    if not f.is_file() or name in done:
        continue
    done.add(name)
    export_from_path(f, pub / "covers" / name, width=COVER_SIZE)
    export_from_path(f, pub / "covers" / "sm" / name, width=480)

Image.MAX_IMAGE_PIXELS = None
behance_src = root / "assets" / "behance"
manifest = {}
if behance_src.exists():
    for proj in sorted(p for p in behance_src.iterdir() if p.is_dir()):
        dest_dir = pub / "behance" / proj.name
        if dest_dir.exists():
            shutil.rmtree(dest_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        cap_file = proj / "captions.json"
        captions = json.loads(cap_file.read_text(encoding="utf-8")) if cap_file.exists() else {}
        images = []
        for f in sorted(proj.iterdir()):
            if f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            out_name = f"{slug(f.stem + '.jpg')}"
            if f.stem == "cover":
                w, h = export_from_path(f, dest_dir / out_name, width=BEHANCE_COVER)
            else:
                im = Image.open(f).convert("RGB")
                im = fit_long_side(im, GALLERY_LONG_SIDE)
                w, h = export_raster(im, dest_dir / out_name)
            images.append({
                "src": f"behance/{proj.name}/{out_name}",
                "w": w,
                "h": h,
                "caption": captions.get(f.name) or captions.get(out_name) or "",
            })
        desc = proj / "description.txt"
        manifest[proj.name] = {
            "images": images,
            "description": desc.read_text(encoding="utf-8").strip() if desc.exists() else None,
        }

(root / "src" / "data").mkdir(parents=True, exist_ok=True)
(root / "src" / "data" / "behance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print("behance manifest:", {k: len(v["images"]) for k, v in manifest.items()})

video_src = root / "assets" / "video"
video_out = pub / "video"
videos = {}
ffmpeg = shutil.which("ffmpeg")
if video_src.exists() and ffmpeg:
    video_out.mkdir(parents=True, exist_ok=True)
    for f in sorted(video_src.iterdir()):
        if f.suffix.lower() not in {".mp4", ".mov", ".webm", ".mkv"}:
            continue
        name = slug(f.stem + ".x").rsplit(".", 1)[0]
        if "cover" in name:
            vf = "crop='min(iw,ih)':'min(iw,ih)',scale='min(1080,iw)':-2"
        elif "portrait" in name:
            vf = "scale=-2:'min(1280,ih)'"
        else:
            vf = "scale='min(1280,iw)':-2"
        base = ["-y", "-hide_banner", "-loglevel", "error", "-i", str(f), "-an", "-vf", f"{vf},fps=30"]
        mp4, webm, poster = video_out / f"{name}.mp4", video_out / f"{name}.webm", video_out / f"{name}.jpg"
        subprocess.run([ffmpeg, *base, "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(mp4)], check=True)
        subprocess.run([ffmpeg, *base, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", str(webm)], check=True)
        subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(mp4), "-frames:v", "1",
                        "-q:v", "4", str(poster)], check=True)
        export_from_path(poster, poster)
        key = name.replace("-portrait", "")
        entry = videos.setdefault(key, {})
        entry["portrait" if "portrait" in name else "landscape"] = {
            "mp4": f"video/{mp4.name}", "webm": f"video/{webm.name}", "poster": f"video/{poster.name}",
        }
        print(f"video {name}: mp4 {mp4.stat().st_size // 1024}KB, webm {webm.stat().st_size // 1024}KB")
elif video_src.exists():
    print("WARNING: assets/video exists but ffmpeg isn't on PATH — videos skipped")
(root / "src" / "data" / "video.json").write_text(json.dumps(videos, indent=2) + "\n", encoding="utf-8")

print("done")
