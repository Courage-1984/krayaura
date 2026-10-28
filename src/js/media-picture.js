/** AVIF → WebP → JPEG ``<picture>`` helpers (sibling files from scripts/lib/optimize_image.py). */

const stripExt = (url) => url.replace(/\.(avif|webp|jpe?g)$/i, "");

/**
 * @param {{ avif: string, webp: string, jpg: string, w?: number }} entry
 */
function srcsetEntry(entry) {
  const b = stripExt(entry.jpg);
  const w = entry.w ? ` ${entry.w}w` : "";
  return {
    avif: `${b}.avif${w}`,
    webp: `${b}.webp${w}`,
    jpg: `${b}.jpg${w}`,
  };
}

/** ``portfolio/professional/01.jpg`` → ``…/01-sm.jpg`` (720px sibling from optimize-public-rasters). */
export function thumbRel(relJpg) {
  return relJpg.replace(/(\.[^.]+)$/, "-sm$1");
}

/**
 * One logical image (single URL or width descriptors).
 * @param {string | { jpg: string, w?: number }[]} spec — full ``.jpg`` URL, or srcset entries
 */
export function pictureHTML(spec, opts = {}) {
  const {
    sizes = "",
    width,
    height,
    alt = "",
    loading = "lazy",
    decoding = "async",
    fetchpriority,
    className = "",
    draggable = "false",
    style = "",
    attrs = "",
    deferSrc = false,
  } = opts;

  const entries = typeof spec === "string" ? [{ jpg: spec }] : spec;
  const mapped = entries.map(srcsetEntry);
  const avif = mapped.map((e) => e.avif).join(", ");
  const webp = mapped.map((e) => e.webp).join(", ");
  const jpg = mapped.map((e) => e.jpg).join(", ");
  const primary = entries[entries.length - 1].jpg;

  const sizesAttr = sizes ? ` sizes="${sizes}"` : "";
  const fp = fetchpriority ? ` fetchpriority="${fetchpriority}"` : "";
  const cls = className ? ` class="${className}"` : "";
  const sty = style ? ` style="${style}"` : "";
  const srcAttr = deferSrc ? "data-src" : "src";
  const srcsetAttr = deferSrc ? "data-srcset" : "srcset";
  const deferMark = deferSrc ? ` data-defer-src="${primary}"` : "";

  return `<picture${deferMark}>
    <source type="image/avif" ${srcsetAttr}="${avif}"${sizesAttr} />
    <source type="image/webp" ${srcsetAttr}="${webp}"${sizesAttr} />
    <img ${srcAttr}="${primary}" ${srcsetAttr}="${jpg}"${sizesAttr} alt="${alt}" width="${width ?? ""}" height="${height ?? ""}" loading="${loading}" decoding="${decoding}"${fp}${cls}${sty} draggable="${draggable}"${attrs ? ` ${attrs}` : ""} />
  </picture>`;
}

/** Fill a ``data-defer-src`` picture so the browser can fetch it. */
export function hydratePicture(pic) {
  if (!pic || !pic.hasAttribute("data-defer-src")) return;
  pic.removeAttribute("data-defer-src");
  pic.querySelectorAll("source").forEach((s) => {
    if (s.dataset.srcset) {
      s.setAttribute("srcset", s.dataset.srcset);
      s.removeAttribute("data-srcset");
    }
  });
  const img = pic.querySelector("img");
  if (!img) return;
  if (img.dataset.srcset) {
    img.setAttribute("srcset", img.dataset.srcset);
    img.removeAttribute("data-srcset");
  }
  if (img.dataset.src) {
    img.setAttribute("src", img.dataset.src);
    img.removeAttribute("data-src");
  }
}

/** Release / crate cover: sm + full JPEG paths (same naming as content.js). */
export function coverPicture(coverJpg, coverSmJpg, opts = {}) {
  return pictureHTML(
    [
      { jpg: coverSmJpg, w: 480 },
      { jpg: coverJpg, w: 1200 },
    ],
    opts
  );
}

/** ``portfolio/professional/01.jpg`` → picture; ``src`` may be relative to MEDIA without origin. */
export function mediaPathPicture(mediaBase, relJpg, opts = {}) {
  const jpg = relJpg.startsWith("http") || relJpg.startsWith("/") ? relJpg : `${mediaBase}/${relJpg}`;
  if (opts.thumb) {
    const { thumb, fullW = 1400, thumbW = 720, ...rest } = opts;
    const sm = jpg.replace(/(\.[^.]+)$/, "-sm$1");
    return pictureHTML(
      [
        { jpg: sm, w: thumbW },
        { jpg, w: fullW },
      ],
      rest
    );
  }
  return pictureHTML(jpg, opts);
}

/** Replace a lone ``<img>`` with a ``<picture>`` (e.g. M.I.A. cover filled in by JS). */
export function installCoverPicture(img, coverJpg, coverSmJpg, opts = {}) {
  if (!img?.parentNode) return null;
  const tpl = document.createElement("template");
  tpl.innerHTML = coverPicture(coverJpg, coverSmJpg, opts).trim();
  const pic = tpl.content.firstElementChild;
  img.replaceWith(pic);
  return pic.querySelector("img");
}
