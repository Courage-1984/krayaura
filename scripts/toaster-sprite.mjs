/**
 * Builds the toaster sprite (hero stage, header brand, mobile drawer) from his two drawings:
 *   assets/logos/Toaster-01.svg   the empty toaster: body, slots, lever paddle
 *   assets/logos/Cassete-01.svg   one whole cassette, dropped into both slots
 * and writes it as one hidden <svg> between the kr-sprite markers in index.html (plus the viewBox of
 * every <svg> that draws from it). Re-run after either drawing changes:
 *   node scripts/toaster-sprite.mjs
 * It prints the numbers hero.css and toaster.js mirror (stage aspect, slot clips, pivots, lever).
 *
 * The cassettes are whole, so they can pop right out: each one stands in its slot and is clipped at
 * that slot's front lip, so everything below the lip is inside the toaster.
 */
import { readFileSync, writeFileSync } from "node:fs";

const TOASTER = "assets/logos/Toaster-01.svg";
const CASSETTE = "assets/logos/Cassete-01.svg";
const HTML = "index.html";

/* How the cassettes sit (toaster user units) */
const FILL = 0.95; // cassette width as a share of its slot's length
const REST = 120; // resting depth: how far below "standing on the slot" the cassette sits
const LEAN = 2.8; // his toaster's verticals lean: tops 2.8° to the left

/* ── Tiny SVG reader: top-level elements, class styles, path sampling ── */

const read = (f) => readFileSync(f, "utf8").replace(/\r\n?/g, "\n");

/** Top-level elements after </defs>, as raw strings */
function topLevel(svg) {
  const body = svg.slice(svg.indexOf("</defs>") + 7, svg.lastIndexOf("</svg>"));
  const out = [];
  let depth = 0;
  let start = 0;
  for (const m of body.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [tag, close, , self] = m;
    if (!close && depth === 0) start = m.index;
    if (close) depth--;
    else if (!self) depth++;
    if (depth === 0) out.push(body.slice(start, m.index + tag.length));
  }
  return out;
}

/** .cls-N { … } → { "cls-N": 'fill="…" …' } (so the inlined sprite carries no global <style>) */
function classAttrs(svg, ids) {
  const css = svg.match(/<style>([\s\S]*?)<\/style>/)[1];
  const map = {};
  for (const [, sel, decl] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const attrs = [...decl.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(
      ([, k, v]) => `${k}="${ids(v.trim().replace(/px$/, "").replace(/^\.(\d)/, "0.$1"))}"`
    );
    for (const c of sel.split(",").map((s) => s.trim().replace(/^\./, ""))) (map[c] ||= []).push(...attrs);
  }
  return (el) => el.replace(/class="(cls-\d+)"/g, (_, c) => map[c].join(" "));
}

const num = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** Points along a path (M L H V C S Z, absolute or relative): enough for extents and lip lines */
function samplePath(d, steps = 24) {
  const pts = [];
  let cur = [0, 0];
  let startPt = [0, 0];
  let lastCtrl = null;
  const cubic = (p0, p1, p2, p3) => {
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
    }
  };
  for (const [, cmd, args] of d.matchAll(/([MLHVCSZmlhvcsz])([^MLHVCSZmlhvcsz]*)/g)) {
    const n = (args.match(num) || []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    const at = (x, y) => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    const C = cmd.toUpperCase();
    if (C === "Z") {
      cur = startPt;
      pts.push(cur);
      lastCtrl = null;
      continue;
    }
    const size = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4 }[C];
    for (let i = 0; i < n.length; i += size) {
      const a = n.slice(i, i + size);
      if (C === "M" && i === 0) {
        cur = startPt = at(a[0], a[1]);
        pts.push(cur);
      } else if (C === "M" || C === "L") {
        cur = at(a[0], a[1]);
        pts.push(cur);
      } else if (C === "H") {
        cur = [rel ? cur[0] + a[0] : a[0], cur[1]];
        pts.push(cur);
      } else if (C === "V") {
        cur = [cur[0], rel ? cur[1] + a[0] : a[0]];
        pts.push(cur);
      } else {
        const c1 = C === "C" ? at(a[0], a[1]) : lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const c2 = C === "C" ? at(a[2], a[3]) : at(a[0], a[1]);
        const end = C === "C" ? at(a[4], a[5]) : at(a[2], a[3]);
        cubic(cur, c1, c2, end);
        lastCtrl = c2;
        cur = end;
        continue;
      }
      lastCtrl = null;
    }
  }
  return pts;
}

