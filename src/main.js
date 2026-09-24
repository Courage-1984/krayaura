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

import { site, socials, proofLine, releaseById } from "./js/content.js";
import { icon } from "./js/icons.js";
import { initHeroWebGL } from "./js/hero-webgl.js";
import { initScroll, initMagneticButtons } from "./js/scroll.js";
import { initCursor } from "./js/cursor.js";
import { renderMusic, jumpToRelease } from "./js/music.js";
import { renderDesign } from "./js/design.js";
import { initCrash } from "./js/crash.js";
import { initMiniPlayer } from "./js/mini-player.js";
import { initDoodles } from "./js/doodles.js";
import { initMarquee } from "./js/marquee.js";
import { runIntro } from "./js/intro.js";
import { initToaster } from "./js/toaster.js";
import { initNav } from "./js/nav.js";
import { initConnect } from "./js/connect.js";
import { openRecordSheet } from "./js/record-sheet.js";

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
    roles.innerHTML = site.roles.map((r) => `<li>${r}</li>`).join("");
  }

  const bio = document.querySelector("[data-bio]");
  if (bio) {
    bio.innerHTML = site.bio.map((p) => `<p>${p}</p>`).join("");
  }

  const location = document.querySelector("[data-location]");
  if (location) {
    location.textContent = site.location;
  }

  const handle = document.querySelector("[data-about-handle]");
  if (handle) handle.textContent = site.handle;

  const profile = document.querySelector("[data-about-profile]");
  if (profile) {
    profile.src = site.profileImage;
    profile.alt = site.name;
  }

  const banner = document.querySelector("[data-about-banner]");
  if (banner) {
    banner.src = site.bannerImage;
    banner.alt = "";
  }

  const booking = document.querySelector("[data-booking]");
  if (booking) {
    booking.href = site.booking.href;
    booking.textContent = site.booking.label;
  }

  const bookingNote = document.querySelector("[data-booking-note]");
  if (bookingNote) {
    bookingNote.textContent = site.booking.note;
  }

  // Connect: Spotify + Apple as the two wide cards, the rest as stickers (Linktree lives in the footer)
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

  const proof = document.querySelector("[data-proof]");
  if (proof) proof.textContent = proofLine();

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
}

async function boot() {
  hydrateStaticCopy();
  const music = renderMusic(document.querySelector("#music"));
  initCrash(document.querySelector("#crash"));
  renderDesign(document.querySelector("#design"), document.querySelector("#lightbox"));
  initMiniPlayer();

  const hero = document.querySelector(".hero");
  const heroApi = initHeroWebGL(document.querySelector("#hero-canvas"), { reducedMotion });
  // No WebGL (or reduced motion) → the static CSS fan of rays shows instead
  if (hero && !heroApi.ok) hero.classList.add("reduced-motion");
  const toaster = initToaster({ heroApi, reducedMotion });

  initCursor();
  const { lenis } = initScroll();
  initNav({ lenis, reducedMotion }); // before the anchor handlers below (drawer links close first)
  initMagneticButtons();
  initDoodles();
  initMarquee(document.querySelector("[data-marquee]"), lenis);
  initConnect({ lenis, reducedMotion });

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
    // Measure with the real fonts (the headings reflow when Bolde lands), but don't wait long
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
