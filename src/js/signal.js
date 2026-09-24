import gsap from "gsap";
import { onChange, levels, bands } from "./audio.js";

/**
 * One smoothed audio bus for every visual (hero toaster, shader, nav). A single gsap.ticker callback
 * reads the analyser once per frame while music plays (plus a short decay tail), smooths it with a
 * fast attack / slow release, and hands it to subscribers. When it's quiet, nothing runs.
 */
/**
 * `kick` is the beat, not the loudness: how far the bass jumps above its own ~0.5s average, snapping
 * up on the onset and falling back within ~100ms. Level-driven motion sat pinned high on dense mixes
 * (bass rarely drops below ~0.35), so it read as static; the kick punches and relaxes on every beat.
 */
export const sig = { bass: 0, mid: 0, high: 0, energy: 0, kick: 0, eq: new Float32Array(4), live: false, lite: false, frozen: false };
let fluxAvg = 0;

const subs = new Set();
const eqRaw = new Float32Array(4);
const TAIL_MS = 700;
let playing = false;
let running = false;
let tail = 0;

const follow = (cur, target, up, down) => cur + (target - cur) * (target > cur ? up : down);

function tick(_time, dtMs) {
  const l = playing ? levels() : null;
  if (playing) bands(4, eqRaw);
  else eqRaw.fill(0);
  sig.bass = follow(sig.bass, l ? l.bass : 0, 0.5, 0.08);
  sig.mid = follow(sig.mid, l ? l.mid : 0, 0.5, 0.08);
  sig.high = follow(sig.high, l ? l.high : 0, 0.5, 0.08);
  sig.energy = follow(sig.energy, l ? l.energy : 0, 0.5, 0.08);
  // Beat: low-end rise this frame (flux) against its own running average, so quiet intros and
  // loud choruses both kick. Snaps up on the onset, falls back within ~150ms.
  const flux = l ? l.flux : 0;
  const k = Math.min(1, dtMs / 16.7); // frame-rate independent
  const onset = Math.min(1, Math.max(0, flux - fluxAvg * 1.4) / (fluxAvg * 2.2 + 0.012));
  fluxAvg += (flux - fluxAvg) * 0.04 * k;
  sig.kick = onset > sig.kick ? onset : sig.kick * Math.pow(0.84, k);
  for (let i = 0; i < 4; i++) sig.eq[i] = follow(sig.eq[i], eqRaw[i], 0.6, 0.15);

  if (playing) watchFrameRate(dtMs);
  subs.forEach((fn) => fn(sig, dtMs));
  if (!playing && (tail -= dtMs) <= 0) stop();
}

/**
 * Quality governor — judges SUSTAINED frame rate, never a hitch. Track starts (audio decode), tab
 * returns and track switches stall a frame or two on busy machines; the old per-frame rule tripped on
 * those and switched the rays + echo off for the rest of the visit.
 *  grace  — the first 2.5s after playback starts / the track changes / the tab returns are ignored
 *  lite   — two 3s windows in a row averaging < 30fps: shader at 0.6× resolution and 30fps
 *  frozen — still < 12fps over a 3s window once lite: the shader stops drawing per frame
 *  thaw   — frozen, then a 3s window > 40fps: the shader draws again
 */
const WINDOW_MS = 3000;
let grace = 2500;
let winMs = 0;
let winFrames = 0;
let slowWindows = 0;

function watchFrameRate(dtMs) {
  if (grace > 0) {
    grace -= dtMs;
    return;
  }
  winMs += dtMs;
  winFrames++;
  if (winMs < WINDOW_MS) return;
  const fps = (winFrames * 1000) / winMs;
  winMs = winFrames = 0;
  if (sig.frozen) {
    if (fps > 40) {
      sig.frozen = false;
      window.dispatchEvent(new Event("krayaura:thaw"));
    }
    return;
  }
  slowWindows = fps < 30 ? slowWindows + 1 : 0;
  if (slowWindows >= 2 && !sig.lite) {
    sig.lite = true;
    document.documentElement.classList.add("is-lite");
    window.dispatchEvent(new Event("krayaura:lite"));
  } else if (sig.lite && fps < 12) {
    sig.frozen = true;
    window.dispatchEvent(new Event("krayaura:frozen"));
  }
}

const resetGrace = () => {
  grace = 2500;
  winMs = winFrames = 0;
};
document.addEventListener("visibilitychange", resetGrace);

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
  sig.bass = sig.mid = sig.high = sig.energy = sig.kick = 0;
  fluxAvg = 0;
  sig.eq.fill(0);
  subs.forEach((fn) => fn(sig, 0)); // one last frame at rest
}

let lastKey = null;
onChange(({ playing: p, current }) => {
  if (p && (!playing || current?.key !== lastKey)) resetGrace(); // (re)start or a new track: decode hitch
  lastKey = current?.key ?? null;
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
