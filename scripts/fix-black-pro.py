"""
Black Pro's four .woff2 files declare OS/2 table version 5 but ship a 96-byte (version 4) table.
Chrome's font sanitizer (OTS) rejects them, so every "Black Pro" heading on the site silently
falls back to system-ui. This relabels the table as version 4 (no glyph or metric changes).
Run once:  python scripts/fix-black-pro.py      (needs: pip install fonttools brotli)
"""
import struct
from pathlib import Path

from fontTools.ttLib import TTFont, newTable

FONTS = Path(__file__).resolve().parent.parent / "src" / "fonts"

for path in sorted(FONTS.glob("black-pro-*.woff2")):
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
