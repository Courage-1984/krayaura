import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { crashStory, crashAlbum, MEDIA } from "./content.js";
import { tracklistHTML, releaseLinksHTML } from "./tracklist.js";
import { register, levels, onChange } from "./audio.js";
import { icon } from "./icons.js";
import { doodle, sunburst, sunburstRay } from "./doodles.js";
import videoManifest from "../data/video.json";

/**
 * "Living cover": animated version of the real CRASH cover (assets/video/crash-cover.mp4).
 * The still stays underneath as poster/fallback until the loop is actually playing.
 */
function initLivingCover(root) {
  const v = videoManifest["crash-cover"]?.landscape || videoManifest["crash-cover"]?.portrait;
  const img = root.querySelector("[data-crash-cover]");
  if (!v || !img) return;
  const video = document.createElement("video");
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "none" });
  video.setAttribute("muted", "");
  video.setAttribute("aria-label", img.alt);
  video.poster = img.src;
  video.className = "crash__cover-video";
  img.after(video);

  let attached = false;
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) {
        if (!attached) {
          video.innerHTML = `<source src="${MEDIA}/${v.webm}" type="video/webm"><source src="${MEDIA}/${v.mp4}" type="video/mp4">`;
          video.load();
          attached = true;
        }
        video.play().then(() => root.classList.add("has-living-cover")).catch(() => {});
      } else if (attached) {
        video.pause();
      }
    },
    { rootMargin: "300px 0px" }
  ).observe(video);
}

/**
 * Optional ambient loop behind the pinned story (assets/video/crash-loop*.mp4 → copy-media.py).
 * Lazy: sources attach only near the viewport; pauses off-screen; poster-only for reduced motion and Save-Data.
 */
function initCrashVideo(root, posterOnly) {
  const v = videoManifest["crash-loop"];
  const pin = root.querySelector("[data-crash-pin]");
  if (!v || !pin) return;
  const land = v.landscape || v.portrait;
  const port = v.portrait;
  const src = (p) => `${MEDIA}/${p}`;

  const wrap = document.createElement("div");
  wrap.className = "crash__video";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = `<video muted loop playsinline preload="none" poster="${src(land.poster)}"></video>`;
  pin.prepend(wrap);
  const video = wrap.querySelector("video");
  if (posterOnly) return;

  const sources = [
    port && `<source media="(max-aspect-ratio: 3/4)" src="${src(port.webm)}" type="video/webm">`,
    port && `<source media="(max-aspect-ratio: 3/4)" src="${src(port.mp4)}" type="video/mp4">`,
    `<source src="${src(land.webm)}" type="video/webm">`,
    `<source src="${src(land.mp4)}" type="video/mp4">`,
  ].filter(Boolean);

  // Watch the loop itself (it lives in the pin), not the whole section: the section runs on through the
  // tracklist, and a masked video decoding off screen there was the page's biggest idle cost
  let attached = false;
  let onScreen = false;
  let live = false;
  new IntersectionObserver(
    ([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) {
        if (!attached) {
          video.innerHTML = sources.join("");
          video.load();
          attached = true;
        }
        video.play().catch(() => {});
      } else if (attached) {
        video.pause();
      }
      syncKick();
    },
    { rootMargin: "100px 0px" }
  ).observe(wrap);

  // The set's light breathes with the music (opacity only — compositor-cheap), only while both are live
  const kick = () => {
    if (!video.paused) wrap.style.setProperty("--kick", levels().bass.toFixed(3));
  };
  let kicking = false;
  function syncKick() {
    const want = live && onScreen;
    if (want === kicking) return;
    kicking = want;
    if (want) gsap.ticker.add(kick);
    else {
      gsap.ticker.remove(kick);
      wrap.style.setProperty("--kick", "0");
    }
  }
  onChange(({ playing }) => {
    live = playing;
    syncKick();
  });
}

gsap.registerPlugin(ScrollTrigger);

const words = (text) =>
  text
    .split(/\s+/)
    .map((w) => `<span class="w">${w}</span>`)
    .join(" ");

const RAYS = 14; // one per CRASH track

/**
 * Undrawn state for a pathLength=1 doodle. Not the usual "1 / offset 1": that leaves zero-length dashes
 * touching both ends of the path, and round caps paint them as dots before the stroke is drawn.
 * Tween strokeDashoffset to 0 to draw it.
 */
const UNDRAWN = { strokeDasharray: "1 1.5", strokeDashoffset: 1.05 };

/**
 * The sunburst behind the cover. While a CRASH track is up its ray lights orange and the rest dim
 * (at every size, reduced motion included). With `kick()` on (desktop scrub), the lit ray also punches
 * with the bass: a compositor-only scale on its own layer, ticking only while the album is playing
 * AND the section is on screen. The "Read it with the album on" chip bows out once CRASH is up.
 */
