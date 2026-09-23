import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/sections/header.css";
import "./styles/sections/hero.css";
import "./styles/sections/music.css";
import "./styles/sections/design.css";
import "./styles/sections/about.css";

import { site, socials } from "./js/content.js";
import { initHeroWebGL } from "./js/hero-webgl.js";
import { initScroll, initMagneticButtons } from "./js/scroll.js";
import { initCursor } from "./js/cursor.js";
import { renderMusic } from "./js/music.js";
import { renderDesign } from "./js/design.js";
import gsap from "gsap";

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

  const booking = document.querySelector("[data-booking]");
  if (booking) {
    booking.href = site.booking.href;
    booking.textContent = site.booking.label;
  }

  const bookingNote = document.querySelector("[data-booking-note]");
  if (bookingNote) {
    bookingNote.textContent = site.booking.note;
  }

  const socialRoot = document.querySelector("[data-socials]");
  if (socialRoot) {
    socialRoot.innerHTML = socials
      .map(
        (s) => `
        <a class="social-link" href="${s.href}" target="_blank" rel="noopener noreferrer">
          <span>${s.label}</span>
          <span>↗</span>
        </a>`
      )
      .join("");
  }

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const drawer = document.querySelector(".nav-drawer");
  if (!toggle || !drawer) return;

  const setOpen = (open) => {
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  toggle.addEventListener("click", () => setOpen(!drawer.classList.contains("is-open")));
  drawer.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
}

function initHeroVisibility(heroApi) {
  const hero = document.querySelector(".hero");
  if (!hero || !heroApi) return;

  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) heroApi.resume();
      else heroApi.pause();
    },
    { threshold: 0.05 }
  );
  io.observe(hero);
}

function boot() {
  hydrateStaticCopy();
  initNav();
  renderMusic(document.querySelector("#music"));
  renderDesign(document.querySelector("#design"), document.querySelector("#lightbox"));

  const hero = document.querySelector(".hero");
  const canvas = document.querySelector("#hero-canvas");

  if (reducedMotion && hero) {
    hero.classList.add("reduced-motion");
  }

  const heroApi = initHeroWebGL(canvas, { reducedMotion });
  initHeroVisibility(heroApi);

  initCursor();
  const { lenis } = initScroll();
  initMagneticButtons();
  initHeroIntro();

  // Smooth-scroll for in-page anchors via Lenis when available
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -20 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function initHeroIntro() {
  if (reducedMotion) return;
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(".hero__wordmark", { y: 80, autoAlpha: 0, duration: 1.1 })
    .from(".hero__tagline", { y: 24, autoAlpha: 0, duration: 0.8 }, "-=0.55")
    .from(".hero__cta .btn", { y: 20, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, "-=0.45")
    .from(".hero__logo", { autoAlpha: 0, scale: 1.06, duration: 1.2 }, 0.15);
}

boot();