const pathPoints = (els) => els.flatMap((el) => [...el.matchAll(/ d="([^"]+)"/g)].flatMap(([, d]) => samplePath(d)));

/* ── 2D helpers ── */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (a) => mul(a, 1 / Math.hypot(a[0], a[1]));
const mid = (a, b) => mul(add(a, b), 0.5);
// 2×2 matrices column-major [a b c d] = columns (a,b), (c,d), like SVG matrix(a b c d e f)
const inv = ([a, b, c, d]) => {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det];
};
const mm = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3]];
const app = (m, p) => [m[0] * p[0] + m[2] * p[1], m[1] * p[0] + m[3] * p[1]];
const r2 = (v) => Math.round(v * 100) / 100;
const bbox = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/* ── The toaster: body + slots, and the paddle on its own so it can slide ── */
const toasterSvg = read(TOASTER);
const tAttrs = classAttrs(toasterSvg, (v) => v);
const tEls = topLevel(toasterSvg);
const isPaddle = (el) => el.includes('d="M223.65,506.46') || el.includes('d="M236.06,533.67');
const backSlot = tEls.find((el) => el.startsWith("<polygon") && el.includes('points="202.8 278.95'));
const frontSlot = tEls.find((el) => el.includes('d="M723.43,190.88s-309.28'));
if (tEls.filter(isPaddle).length !== 2 || !backSlot || !frontSlot) {
  throw new Error(`${TOASTER} changed: re-check the paddle and slot shapes in scripts/toaster-sprite.mjs`);
}

// Slot corners, back-left A → front-left B → front-right C → back-right D. The front lip B→C is where the
// slot's front edge hides a standing cassette's lower part.
const polyPts = (el) => {
  const n = el.match(/points="([^"]+)"/)[1].match(num).map(Number);
  return n.reduce((a, v, i) => (i % 2 ? (a[a.length - 1].push(v), a) : [...a, [v]]), []);
};
const [bA, bB, bC, bD] = polyPts(backSlot);
// front slot path: M C(723.43,190.88) → curve to B → l to A → l to D → back to C
const LIP_STEPS = 6;
const fPts = samplePath(frontSlot.match(/ d="([^"]+)"/)[1], LIP_STEPS);
const fLip = fPts.slice(0, LIP_STEPS + 1).reverse(); // the curve, B → C
const SLOTS = {
  back: { A: bA, B: bB, C: bC, D: bD, lip: [bB, bC] },
  front: { A: fPts[LIP_STEPS + 1], B: fLip[0], C: fLip[LIP_STEPS], D: fPts[LIP_STEPS + 2], lip: fLip },
};

/* ── The cassette: its face frame, from the label plate's edges ── */
const cassetteSvg = read(CASSETTE);
if (!cassetteSvg.includes('d="M347.56,753.58l-28.07-237.24')) {
  throw new Error(`${CASSETTE} changed: re-measure the label plate edges in scripts/toaster-sprite.mjs`);
}
const cIds = {};
[...cassetteSvg.matchAll(/id="(linear-gradient[^"]*)"/g)].forEach(([, id], i) => (cIds[id] = `kr-cg-${i + 1}`));
const renameIds = (s) => s.replace(/#(linear-gradient[-\d]*)(?=["')])/g, (_, id) => `#${cIds[id]}`);
const cAttrs = classAttrs(cassetteSvg, renameIds);
// every classed shape (one unclassed 1-unit speck in the file is an export stray)
const cEls = topLevel(cassetteSvg).filter((el) => /class="cls-/.test(el));
const cDefs = cassetteSvg
  .match(/<defs>([\s\S]*?)<\/defs>/)[1]
  .replace(/<style>[\s\S]*?<\/style>/, "")
  .replace(/id="(linear-gradient[^"]*)"/g, (_, id) => `id="${cIds[id]}"`)
  .replace(/xlink:href="([^"]*)"/g, (_, h) => `href="${renameIds(h + '"').slice(0, -1)}"`)
  .replace(/\s*\n\s*/g, "")
  .trim();
const U = unit(add(unit([420.77, -113.71]), unit([421.25, -139.39]))); // along the tape (plate top + bottom)
const V = unit(add(unit([-28.07, -237.24]), unit([-28.56, -211.56]))); // up its sides
const cPts = pathPoints(cEls);

const lean = (LEAN * Math.PI) / 180;
const UP = [-Math.sin(lean), -Math.cos(lean)]; // the toaster's "up"

/** Stand the cassette in a slot: its tape runs along the slot, its sides go up the toaster's verticals */
function seat(s) {
  const e1 = unit(sub(s.C, s.B));
  const O = mid(mid(s.A, s.B), mid(s.D, s.C)); // slot centre
  const len = Math.hypot(...sub(mid(s.D, s.C), mid(s.A, s.B)));
  let M = mm([e1[0], e1[1], UP[0], UP[1]], inv([U[0], U[1], V[0], V[1]]));
  const toFrame = inv([e1[0], e1[1], UP[0], UP[1]]); // → (along the slot, up)
  const ab = cPts.map((p) => app(toFrame, app(M, p)));
  const [aMin, bMin, aMax, bMax] = bbox(ab);
  const k = (FILL * len) / (aMax - aMin);
  M = M.map((v) => v * k);
  const t = add(O, add(mul(e1, (-(aMin + aMax) / 2) * k), mul(UP, -bMin * k - REST)));
  const placed = cPts.map((p) => add(app(M, p), t));
  return { M, t, O, e1, placed, height: (bMax - bMin) * k };
}
const seats = { back: seat(SLOTS.back), front: seat(SLOTS.front) };

