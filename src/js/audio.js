/**
 * One shared preview player for the whole site (30s iTunes previews, CORS-enabled).
 * Audio → GainNode (crossfades) → AnalyserNode → speakers; levels()/bands() feed the visuals.
 * Nothing autoplays: the first play() always comes from a click.
 *
 * Queue: a [data-play-key] button with data-queue="<release id>|crate" starts a run. When a preview
 * ends, the next key plays on the SAME element (so iOS keeps the original click's permission) with
 * the usual 0.35s fade-in; when the run (or a lone single) runs out, `finished` flips on.
 */

const listeners = new Set();
const registry = new Map(); // key → Playable (see content.js)

let el = null;
let ctx = null;
let gain = null;
let analyser = null;
let freq = null;
let current = null;
let unlocked = false;
let switching = 0;
let buffering = false; // play() called, no audio coming out yet ('waiting' until 'playing')
let failed = false; // the preview errored or play() was refused
let queue = []; // registry keys in play order (empty = no run)
let qi = -1; // index of `current` in the queue
let queueRelease = null; // the release id when every queued key is from one release
let finished = false; // the last preview ran out and nothing was queued after it
let finishedRelease = null; // …and it was the end of a whole-release run ("Full album")

const ZERO = Object.freeze({ bass: 0, mid: 0, high: 0, energy: 0 });

function queueInfo() {
  return { index: qi, length: queue.length, nextKey: queue[qi + 1] ?? null, releaseId: queueRelease };
}

function snapshot() {
  return { current, playing: isPlaying(), buffering, failed, finished, finishedRelease, queue: queueInfo() };
}

function emit() {
  const s = snapshot();
  listeners.forEach((cb) => cb(s));
  syncButtons(s);
  syncMediaSession();
}

/** Forget the run without emitting (callers emit right after) */
function dropQueue() {
  queue = [];
  qi = -1;
  queueRelease = null;
}

function isPlaying() {
  return !!el && !el.paused && !el.ended;
}

function ensureElement() {
  if (el) return;
  el = new Audio();
  el.crossOrigin = "anonymous"; // required for the analyser to read CORS audio
  el.preload = "auto";
  el.addEventListener("play", emit);
  // A src swap can queue a stale 'pause' after the next play() — only trust it if we're really paused
  el.addEventListener("pause", () => {
    if (el.paused || el.ended) buffering = false;
    emit();
  });
  // Nothing is playing any more, so no crossfade: the next preview's 0.35s fade-in is the transition
  el.addEventListener("ended", () => {
    buffering = false;
    const next = registry.get(queue[qi + 1]);
    if (next) {
      play(next);
      return;
    }
    finished = true;
    finishedRelease = queue.length ? queueRelease : null;
    dropQueue();
    emit();
  });
  ["timeupdate", "durationchange", "ratechange"].forEach((t) => el.addEventListener(t, syncPosition));
  el.addEventListener("waiting", () => {
    buffering = true;
    emit();
  });
  el.addEventListener("playing", () => {
    buffering = false;
    failed = false;
    emit();
  });
  el.addEventListener("error", () => {
    console.warn("[audio] preview failed to load", current?.preview);
    buffering = false;
    failed = true;
    emit();
  });
  initMediaSession();
}

function ensureGraph() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    const source = ctx.createMediaElementSource(el);
    gain = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(gain).connect(analyser).connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
  } catch (err) {
    console.warn("[audio] Web Audio unavailable — playback without visuals", err);
    ctx = null;
  }
}

function ramp(to, seconds) {
  if (!gain || !ctx) return Promise.resolve();
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + seconds);
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