function initRays(root, { kick }) {
  const stage = root.querySelector("[data-crash-stage]");
  if (!stage) return null;
  stage.insertAdjacentHTML(
    "afterbegin",
    `<div class="crash__rays" aria-hidden="true" data-crash-rays>${sunburst(RAYS, "crash__burst")}<span class="crash__lit">${sunburstRay(RAYS)}</span></div>`
  );
  const rays = stage.querySelector("[data-crash-rays]");
  const each = rays.querySelectorAll(".crash__burst .sunburst__ray");
  const lit = rays.querySelector(".crash__lit");
  const litRay = lit.firstElementChild;
  const score = root.querySelector("[data-crash-score]");
  const title = root.querySelector(".crash__title");

  let onScreen = false;
  let playing = false;
  let litIndex = -1;
  let ticking = false;
  const tick = () => {
    litRay.style.transform = `scale(${(1 + levels().bass * 0.08).toFixed(3)})`;
  };
  const sync = () => {
    const want = kick() && onScreen && playing && litIndex >= 0;
    if (want === ticking) return;
    ticking = want;
    if (want) gsap.ticker.add(tick);
    else {
      gsap.ticker.remove(tick);
      litRay.style.transform = "";
    }
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  }).observe(root);

  onChange(({ current, playing: p }) => {
    const [rid, n] = current?.key?.split(":") ?? [];
    const idx = rid === crashAlbum.id && Number(n) <= RAYS ? Number(n) - 1 : -1;
    playing = p;
    if (idx !== litIndex) {
      litIndex = idx;
      rays.classList.toggle("is-live", idx >= 0);
      each.forEach((r, i) => r.classList.toggle("is-lit", i === idx));
      if (idx >= 0) lit.style.setProperty("--ray", idx);
    }
    const crashUp = idx >= 0;
    if (score && score.classList.contains("is-gone") !== crashUp) {
      // Don't strand keyboard focus on a button that's about to vanish: hand it to the story's heading
      if (crashUp && document.activeElement === score && title) {
        title.setAttribute("tabindex", "-1");
        title.focus({ preventScroll: true });
      }
      score.classList.toggle("is-gone", crashUp);
    }
    sync();
  });

  return { recheck: sync };
}

/** Draw a doodle's paths on as it scrolls into view (mobile; the desktop pin draws them on its timeline) */
function drawOnView(svg, start, duration = 0.5) {
  const paths = svg.querySelectorAll("path");
  gsap.set(paths, UNDRAWN);
  gsap.to(paths, {
    strokeDashoffset: 0,
    duration,
    stagger: duration * 0.5,
    ease: "power2.inOut",
    scrollTrigger: { trigger: svg, start, once: true },
  });
}