/* ── Stage viewBox: the toaster with its cassettes at rest ── */
const tPts = pathPoints(tEls);
const [x0, y0, x1, y1] = bbox([...tPts, ...seats.back.placed, ...seats.front.placed]).map((v, i) => (i < 2 ? Math.floor(v) - 2 : Math.ceil(v) + 2));
const VB = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
const pct = ([x, y]) => [((x - VB.x) / VB.w) * 100, ((y - VB.y) / VB.h) * 100];

/** Everything above a slot's front lip (and above its left end) shows; the rest is inside the toaster */
function clipFor(s) {
  const e1 = unit(sub(s.C, s.B));
  const left = VB.x - VB.w * 0.15;
  const right = VB.x + VB.w * 1.15;
  const top = VB.y - VB.h;
  const back = unit(sub(s.A, s.B)); // up the slot's left end, extended
  const lEnd = add(s.A, mul(back, (left - s.A[0]) / back[0]));
  const rEnd = add(s.C, mul(e1, (right - s.C[0]) / e1[0]));
  return [[left, top], [right, top], rEnd, ...[...s.lip].reverse(), s.A, lEnd];
}
const clips = { back: clipFor(SLOTS.back), front: clipFor(SLOTS.front) };
const f1 = (v) => String(Math.round(v * 10) / 10);
const svgPoly = (pts) => pts.map((p) => p.map(f1).join(" ")).join(" ");

/* ── Sprite ── */
const body = tEls.filter((el) => !isPaddle(el)).map((el) => tAttrs(el.trim()));
const paddle = tEls.filter(isPaddle).map((el) => tAttrs(el.trim()));
const collapse = (s) => s.replace(/>\s+</g, "><");
const matrix = ({ M, t }) => [...M, ...t].map((v) => String(Math.round(v * 10000) / 10000)).join(" ");

// NOT display:none: gradients + clipPaths referenced from a display:none SVG break in some engines
const sprite = [
  '<svg class="kr-sprite" width="0" height="0" aria-hidden="true" focusable="false">',
  "<defs>",
  cDefs,
  `<clipPath id="kr-clip-back" clipPathUnits="userSpaceOnUse"><polygon points="${svgPoly(clips.back)}"/></clipPath>`,
  `<clipPath id="kr-clip-front" clipPathUnits="userSpaceOnUse"><polygon points="${svgPoly(clips.front)}"/></clipPath>`,
  `<g id="kr-body">${collapse(body.join(""))}</g>`,
  `<g id="kr-lever">${collapse(paddle.join(""))}</g>`,
  `<g id="kr-cassette">${collapse(cEls.map((el) => cAttrs(el.trim())).join(""))}</g>`,
  `<g id="kr-slice-back"><use href="#kr-cassette" transform="matrix(${matrix(seats.back)})"/></g>`,
  `<g id="kr-slice-front"><use href="#kr-cassette" transform="matrix(${matrix(seats.front)})"/></g>`,
  "</defs>",
  "</svg>",
].join("\n");

let html = read(HTML);
const START = "<!-- kr-sprite:start -->";
const END = "<!-- kr-sprite:end -->";
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a < 0 || b < a) throw new Error(`Add ${START} … ${END} right after <body> in index.html`);
html = html.slice(0, a + START.length) + "\n" + sprite + "\n    " + html.slice(b);
const viewBox = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
let n = 0;
html = html.replace(/(<svg class="(?:toaster__layer|brand-mark__toaster|nav-drawer__toaster)" viewBox=")[^"]*"/g, (_, pre) => (n++, `${pre}${viewBox}"`));
writeFileSync(HTML, html);

/* ── The numbers hero.css / toaster.js / header.css mirror ── */
const cssPoly = (pts) => pts.map((p) => pct(p).map((v) => `${f1(v)}%`).join(" ")).join(", ");
const origin = (s) => pct(s.O).map((v) => `${f1(v)}%`).join(" ");
const [px0, py0, px1, py1] = bbox(pathPoints(tEls.filter(isPaddle)));
const lowest = tPts.reduce((m, p) => (p[1] > m[1] ? p : m));
console.log(`kr-sprite: ${Buffer.byteLength(sprite)} bytes written into ${HTML}; viewBox "${viewBox}" on ${n} <svg>s
  hero.css  aspect-ratio: ${VB.w} / ${VB.h}
            .toaster__slot--back  clip-path: polygon(${cssPoly(clips.back)})
            .toaster__slot--front clip-path: polygon(${cssPoly(clips.front)})
            .toaster__slice--back  transform-origin: ${origin(seats.back)}
            .toaster__slice--front transform-origin: ${origin(seats.front)}
            lever paddle centre: ${pct([(px0 + px1) / 2, (py0 + py1) / 2]).map((v) => f1(v) + "%").join(" ")}
            lowest point (front corner): x ${f1(pct(lowest)[0])}%
  toaster.js VB_W = ${VB.w}, VB_H = ${VB.h}, SLOT_LEAN = ${r2(-Math.tan(lean))}
            cassette height: back ${f1(seats.back.height)}, front ${f1(seats.front.height)} (REST depth ${REST})`);
