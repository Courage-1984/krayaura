import gsap from "gsap";
import { icon } from "./icons.js";
import { onSignal } from "./signal.js";
import { markMia } from "./mia-letters.js";

const TICKETS = [
  { kind: "now", kicker: "No. 01", title: "Now serving" },
  { kind: "mia", kicker: "Order up", title: "M.I.A." },
  { kind: "now", kicker: "No. 14", title: "Now toasting" },
  { kind: "mia", kicker: "6 Nov", title: "M.I.A." },
];

function ticketHTML(t) {
  if (t.kind === "mia") {
    return `<span class="marquee__ticket marquee__ticket--mia">
      <span class="marquee__ticket-kicker">${t.kicker}</span>
      <strong class="marquee__ticket-title is-mia">${markMia(t.title)}</strong>
    </span>`;
  }
  return `<span class="marquee__ticket marquee__ticket--now">
    <span class="marquee__ticket-kicker">${t.kicker}</span>
    <strong class="marquee__ticket-title">${t.title}</strong>
  </span>${icon("flame", "icon marquee__sep")}`;
}

/** Diner order-up belt whose speed and direction follow the scroll (Lenis velocity). */
export function initMarquee(root, lenis) {
  const track = root?.querySelector("[data-marquee-track]");
  if (!track) return;

  const run = TICKETS.map(ticketHTML).join("");
  track.innerHTML = `<div class="marquee__run">${run}${run}</div><div class="marquee__run" aria-hidden="true">${run}${run}</div>`;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let x = 0;
  let dir = -1;
  let boost = 0;
  let drift = 1;
  let idleFor = 0;
  let onScreen = false;
  const base = 48;
  const RUN = 4000;
  const EASE = 1000;
  const tickets = [...track.querySelectorAll(".marquee__ticket")];

  const tick = (_, delta) => {
    const v = lenis?.velocity || 0;
    if (Math.abs(v) > 0.5) {
      dir = v > 0 ? -1 : 1;
      idleFor = 0;
    } else idleFor += delta;
    const t = Math.min(1, Math.max(0, (idleFor - RUN) / EASE));
    const target = 1 - t * t * (3 - 2 * t);
    drift = target > drift ? drift + (target - drift) * Math.min(1, delta / 300) : target;
    boost += (Math.min(Math.abs(v) * 30, 900) - boost) * 0.1;
    if (boost < 0.01) boost = 0;
    const speed = base * drift + boost;
    if (speed) {
      x += (dir * speed * delta) / 1000;
      const half = track.scrollWidth / 2;
      if (half) x = ((x % half) - half) % half;
      track.style.transform = `translate3d(${x}px,0,0)`;
    }
  };

  onSignal((s) => {
    if (!onScreen) return;
    const hop = (s.kick * 10).toFixed(2);
    tickets.forEach((el, i) => el.style.setProperty("--hop", i % 2 ? hop : (s.kick * 6).toFixed(2)));
    if (!s.live) tickets.forEach((el) => el.style.setProperty("--hop", "0"));
  });

  let running = false;
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (e.isIntersecting === running) return;
    running = e.isIntersecting;
    if (running) {
      idleFor = 0;
      gsap.ticker.add(tick);
    } else {
      gsap.ticker.remove(tick);
      tickets.forEach((el) => el.style.setProperty("--hop", "0"));
    }
  }).observe(root);
}
