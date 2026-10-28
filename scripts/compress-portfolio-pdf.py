"""Re-compress the shipped Professional Portfolio PDF in public/media/portfolio."""

import shutil
import subprocess
import sys
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parent))
root = Path(__file__).resolve().parent.parent
dest = root / "public" / "media" / "portfolio" / "Krayaura-Professional-Portfolio.pdf"
src = dest
if len(sys.argv) > 1:
    src = Path(sys.argv[1])
if not src.exists():
    raise SystemExit(f"missing {src}")

tmp = dest.with_suffix(".tmp.pdf")
gs = shutil.which("gswin64c") or shutil.which("gswin32c") or shutil.which("gs")
before = dest.stat().st_size
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
            f"-sOutputFile={tmp}",
            str(src),
        ],
        check=True,
    )
else:
    doc = fitz.open(src)
    doc.save(tmp, garbage=4, deflate=True, clean=True)
    doc.close()
tmp.replace(dest)
after = dest.stat().st_size
print(f"{dest.relative_to(root)} {after // 1024}KB (was {before // 1024}KB)")
