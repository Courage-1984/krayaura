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

Vite uses `base: '/krayaura/'` for GitHub Pages; `npm run dev` serves at `http://localhost:5173/krayaura/`.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

Repo: [Courage-1984/krayaura](https://github.com/Courage-1984/krayaura)

On push to `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds with Vite and deploys `dist/`.
In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Site URL: `https://Courage-1984.github.io/krayaura/`

## Content pipeline

Everything in `public/media` and `src/data` is generated — edit the sources, then re-run:

| Script | Reads | Writes |
| --- | --- | --- |
| `python scripts/fetch-discography.py` | `assets/spotify_&_apple_music_links.md`, iTunes API, Spotify oEmbed | `src/data/discography.json`, missing covers → `assets/itunes_covers/` |
| `python scripts/copy-media.py` | `assets/new_images/`, `assets/itunes_covers/`, `assets/behance/`, channel art | resized `public/media/**`, `src/data/behance.json` |
| `python scripts/make-brand-assets.py` | logo, fonts, Crash cover | `public/favicon.*`, `public/icons/*`, `public/media/brand/share.jpg` |

New release out? Add its Spotify + Apple links to `assets/spotify_&_apple_music_links.md`, then run
`fetch-discography.py` and `copy-media.py`. The crate, timeline, tracklists and previews update themselves.

Behance: drop project images into `assets/behance/<project>/` (see the README there) and run `copy-media.py`.

Copy (tagline, bio, Crash write-up, videos, design projects, socials) lives in [`src/js/content.js`](src/js/content.js).

## Brand

- Colours: `assets/Colours-01.jpg` → tokens in `src/styles/tokens.css`, plus `--c-orange` sampled from his own artwork
- Fonts: Bolde (display) + Black Pro (sub-heads) bundled from `src/fonts/`; body in Source Sans 3
  - Proxima Nova isn't loaded — only DEMO files exist (parked in `assets/fonts/proxima-nova-demo/`, never deployed)

## Still to get from Krayaura

1. Booking email (currently Instagram DM)
2. Behance project images + descriptions (`assets/behance/`)
3. Real descriptions for the cover-art design entries in `content.js`
