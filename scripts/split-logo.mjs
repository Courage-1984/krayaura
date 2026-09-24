/**
 * Splits public/logos/main-logo.svg (left untouched, it stays the source) into four <g> groups
 * (body / lever / back cassette / front cassette) plus the slot clip, and writes them as one hidden
 * sprite into index.html between the kr-sprite markers. Re-run after the logo changes:
 *   node scripts/split-logo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "public/logos/main-logo.svg";
const HTML = "index.html";
const lines = readFileSync(SRC, "utf8").split(/\r?\n/);
const line = (n) => lines[n - 1];

// Guard: the grouping below is by line number, so refuse to run on a different drawing
if (lines.length < 157 || !line(94).includes('d="M.14,417.76') || !line(149).trim().startsWith("<g>")) {
  throw new Error("main-logo.svg changed: re-check the line groups in scripts/split-logo.mjs");
}

// The logo's <style> would leak globally once inlined, so every class becomes attributes
const CLS = {
  "cls-1": 'fill="#3a9ced"',
  "cls-2": 'fill="#3a9ced" stroke="#04175b" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.08"',
  "cls-3": 'fill="#0b0b21"',
  "cls-4": 'fill="#103784"',
  "cls-5": 'fill="url(#kr-lg-2)"',
  "cls-6": 'opacity=".51"',
  "cls-7": 'fill="#0a0435"',
  "cls-8": 'fill="#fff"',
  "cls-9": 'fill="url(#kr-lg-4)"',
  "cls-10": 'fill="url(#kr-lg-3)"',
  "cls-11": 'fill="#04175b"',
  "cls-12": 'fill="#601306"',
  "cls-13": 'fill="#0b0b21"',
  "cls-14": 'fill="#2d3951"',
  "cls-15": 'fill="url(#kr-lg-1)"',
  "cls-16": 'fill="#f2b705"',
  "cls-17": 'fill="#f2b705" stroke="#103784" stroke-miterlimit="10" stroke-width="6"',
};
const conv = (s) => s.trim().replace(/class="(cls-\d+)"/g, (_, c) => CLS[c]);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => conv(line(a + i)));

const GROUPS = {
  // body, trim strokes, the "k", both slot lips, the lever track
  "kr-body": [...range(94, 97), ...range(99, 100), ...range(136, 148)],
  // the paddle only; it slides along the track
  "kr-lever": range(149, 156),
  "kr-slice-back": [...range(101, 104), ...range(106, 108), ...range(119, 123), ...range(128, 129)],
  "kr-slice-front": [conv(line(105)), ...range(109, 118), ...range(124, 127), ...range(130, 133)],
};

const DEFS = [
  '<linearGradient id="kr-lg-1" x1="199.4" y1="183.9" x2="403.51" y2="60.61" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0a0435"/><stop offset=".38" stop-color="#0b0535"/><stop offset=".51" stop-color="#0f0c39"/><stop offset=".61" stop-color="#17183f"/><stop offset=".69" stop-color="#222948"/><stop offset=".74" stop-color="#2d3951"/><stop offset="1" stop-color="#0a0435"/></linearGradient>',
  '<linearGradient id="kr-lg-2" x1="139.86" y1="46.61" x2="327.46" y2="46.61" href="#kr-lg-1"/>',
  '<linearGradient id="kr-lg-3" x1="261.3" y1="74.33" x2="398.79" y2="74.33" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0b0b21"/><stop offset="1" stop-color="#2d3951"/></linearGradient>',
  '<linearGradient id="kr-lg-4" x1="155.75" y1="39.33" x2="243.84" y2="39.33" href="#kr-lg-3"/>',
  // Everything above the slot lips stays visible; cassettes pushed below it vanish into the toaster
  '<clipPath id="kr-slot-clip" clipPathUnits="userSpaceOnUse"><path d="M-60-420H590V205L435 208 228 252 196 236 150 228 122 216H-60Z"/></clipPath>',
];

// NOT display:none: gradients + clipPaths referenced from a display:none SVG break in some engines
const sprite = [
  '<svg class="kr-sprite" width="0" height="0" aria-hidden="true" focusable="false">',
  "<defs>",
  ...DEFS,
  ...Object.entries(GROUPS).map(([id, parts]) => `<g id="${id}">${parts.join("")}</g>`),
  "</defs>",
  "</svg>",
].join("\n");

const html = readFileSync(HTML, "utf8");
const START = "<!-- kr-sprite:start -->";
const END = "<!-- kr-sprite:end -->";
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a < 0 || b < a) throw new Error(`Add ${START} … ${END} right after <body> in index.html`);
writeFileSync(HTML, html.slice(0, a + START.length) + "\n" + sprite + "\n    " + html.slice(b));
console.log(`kr-sprite: ${Buffer.byteLength(sprite)} bytes written into ${HTML}`);
