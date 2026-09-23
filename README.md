# Krayaura

Artist · Creative Director · Graphic Designer — dual music + design site.

## Stack

- Vite + vanilla HTML / CSS / JS
- Three.js (hero shader)
- GSAP + ScrollTrigger
- Lenis smooth scroll

## Develop

```bash
npm install
npm run dev
```

Local Vite uses `base: '/krayaura/'` for GitHub Pages — assets still load correctly in `npm run dev`.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

Repo: [Courage-1984/krayaura](https://github.com/Courage-1984/krayaura)

On push to `main`, [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds with Vite and deploys `dist/`.

After the first push, in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Site URL: `https://Courage-1984.github.io/krayaura/`

## Brand

- Colours: `assets/Colours-01.jpg` → CSS tokens in `src/styles/tokens.css`
- Fonts: Bolde (headings), Black Pro (subheadings), Proxima Nova (body)
  - Drop licensed `.woff2` into `public/fonts/` (see README there)
  - Until then: Clash Display / General Sans / Source Sans 3 stand-ins

## Content swaps

Edit [`src/js/content.js`](src/js/content.js) for tagline, bio, tracks, projects, socials, and booking link.

Placeholder copy is already written to fit Krayaura (nostalgia / fun / confidence, Pretoria, dual music + design). Swap it when you get revisions from him.

Quick checklist for Krayaura revisions:
1. Tagline + bio voice
2. Real Spotify/Apple track URLs (and optional YouTube `embedUrl`)
3. Design project covers → set `cover` paths on each project
4. Booking email (replace Instagram DM)
5. Drop Bolde / Black Pro / Proxima Nova into `public/fonts/` and uncomment `@font-face` in `src/styles/tokens.css`
