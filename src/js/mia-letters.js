import { onSignal } from "./signal.js";

/** "M.I.A." in running text → the brush wordmark (the client wants that word always in his M.I.A. font) */
export const markMia = (text) => String(text).replace(/M\.I\.A\.?/g, (m) => `<span class="mia-mark">${m}</span>`);

const GLYPHS = ["M", ".", "I", ".", "A", "."];

/** The wordmark as one span per glyph (aria-hidden: pair it with an sr-only "M.I.A." in the heading) */
export function miaLettersHTML(className = "mia-letters") {
  return `<span class="${className}" aria-hidden="true" data-mia-letters>${GLYPHS.map(
    (g, i) => `<span class="mia-ch${g === "." ? " mia-ch--dot" : ""}" style="--i:${i}">${g}</span>`
  ).join("")}</span>`;
}

/**
 * Makes the wordmark dance to whatever is playing. Every glyph reads its own slice of the audio bus (signal.js):
 * M rides the kick, the dots sparkle with the highs, I follows the mids, A rides the kick and the low-mids.
 * Only one custom property (--lit, 0..1) is written per glyph per frame; the CSS turns it into lift, scale and
 * colour (white-hot, a red edge on the loudest hits). Skipped off screen and with reduced motion.
 * @param {Element} root an element holding (or being) a [data-mia-letters] wordmark
 * @returns {() => void} stop
 */
export function initMiaLetters(root, { reducedMotion = false } = {}) {
  const wrap = root?.matches?.("[data-mia-letters]") ? root : root?.querySelector("[data-mia-letters]");
  if (!wrap) return () => {};
  const chars = [...wrap.children];
  if (reducedMotion) return () => {};

  let onScreen = true;
  const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { rootMargin: "100px 0px" });
  io.observe(wrap);

  const lit = new Float32Array(chars.length);
  const drive = (s) => [
    Math.min(1, s.kick * 0.9 + s.eq[0] * 0.45), // M
    Math.min(1, s.eq[3] * 1.1), // .
    Math.min(1, s.eq[1] * 1.1 + s.kick * 0.15), // I
    Math.min(1, s.eq[3] * 0.9 + s.eq[2] * 0.3), // .
    Math.min(1, s.kick * 0.75 + s.eq[2] * 0.6), // A
    Math.min(1, s.eq[2] * 0.9 + s.eq[3] * 0.3), // .
  ];

  const stop = onSignal((s) => {
    if (!onScreen && s.live) return;
    const target = drive(s);
    for (let i = 0; i < chars.length; i++) {
      // fast attack, slower release: snaps on the hit, settles like a brush stroke drying
      lit[i] += (target[i] - lit[i]) * (target[i] > lit[i] ? 0.7 : 0.18);
      // signal.js sends one last frame at rest (live=false) and then goes quiet: land exactly on zero
      if (lit[i] < 0.004 || !s.live) lit[i] = 0;
      chars[i].style.setProperty("--lit", lit[i].toFixed(3));
    }
  });
  return () => {
    stop();
    io.disconnect();
  };
}