export async function play(playable) {
  if (!playable?.preview) return;
  ensureElement();
  ensureGraph();
  unlocked = true;
  if (ctx?.state === "suspended") ctx.resume();

  if (current?.key === playable.key) {
    if (isPlaying() && !failed) el.pause();
    else {
      if (failed) el.load(); // "Try again": re-fetch a preview that errored
      buffering = true;
      failed = false;
      finished = false;
      finishedRelease = null;
      emit();
      el.play().catch(() => {
        buffering = false;
        emit();
      });
    }
    return;
  }

  // A run only survives moves along itself (step, 'ended', a queued button); anything else ends it
  const at = queue.indexOf(playable.key);
  if (at < 0) dropQueue();
  else qi = at;
  finished = false;
  finishedRelease = null;

  const token = ++switching;
  if (isPlaying()) await ramp(0, 0.18);
  if (token !== switching) return; // a newer play() won

  current = playable;
  buffering = true;
  failed = false;
  el.src = playable.preview;
  if (gain) gain.gain.value = 0;
  window.dispatchEvent(new CustomEvent("krayaura:audio-play", { detail: playable }));
  emit();
  try {
    await el.play();
    ramp(1, 0.35);
  } catch {
    if (token !== switching) return; // superseded by a newer play(): its state wins
    buffering = false;
    emit();
  }
}

/**
 * Play `keys` in order from `startKey` (default: the first). Pressing the button of the track that is
 * already up toggles it, like any play button, and adopts the run. Fewer than 2 playable keys = no run.
 */
export function playQueue(keys, startKey) {
  const list = [...new Set(keys)].filter((k) => registry.has(k));
  const start = list.includes(startKey) ? startKey : list[0];
  if (!start) return;
  if (list.length < 2) dropQueue();
  else {
    queue = list;
    qi = list.indexOf(start);
    const ids = new Set(list.map((k) => k.split(":")[0]));
    queueRelease = ids.size === 1 ? [...ids][0] : null;
  }
  play(registry.get(start));
}

export function clearQueue() {
  if (!queue.length) return;
  dropQueue();
  emit();
}

