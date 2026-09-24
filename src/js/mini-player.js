import { onChange, state, bands, stop, step, lookup, resume } from "./audio.js";
import { releaseById } from "./content.js";
import { icon } from "./icons.js";

const pad = (n) => String(n).padStart(2, "0");
const PLATFORM = { spotify: "Spotify", apple: "Apple Music" };

/**
 * Floating "now playing" pill: cover, title, live EQ canvas, play/pause, next (album runs), deep links.
 * When a preview (or a whole run) runs out it stays open on "hear the full song" until × is pressed.
 */
export function initMiniPlayer() {
  const html = document.documentElement;
  const root = document.createElement("aside");
  root.className = "mini-player";
  root.setAttribute("aria-label", "Now playing");
  root.setAttribute("aria-hidden", "true");
  root.inert = true;
  root.innerHTML = `
    <div class="mini-player__art"><img alt="" data-mp-cover /></div>
    <div class="mini-player__info">
      <span class="mini-player__kicker" data-mp-kicker></span>
      <strong class="mini-player__title" data-mp-title></strong>
      <span class="mini-player__sub" data-mp-sub></span>
    </div>
    <canvas class="mini-player__eq" width="112" height="40" aria-hidden="true" data-mp-eq></canvas>
    <div class="mini-player__done" data-mp-done></div>
    <button type="button" class="mini-player__btn" data-mp-toggle aria-label="Pause">
      <span data-mp-icon>${icon("pause")}</span>
    </button>
    <button type="button" class="mini-player__next" data-mp-next aria-label="Next track" hidden>${icon("next")}</button>
    <div class="mini-player__links" data-mp-links></div>
    <a class="mini-player__full" data-mp-full target="_blank" rel="noopener noreferrer">
      <span class="mini-player__full-icon" data-mp-full-icon></span><span class="mini-player__full-label" data-mp-full-label>Full song</span><span class="mini-player__full-arrow" aria-hidden="true">↗</span>
    </a>
    <button type="button" class="mini-player__close" data-mp-close aria-label="Stop and close">${icon("close")}</button>
    <span class="mini-player__progress" data-mp-progress></span>
  `;
  // Outside the pill: a live region inside an aria-hidden / visibility:hidden box would never be read
  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.append(root, status);

  const $ = (s) => root.querySelector(s);
  const cover = $("[data-mp-cover]");
  const kicker = $("[data-mp-kicker]");
  const title = $("[data-mp-title]");
  const sub = $("[data-mp-sub]");
  const eq = $("[data-mp-eq]");
  const done = $("[data-mp-done]");
  const toggle = $("[data-mp-toggle]");
  const iconSlot = $("[data-mp-icon]");
  const next = $("[data-mp-next]");
  const links = $("[data-mp-links]");
  const full = $("[data-mp-full]");
  const fullIcon = $("[data-mp-full-icon]");
  const fullLabel = $("[data-mp-full-label]");
  const progress = $("[data-mp-progress]");
  const g = eq.getContext("2d");

  // "Play again" after a whole-release run replays the run, not just its last track (audio.js resume())
  toggle.addEventListener("click", resume);
  next.addEventListener("click", () => step(1));

  // × hides the pill (inert) while it may hold focus: hand focus back first, or it drops to <body> and the
  // next Tab starts over at the top. Where it came from → the play button that started this → the nav chip.
  let cameFrom = null;
  let trigger = null;
  const usable = (el) =>
    el?.isConnected && !root.contains(el) && el.getClientRects().length > 0 && !el.closest("[inert], [aria-hidden='true']") && !el.disabled;
  root.addEventListener("focusin", (e) => {
    if (e.relatedTarget && !root.contains(e.relatedTarget)) cameFrom = e.relatedTarget;
  });
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest?.("[data-play-key], [data-lever-btn]");
      if (b && !root.contains(b)) trigger = b;
    },
    true
  );
  $("[data-mp-close]").addEventListener("click", () => {
    if (root.contains(document.activeElement)) {
      // (first one that really takes focus: a visibility:hidden candidate refuses it silently)
      [cameFrom, trigger, document.querySelector("[data-nav-play]"), document.querySelector("main")].filter(usable).some((el) => {
        el.focus({ preventScroll: true });
        return document.activeElement === el;
      });
    }
    stop();
  });

  // Over the hero the toaster announces tracks itself (and the pill is tucked away)
  const say = (text) => {
    if (html.classList.contains("hero-controls-visible") || status.textContent === text) return;
    status.textContent = text;
  };
  const where = (p) => (releaseById[p.releaseId]?.type === "album" ? `${p.release} track ${Number(p.key.split(":")[1])}` : "single");

  // EQ bars + progress: the loop runs only while the pill is open
  const bars = new Float32Array(14);
  const smooth = new Float32Array(14);
  const accent = getComputedStyle(html).getPropertyValue("--c-orange").trim() || "#f26a1f";
  const gold = getComputedStyle(html).getPropertyValue("--c-gold").trim() || "#f2b705";
  let raf = 0;
  let looping = false; // playing: the loop keeps going (else it sleeps once the bars are flat)

  let shownKey = null;
  let linksSig = "";
  let wasDone = false;
  let iconName = "pause";
  onChange(({ current, playing, finished, finishedRelease, queue }) => {
    const open = !!current;
    const isDone = open && finished;
    const queued = open && queue.length > 0;
    root.classList.toggle("is-open", open);
    root.classList.toggle("is-playing", playing);
    root.classList.toggle("is-finished", isDone);
    root.classList.toggle("is-queued", queued);
    root.setAttribute("aria-hidden", String(!open));
    root.inert = !open || html.classList.contains("is-menu-open");
    html.classList.toggle("has-player", open);
    progress.style.transform = `scaleX(${finished ? 1 : state.progress})`; // (also right while the loop sleeps)
    setLoop(open && playing);

    toggle.setAttribute("aria-label", playing ? "Pause" : isDone ? (finishedRelease ? "Play the album again" : "Play again") : "Play");
    const want = playing ? "pause" : "play";
    if (want !== iconName) iconSlot.innerHTML = icon((iconName = want));

    if (!open) {
      status.textContent = "";
      shownKey = null;
      linksSig = "";
      if (wasDone) kicker.textContent = "";
      wasDone = false;
      return;
    }

    if (current.key !== shownKey) {
      shownKey = current.key;
      cover.src = current.coverSm || current.cover;
      title.textContent = current.title;
      // A focused link here is about to be replaced: keep focus on the same slot
      const had = [...links.children].indexOf(document.activeElement);
      links.innerHTML = Object.keys(PLATFORM)
        .filter((k) => current[k])
        .map(
          (k) =>
            `<a href="${current[k]}" target="_blank" rel="noopener noreferrer" aria-label="Full song on ${PLATFORM[k]}">${icon(k)}</a>`
        )
        .join("");
      if (had >= 0) (links.children[had] || toggle).focus({ preventScroll: true });
      say(`Now playing preview: ${current.title}, ${where(current)}`);
    }

    // Run position + what's next (⏭ onto the last track hides ⏭: its focus moves to ▶, not to <body>)
    const up = queue.nextKey ? lookup(queue.nextKey) : null;
    if (!up && document.activeElement === next) toggle.focus({ preventScroll: true });
    next.hidden = !up;
    if (up) next.setAttribute("aria-label", `Next: ${up.title}`);
    sub.textContent = queued
      ? [`${pad(queue.index + 1)} / ${pad(queue.length)}`, up && `Up next: ${up.title}`].filter(Boolean).join(" · ")
      : [current.features?.length ? `ft. ${current.features.join(" & ")}` : "", current.subtitle].filter(Boolean).join(" · ");
    if (isDone !== wasDone || !kicker.childNodes.length) {
      // (the " · preview" tail drops on phones, where the row is full)
      kicker.innerHTML = isDone ? "Preview's done — hear the full song" : `Now playing<span class="mini-player__kicker-x"> · preview</span>`;
    }
    if (isDone && !wasDone) say("Preview's done — hear the full song");
    wasDone = isDone;

    // Full-song links: the track's, or the release's once a whole run has finished
    const rel = isDone && finishedRelease ? releaseById[finishedRelease] : null;
    const src = rel || current;
    const what = rel ? "Full album" : "Full song";
    const sig = `${current.key}|${rel?.id ?? ""}|${isDone}`;
    if (sig === linksSig) return;
    linksSig = sig;
    const first = src.spotify ? "spotify" : src.apple ? "apple" : null;
    full.hidden = !first;
    if (first) {
      full.href = src[first];
      full.setAttribute("aria-label", `${what} on ${PLATFORM[first]}`);
      fullIcon.innerHTML = icon(first);
      fullLabel.textContent = what;
    }
    const hadDone = [...done.children].indexOf(document.activeElement);
    done.innerHTML = !isDone
      ? ""
      : Object.keys(PLATFORM)
          .filter((k) => src[k])
          .map(
            (k) =>
              `<a class="mini-player__pill mini-player__pill--${k}" href="${src[k]}" target="_blank" rel="noopener noreferrer"${
                rel ? ` aria-label="Full album on ${PLATFORM[k]}"` : ""
              }>${icon(k)}<span>${rel ? "Full album" : PLATFORM[k]}</span></a>`
          )
          .join("");
    if (hadDone >= 0) (done.children[hadDone] || toggle).focus({ preventScroll: true });
  });

  function paintBars() {
    const w = eq.width;
    const h = eq.height;
    const bw = w / bars.length;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < bars.length; i++) {
      const bh = Math.max(3, smooth[i] * h);
      g.fillStyle = i % 3 === 0 ? accent : gold;
      if (g.roundRect) {
        g.beginPath();
        g.roundRect(i * bw + 1.5, (h - bh) / 2, bw - 3, bh, 2);
        g.fill();
      } else {
        g.fillRect(i * bw + 1.5, (h - bh) / 2, bw - 3, bh);
      }
    }
  }

  function draw() {
    if (html.classList.contains("hero-controls-visible")) return; // tucked away under the toaster
    progress.style.transform = `scaleX(${state.finished ? 1 : state.progress})`;
    if (root.classList.contains("is-finished")) return; // the EQ is swapped for the full-song pills
    bands(bars.length, bars);
    for (let i = 0; i < bars.length; i++) smooth[i] += (bars[i] - smooth[i]) * (bars[i] > smooth[i] ? 0.6 : 0.15);
    paintBars();
  }

  // The loop runs while playing. Paused, it runs on only until the bars have sunk, then sleeps
  // (closed, finished or tucked under the hero: the bars go flat at once).
  const flat = () => smooth.every((v) => v < 0.01);
  function frame() {
    draw();
    if (!looping) {
      const idle = !root.classList.contains("is-open") || root.classList.contains("is-finished") || html.classList.contains("hero-controls-visible");
      if (idle && !flat()) {
        smooth.fill(0);
        paintBars();
      }
      if (idle || flat()) {
        raf = 0;
        return;
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function setLoop(on) {
    looping = on;
    if (!raf) raf = requestAnimationFrame(frame);
  }
}
