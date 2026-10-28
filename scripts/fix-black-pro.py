"""
Black Pro's four .woff2 files declared OS/2 table version 5 but shipped a 96-byte (version 4) table.
Chrome's font sanitizer (OTS) rejected them. This relabeled the table as version 4.

Black Pro has been replaced by Poppins (`python scripts/build-fonts.py`). If those woff2 files
are gone, this script has nothing to do.
"""
import struct
from pathlib import Path

from fontTools.ttLib import TTFont, newTable

FONTS = Path(__file__).resolve().parent.parent / "src" / "fonts"
paths = sorted(FONTS.glob("black-pro-*.woff2"))
if not paths:
    raise SystemExit("No black-pro woff2 files. That face was replaced by Poppins; see scripts/build-fonts.py.")

for path in paths:
    font = TTFont(path, lazy=True)
    raw = bytearray(font.reader["OS/2"])
    version = struct.unpack(">H", raw[:2])[0]
    if version != 5 or len(raw) >= 100:
        print(f"{path.name}: OS/2 v{version}, {len(raw)} bytes, already fine")
        continue
    raw[0:2] = struct.pack(">H", 4)
    table = newTable("OS/2")
    table.decompile(bytes(raw), font)
    font["OS/2"] = table
    font.flavor = "woff2"
    font.save(path)
    print(f"{path.name}: OS/2 v5 (96 bytes) -> v4, rewritten")
