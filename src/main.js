import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/sections/header.css";
import "./styles/sections/hero.css";
import "./styles/sections/music.css";
import "./styles/sections/yt-carousel.css";
import "./styles/sections/crash.css";
import "./styles/sections/design.css";
import "./styles/sections/about.css";
import "./styles/sections/crate.css";
import "./styles/sections/player.css";
import "./styles/sections/brand.css";
import "./styles/sections/intro.css";
import "./styles/sections/mia.css";
import "./styles/sections/contact.css";

import { site, socials, releaseById, aboutStats } from "./js/content.js";
import { markMia } from "./js/mia-letters.js";
import { initContactMenus } from "./js/contact-menu.js";
import { icon } from "./js/icons.js";
import { initHeroWebGL } from "./js/hero-webgl.js";
import { initScroll, initMagneticButtons } from "./js/scroll.js";
import { initCursor } from "./js/cursor.js";
import { renderMusic, jumpToRelease } from "./js/music.js";
import { initMiniPlayer } from "./js/mini-player.js";
import { refreshPlayState } from "./js/audio.js";
import { initDoodles } from "./js/doodles.js";
import { initMarquee } from "./js/marquee.js";
import { runIntro } from "./js/intro.js";
import { initToaster } from "./js/toaster.js";
import { initNav } from "./js/nav.js";
import { openRecordSheet } from "./js/record-sheet.js";

