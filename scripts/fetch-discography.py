"""Snapshot Krayaura's discography into src/data/discography.json.

Sources:
  - assets/spotify_&_apple_music_links.md  → which releases exist + Spotify/Apple deep links
  - Spotify oEmbed                          → names for the Spotify IDs in that file
  - iTunes lookup API                       → dates, track lists, 30s preview clips, artwork

Covers: local originals in assets/new_images/covers win; anything missing is downloaded
from iTunes artwork into assets/itunes_covers/ (run copy-media.py afterwards to resize).

Re-run whenever a new release drops:  python scripts/fetch-discography.py && python scripts/copy-media.py
"""
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parent.parent
links_md = root / "assets" / "spotify_&_apple_music_links.md"
out = root / "src" / "data" / "discography.json"
itunes_covers = root / "assets" / "itunes_covers"
local_covers = root / "assets" / "new_images" / "covers"

ARTIST_ID = 1588929160
UA = {"User-Agent": "Mozilla/5.0"}

# Local original filenames that don't match the release slug
COVER_ALIASES = {
    "wrote-me-a-letter": "she-wrote-me-a-letter",
    "stealing-this-show": "stealing",
}


def fetch(url, tries=4):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except OSError:
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def get_json(url):
    return json.loads(fetch(url))


def norm(name: str) -> str:
    """'B.O.M.B (feat. iloh vas) - Single' → 'bomb'"""
    s = re.sub(r"\s*\((feat|ft)\.?[^)]*\)", "", name, flags=re.I)
    s = re.sub(r"\s*-\s*(single|ep)$", "", s, flags=re.I)
    s = s.lower().replace("'", "").replace("’", "").replace(".", "")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def slug(name: str) -> str:
    return norm(name).replace(" ", "-")


def split_title(name: str):
    """'No Calls (feat. Dioscuri & iloh vas) - Single' → ('No Calls', ['Dioscuri', 'iloh vas'])"""
    base = re.sub(r"\s*-\s*(Single|EP)$", "", name)
    m = re.search(r"\s*\((?:feat|ft)\.?\s*([^)]*)\)", base, flags=re.I)
    features = [f.strip() for f in re.split(r",|&", m.group(1))] if m else []
    title = re.sub(r"\s*\((?:feat|ft)\.?[^)]*\)", "", base, flags=re.I).strip()
    return title, [f for f in features if f]


def local_cover_for(rid):
    for stem in (rid, COVER_ALIASES.get(rid, "")):
        if not stem:
            continue
        for f in local_covers.glob("*"):
            if slug(f.stem) == stem:
                return stem
    return None


# --- 1. Parse the links file -------------------------------------------------
text = links_md.read_text(encoding="utf-8")
spotify_popular = re.findall(r"open\.spotify\.com/track/([A-Za-z0-9]{22})", text)
spotify_albums = re.findall(r"open\.spotify\.com/album/([A-Za-z0-9]{22})", text)
apple_albums = [int(i) for i in re.findall(r"music\.apple\.com/us/album/[a-z0-9\-]+/(\d+)", text)]


def spotify_name(kind, sid):
    d = get_json(f"https://open.spotify.com/oembed?url=https://open.spotify.com/{kind}/{sid}")
    return d["title"]


spotify_by_norm = {norm(spotify_name("album", sid)): f"https://open.spotify.com/album/{sid}" for sid in spotify_albums}
popular = [
    {"title": spotify_name("track", sid), "spotify": f"https://open.spotify.com/track/{sid}"}
    for sid in spotify_popular
]
popular_norms = [norm(p["title"]) for p in popular]

# --- 2. iTunes catalogue -----------------------------------------------------
albums = {
    r["collectionId"]: r
    for r in get_json(f"https://itunes.apple.com/lookup?id={ARTIST_ID}&entity=album&limit=200")["results"]
    if r.get("wrapperType") == "collection"
}
songs = [
    r
    for r in get_json(f"https://itunes.apple.com/lookup?id={ARTIST_ID}&entity=song&limit=200")["results"]
    if r.get("wrapperType") == "track"
]

releases = []
itunes_covers.mkdir(parents=True, exist_ok=True)

for cid in apple_albums:
    a = albums.get(cid)
    if not a:
        a = get_json(f"https://itunes.apple.com/lookup?id={cid}")["results"][0]
    title, features = split_title(a["collectionName"])
    rid = slug(title)
    is_album = a.get("trackCount", 1) > 1

    tracks = sorted(
        (s for s in songs if s.get("collectionId") == cid),
        key=lambda s: (s.get("discNumber", 1), s.get("trackNumber", 0)),
    )
    track_list = []
    for s in tracks:
        t_title, t_feat = split_title(s["trackName"])
        track_list.append(
            {
                "n": s.get("trackNumber"),
                "title": t_title,
                "features": t_feat,
                "preview": s.get("previewUrl"),
                "apple": s.get("trackViewUrl", "").split("?")[0],
                "durationMs": s.get("trackTimeMillis"),
                "popular": norm(t_title) in popular_norms,
            }
        )

    cover_stem = local_cover_for(rid)
    if not cover_stem:
        art = a.get("artworkUrl100", "").replace("100x100bb", "1200x1200bb")
        if art:
            dest = itunes_covers / f"{rid}.jpg"
            if not dest.exists():
                dest.write_bytes(fetch(art))
                print("downloaded cover", dest.name)
            cover_stem = rid

    date = a["releaseDate"][:10]
    releases.append(
        {
            "id": rid,
            "title": title,
            "features": features,
            "type": "album" if is_album else "single",
            "date": date,
            "year": int(date[:4]),
            "trackCount": a.get("trackCount", len(track_list)),
            "apple": f"https://music.apple.com/us/album/{slug(a['collectionName'])}/{cid}",
            "spotify": spotify_by_norm.get(norm(title)),
            "cover": f"covers/{cover_stem}.jpg" if cover_stem else None,
            "popular": norm(title) in popular_norms,
            "tracks": track_list,
        }
    )

releases.sort(key=lambda r: r["date"], reverse=True)

# Popular tracks → the release + preview they live on (prefer the single over the album cut)
for p in popular:
    n = norm(p["title"])
    home = next((r for r in releases if r["type"] == "single" and norm(r["title"]) == n), None)
    home = home or next((r for r in releases if any(norm(t["title"]) == n for t in r["tracks"])), None)
    p["release"] = home["id"] if home else None
    t = next((t for t in (home or {}).get("tracks", []) if norm(t["title"]) == n), None)
    p["preview"] = t["preview"] if t else None

data = {
    "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "artist": {
        "spotify": "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu",
        "apple": f"https://music.apple.com/us/artist/krayaura/{ARTIST_ID}",
    },
    "releases": releases,
    "popular": popular,
}

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

missing = [r["title"] for r in releases if not r["spotify"]]
print(f"wrote {out.relative_to(root)}: {len(releases)} releases, {len(popular)} popular")
if missing:
    print("WARNING no Spotify match:", missing)