const titleOf = (k) => (registry.get(k)?.title ?? k).toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * data-queue → keys: "crate" = the visible crate's ▶ keys in DOM order (respects the filter); else a release id.
 * The crate can hold one song twice (CRASH's lead "You Amazing" is also out as a single): a run plays it
 * once, as `keep` (the pressed record) if that's one of them, else as its first record.
 */
export function queueFor(q, keep = null) {
  if (q !== "crate") return [...registry.keys()].filter((k) => k.startsWith(`${q}:`));
  const keys = [...document.querySelectorAll(".record:not([hidden]) .record__play[data-play-key]")].map((b) => b.dataset.playKey);
  const pick = new Map(); // title → the key that plays it
  keys.forEach((k) => {
    const t = titleOf(k);
    if (!pick.has(t) || k === keep) pick.set(t, k);
  });
  return keys.filter((k) => pick.get(titleOf(k)) === k);
}

export function lookup(key) {
  return registry.get(key) ?? null;
}

/**
 * Next/previous track. In a run: along the run. Otherwise: the current release's registered tracks
 * (album order). Returns false if there's none.
 */
export function step(dir = 1, { wrap = false } = {}) {
  if (!current) return false;
  if (queue.length) {
    let j = qi + dir;
    if (j < 0 || j >= queue.length) {
      if (!wrap) return false;
      j = (j + queue.length) % queue.length;
    }
    const target = registry.get(queue[j]);
    if (!target || target.key === current.key) return false;
    play(target);
    return true;
  }
  const [rid, n] = current.key.split(":");
  let next = registry.get(`${rid}:${Number(n) + dir}`);
  if (!next && wrap) {
    const ns = [...registry.keys()]
      .filter((k) => k.startsWith(`${rid}:`))
      .map((k) => Number(k.split(":")[1]))
      .sort((a, b) => a - b);
    next = registry.get(`${rid}:${dir > 0 ? ns[0] : ns[ns.length - 1]}`);
  }
  if (!next || next.key === current.key) return false;
  play(next);
  return true;
}

export function playKey(key) {
  const p = registry.get(key);
  if (p) play(p);
}

export function pause() {
  if (isPlaying()) el.pause();
}

/**
 * The "resume" of every generic play/pause control (the pill's ▶, the lock screen, the nav chip): toggles
 * what's loaded, except that once a whole-release run has played out it plays the run again from the top
 * (not just its last track).
 */
export function resume() {
  if (finished && finishedRelease && !isPlaying()) playQueue(queueFor(finishedRelease));
  else if (current) play(current);
}

export function stop() {
  if (!el) return;
  el.pause();
  el.removeAttribute("src");
  el.load();
  current = null;
  buffering = false;
  failed = false;
  finished = false;
  finishedRelease = null;
  dropQueue();
  const ms = navigator.mediaSession;
  if (ms) {
    ms.metadata = null;
    ms.playbackState = "none";
    try {
      ms.setPositionState?.(); // no argument = clear
    } catch {
      /* not supported */
    }
  }
  msKey = null;
  emit();
}

/* Lock screen / hardware media keys drive the same previews */
let msKey = null;
let msSteps = ""; // which of previous/next are wired right now ("" | "p" | "pn")

function msSet(action, fn) {
  try {
    navigator.mediaSession.setActionHandler(action, fn);
  } catch {
    /* action not supported here */
  }
}

function initMediaSession() {
  if (!navigator.mediaSession) return;
  msSet("play", () => current && !isPlaying() && resume());
  msSet("pause", pause);
  msSet("stop", stop);
}

function syncMediaSession() {
  const ms = navigator.mediaSession;
  if (!ms) return;
  // Previous / next only while a run is going (next only if there is one): a lone preview has nowhere to go
  const steps = queue.length ? (queue[qi + 1] ? "pn" : "p") : "";
  if (steps !== msSteps) {
    msSteps = steps;
    msSet("previoustrack", steps ? () => (el.currentTime > 3 || qi <= 0 ? (el.currentTime = 0) : step(-1)) : null);
    msSet("nexttrack", steps === "pn" ? () => step(1) : null);
  }
  if (!current) return;
  ms.playbackState = isPlaying() ? "playing" : "paused";
  if (msKey === current.key || typeof MediaMetadata === "undefined") return;
  msKey = current.key;
  const abs = (src) => new URL(src, location.href).href;
  const artwork = [
    current.coverSm && { src: abs(current.coverSm), sizes: "480x480", type: "image/jpeg" },
    current.cover && { src: abs(current.cover), sizes: "1200x1200", type: "image/jpeg" },
  ].filter(Boolean);
  ms.metadata = new MediaMetadata({ title: current.title, artist: "Krayaura", album: current.release || "", artwork });
}

/** Lock-screen scrubber */
function syncPosition() {
  const ms = navigator.mediaSession;
  if (!ms?.setPositionState || !current || !Number.isFinite(el.duration) || el.duration <= 0) return;
  try {
    ms.setPositionState({ duration: el.duration, playbackRate: el.playbackRate || 1, position: Math.min(el.currentTime, el.duration) });
  } catch {
    /* a racing src swap can briefly report position > duration */
  }
}

export function onChange(cb) {
  listeners.add(cb);
  cb(snapshot());
  return () => listeners.delete(cb);
}

/** Re-apply .is-current / .is-playing to [data-play-key] buttons rendered after the last change (sheet, gallery) */
export function refreshPlayState() {
  syncButtons({ current, playing: isPlaying() });
}

export function register(playables) {
  playables.forEach((p) => p?.key && registry.set(p.key, p));
}

export const state = {
  get current() {
    return current;
  },
  get playing() {
    return isPlaying();
  },
  get unlocked() {
    return unlocked;
  },
  get buffering() {
    return buffering;
  },
  get failed() {
    return failed;
  },
  /** The preview ran out with nothing queued after it (cleared by the next play) */
  get finished() {
    return finished;
  },
  /** Release id when `finished` came at the end of a whole-release run */
  get finishedRelease() {
    return finishedRelease;
  },
  /** { index, length, nextKey, releaseId }; length 0 = no run */
  get queue() {
    return queueInfo();
  },
  /** 0..1 through the preview */
  get progress() {
    return el && el.duration ? el.currentTime / el.duration : 0;
  },
  /** For console debugging: import("/src/js/audio.js").then(m => m.state.debug) */
  get debug() {
    return el
      ? {
          readyState: el.readyState,
          networkState: el.networkState,
          currentTime: el.currentTime,
          duration: el.duration,
          error: el.error?.code ?? null,
          ctx: ctx?.state ?? "none",
          src: el.currentSrc,
        }
      : null;
  },
};

/** Smoothed band levels, 0..1. Cheap enough to call every frame. */
export function levels() {
  if (!analyser || !isPlaying()) return ZERO;
  analyser.getByteFrequencyData(freq);
  const hz = ctx.sampleRate / analyser.fftSize;
  const avg = (lo, hi) => {
    const a = Math.max(1, Math.floor(lo / hz));
    const b = Math.min(freq.length - 1, Math.ceil(hi / hz));
    let sum = 0;
    for (let i = a; i <= b; i++) sum += freq[i];
    return sum / ((b - a + 1) * 255);
  };
  const bass = avg(35, 180);
  const mid = avg(250, 2000);
  const high = avg(2500, 9000);
  // Curves: bass is the "kick", expanded so it reads as a punch
  return {
    bass: Math.min(1, Math.pow(bass, 1.6) * 1.8),
    mid,
    high: Math.min(1, high * 1.6),
    energy: Math.min(1, bass * 0.5 + mid * 0.35 + high * 0.15) * 1.25,
  };
}

/** n log-spaced bars (0..1) for EQ visualisers */
export function bands(n = 16, out = new Float32Array(n)) {
  if (!analyser || !isPlaying()) return out.fill(0);
  analyser.getByteFrequencyData(freq);
  const min = 2;
  const max = freq.length * 0.7;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(min * Math.pow(max / min, i / n));
    const b = Math.max(a + 1, Math.floor(min * Math.pow(max / min, (i + 1) / n)));
    let s = 0;
    for (let j = a; j < b; j++) s += freq[j];
    out[i] = s / ((b - a) * 255);
  }
  return out;
}