/** Fill the Crash section, then (desktop) pin it and scrub the story like a teleprompter. */
export function initCrash(root) {
  if (!root || !crashAlbum) return;
  register(crashAlbum.playables);

  const $ = (s) => root.querySelector(s);
  $("[data-crash-cover]").src = crashStory.cover;
  $("[data-crash-kicker]").textContent = crashStory.kicker;
  $("[data-crash-title]").textContent = crashStory.title;
  $(".crash__title").insertAdjacentHTML("beforeend", doodle("burst", "doodle--burst", { manual: true }));
  $("[data-crash-story]").innerHTML = crashStory.story.map((p) => `<p>${words(p)}</p>`).join("");
  // Each label gets a marker strike; the dim targets the text span so the strike stays at full strength
  $("[data-crash-punch]").innerHTML = crashStory.punchlines
    .map((l) => `<p><span class="crash__punch-text">${l}</span>${doodle("strike", "doodle--strike", { manual: true })}</p>`)
    .join("");
  $("[data-crash-finale-lead]").textContent = crashStory.finaleLead;
  $("[data-crash-finale-big]").textContent = crashStory.finale;
  $("[data-crash-finale-tail]").textContent = crashStory.finaleTail;
  $("[data-crash-credit]").textContent = crashStory.credit;
  $("[data-crash-stream]").innerHTML = `
    <p class="crash__stream-label">Stream CRASH</p>
    <div class="crash__stream-links">${releaseLinksHTML(crashAlbum, { big: true })}</div>`;
  const scoreIcon = $("[data-crash-score-icon]");
  if (scoreIcon) scoreIcon.innerHTML = icon("play");

  const guests = [...new Set(crashAlbum.tracks.flatMap((t) => t.features))];
  const date = new Date(crashAlbum.date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  $("[data-crash-meta]").textContent = `${crashAlbum.trackCount} tracks · ${date}${
    guests.length ? ` · with ${guests.join(", ")}` : ""
  }`;
  $("[data-crash-links]").innerHTML = `
    <button type="button" class="btn btn--primary btn--listen" data-play-key="${crashAlbum.playables[0]?.key}" data-queue="${crashAlbum.id}" data-cursor="Play">
      <span class="btn__icon">${icon("play")}</span><span>Play the album</span>
    </button>
    ${releaseLinksHTML(crashAlbum)}`;
  $("[data-crash-tracklist]").innerHTML = tracklistHTML(crashAlbum, { className: "tracklist tracklist--album" });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let scrubbing = false; // the desktop pin is live, so the lit ray may kick
  const rays = initRays(root, { kick: () => scrubbing });

  // Save-Data: the ambient loop shows only its poster and the living cover stays a still (no video bytes)
  const saveData = !!navigator.connection?.saveData;
  initCrashVideo(root, reduced || saveData);
  if (!reduced && !saveData) initLivingCover(root);

  if (reduced) {
    root.classList.add("is-static");
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    const pin = $("[data-crash-pin]");
    const copy = $(".crash__copy");
    const viewport = $(".crash__viewport");
    const cover = $("[data-crash-cover-wrap]");
    const burst = $("[data-crash-rays]");
    const halftone = $(".crash__halftone");
    const storyWords = root.querySelectorAll(".crash__story .w");
    const punchBox = $(".crash__punch");
    const punch = [...root.querySelectorAll(".crash__punch p")];
    const punchText = punch.map((p) => p.querySelector(".crash__punch-text"));
    const strikes = punch.map((p) => [...p.querySelectorAll(".doodle--strike path")]);
    const dingSvg = $(".doodle--burst");
    const ding = [...dingSvg.querySelectorAll("path")];
    const finale = $("[data-crash-finale]");
    const coverDim = $("[data-crash-cover-dim]");
    const streamLinks = finale.querySelector(".crash__stream-links");
    const score = $("[data-crash-score]");

    // Lift the finale out of the viewport's fade mask: the word lands whole, centred over the pin
    const home = { parent: finale.parentNode, next: finale.nextSibling };
    pin.append(finale);
    scrubbing = true;
    rays?.recheck();

    // The word lands at LAND; by then the struck-out lines sit in the upper third of the viewport.
    // Travel is measured from the punch block (not a tuned bottom padding), so it holds at any size.
    const LAND = 0.84;
    const travel = () => {
      const at = punchBox.getBoundingClientRect().top - copy.getBoundingClientRect().top;
      return Math.max(0, (at - viewport.clientHeight * 0.15) / LAND);
    };

    gsap.set([...strikes.flat(), ...ding], UNDRAWN);

    // The finale fades with opacity (its words stay in the accessibility tree the whole way); its links stay
    // out of reach (inert) until the word has landed, since an invisible link must not take a Tab or a click
    let linksOn = null;
    const setLinks = (on) => {
      if (on === linksOn || !streamLinks) return;
      linksOn = on;
      // (scrolled back up with a link focused: hand focus to the story's heading, not to <body>)
      const title = $(".crash__title");
      if (!on && streamLinks.contains(document.activeElement) && title) {
        title.setAttribute("tabindex", "-1");
        title.focus({ preventScroll: true });
      }
      streamLinks.inert = !on;
    };
    setLinks(false);

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 2.4)}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
      onUpdate: () => setLinks(tl.progress() >= LAND + 0.045),
    });

    // The chip opens the story, so it rides up out of view with the copy: when it takes focus there
    // (Shift+Tab back into the pin) bring the story back to its start, where the chip is on screen
    const onScoreFocus = () => {
      const st = tl.scrollTrigger;
      const r = score.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect();
      viewport.scrollTop = 0; // (a focus scroll can nudge the clipped viewport)
      if (st && (r.top < vr.top + vr.height * 0.14 || r.bottom > vr.bottom)) window.scrollTo({ top: st.start, behavior: "instant" });
    };
    score?.addEventListener("focus", onScoreFocus);

    // 0–0.12 · CRASH pops out of the toaster: the cover rises with an overshoot, the rays burst behind it
    tl.fromTo(cover, { yPercent: 70, rotate: -14, scale: 0.85 }, { yPercent: 0, rotate: -3, scale: 1, duration: 0.12, ease: "back.out(2.2)" }, 0)
      .fromTo(burst, { scale: 0.4 }, { scale: 1, duration: 0.12, ease: "back.out(2.2)" }, 0)
      .fromTo(burst, { rotate: 0 }, { rotate: 25, duration: 1 - 0.12 }, 0.12)
      // 0.10–0.16 · the impact: halftone flash, a shake on x only (the pop owns rotate/scale/y), the title's "ding"
      .fromTo(halftone, { opacity: 0.5 }, { opacity: 0.9, duration: 0.03 }, 0.1)
      .to(halftone, { opacity: 0.5, duration: 0.03 }, 0.13)
      .to(cover, { x: 10, duration: 0.01 }, 0.12)
      .to(cover, { x: -7, duration: 0.01 }, 0.13)
      .to(cover, { x: 4, duration: 0.01 }, 0.14)
      .to(cover, { x: 0, duration: 0.01 }, 0.15)
      .fromTo(dingSvg, { autoAlpha: 0, scale: 0.4, rotate: -35 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.03, ease: "back.out(3)" }, 0.12)
      .to(ding, { strokeDashoffset: 0, duration: 0.03, stagger: 0.012 }, 0.12)
      // The teleprompter
      .fromTo(copy, { y: 0 }, { y: () => -travel(), duration: 1 }, 0)
      .fromTo(storyWords, { opacity: 0.14 }, { opacity: 1, stagger: 0.45 / storyWords.length, duration: 0.02 }, 0.05);

    punch.forEach((p, i) => {
      const at = 0.52 + i * 0.1;
      tl.fromTo(p, { opacity: 0, y: 70, skewY: 7 }, { opacity: 1, y: 0, skewY: 0, duration: 0.07, ease: "power3.out" }, at);
      if (i > 0) tl.to(punchText[i - 1], { opacity: 0.32, duration: 0.05 }, at);
    });
    // 0.78 / 0.80 / 0.82 · each label is crossed out, two marker passes
    strikes.forEach((paths, i) => tl.to(paths, { strokeDashoffset: 0, duration: 0.012, stagger: 0.006 }, 0.78 + i * 0.02));

    // 0.84 · the word lands; the cover steps back, rays pulse. The cover itself stays opaque (half see-through,
    // the rays ran across the photo): a void layer over it dims it instead. Opacity only, not blur (the living
    // cover would repaint every frame)
    tl.to(punchText[punchText.length - 1], { opacity: 0.32, duration: 0.05 }, LAND)
      .fromTo(finale, { opacity: 0, scale: 0.7, rotate: -6 }, { opacity: 1, scale: 1, rotate: -2, duration: 0.09, ease: "back.out(2)" }, LAND)
      .to(cover, { scale: 0.82, xPercent: -8, duration: 0.09 }, LAND)
      .fromTo(coverDim, { opacity: 0 }, { opacity: 0.5, duration: 0.09 }, LAND)
      .to(burst, { scale: 1.14, duration: 0.025, ease: "power2.out" }, LAND)
      .to(burst, { scale: 1, duration: 0.05, ease: "power2.inOut" }, LAND + 0.025);

    return () => {
      scrubbing = false;
      rays?.recheck();
      score?.removeEventListener("focus", onScoreFocus);
      if (streamLinks) streamLinks.inert = false;
      home.parent.insertBefore(finale, home.next);
      gsap.set([cover, coverDim, copy, storyWords, punch, punchText, finale, burst, halftone, dingSvg, ...strikes.flat(), ...ding], { clearProps: "all" });
    };
  });

  // Content fades in with opacity, never visibility: it stays readable by screen readers and reachable by
  // Tab before it has scrolled in, and focus inside shows it at once
  const showOnFocus = (el, tween) => {
    const on = () => tween.progress() < 1 && tween.play();
    el?.addEventListener("focusin", on, { passive: true });
    return () => el?.removeEventListener("focusin", on);
  };

  mm.add("(max-width: 899px)", () => {
    const targets = root.querySelectorAll(".crash__story p, .crash__punch p, .crash__finale, .crash__stage");
    const offs = [...targets].map((el) =>
      showOnFocus(
        el,
        gsap.from(el, {
          opacity: 0,
          y: 40,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        })
      )
    );
    // The doodles draw as they come into view: the title's "ding", then each label crossed out once read
    root.querySelectorAll(".doodle--burst").forEach((svg) => drawOnView(svg, "top 85%", 0.6));
    root.querySelectorAll(".doodle--strike").forEach((svg) => drawOnView(svg, "top 62%", 0.4));
    return () => offs.forEach((off) => off());
  });

  // Tracklist rows cascade in
  const tracklist = $("[data-crash-tracklist]");
  showOnFocus(
    tracklist,
    gsap.from(root.querySelectorAll(".tracklist--album li"), {
      opacity: 0,
      x: -24,
      duration: 0.5,
      stagger: 0.035,
      ease: "power2.out",
      scrollTrigger: { trigger: tracklist, start: "top 85%", once: true },
    })
  );
}
