// Share stubs: one tiny page per release at public/r/<id>/index.html (→ /krayaura/r/<id>/ once built), so
// a shared record's link preview (WhatsApp, Instagram DMs, X, Slack…) shows its own cover and title.
// A visitor is bounced straight to the site's #r/<id> deep link, which opens that record.
//
// Runs as the `prebuild` npm step (so also in the GitHub Pages deploy job). Output is generated: public/r/ is
// gitignored. No meta refresh: link-preview crawlers treat http-equiv="refresh" as a redirect to follow and
// would read the home page's tags instead. They don't run JS, so the JS redirect only moves real browsers;
// without JS there's a plain link.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://courage-1984.github.io/krayaura/"; // matches index.html's canonical / og:url
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "r");
const { releases } = JSON.parse(fs.readFileSync(path.join(root, "src", "data", "discography.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const month = (d) => new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

fs.rmSync(out, { recursive: true, force: true });

for (const r of releases) {
  if (!/^[\w-]+$/.test(r.id)) throw new Error(`release id not URL-safe: ${r.id}`);
  const url = `${SITE}r/${r.id}/`;
  const title = `${r.title} — Krayaura`;
  const features = [...new Set([...(r.features || []), ...r.tracks.flatMap((t) => t.features || [])])];
  const what = r.type === "album" ? `The album · ${r.trackCount} tracks` : "Single";
  const description = `${what}${features.length ? ` ft. ${features.join(" & ")}` : ""} · ${month(r.date)}. Hear a preview, then stream it on Spotify or Apple Music.`;
  const image = `${SITE}media/${r.cover}`; // covers/<file>.jpg, 1200×1200
  const target = `../../#r/${r.id}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta name="theme-color" content="#0B0B21" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Krayaura" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="1200" />
    <meta property="og:image:alt" content="${esc(`${r.title} cover art`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
    <script>location.replace(${JSON.stringify(target)});</script>
    <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b21;color:#efeddf;font:600 1rem/1.5 system-ui,sans-serif}a{color:#f2b705}</style>
  </head>
  <body>
    <p><a href="${esc(target)}">${esc(r.title)} on Krayaura →</a></p>
  </body>
</html>
`;
  fs.mkdirSync(path.join(out, r.id), { recursive: true });
  fs.writeFileSync(path.join(out, r.id, "index.html"), html);
}

console.log(`share stubs: ${releases.length} pages → public/r/`);
