import gsap from "gsap";
import { onChange, levels, bands } from "./audio.js";

/**
 * One smoothed audio bus for every visual (hero toaster, shader, nav). A single gsap.ticker callback
 * reads the analyser once per frame while music plays (plus a short decay tail), smooths it with a
 * fast attack / slow release, and hands it to subscribers. When it's quiet, nothing runs.
 */
export const sig = { bass: 0, mid: 0, high: 0, energy: 0, eq: new Float32Array(4), live: false, lite: false, frozen: false };

const subs = new Set();
const eqRaw = new Float32Array(4);
const TAIL_MS = 700;
let playing = false;
let running = false;
let tail = 0;
let frames = 0;
let slowFrames = 0;

const follow = (cur, target, up, down) => cur + (target - cur) * (target > cur ? up : down);

function tick(_time, dtMs) {
  const l = playing ? levels() : null;
  if (playing) bands(4, eqRaw);
  else eqRaw.fill(0);
  sig.bass = follow(sig.bass, l ? l.bass : 0, 0.5, 0.08);
  sig.mid = follow(sig.mid, l ? l.mid : 0, 0.5, 0.08);
  sig.high = follow(sig.high, l ? l.high : 0, 0.5, 0.08);
  sig.energy = follow(sig.energy, l ? l.energy : 0, 0.5, 0.08);
  for (let i = 0; i < 4; i++) sig.eq[i] = follow(sig.eq[i], eqRaw[i], 0.6, 0.15);

  if (playing && !sig.frozen) watchFrameRate();
  subs.forEach((fn) => fn(sig, dtMs));
  if (!playing && (tail -= dtMs) <= 0) stop();
}

/**
 * Quality governor, two steps, once per session:
 *  lite   — 20 of 30 frames under ~37fps: shader at 0.6× and 30fps, no echo outline
 *  frozen — 4 frames in a row over 100ms: the shader stops drawing per frame altogether
 */
let stalls = 0;
function watchFrameRate() {
  const ratio = gsap.ticker.deltaRatio();
  stalls = ratio > 6 ? stalls + 1 : 0;
  if (stalls >= 4 && !sig.frozen) {
    sig.frozen = true;
    window.dispatchEvent(new Event("krayaura:frozen"));
  }
  frames++;
  if (ratio > 1.6) slowFrames++;
  if (frames < 30) return;
  if (slowFrames >= 20 && !sig.lite) {
    sig.lite = true;
    document.documentElement.classList.add("is-lite");
    window.dispatchEvent(new Event("krayaura:lite"));
  }
  frames = slowFrames = 0;
}

function start() {
  if (running) return;
  running = true;
  sig.live = true;
  gsap.ticker.add(tick);
}

function stop() {
  running = false;
  sig.live = false;
  gsap.ticker.remove(tick);
  sig.bass = sig.mid = sig.high = sig.energy = 0;
  sig.eq.fill(0);
  subs.forEach((fn) => fn(sig, 0)); // one last frame at rest
}

onChange(({ playing: p }) => {
  playing = p;
  if (p) {
    tail = TAIL_MS;
    start();
  }
});

/** fn(sig, dtMs) runs every frame while music plays, then once more at rest. Returns an unsubscribe. */
export function onSignal(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
