"""Build web-sized media in public/media from the source files in assets/.

Originals stay in assets/; only resized copies ship. Requires Pillow.
"""
import json
import re
import shutil
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
pub = root / "public" / "media"
(pub / "covers").mkdir(parents=True, exist_ok=True)
(pub / "brand").mkdir(parents=True, exist_ok=True)

COVER_SIZE = 1200  # cards render ≤ 320px, Crash cover ≤ 448px, lightbox ≤ 640px — 2× DPR safe


def slug(name: str) -> str:
    stem, ext = name.rsplit(".", 1)
    s = stem.lower().replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return f"{s}.{ext.lower()}"


def save_resized(src: Path, dest: Path, width: int) -> None:
    im = Image.open(src).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dest, quality=84, optimize=True, progressive=True)
    print(dest.relative_to(root), f"{im.width}x{im.height}", f"{dest.stat().st_size // 1024}KB")


(pub / "covers" / "sm").mkdir(parents=True, exist_ok=True)

# Designer originals first; iTunes artwork (from fetch-discography.py) only fills gaps
cover_sources = sorted((root / "assets" / "new_images" / "covers").glob("*"))
cover_sources += sorted((root / "assets" / "itunes_covers").glob("*"))
done = set()
for f in cover_sources:
    name = slug(f.name)
    if not f.is_file() or name in done:
        continue
    done.add(name)
    save_resized(f, pub / "covers" / name, COVER_SIZE)
    save_resized(f, pub / "covers" / "sm" / name, 480)  # crate sleeves, mini-player, tracklists

for f in (root / "assets" / "new_images").glob("*.jpg"):
    dest = pub / "brand" / slug(f.name)
    shutil.copy2(f, dest)
    print(dest.relative_to(root))

# Full channel art (2560×1440) → sized for the Channel World preview + lightbox
banner = root / "assets" / "current_reference_images" / "You-tuber-banner.jpg"
if banner.exists():
    for w in (1600, 800):
        save_resized(banner, pub / "brand" / f"channel-banner-{w}.jpg", w)

# Behance projects → resized gallery images + manifest (src/data/behance.json)
#   assets/behance/<project>/cover.jpg        list preview
#   assets/behance/<project>/<NN-name>.jpg    gallery slides, in file-name order
#   assets/behance/<project>/captions.json    optional {"<file name>": "<caption>"}
#   assets/behance/<project>/description.txt  optional; paragraphs separated by a blank line
# Loose files in assets/behance/ itself (raw page captures) are sources only and are ignored here.
GALLERY_LONG_SIDE = 1600  # slides render ≤ ~36rem tall / ≤ 1000px wide — 2× DPR safe


def save_fitted(src: Path, dest: Path, long_side: int):
    im = Image.open(src).convert("RGB")
    scale = long_side / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(dest, quality=84, optimize=True, progressive=True)
    print(dest.relative_to(root), f"{im.width}x{im.height}", f"{dest.stat().st_size // 1024}KB")
    return im.size


Image.MAX_IMAGE_PIXELS = None
behance_src = root / "assets" / "behance"
manifest = {}
if behance_src.exists():
    for proj in sorted(p for p in behance_src.iterdir() if p.is_dir()):
        dest_dir = pub / "behance" / proj.name
        if dest_dir.exists():
            shutil.rmtree(dest_dir)  # re-crops / deletions upstream must not leave stale slides
        dest_dir.mkdir(parents=True, exist_ok=True)
        cap_file = proj / "captions.json"
        captions = json.loads(cap_file.read_text(encoding="utf-8")) if cap_file.exists() else {}
        images = []
        for f in sorted(proj.iterdir()):
            if f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            out_name = f"{slug(f.stem + '.jpg')}"
            if f.stem == "cover":
                save_resized(f, dest_dir / out_name, 900)
                continue
            w, h = save_fitted(f, dest_dir / out_name, GALLERY_LONG_SIDE)
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

# Ambient video loops: assets/video/<name>.(mp4|mov|webm) → web mp4 (H.264) + webm (VP9) + poster,
# silent, capped at 1280px wide. "<name>-portrait" files become the mobile source of <name>.
import subprocess

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
            # Covers are square: generators only do 16:9 / 9:16, so centre-crop the square back out
            vf = "crop='min(iw,ih)':'min(iw,ih)',scale='min(1080,iw)':-2"
        elif "portrait" in name:
            vf = "scale=-2:'min(1280,ih)'"
        else:
            vf = "scale='min(1280,iw)':-2"
        base = ["-y", "-hide_banner", "-loglevel", "error", "-i", str(f), "-an", "-vf", f"{vf},fps=30"]
        mp4, webm, poster = video_out / f"{name}.mp4", video_out / f"{name}.webm", video_out / f"{name}.jpg"
        subprocess.run([ffmpeg, *base, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(mp4)], check=True)
        subprocess.run([ffmpeg, *base, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", str(webm)], check=True)
        subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(mp4), "-frames:v", "1",
                        "-q:v", "4", str(poster)], check=True)
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
