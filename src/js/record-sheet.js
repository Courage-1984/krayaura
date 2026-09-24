import gsap from "gsap";
import { releaseById } from "./content.js";
import { icon } from "./icons.js";
import { tracklistHTML, releaseLinksHTML } from "./tracklist.js";
import { onChange, bands, levels, state, play, refreshPlayState } from "./audio.js";

/**
 * Record detail sheet — turntable with the vinyl spinning, a live radial visualiser,
 * release info, tracklist previews and deep links.
 * While it's open the address bar reads #r/<id> (history.replaceState), so it's always a shareable link;
 * Share hands out the /r/<id>/ stub page (scripts/build-share-stubs.mjs) so previews show the cover.
 */
let sheet;
let panel;
let returnFocus = null;
let openId = null;
let raf = 0;
let toastTimer = 0;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ensure() {
  if (sheet) return true;
  sheet = document.querySelector("#record-sheet");
  panel = sheet?.querySelector("[data-sheet-panel]");
  if (!sheet || !panel) return false;

  sheet.addEventListener("click", (e) => {
    if (e.target === sheet || e.target.closest("[data-sheet-close]")) closeRecordSheet();
    else if (e.target.closest("[data-sheet-share]") && openId) shareRelease(releaseById[openId]);
  });
  sheet.addEventListener("keydown", (e) => {
    if (e.key === "Tab") trapFocus(e);
  });
  // Document-level so Escape works wherever focus ended up
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheet.classList.contains("is-open")) {
      e.stopImmediatePropagation();
      closeRecordSheet();
    }
  });
  onChange(({ current, playing }) => {
    if (!sheet.classList.contains("is-open")) return;
    const live = !!current && current.releaseId === openId;
    sheet.classList.toggle("is-spinning", live && playing);
  });
  return true;
}

function trapFocus(e) {
  const f = [...panel.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])")].filter(
    (el) => !el.disabled && el.offsetParent !== null
  );
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** The address bar mirrors the sheet (no history entries: Back still leaves the page) */
function setHash(id) {
  try {
    history.replaceState(history.state, "", `${location.pathname}${location.search}${id ? `#r/${id}` : ""}`);
  } catch {
    /* sandboxed / file: — the sheet works without it */
  }
}

/**
 * @param {string} id release id
 * @param {Element|null} trigger what gets focus back on close
 * @param {{ deepLink?: boolean }} [opts] deepLink: opened from #r/<id> — never autoplays, focus returns to the record
 */
export function openRecordSheet(id, trigger, { deepLink = false } = {}) {
  const r = releaseById[id];
  if (!r || !ensure()) return;
  openId = id;
  returnFocus = trigger || (deepLink && document.querySelector(`[data-open-release="${id}"]`)) || document.activeElement;
  // Audio is still locked (nothing played yet): a big button, since nothing may start on its own
  const needle =
    !state.unlocked && r.lead
      ? `<button type="button" class="btn btn--primary btn--listen sheet__needle" data-play-key="${r.lead.key}" data-queue="${r.id}" data-cursor="Play" data-label-swaps data-sheet-needle>
          <span class="btn__icon sheet__needle-icon">${icon("play")}${icon("pause")}</span>
          <span class="sheet__needle-label">Drop the needle</span><span class="sheet__needle-label sheet__needle-label--on">Pause</span>
        </button>`
      : "";

  const date = new Date(r.date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const feat = r.features.length ? `<p class="sheet__feat">ft. ${r.features.join(" & ")}</p>` : "";
  panel.innerHTML = `
    <button type="button" class="sheet__share" data-sheet-share>${icon("share")}<span>Share</span></button>
    <button type="button" class="sheet__close" data-sheet-close aria-label="Close">${icon("close")}</button>
    <p class="sheet__toast" role="status" aria-live="polite" data-sheet-toast></p>
    <div class="sheet__deck">
      <div class="sheet__turntable">
        <canvas class="sheet__viz" width="640" height="640" aria-hidden="true" data-viz></canvas>
        <div class="sheet__platter">
          <div class="sheet__vinyl" data-sheet-vinyl>
            <span class="sheet__label" style="background-image:url('${r.coverSm}')"></span>
          </div>
        </div>
        <img class="sheet__sleeve" src="${r.cover}" srcset="${r.coverSm} 480w, ${r.cover} 1200w" sizes="(min-width: 860px) 240px, 45vw"
          width="1200" height="1200" decoding="async" alt="${r.title} cover art" />
      </div>
    </div>
    <div class="sheet__info">
      <p class="sheet__kicker">${r.type === "album" ? `Album · ${r.trackCount} tracks` : "Single"} · ${date}</p>
      <h3 class="sheet__title" id="record-sheet-title">${r.title}</h3>
      ${feat}
      ${r.popular ? `<p class="sheet__hot">${icon("flame")} Popular on Spotify</p>` : ""}
      ${needle}
      <div class="sheet__links">${releaseLinksHTML(r, { big: true })}</div>
      ${tracklistHTML(r, { className: "tracklist sheet__tracks" })}
      <p class="sheet__note">30-second previews · full songs on Spotify &amp; Apple Music</p>
    </div>
  `;
  refreshPlayState(); // the fresh rows show what's already playing (EQ bars, orange title)

  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  sheet.setAttribute("data-lenis-prevent", "");
  document.documentElement.classList.add("is-sheet-open");
  window.dispatchEvent(new CustomEvent("krayaura:modal", { detail: { open: true } }));
  const live = state.current?.releaseId === id;
  sheet.classList.toggle("is-spinning", live && state.playing);
  // visibility flips instantly on open (see crate.css), so focus can move now
  panel.scrollTop = 0;
  (panel.querySelector("[data-sheet-needle]") || panel.querySelector("[data-sheet-close]") || panel).focus({ preventScroll: true });
  setHash(id);
  panel.querySelector(".tracklist__row.is-current")?.scrollIntoView({ block: "nearest" });
  if (!reduced) {
    // opacity, not autoAlpha: the rows stay focusable (and in the accessibility tree) while they fade in
    gsap.from(panel.querySelectorAll(".sheet__tracks li"), {
      x: -16,
      opacity: 0,
      stagger: 0.025,
      duration: 0.35,
      ease: "power2.out",
      clearProps: "transform,opacity",
    });
  }

  // Nothing loaded at all? Drop the needle (never from a link: that's the visitor's call). A paused track or
  // run, or the finished "hear the full song" pill, is left alone: opening a sheet to look must not replace it.
  if (!deepLink && state.unlocked && !state.current && r.lead) play(r.lead);

  startViz();
}

export function closeRecordSheet() {
  if (!sheet?.classList.contains("is-open")) return;
  sheet.classList.remove("is-open", "is-spinning");
  sheet.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("is-sheet-open");
  window.dispatchEvent(new CustomEvent("krayaura:modal", { detail: { open: false } }));
  cancelAnimationFrame(raf);
  clearTimeout(toastTimer);
  openId = null;
  setHash(null);
  returnFocus?.focus?.({ preventScroll: true });
}

function toast(text) {
  const el = panel?.querySelector("[data-sheet-toast]");
  if (!el) return;
  el.textContent = text;
  el.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-on"), 2400);
}

/** The system share sheet where there is one (phones), else copy the link */
async function shareRelease(r) {
  if (!r) return;
  const url = `${location.origin}${import.meta.env.BASE_URL}r/${r.id}/`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `${r.title} — Krayaura`, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return; // closed the share sheet
    }
  }
  toast((await copyText(url)) ? "Link copied" : url);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / no permission: the textarea trick
    const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    panel.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      /* nothing left to try: the toast shows the link instead */
    }
    ta.remove();
    panel.querySelector("[data-sheet-share]")?.focus({ preventScroll: true });
    return ok;
  }
}

