import gsap from "gsap";
import { icon } from "./icons.js";

const WORDS = ["Crash", "The album", "Out now", "14 tracks", "Pretoria", "Full creator"];

/** Skewed ticker whose speed and direction follow the scroll (Lenis velocity). */
export function initMarquee(root, lenis) {
  const track = root?.querySelector("[data-marquee-track]");
  if (!track) return;

  const run = WORDS.map((w, i) => `<span class="marquee__word${i % 2 ? " is-outline" : ""}">${w}</span>${icon(i % 2 ? "disc" : "flame", "icon marquee__sep")}`).join("");
  // Two copies → wrap seamlessly at -50%
  track.innerHTML = `<div class="marquee__run">${run}${run}</div><div class="marquee__run" aria-hidden="true">${run}${run}</div>`;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // WCAG 2.2.2: after the band comes into view or the page last scrolled, the 60px/s drift runs 4s, then
  // eases to a full stop by 5s. Scrolling still drives it (speed and direction). Off screen, it does nothing.
  let x = 0;
  let dir = -1;
  let boost = 0;
  let drift = 1; // 0..1 share of the base speed
  let idleFor = 0; // ms since the band came into view / the last scroll
  const base = 60; // px/s
  const RUN = 4000;
  const EASE = 1000; // RUN + EASE = 5s, then still
  const tick = (_, delta) => {
    const v = lenis?.velocity || 0;
    if (Math.abs(v) > 0.5) {
      dir = v > 0 ? -1 : 1;
      idleFor = 0;
    } else idleFor += delta;
    const t = Math.min(1, Math.max(0, (idleFor - RUN) / EASE));
    const target = 1 - t * t * (3 - 2 * t); // smoothstep down to exactly 0 at 5s
    drift = target > drift ? drift + (target - drift) * Math.min(1, delta / 300) : target; // pick up gently
    boost += (Math.min(Math.abs(v) * 30, 900) - boost) * 0.1;
    if (boost < 0.01) boost = 0;
    const speed = base * drift + boost;
    if (!speed) return; // at rest: nothing to write
    x += (dir * speed * delta) / 1000;
    const half = track.scrollWidth / 2;
    if (half) x = ((x % half) - half) % half;
    track.style.transform = `translate3d(${x}px,0,0)`;
  };

  let running = false;
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting === running) return;
    running = e.isIntersecting;
    if (running) {
      idleFor = 0; // coming into view: drift again for 5s
      gsap.ticker.add(tick);
    } else gsap.ticker.remove(tick);
  }).observe(root);
}