/**
 * Every [data-play-key] reflects the global state: .is-current / .is-playing + aria-pressed.
 * A button whose name itself swaps to "Pause" (data-label-swaps) gets no aria-pressed: "Pause, pressed" reads as paused.
 */
function syncButtons({ current: cur, playing }) {
  document.querySelectorAll("[data-play-key]").forEach((btn) => {
    const mine = cur?.key === btn.dataset.playKey;
    btn.classList.toggle("is-current", mine);
    btn.classList.toggle("is-playing", mine && playing);
    if ("labelSwaps" in btn.dataset) btn.removeAttribute("aria-pressed");
    else btn.setAttribute("aria-pressed", String(mine && playing));
    if (btn.dataset.cursor) btn.dataset.cursor = mine && playing ? "Pause" : "Play";
  });
  document.documentElement.classList.toggle("is-audio-playing", !!playing);
  window.dispatchEvent(new Event("krayaura:cursor-refresh"));
}

// One delegated handler for every play button on the site
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-play-key]");
  if (!btn) return;
  e.preventDefault();
  const key = btn.dataset.playKey;
  // Pausing / resuming the track that's up never touches the run it's in, whichever button does it
  // (the crate ▶, hero Listen, a tracklist or sheet row, the nav chip, the gallery ▶)
  if (current?.key === key && queue.includes(key)) {
    playKey(key);
    return;
  }
  if (btn.dataset.queue) {
    playQueue(queueFor(btn.dataset.queue, key), key);
    return;
  }
  // A plain button starting another track ends the run
  if (current?.key !== key) dropQueue();
  playKey(key);
});

// Console/QA hook: always in dev, opt-in on the live site with ?debug
if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
  /** seek(29) → 29s in; seek(-1) → 1s before the end */
  const seek = (t) => {
    if (el && Number.isFinite(el.duration)) el.currentTime = t < 0 ? Math.max(0, el.duration + t) : t;
  };
  window.__krAudio = { state, levels, bands, seek, playQueue, clearQueue, queueFor };
}

// iOS WebKit can suspend the AudioContext (all audio runs through it) in the background: keep pausing there
const iOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

// Don't keep playing into a background tab, unless an album run is going (lock-screen listening)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  if (queue.length && !iOS) return;
  pause();
});
