import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { onChange, state, playQueue, queueFor } from "./audio.js";
import { onSignal } from "./signal.js";
import { crashAlbum } from "./content.js";
import { icon } from "./icons.js";

gsap.registerPlugin(ScrollTrigger);

/*
 * The hero is the site's player. Press Listen (or the toaster, or its lever): the lever slams down,
 * the cassettes sink and the toaster rattles while the preview buffers, then they pop out with a
 * DING! and hop on every kick. Pause = "keeping warm" (half sunk). Layout is pure CSS; this file only
 * moves things.
 *
 * Transform ownership (no two systems ever write the same property):
 *   .toaster__rig   GSAP `transform` (entrance, charge, pop, hiccup)  ·  CSS `rotate` (pointer lean)
 *   .toaster__slice GSAP `transform` (poses)                           ·  CSS `translate` (per-frame kick)
 *   letter spans    GSAP yPercent (entrance) + y (landing dips) — separate components
 *   .hero__echo     CSS `translate` (per-frame kick)
 */

/* Toaster geometry, in the logo's viewBox units (526.8 × 516.93) */
const VB_W = 526.8;
const VB_H = 516.93;
const SLOT_LEAN = 0.28; // the slots lean: a cassette rising 1 unit also moves 0.28 right
const LEVER_LEAN = 0.27; // the lever track leans the other way
const REST = 0;
const POPPED = 40; // cassettes stick out while a track plays
const WARM = -20; // paused: half sunk, "keeping warm"
const SUNK = -150; // charged: all the way down, only the tape curls show

/** A slice moved `u` units up its slot (negative = down), as % of its full-stage layer */
const slot = (u) => ({ yPercent: (-u / VB_H) * 100, xPercent: ((u * SLOT_LEAN) / VB_W) * 100 });
/** The lever pushed `u` units down its track */
const leverAt = (u) => ({ yPercent: (u / VB_H) * 100, xPercent: ((-u * LEVER_LEAN) / VB_W) * 100 });
const trackNo = (p) => Number(p.key.split(":")[1]);
const pad = (n) => String(n).padStart(2, "0");

