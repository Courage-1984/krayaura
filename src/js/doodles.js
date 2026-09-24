import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Hand-drawn stroke doodles (his "expressive strokes"): each path uses pathLength=1 so the
 * draw-on animation is just dashoffset 1 → 0.
 */
const DOODLES = {
  underline: {
    viewBox: "0 0 240 30",
    paths: ["M5 17c38-9 88-11 130-7 30 3 63 2 100-5", "M28 24c48-6 106-7 168-3"],
  },
  burst: {
    viewBox: "0 0 100 100",
    paths: [
      "M50 8v18M50 74v18M8 50h18M74 50h18M20 20l13 13M67 67l13 13M80 20 67 33M33 67 20 80",
      "M50 34l5 10 11 1-8 7 3 11-11-6-10 6 3-11-8-7 11-1z",
    ],
  },
  arrow: {
    viewBox: "0 0 120 70",
    paths: ["M6 60C22 22 58 8 104 18", "M88 6l17 12-14 15"],
  },
  loops: {
    viewBox: "0 0 800 220",
    paths: [
      "M-10 150C60 40 150 20 190 90s-30 120-70 60 40-130 150-110 140 120 230 70 60-140 150-110 110 90 170 40",
    ],
  },
  // A marker scribbled through a line of text: across, then back (stretched to the text's width)
  strike: {
    viewBox: "0 0 300 30",
    paths: [
      "M4 18c26-3 52-7 84-6s58 3 88-1 60-5 88-3c14 1 24-1 32-3",
      "M290 12c-30 5-62 9-96 8s-62-3-94 1-58 4-90 2",
    ],
  },
};

/** `manual`: drawn by its owner's timeline (data-manual), so initDoodles leaves it alone */
export function doodle(name, className = "", { manual = false } = {}) {
  const d = DOODLES[name];
  if (!d) return "";
  const paths = d.paths.map((p) => `<path d="${p}" pathLength="1" />`).join("");
  return `<svg class="doodle doodle--${name} ${className}"${manual ? " data-manual" : ""} viewBox="${d.viewBox}" fill="none" preserveAspectRatio="none" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** One flat wedge around (0,0), pointing up: half of each 360/n slot, like the hero's title-card fan */
function wedge(n, r = 100) {
  const h = Math.PI / n / 2;
  const x = +(r * Math.sin(h)).toFixed(2);
  const y = +(r * Math.cos(h)).toFixed(2);
  return `M0 0L${-x} ${-y}A${r} ${r} 0 0 1 ${x} ${-y}Z`;
}

/**
 * A cartoon sunburst: n wedges (ray i at rotate(i*360/n), ray 0 straight up, clockwise), one per
 * CRASH track by default. Style with .sunburst / .sunburst__ray (fill); the box is square.
 */
export function sunburst(n = 14, className = "") {
  const d = wedge(n);
  const rays = Array.from({ length: n }, (_, i) => `<path class="sunburst__ray" d="${d}" transform="rotate(${+((i * 360) / n).toFixed(3)})" />`).join("");
  return `<svg class="sunburst ${className}" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">${rays}</svg>`;
}

/** A single ray of sunburst(n), same geometry (pointing up: rotate the box to aim it) */
export function sunburstRay(n = 14, className = "") {
  return `<svg class="sunburst ${className}" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><path class="sunburst__ray" d="${wedge(n)}" /></svg>`;
}

export function initDoodles() {
  document.querySelectorAll(".section-title").forEach((title) => {
    if (title.querySelector(".doodle")) return;
    title.classList.add("has-doodle");
    title.insertAdjacentHTML("beforeend", doodle("underline", "doodle--under"));
  });

  // The CRASH title burst and line strikes are added and drawn by crash.js (the pin's "ding")
  document.querySelector("[data-booking]")?.parentElement?.insertAdjacentHTML("beforeend", doodle("arrow", "doodle--arrow"));
  // Design: big void loops like his portfolio cover, across the top and (turned over) under the CTA
  const design = document.querySelector(".design");
  design?.insertAdjacentHTML("afterbegin", doodle("loops", "doodle--loops doodle--design"));
  design?.insertAdjacentHTML("beforeend", doodle("loops", "doodle--loops doodle--design doodle--design-end"));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // [data-manual] doodles (the hero's, CRASH's burst and .doodle--strike) are drawn by their own timeline
  document.querySelectorAll(".doodle:not([data-manual])").forEach((svg) => {
    if (reduced) return;
    const paths = [...svg.querySelectorAll("path")];
    // Hidden: one screen-length dash, pushed just past the start (no round-cap dot), a long gap after it
    const hide = () =>
      paths.forEach((p) => {
        const k = screenDash(p);
        p.style.strokeDasharray = `${k} ${k * 2}`;
        p.style.strokeDashoffset = `${k * 1.05}`;
      });
    hide();
    ScrollTrigger.create({
      trigger: svg,
      start: "top 85%",
      once: true,
      onEnter: () => {
        hide(); // re-measure: web fonts and layout may have resized it since boot
        gsap.to(paths, {
          strokeDashoffset: 0,
          duration: 1.1,
          stagger: 0.18,
          ease: "power2.inOut",
          // Solid from here on, whatever size the doodle is resized to
          onComplete: () => gsap.set(paths, { clearProps: "strokeDasharray,strokeDashoffset" }),
        });
      },
    });
  });
}

/**
 * The pathLength=1 dash that covers a path on screen. With non-scaling-stroke, Chrome normalises the dash
 * in user units but draws it in screen px, so a doodle stretched s× wide drew only ~1/s of its line
 * (the section underlines stopped at ~70%). Measure the on-screen length instead.
 */
function screenDash(path) {
  const svg = path.ownerSVGElement;
  const vb = svg?.viewBox.baseVal;
  if (!vb?.width || getComputedStyle(path).vectorEffect !== "non-scaling-stroke") return 1;
  const sx = svg.clientWidth / vb.width;
  const sy = svg.clientHeight / vb.height;
  const total = path.getTotalLength();
  if (!sx || !sy || !total) return 1;
  let len = 0;
  let prev = path.getPointAtLength(0);
  for (let i = 1; i <= 64; i++) {
    const pt = path.getPointAtLength((total * i) / 64);
    len += Math.hypot((pt.x - prev.x) * sx, (pt.y - prev.y) * sy);
    prev = pt;
  }
  return (len / total) * 1.02;
}
