"""Subset the replacement brand fonts into src/fonts.

Reads the TTFs in ``Updated fonts/`` and writes woff2:

  righteous-latin.woff2
  poppins-latin-400.woff2, -400-italic, -500, -700, -700-italic
  a-dripping-marker.woff2   (the word "M.I.A." only)

Righteous and Poppins are SIL OFL. A Dripping Marker is the freeware file
supplied with that folder (FontSpace); see src/fonts/README.md.

  python scripts/build-fonts.py
"""
from pathlib import Path

from fontTools.subset import Options, Subsetter, parse_unicodes
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
src = root / "Updated fonts"
out = root / "src" / "fonts"

# Google Fonts "latin" subset. Keeps English copy, digits, and common punctuation.
LATIN = parse_unicodes(
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
)
# The M.I.A. wordmark never uses another glyph.
MIA = parse_unicodes("U+002E,U+0041,U+0049,U+004D")

JOBS = [
    ("Righteous/Righteous-Regular.ttf", "righteous-latin.woff2", LATIN),
    ("Poppins/Poppins-Regular.ttf", "poppins-latin-400.woff2", LATIN),
    ("Poppins/Poppins-Italic.ttf", "poppins-latin-400-italic.woff2", LATIN),
    ("Poppins/Poppins-Medium.ttf", "poppins-latin-500.woff2", LATIN),
    ("Poppins/Poppins-Bold.ttf", "poppins-latin-700.woff2", LATIN),
    ("Poppins/Poppins-BoldItalic.ttf", "poppins-latin-700-italic.woff2", LATIN),
    ("a-dripping-marker-font/ADrippingMarker-Ddw1.ttf", "a-dripping-marker.woff2", MIA),
]

# Retired brand files. Source Sans 3 stays.
RETIRED = [
    "bolde-regular.woff2",
    "bolde-light.woff2",
    "bolde-italic.woff2",
    "bolde-bold.woff2",
    "bolde-hollow.woff2",
    "black-pro-regular.woff2",
    "black-pro-italic.woff2",
    "black-pro-bold.woff2",
    "black-pro-bold-italic.woff2",
    "mathew-rohas.woff2",
]


def subset(src_path: Path, dest: Path, unicodes) -> None:
    font = TTFont(src_path)
    options = Options()
    options.layout_features = ["*"]
    options.hinting = True
    options.desubroutinize = False
    options.flavor = "woff2"
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.flavor = "woff2"
    dest.parent.mkdir(parents=True, exist_ok=True)
    font.save(dest)
    print(dest.relative_to(root), f"{dest.stat().st_size // 1024}KB")


def main() -> None:
    for rel, name, unicodes in JOBS:
        subset(src / rel, out / name, unicodes)
    for name in RETIRED:
        path = out / name
        if path.exists():
            path.unlink()
            print("removed", path.relative_to(root))


if __name__ == "__main__":
    main()
