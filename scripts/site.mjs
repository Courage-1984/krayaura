// One source of truth for dual-host builds.
// Default (pages): GitHub Pages at /krayaura/, noindex staging.
// SITE=live: Apache apex https://krayaura.co.za/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function siteFromEnv(env = process.env) {
  const live = env.SITE === "live";
  const origin = live ? "https://krayaura.co.za" : "https://courage-1984.github.io";
  const base = live ? "/" : "/krayaura/";
  const url = `${origin}${base}`;
  return {
    live,
    origin,
    base,
    url,
    noindex: !live,
    outDir: live ? "dist-live" : "dist",
  };
}

export function releases() {
  const discography = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "discography.json"), "utf8"));
  const mia = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "mia.json"), "utf8"));
  return [
    {
      id: "mia",
      title: "M.I.A.",
      type: "album",
      features: [],
      trackCount: mia.tracks.length,
      date: mia.date,
      cover: mia.cover,
      tracks: mia.tracks,
      upcoming: true,
    },
    ...discography.releases,
  ];
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function writeSiteFiles(site) {
  const pub = path.join(root, "public");
  fs.mkdirSync(pub, { recursive: true });

  const robots = site.noindex
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${site.url}sitemap.xml\n`;
  fs.writeFileSync(path.join(pub, "robots.txt"), robots);

  const locs = [site.url, ...releases().map((r) => `${site.url}r/${r.id}/`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((loc) => `  <url><loc>${esc(loc)}</loc></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(pub, "sitemap.xml"), sitemap);

  const home = esc(site.url);
  const robotsMeta = site.noindex
    ? '    <meta name="robots" content="noindex, nofollow" />\n'
    : '    <meta name="robots" content="noindex" />\n';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Not found — Krayaura</title>
${robotsMeta}    <link rel="canonical" href="${home}" />
    <meta name="theme-color" content="#0B0B21" />
    <style>
      html,body{margin:0;min-height:100vh;background:#0b0b21;color:#efeddf}
      body{display:grid;place-items:center;padding:2rem;font:600 1rem/1.5 system-ui,sans-serif;text-align:center}
      h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:.02em;margin:0 0 .6rem}
      p{margin:0 0 1rem;color:#d7d7d9}
      a{color:#f2b705}
      .brand{letter-spacing:.18em;text-transform:uppercase;font-size:.72rem;color:#f2b705;margin-bottom:1.2rem}
    </style>
  </head>
  <body>
    <main>
      <p class="brand">Krayaura</p>
      <h1>This page isn’t here</h1>
      <p>The link may be old. Head home and dig from there.</p>
      <p><a href="${home}">Back to Krayaura →</a></p>
    </main>
  </body>
</html>
`;
  fs.writeFileSync(path.join(pub, "404.html"), html);
}