export function initToaster({ heroApi, reducedMotion = false }) {
  const hero = document.querySelector("[data-hero]");
  if (!hero) return { playEntrance() {} };
  const html = document.documentElement;
  const $ = (s) => hero.querySelector(s);

  const stage = $("[data-stage]");
  const toaster = $("[data-toaster]");
  const rig = $("[data-rig]");
  const back = $('[data-slice="back"]');
  const front = $('[data-slice="front"]');
  const slices = [back, front];
  const lever = $("[data-lever]");
  const ding = $(".toaster__ding");
  const shadow = $("[data-toaster-shadow]");
  const sun = $("[data-sun]");
  const lettersWrap = $("[data-letters]");
  const letters = [...lettersWrap.children];
  const under = letters.slice(5); // U R A carry the toaster
  const echo = $(".hero__echo");
  const listen = $("[data-hero-listen]");
  const listenIcon = listen.querySelector("[data-listen-icon]");
  const listenLabel = listen.querySelector("[data-listen-label]");
  const leverBtn = $("[data-lever-btn]");
  const hint = $("[data-hint]");
  const serve = {
    root: $("[data-serve]"),
    cover: $("[data-serve-cover]"),
    pill: $("[data-serve-pill]"),
    title: $("[data-serve-title]"),
    meta: $("[data-serve-meta]"),
    bar: $("[data-serve-progress]"),
  };
  const live = document.querySelector("[data-now-status]");
  const isCrash = (p) => !!p && p.releaseId === crashAlbum?.id;
  const total = crashAlbum?.playables.length ?? 14;

  let mode = "rest"; // rest | charging | popped | warm
  let pose = null; // the one pose timeline — always killed before the next
  let rattle = null;
  let chargedAt = 0;
  let heroVisible = true;
  let unit = 1; // CSS px per viewBox unit
  let wm = 100; // wordmark font-size, px
  let shownKey;
  let failedKey = null;
  let interacted = false;
  const animate = () => heroVisible && !reducedMotion && !document.hidden;

  listenIcon.innerHTML = icon("play");
  listen.dataset.glyph = "play";
  gsap.set(slices, { ...slot(REST), rotation: 0 });
  gsap.set(lever, leverAt(0));
  gsap.set(ding, { autoAlpha: 0, scale: 0 });

  /* ── Geometry JS needs (layout itself is CSS): px per unit, font-size, the sun centre for the rays ── */
  function offsetIn(el, root) {
    let x = 0;
    let y = 0;
    for (let n = el; n && n !== root; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return { x, y };
  }

  function fit() {
    unit = stage.offsetWidth / VB_W;
    wm = parseFloat(getComputedStyle(lettersWrap).fontSize) || wm;
    const r = sun.offsetWidth / 2;
    const o = offsetIn(sun, hero); // offsets ignore transforms, so the sunrise tween can't skew this
    const cx = o.x + r;
    const cy = o.y + r;
    hero.style.setProperty("--ox", `${cx}px`);
    hero.style.setProperty("--oy", `${cy}px`);
    hero.style.setProperty("--or", `${r}px`);
    heroApi.setOrigin(cx, cy, r);
  }
  new ResizeObserver(fit).observe(hero);
  document.fonts?.ready.then(fit);
  fit();

  /* ── Poses ── */
  const timeline = (delay = 0) => {
    pose?.kill();
    pose = gsap.timeline({ delay, defaults: { overwrite: "auto" } });
    return pose;
  };

  const dip = (t, px, at) =>
    t
      .to(under, { y: px, duration: 0.08, ease: "power2.out", stagger: 0.02 }, at)
      .to(under, { y: 0, duration: 0.55, ease: "elastic.out(1, 0.45)", stagger: 0.02 }, at + 0.08);

  function stopRattle() {
    if (!rattle) return;
    rattle.kill();
    rattle = null;
    gsap.to(rig, { x: 0, rotation: 0, duration: 0.12, overwrite: "auto" });
  }

  function charge() {
    if (mode === "charging") return;
    mode = "charging";
    chargedAt = performance.now();
    hero.classList.add("is-used");
    if (!animate()) {
      gsap.set(slices, { ...slot(SUNK), rotation: 0 });
      gsap.set(lever, leverAt(26));
      return;
    }
    timeline()
      .to(lever, { ...leverAt(26), duration: 0.12, ease: "power4.in" }, 0)
      .to(back, { ...slot(SUNK), rotation: 0, duration: 0.14, ease: "power3.in" }, 0)
      .to(front, { ...slot(SUNK), rotation: 0, duration: 0.14, ease: "power3.in" }, 0.03)
      .to(rig, { scaleX: 1.03, scaleY: 0.94, duration: 0.12, ease: "power2.out" }, 0)
      .add(() => {
        // Rattles for at most 1.2s, then just sits charged ("simmering") until audio arrives
        rattle = gsap.to(rig, {
          x: "random(-2, 2)",
          rotation: "random(-0.8, 0.8)",
          duration: 0.05,
          ease: "none",
          repeat: 23,
          repeatRefresh: true,
          onComplete: stopRattle,
        });
      }, 0.17);
  }

  function pop() {
    const fromCharge = mode === "charging";
    mode = "popped";
    stopRattle();
    if (!animate()) {
      gsap.set(slices, { ...slot(POPPED), rotation: 0 });
      gsap.set(lever, leverAt(0));
      gsap.set(rig, { scaleX: 1, scaleY: 1 });
      if (fromCharge && reducedMotion && heroVisible) {
        gsap.fromTo(ding, { autoAlpha: 0, scale: 1, rotation: 8 }, { autoAlpha: 1, duration: 0.15, yoyo: true, repeat: 1, repeatDelay: 0.8 });
      }
      return;
    }
    // Keep the charge on screen long enough to read, even when the preview was already buffered
    const wait = fromCharge ? Math.max(0, 0.35 - (performance.now() - chargedAt) / 1000) : 0;
    const t = timeline(wait)
      .to(rig, { scaleX: 0.96, scaleY: 1.07, duration: 0.1, ease: "power2.out" }, 0)
      .to(rig, { scaleX: 1, scaleY: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" }, 0.1)
      .to(lever, { ...leverAt(0), duration: 0.4, ease: "back.out(3)" }, 0)
      .to(back, { ...slot(150), rotation: -8, duration: 0.38, ease: "power2.out" }, 0)
      .to(front, { ...slot(115), rotation: 6, duration: 0.36, ease: "power2.out" }, 0.04)
      .to(back, { ...slot(POPPED), rotation: 0, duration: 0.5, ease: "bounce.out" }, 0.38)
      .to(front, { ...slot(POPPED), rotation: 0, duration: 0.5, ease: "bounce.out" }, 0.4);
    dip(t, 0.022 * wm, 0.1);
    if (fromCharge) {
      t.fromTo(ding, { autoAlpha: 1, scale: 0, rotation: -20 }, { autoAlpha: 1, scale: 1, rotation: 8, duration: 0.45, ease: "back.out(3)" }, 0.05).to(
        ding,
        { scale: 0, autoAlpha: 0, duration: 0.25, ease: "power2.in" },
        1.1
      );
    }
  }

  /** WARM when paused, REST when ended / stopped / failed */
  function settle(to) {
    mode = to === WARM ? "warm" : "rest";
    stopRattle();
    if (!animate()) {
      gsap.set(slices, { ...slot(to), rotation: 0 });
      gsap.set(lever, leverAt(0));
      gsap.set(rig, { scaleX: 1, scaleY: 1 });
      return;
    }
    timeline()
      .to(slices, { ...slot(to), rotation: 0, duration: 0.45, ease: to === REST ? "back.out(2.5)" : "power3.inOut", stagger: 0.05 }, 0)
      .to(lever, { ...leverAt(0), duration: 0.35, ease: "back.out(3)" }, 0)
      .to(rig, { scaleX: 1, scaleY: 1, duration: 0.4, ease: "power2.out" }, 0);
  }

  /* ── State → UI ── */
  function renderListen({ current, playing, buffering, failed, finishedRelease }) {
    // Listen follows whichever CRASH track is up; once the album run has played out it starts over
    if (isCrash(current)) listen.dataset.playKey = finishedRelease === crashAlbum.id ? crashAlbum.playables[0].key : current.key;
    const mine = current?.key === listen.dataset.playKey;
    let label = "Listen to CRASH";
    let glyph = "play";
    if (mine) {
      if (failed) label = "Try again";
      else if (buffering) {
        label = "Toasting…";
        glyph = "flame";
      } else if (playing) {
        label = "Pause";
        glyph = "pause";
      } else if (state.progress > 0.99) label = "Play again";
      else label = "Resume";
    }
    listen.classList.toggle("is-toasting", mine && buffering && !failed);
    if (listenLabel.textContent !== label) listenLabel.textContent = label;
    if (listen.dataset.glyph !== glyph) {
      listen.dataset.glyph = glyph;
      listenIcon.innerHTML = icon(glyph);
    }
    if (failed && current && failedKey !== current.key && live) {
      failedKey = current.key;
      live.textContent = `The ${current.title} preview didn't load. Try again.`;
    }
    if (!failed) failedKey = null;
  }

  function renderServe({ current, playing }) {
    serve.root.classList.toggle("is-live", !!current && playing);
    serve.pill.textContent = !current ? "Now serving" : playing ? "Now toasting" : "Keeping warm";
    const key = current?.key ?? null;
    if (key === shownKey) return;
    shownKey = key;
    const src = current ? current.coverSm || current.cover : crashAlbum?.coverSm;
    if (src && serve.cover.dataset.src !== src) {
      serve.cover.dataset.src = src;
      serve.cover.src = src;
    }
    if (!current) {
      serve.title.textContent = "Crash";
      serve.meta.textContent = `The album · ${total} tracks`;
      serve.bar.style.transform = "scaleX(0)";
      return;
    }
    serve.title.textContent = current.title;
    serve.meta.textContent = isCrash(current) ? `Crash · ${pad(trackNo(current))} of ${total} · preview` : `${current.release} · single · preview`;
    // Off the hero the mini-player announces the track (its own live region), so say it once
    if (live && html.classList.contains("hero-controls-visible")) {
      const ft = current.features?.length ? ` featuring ${current.features.join(" and ")}` : "";
      live.textContent = `Now playing ${current.title}${ft}, from ${current.release}. 30-second preview.`;
    }
  }

  function syncLever(current) {
    if (isCrash(current)) {
      const list = crashAlbum.playables;
      const next = list[(list.findIndex((p) => p.key === current.key) + 1) % list.length];
      leverBtn.setAttribute("aria-label", `Push the lever: next track, ${next.title}`);
      leverBtn.dataset.cursor = "Next";
    } else {
      leverBtn.setAttribute("aria-label", "Push the lever: play CRASH");
      leverBtn.dataset.cursor = "Push";
    }
  }

  onChange((s) => {
    const { current, playing, buffering, failed } = s;
    renderListen(s);
    renderServe(s);
    syncLever(current);
    heroApi.setActive(isCrash(current) ? trackNo(current) - 1 : -1);

    if (!current || failed) {
      if (mode !== "rest") settle(REST);
    } else if (playing && !buffering) {
      if (mode !== "popped") pop();
    } else if (buffering) {
      if (mode !== "charging" && mode !== "popped") charge(); // started elsewhere (crate, tracklist, nav)
    } else if (mode === "popped" || mode === "charging") {
      settle(state.progress > 0.99 ? REST : WARM);
    }
  });

  /* ── Per frame, only while music plays and the hero is on screen (signal.js) ── */
  onSignal((s, dt) => {
    if (!heroVisible) return;
    serve.bar.style.transform = `scaleX(${state.progress})`; // information, so it runs with reduced motion too
    if (reducedMotion) return;
    const hop = s.bass * 36 * unit; // cassettes hop out of the slots on the kick
    back.style.translate = `${hop * SLOT_LEAN}px ${-hop}px`;
    front.style.translate = `${hop * 0.85 * SLOT_LEAN}px ${-hop * 0.85}px`;
    const o = (0.035 + s.bass * 0.03) * wm; // CRASH's title trail pulls away on the kick
    echo.style.translate = `${o}px ${o}px`;
    heroApi.frame(s, dt);
  });
  window.addEventListener("krayaura:lite", () => heroApi.setLite());
  window.addEventListener("krayaura:frozen", () => heroApi.freeze());

  /* ── Input ── */
  listen.addEventListener("click", () => {
    const key = listen.dataset.playKey;
    const willPause = state.current?.key === key && state.playing && !state.failed;
    if (!willPause) charge(); // audio.js's delegated handler does the actual play
  });

  // The lever always runs the album: from Listen's track, or (CRASH already up) the next one, wrapping
  leverBtn.addEventListener("click", () => {
    charge();
    const keys = queueFor(crashAlbum.id);
    const at = isCrash(state.current) ? keys.indexOf(state.current.key) : -1;
    playQueue(keys, at < 0 ? listen.dataset.playKey : keys[(at + 1) % keys.length]);
  });

  toaster.addEventListener("click", () => listen.click()); // pointer shortcut; keyboard users have Listen

  const markInteracted = () => (interacted = true);
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) =>
    window.addEventListener(t, markInteracted, { once: true, passive: true, capture: true })
  );

  if (!reducedMotion) {
    // Anticipation: hovering / focusing Listen dips the lever and sinks the cassettes a touch
    const anticipate = (on) => {
      if (mode !== "rest" && mode !== "warm") return;
      const base = mode === "warm" ? WARM : REST;
      gsap.to(lever, { ...leverAt(on ? 8 : 0), duration: on ? 0.18 : 0.4, ease: on ? "power2.out" : "back.out(3)", overwrite: "auto" });
      gsap.to(slices, {
        ...slot(on ? base - 10 : base),
        duration: on ? 0.2 : 0.45,
        ease: on ? "power2.out" : "back.out(3)",
        stagger: 0.03,
        overwrite: "auto",
      });
    };
    ["pointerenter", "focus"].forEach((t) => listen.addEventListener(t, () => anticipate(true)));
    ["pointerleave", "blur"].forEach((t) => listen.addEventListener(t, () => anticipate(false)));

    // Fine pointers: the toaster leans toward the cursor (CSS `rotate`, so it never fights GSAP)
    if (matchMedia("(pointer: fine)").matches) {
      const lean = { r: 0 };
      const to = gsap.quickTo(lean, "r", { duration: 0.6, ease: "power3", onUpdate: () => (rig.style.rotate = `${lean.r}deg`) });
      hero.addEventListener(
        "pointermove",
        (e) => {
          const b = hero.getBoundingClientRect();
          to(((e.clientX - b.left) / b.width - 0.5) * 6);
        },
        { passive: true }
      );
      hero.addEventListener("pointerleave", () => to(0));
    }

    // Leaving the hero: the copy drifts up and fades (the toaster, sun and rays stay put)
    gsap.to($(".hero__copy"), {
      y: -40,
      autoAlpha: 0.25,
      ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 },
    });
  }

  /* ── Visibility: pause the shader / per-frame work off-screen; the toaster is the player while it's up ── */
  // Always read the LAST entry: a fast scroll can batch "visible" and "gone" into one callback
  new IntersectionObserver(
    (entries) => {
      heroVisible = entries[entries.length - 1].isIntersecting;
      html.classList.toggle("hero-in-view", heroVisible);
      if (heroVisible) heroApi.resume();
      else heroApi.pause();
    },
    { threshold: 0.02 }
  ).observe(hero);

  new IntersectionObserver((entries) => html.classList.toggle("hero-controls-visible", entries[entries.length - 1].isIntersecting), {
    rootMargin: "-72px 0px 0px 0px",
  }).observe($(".hero__cta"));

  /* ── One idle hiccup, ever: 6s after the entrance, only if nobody has touched anything ── */
  function hiccupOnce() {
    if (reducedMotion) return;
    gsap.delayedCall(6, () => {
      if (interacted || mode !== "rest" || !animate()) return;
      const t = timeline()
        .to(rig, { y: -14, scaleX: 0.97, scaleY: 1.05, duration: 0.16, ease: "power2.out" })
        .to(rig, { y: 0, scaleX: 1, scaleY: 1, duration: 0.14, ease: "power2.in" })
        .addLabel("land")
        .to(rig, { scaleX: 1.08, scaleY: 0.9, duration: 0.07, ease: "power2.out" }, "land")
        .to(rig, { scaleX: 1, scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" }, "land+=0.07")
        .to(slices, { ...slot(34), duration: 0.16, ease: "power2.out", stagger: 0.03 }, "land")
        .to(slices, { ...slot(REST), duration: 0.45, ease: "bounce.out", stagger: 0.03 }, "land+=0.16");
      dip(t, 0.016 * wm, t.labels.land);
    });
  }

  /* ── Entrance (after runIntro resolves): letters rise, sun rises, toaster drops onto the counter ── */
  function playEntrance() {
    fit();
    if (reducedMotion) {
      html.classList.remove("hero-pending");
      return;
    }
    const nav = document.querySelectorAll(".site-header [data-enter]");
    const statement = $(".hero__statement").children;
    const underline = $(".doodle--hot").querySelectorAll("path");
    const t = gsap.timeline({ defaults: { overwrite: "auto" }, onComplete: hiccupOnce });

    gsap.set(lettersWrap, { clipPath: "inset(-0.6em -0.3em 0 -0.3em)" }); // letters rise out of the counter
    t.fromTo(letters, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: "power4.out", stagger: 0.04 }, 0)
      .set(lettersWrap, { clearProps: "clipPath" }, 1.2)
      .fromTo(sun, { yPercent: 55 }, { yPercent: 0, duration: 1.1, ease: "expo.out" }, 0.05)
      .add(() => heroApi.fan(1.1), 0.1)
      .fromTo(nav, { y: -30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.06 }, 0.3)
      .fromTo(rig, { y: () => -window.innerHeight * 1.1, rotation: -12 }, { y: 0, rotation: 0, duration: 0.5, ease: "power3.in" }, 0.35)
      .addLabel("land", 0.85)
      .to(rig, { scaleX: 1.12, scaleY: 0.85, duration: 0.08, ease: "power2.out" }, "land")
      .to(rig, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" }, "land+=0.08")
      .fromTo(shadow, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.4, ease: "power2.out" }, "land")
      .to(slices, { ...slot(40), duration: 0.14, ease: "power2.out", stagger: 0.03 }, "land")
      .to(slices, { ...slot(REST), duration: 0.5, ease: "bounce.out", stagger: 0.03 }, "land+=0.14")
      .fromTo(serve.root, { scale: 1.35, rotation: -12, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.35, ease: "power4.out" }, "land+=0.1")
      .fromTo(statement, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.08 }, "land+=0.12")
      .fromTo(underline, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut", stagger: 0.15 }, "land+=0.3")
      .fromTo($(".hero__roles"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: "power3.out" }, "land+=0.25")
      .fromTo(listen.parentElement.children, { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "back.out(2)", stagger: 0.08 }, "land+=0.3");
    dip(t, 0.03 * wm, t.labels.land);
    if (hint && getComputedStyle(hint).display !== "none") {
      t.fromTo(hint.firstElementChild, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.4 }, "land+=0.5").fromTo(
        hint.querySelectorAll("path"),
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut", stagger: 0.12 },
        "land+=0.55"
      );
    }
    html.classList.remove("hero-pending"); // every from-state above is already applied (immediateRender)
  }

  return { playEntrance };
}
