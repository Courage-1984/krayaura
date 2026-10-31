# Krayaura

Artist · Creative Director · Graphic Designer — a sound-first music + design site.

## Stack

- Vite + vanilla HTML / CSS / JS (no framework)
- Raw WebGL hero shader that reacts to the music (`src/js/hero-webgl.js`)
- Web Audio preview engine + analyser (`src/js/audio.js`) — 30s iTunes previews, never autoplays
- GSAP + ScrollTrigger (Crash scroll story, reveals, doodles), Lenis smooth scroll

## Develop

```bash
npm install
npm run dev
```

`npm run dev` is the GitHub Pages-shaped site at `http://localhost:5173/krayaura/`.

## Build (two hosts, one codebase)

```bash
npm run build          # GitHub Pages → dist/  (https://courage-1984.github.io/krayaura/, noindex)
npm run preview
npm run build:live     # krayaura.co.za → dist-live/  (apex, indexable)
npm run preview:live   # preview dist-live on http://localhost:4178/
```

Upload **the contents of `dist-live/`** into the server’s `public_html` folder — not the repo root, not `node_modules`, not `Krayaura Website Update/`. Drop the files so `index.html` sits at `public_html/index.html`.

## GitHub Pages (staging)

Repo: [Courage-1984/krayaura](https://github.com/Courage-1984/krayaura)

On push to `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs `npm run build` and deploys `dist/`.
In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Staging URL: `https://courage-1984.github.io/krayaura/` — `noindex, nofollow`. Keep it as the working preview until you cut over.

The same workflow also runs `npm run build:live` and uploads an `apache-public_html` artifact (the `dist-live/` folder). Download that zip on launch day if you would rather not build locally.

## Launch on krayaura.co.za

Manual work this repo cannot do for you:

1. DNS: point the apex (and `www`) at the Apache host (A / AAAA). `www.krayaura.co.za` 301s to `https://krayaura.co.za` via `public/.htaccess`.
2. Let’s Encrypt (or the host’s SSL) so HTTPS is on before you send traffic.
3. Confirm the phone and email in [`src/js/content.js`](src/js/content.js) with him — those stay as they are until he says otherwise.
4. Do not ship DEMO fonts. Righteous and Poppins (the heading and subhead faces) are SIL Open Font License. A Dripping Marker, used only for the word "M.I.A.", is the freeware file in `Updated fonts/` — FontSpace lists it as royalty-free, and there is no separate licence document.

Launch checklist:

1. `npm run build:live` (or download `apache-public_html` from the latest Actions run).
2. Upload the **contents** of `dist-live/` to `public_html`.
3. Confirm HTTPS, then that `https://www.krayaura.co.za` redirects to the apex.
4. Click Listen, open a crate record, and share `/r/crash/` (WhatsApp / iMessage preview).
5. Run PageSpeed Insights against `https://krayaura.co.za/`.

## Content pipeline

Everything in `public/media` and `src/data` is generated — edit the sources, then re-run:

| Script | Reads | Writes |
| --- | --- | --- |
| `python scripts/fetch-discography.py` | `assets/spotify_&_apple_music_links.md`, iTunes API, Spotify oEmbed | `src/data/discography.json`, missing covers → `assets/itunes_covers/` |
| `python scripts/copy-media.py` | `assets/new_images/`, `assets/itunes_covers/`, `assets/behance/`, channel art | resized `public/media/**`, `src/data/behance.json` |
| `python scripts/make-brand-assets.py` | logo, fonts, Crash cover | `public/favicon.*`, `public/icons/*`, `public/media/brand/share.jpg` |
| `node scripts/toaster-sprite.mjs` | `assets/logos/Toaster-01.svg`, `assets/logos/Cassete-01.svg` | the toaster sprite + its viewBoxes in `index.html` (hero, header, menu); prints the slot clips / pivots `hero.css` and `toaster.js` mirror |
| `python scripts/build-fonts.py` | `Updated fonts/` (Righteous, Poppins, A Dripping Marker) | `src/fonts/*.woff2` (brand faces; Source Sans 3 is already there) |
| `python scripts/build-update-assets.py` | the git-ignored `Krayaura Website Update/` folder (M.I.A. cover, tracklist, MP3s, About photos, Professional Portfolio PDF) | `public/media/mia/**` (cover, 30s clips), `public/media/about/**`, `public/media/portfolio/**` (page images + PDF), `src/data/mia.json`, `src/data/portfolio.json`, `share-mia.jpg` |
| `node scripts/build-share-stubs.mjs` | `src/data/*.json` + `scripts/site.mjs` | per-release link-preview stubs (runs as part of `npm run build` / `build:live`) |

The M.I.A. album (due 6 Nov 2026) is driven by `src/data/mia.json`: the hero, Albums block, crate, timeline and mini player all read it.
To make it a normal release later, add album URLs to `miaStreaming` in [`src/js/content.js`](src/js/content.js) (and the discography pipeline if you prefer). Drop the “Out …” pill when it’s fully live.

Launch week: paste new YouTube IDs at the **top** of the `videos` array in `content.js` when a music video drops. Update `miaStreaming.spotify`, `.apple`, `.youtubeMusic`, and optional `.presave` as links arrive, then `npm run build:live`.

New release out? Add its Spotify + Apple links to `assets/spotify_&_apple_music_links.md`, then run
`fetch-discography.py` and `copy-media.py`. The crate, timeline, tracklists and previews update themselves.

Behance: drop project images into `assets/behance/<project>/` (see the README there) and run `copy-media.py`.

Copy (tagline, bio, Crash write-up, videos, design projects, contact details, socials) lives in [`src/js/content.js`](src/js/content.js).

## Media optimization

Raster builds go through [`scripts/lib/optimize_image.py`](scripts/lib/optimize_image.py): each JPEG gets sibling **WebP** and **AVIF** files (~80–90% perceptual quality). The site serves them with `<picture>` via [`src/js/media-picture.js`](src/js/media-picture.js). Open Graph tags stay on JPEG.

```bash
pip install -r scripts/requirements-media.txt
npm run assets:report              # bytes + heavy files under public/ and dist/assets
npm run assets:optimize-rasters    # re-encode existing public/media JPEGs (+ WebP/AVIF)
python scripts/copy-media.py       # after changing assets/behance or covers
python scripts/build-update-assets.py   # M.I.A. pack (needs git-ignored client folder)
```

Ghostscript (`gswin64c` on Windows) shrinks the Professional Portfolio PDF at build time; without it, PyMuPDF deflate is used instead.

## Brand

- Colours: `assets/Colours-01.jpg` → tokens in `src/styles/tokens.css`, plus `--c-orange` sampled from his own artwork
- Fonts: Righteous (display) + Poppins (sub-heads) + A Dripping Marker (the word "M.I.A.") bundled from `src/fonts/`; body in Source Sans 3. Rebuild with `python scripts/build-fonts.py`.
  - Proxima Nova isn't loaded — only DEMO files exist (parked in `assets/fonts/proxima-nova-demo/`, never deployed)
  - Righteous and Poppins are SIL OFL. A Dripping Marker is the freeware file supplied in `Updated fonts/`; its commercial-embedding terms were not independently confirmed. See `src/fonts/README.md`.

## Still to get from Krayaura

1. Behance project images + descriptions (`assets/behance/`)
2. M.I.A. streaming links once the album is live
