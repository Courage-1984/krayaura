"""Generate favicon set + social share card from the real brand assets.

Outputs (all in public/, so they're served at the site root under Vite's base):
  favicon.svg                     logo on a rounded orange tile (scales cleanly in tabs)
  favicon.ico                     16/32/48 fallback for old browsers
  icons/apple-touch-icon.png      180×180, full-bleed (iOS applies its own mask)
  icons/icon-192.png, icon-512.png, icon-maskable-512.png   for site.webmanifest
  media/brand/share.jpg           1200×630 Open Graph / Twitter card

Rendering uses headless Chrome (same fonts/images the site ships), post-processing uses Pillow.
Set CHROME_PATH if Chrome isn't in a standard location.

  python scripts/make-brand-assets.py
"""
import base64
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
pub = root / "public"
logo_svg = (pub / "logos" / "main-logo.svg").read_text(encoding="utf-8")

ORANGE = "#f26a1f"
VOID = "#0b0b21"
GOLD = "#f2b705"
CREAM = "#efeddf"
RED = "#ff1022"


def find_chrome():
    candidates = [
        os.environ.get("CHROME_PATH"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    raise SystemExit("Chrome not found — set CHROME_PATH")


CHROME = find_chrome()


def render(html: str, out: Path, w: int, h: int):
    """Screenshot an HTML string at w×h (transparent background)."""
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "page.html"
        page.write_text(html, encoding="utf-8")
        shot = Path(tmp) / "shot.png"
        subprocess.run(
            [
                CHROME,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                "--default-background-color=00000000",
                f"--user-data-dir={Path(tmp) / 'profile'}",
                f"--window-size={w},{h}",
                "--virtual-time-budget=4000",
                f"--screenshot={shot}",
                page.as_uri(),
            ],
            check=True,
            timeout=90,
            capture_output=True,
        )
        Image.open(shot).convert("RGBA").crop((0, 0, w, h)).save(out)


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


# ── Favicon SVG: the real logo nested on a rounded brand tile ───────────────────
inner = re.sub(r"<\?xml[^>]*\?>", "", logo_svg).strip()
view_box = re.search(r'viewBox="([^"]+)"', inner).group(1)
inner = re.sub(r"<svg\b[^>]*>", f'<svg x="5" y="6" width="54" height="53" viewBox="{view_box}">', inner, count=1)
favicon = (
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64">'
    f'<rect width="64" height="64" rx="15" fill="{ORANGE}"/>'
    f"{inner}</svg>\n"
)
(pub / "favicon.svg").write_text(favicon, encoding="utf-8")
print("public/favicon.svg")

# ── Raster icons ────────────────────────────────────────────────────────────────
icons = pub / "icons"
icons.mkdir(exist_ok=True)
logo_uri = data_uri(pub / "logos" / "main-logo.svg", "image/svg+xml")


def tile_html(size, radius, logo_pct):
    return f"""<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:transparent">
<div style="width:{size}px;height:{size}px;border-radius:{radius}px;background:{ORANGE};display:grid;place-items:center;
            background-image:radial-gradient(circle at 30% 25%, rgba(255,255,255,.18), transparent 55%)">
  <img src="{logo_uri}" style="width:{logo_pct}%;height:auto;filter:drop-shadow({size*0.012}px {size*0.018}px 0 rgba(11,11,33,.55))">
</div></body></html>"""


with tempfile.TemporaryDirectory() as tmp:
    rounded = Path(tmp) / "rounded.png"
    full = Path(tmp) / "full.png"
    maskable = Path(tmp) / "maskable.png"
    render(tile_html(512, 120, 86), rounded, 512, 512)
    render(tile_html(512, 0, 80), full, 512, 512)
    render(tile_html(512, 0, 64), maskable, 512, 512)  # logo inside the 80% safe zone

    r = Image.open(rounded)
    r.resize((192, 192), Image.LANCZOS).save(icons / "icon-192.png", optimize=True)
    r.save(icons / "icon-512.png", optimize=True)
    r.save(pub / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    Image.open(full).convert("RGB").resize((180, 180), Image.LANCZOS).save(icons / "apple-touch-icon.png", optimize=True)
    Image.open(maskable).convert("RGB").save(icons / "icon-maskable-512.png", optimize=True)
print("public/favicon.ico, public/icons/*")

# ── Social share card 1200×630 ──────────────────────────────────────────────────
fonts = root / "src" / "fonts"
bolde = data_uri(fonts / "bolde-bold.woff2", "font/woff2")
black = data_uri(fonts / "black-pro-bold.woff2", "font/woff2")
cover = data_uri(pub / "media" / "covers" / "crash.jpg", "image/jpeg")

share_html = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: Bolde; src: url({bolde}) format("woff2"); font-weight: 700; }}
@font-face {{ font-family: BlackPro; src: url({black}) format("woff2"); font-weight: 700; }}
* {{ margin:0; box-sizing:border-box; }}
body {{ width:1200px; height:630px; overflow:hidden; background:{VOID}; color:{CREAM}; font-family:BlackPro, sans-serif; }}
.card {{ position:relative; width:1200px; height:630px; overflow:hidden;
  background:
    radial-gradient(circle at 18% 55%, rgba(242,106,31,.38), transparent 42%),
    radial-gradient(circle at 92% 8%, rgba(255,16,34,.22), transparent 38%),
    linear-gradient(160deg, #0a0435, {VOID} 60%); }}
.dots {{ position:absolute; inset:0; background-image:radial-gradient(circle, rgba(242,106,31,.55) 1.4px, transparent 2px);
  background-size:12px 12px; -webkit-mask-image:radial-gradient(ellipse 45% 60% at 88% 78%, #000, transparent 70%); opacity:.6; }}
.loops {{ position:absolute; left:-40px; right:-40px; bottom:-30px; opacity:.5; }}
.cover {{ position:absolute; left:70px; top:95px; width:440px; height:440px; border-radius:30px; overflow:hidden;
  transform:rotate(-6deg); box-shadow:16px 16px 0 {ORANGE}, 0 40px 80px rgba(0,0,0,.55); }}
.cover img {{ width:100%; height:100%; object-fit:cover; display:block; }}
.sticker {{ position:absolute; left:400px; top:70px; transform:rotate(12deg); background:{RED}; color:{CREAM};
  padding:12px 22px; border-radius:999px; font-size:22px; letter-spacing:.14em; text-transform:uppercase; box-shadow:5px 5px 0 {VOID}; }}
.copy {{ position:absolute; left:590px; right:56px; top:88px; }}
.logo {{ width:92px; height:auto; filter:drop-shadow(5px 5px 0 {ORANGE}); }}
.word {{ font-family:Bolde; font-size:138px; line-height:.82; text-transform:uppercase; letter-spacing:-.02em; margin-top:18px; }}
.under {{ display:block; width:420px; height:30px; margin-top:6px; }}
.kick {{ display:inline-block; margin-top:26px; background:{GOLD}; color:{VOID}; padding:12px 20px; border-radius:999px;
  font-size:22px; letter-spacing:.14em; text-transform:uppercase; white-space:nowrap; box-shadow:5px 5px 0 {ORANGE}; }}
.roles {{ margin-top:24px; font-size:17px; letter-spacing:.16em; white-space:nowrap; text-transform:uppercase; color:rgba(239,237,223,.72); }}
</style></head><body><div class="card">
  <div class="dots"></div>
  <svg class="loops" viewBox="0 0 800 220" fill="none"><path d="M-10 150C60 40 150 20 190 90s-30 120-70 60 40-130 150-110 140 120 230 70 60-140 150-110 110 90 170 40"
    stroke="{ORANGE}" stroke-width="3" stroke-linecap="round"/></svg>
  <div class="cover"><img src="{cover}"></div>
  <div class="sticker">Out now</div>
  <div class="copy">
    <img class="logo" src="{logo_uri}">
    <div class="word">Krayaura</div>
    <svg class="under" viewBox="0 0 240 30" fill="none" preserveAspectRatio="none">
      <path d="M5 17c38-9 88-11 130-7 30 3 63 2 100-5" stroke="{ORANGE}" stroke-width="6" stroke-linecap="round"/>
      <path d="M28 24c48-6 106-7 168-3" stroke="{GOLD}" stroke-width="4" stroke-linecap="round"/></svg>
    <div class="kick">Crash · the album</div>
    <div class="roles">Artist · Creative Director · Designer</div>
  </div>
</div></body></html>"""

brand = pub / "media" / "brand"
brand.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    png = Path(tmp) / "share.png"
    render(share_html, png, 1200, 630)
    Image.open(png).convert("RGB").save(brand / "share.jpg", quality=88, optimize=True, progressive=True)
print("public/media/brand/share.jpg", (brand / "share.jpg").stat().st_size // 1024, "KB")