/** Load a chunk when the section is near, on idle, or when a matching nav link is pressed. */
function loadWhen(el, loader, { margin = "1200px", timeout = 4000 } = {}) {
  let p;
  const start = () => (p ||= loader());
  if (el) {
    const io = new IntersectionObserver(
      (ents) => {
        if (ents.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
  }
  const ric = window.requestIdleCallback || ((cb, opts) => setTimeout(cb, opts?.timeout ?? 1));
  ric(() => start(), { timeout });
  return start;
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hydrateStaticCopy() {
  document.querySelectorAll("[data-site-name]").forEach((el) => {
    el.textContent = site.name;
  });
  document.querySelectorAll("[data-tagline]").forEach((el) => {
    el.textContent = site.tagline;
  });

  const roles = document.querySelector("[data-roles]");
  if (roles) {
    roles.innerHTML = site.roleClusters
      .map(
        (c) => `
        <section class="about__cluster about__cluster--${c.id}">
          <p class="about__cluster-stamp">${c.label}</p>
          <ul>
            ${c.items.map((r) => `<li>${r}</li>`).join("")}
          </ul>
        </section>`
      )
      .join("");
  }

  const quote = document.querySelector("[data-about-quote]");
  if (quote) quote.innerHTML = `<p>${site.bioQuote}</p>`;

  const bio = document.querySelector("[data-bio]");
  if (bio) {
    bio.innerHTML = site.bioChapters
      .map(
        (c) => `
        <article class="about__chapter">
          <p class="about__chapter-label">${c.label}</p>
          <p>${markMia(c.text)}</p>
        </article>`
      )
      .join("");
  }

  const handle = document.querySelector("[data-about-handle]");
  if (handle) handle.textContent = site.handle;

  // The client's own figures (content.js). Cassette tapes (the ones that pop out of his toaster), in his
  // colours; A/B sides alternate
  const stats = document.querySelector("[data-about-stats]");
  if (stats) {
    const tapes = ["orange", "gold", "red", "blue"];
    stats.innerHTML = aboutStats
      .map(
        ({ n, label, plain }, i) => `
        <li class="cassette cassette--${tapes[i % tapes.length]}">
          <div class="cassette__label">
            <span class="cassette__side" aria-hidden="true">Side ${i % 2 ? "B" : "A"}</span>
            <strong class="cassette__num" data-count="${n}"${plain ? " data-plain" : ""}>${n}</strong>
            <span class="cassette__name">${label}</span>
          </div>
          <div class="cassette__window" aria-hidden="true">
            <span class="cassette__reel cassette__reel--full"></span>
            <span class="cassette__reel"></span>
          </div>
          <span class="cassette__head" aria-hidden="true"></span>
        </li>`
      )
      .join("");
  }

  // Connect: Spotify + Apple as the two wide cards, the rest as stickers
  const external = 'target="_blank" rel="noopener noreferrer"';
  const streamRoot = document.querySelector("[data-stream-cards]");
  if (streamRoot) {
    streamRoot.innerHTML = socials
      .filter((s) => s.primary)
      .map(
        (s) => `
        <a class="stream-card" href="${s.href}" ${external}>
          <span class="stream-card__badge">${icon(s.icon)}</span>
          <span class="stream-card__label">${s.cta}</span>
          <span class="stream-card__arrow" aria-hidden="true">↗</span>
        </a>`
      )
      .join("");
  }

  const socialRoot = document.querySelector("[data-socials]");
  if (socialRoot) {
    socialRoot.innerHTML = socials
      .filter((s) => !s.primary)
      .map(
        (s) => `
        <a class="social-link" href="${s.href}" ${external}>
          <span class="social-link__badge">${icon(s.icon, "icon social-link__icon")}</span>
          <span class="social-link__label">${s.label}</span>
          <span class="social-link__arrow" aria-hidden="true">↗</span>
        </a>`
      )
      .join("");
  }

  // Footer: icon-only strip, every platform
  const footerSocials = document.querySelector("[data-footer-socials]");
  if (footerSocials) {
    footerSocials.innerHTML = socials
      .map(
        (s) => `
        <li><a class="footer-social" href="${s.href}" ${external} aria-label="${s.label}" data-cursor="${s.label}">
          ${icon(s.icon, "icon footer-social__icon")}
        </a></li>`
      )
      .join("");
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
}

async function boot() {
  hydrateStaticCopy();
  const music = renderMusic(document.querySelector("#music"));
  initMiniPlayer();
  refreshPlayState();
  initContactMenus();

  // The hero is now the M.I.A. cover banner (CSS) lit by the music, so the old WebGL shader is no longer drawn
  const heroApi = initHeroWebGL(null, { reducedMotion });
  const toaster = initToaster({ heroApi, reducedMotion });

  initCursor();
  const { lenis } = initScroll();
  initNav({ lenis, reducedMotion }); // before the anchor handlers below (drawer links close first)
  initMagneticButtons();
  initDoodles();
  initMarquee(document.querySelector("[data-marquee]"), lenis);

  const loadAlbums = loadWhen(document.querySelector("#albums"), async () => {
    const [{ initMia }, { initCrash }, { initAlbumStickyPlay }] = await Promise.all([
      import("./js/mia.js"),
      import("./js/crash.js"),
      import("./js/album-sticky-play.js"),
    ]);
    initMia(document.querySelector("#mia"), { reducedMotion });
    initCrash(document.querySelector("#crash"));
    initAlbumStickyPlay();
    refreshPlayState();
  });
  const loadDesign = loadWhen(document.querySelector("#design"), async () => {
    const { renderDesign } = await import("./js/design.js");
    renderDesign(document.querySelector("#design"), document.querySelector("#lightbox"));
  });
  const loadAbout = loadWhen(document.querySelector("#about"), async () => {
    const { initAboutCarousel } = await import("./js/about-carousel.js");
    initAboutCarousel(document.querySelector("#about"), { reducedMotion });
  });
  const loadConnect = loadWhen(document.querySelector("#connect"), async () => {
    const { initConnect } = await import("./js/connect.js");
    initConnect({ lenis, reducedMotion });
  });

  const preload = [
    ['a[href="#mia"], a[href="#crash"], a[href="#albums"]', loadAlbums],
    ['a[href="#design"]', loadDesign],
    ['a[href="#about"]', loadAbout],
    ['a[href="#connect"]', loadConnect],
  ];
  preload.forEach(([sel, load]) => {
    document.querySelectorAll(sel).forEach((a) => a.addEventListener("pointerdown", load, { once: true }));
  });

  // Modals (record sheet, mobile menu) freeze the page scroll
  window.addEventListener("krayaura:modal", (e) => {
    // The layer under a still pointer just changed: drop a stale label ("Open" over the sheet's vinyl)
    requestAnimationFrame(() => window.dispatchEvent(new Event("krayaura:cursor-refresh")));
    if (!lenis) return;
    if (e.detail.open) lenis.stop();
    else lenis.start();
  });

  // In-page anchors: smooth-scroll clear of the floating header, then move focus to the target
  const navH = () => (document.querySelector(".site-header__inner")?.getBoundingClientRect().bottom ?? 72) + 12;
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const offset = id === "#top" ? 0 : -navH();
      if (lenis) lenis.scrollTo(target, { offset });
      else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset });
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });

  // Deep links (his Instagram bio, a shared record): #r/<release> opens that record, #v/<video id> cues a video.
  // The <head> script already skipped the intro for these. Nothing plays until the visitor taps.
  const arrive = (el, then) => {
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      // Web fonts or late images moved it while we travelled? One quick correction.
      const off = el.getBoundingClientRect().top - navH();
      if (Math.abs(off) > 24) {
        if (lenis) lenis.scrollTo(el, { offset: -navH(), immediate: true });
        else window.scrollBy(0, off);
      }
      then();
    };
    if (lenis) {
      lenis.scrollTo(el, { offset: -navH(), onComplete: once });
      setTimeout(once, 1800); // a touch mid-scroll can cancel Lenis's onComplete
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navH() });
      once();
    }
  };
  const route = async () => {
    const m = /^#([rv])\/([\w-]+)/.exec(location.hash);
    if (!m) return;
    const [, kind, id] = m;
    // Measure with the real fonts (the headings reflow when Righteous lands), but don't wait long
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1200))]);
    if (kind === "r" && releaseById[id]) {
      // The whole crate should be on screen (phones: the section head is taller than the viewport allows)
      const section = document.querySelector("#music");
      const crate = section.querySelector("[data-crate]");
      const fits = crate.getBoundingClientRect().bottom - section.getBoundingClientRect().top <= innerHeight - navH();
      arrive(fits ? section : crate, () => {
        jumpToRelease(id);
        openRecordSheet(id, null, { deepLink: true });
      });
    } else if (kind === "v" && music.video) {
      const i = music.video.indexOf(id);
      if (i >= 0) arrive(document.querySelector("[data-video]"), () => music.video.go(i));
    }
  };
  route();
  window.addEventListener("hashchange", route);

  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("is-ready")));

  await runIntro();
  toaster.playEntrance();
}

boot();