function startViz() {
  cancelAnimationFrame(raf);
  const canvas = panel.querySelector("[data-viz]");
  const vinyl = panel.querySelector("[data-sheet-vinyl]");
  const g = canvas.getContext("2d");
  const n = 64;
  const bars = new Float32Array(n);
  const smooth = new Float32Array(n);
  const css = getComputedStyle(document.documentElement);
  const gold = css.getPropertyValue("--c-gold").trim() || "#f2b705";
  const orange = css.getPropertyValue("--c-orange").trim() || "#f26a1f";
  const red = css.getPropertyValue("--c-red").trim() || "#ff1022";
  let angle = 0;
  let last = performance.now();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(now - last, 64) / 1000;
    last = now;
    const live = state.current?.releaseId === openId && state.playing;
    bands(n, bars);
    const { energy, bass } = live ? levels() : { energy: 0, bass: 0 };

    if (live && !reduced) {
      angle = (angle + dt * (200 + energy * 260)) % 360;
      vinyl.style.transform = `rotate(${angle}deg) scale(${1 + bass * 0.03})`;
    }

    const w = canvas.width;
    const c = w / 2;
    g.clearRect(0, 0, w, w);
    const inner = w * 0.36;
    for (let i = 0; i < n; i++) {
      smooth[i] += ((live ? bars[i] : 0) - smooth[i]) * (bars[i] > smooth[i] ? 0.55 : 0.12);
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const len = 6 + smooth[i] * w * 0.13;
      g.strokeStyle = i % 4 === 0 ? red : i % 2 ? gold : orange;
      g.globalAlpha = 0.35 + smooth[i] * 0.65;
      g.lineWidth = 5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner);
      g.lineTo(c + Math.cos(a) * (inner + len), c + Math.sin(a) * (inner + len));
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  raf = requestAnimationFrame(frame);
}
