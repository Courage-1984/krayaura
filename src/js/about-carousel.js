import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { aboutPhotos } from "./content.js";
import { initDragRail } from "./drag-rail.js";
import { pictureHTML } from "./media-picture.js";

gsap.registerPlugin(ScrollTrigger);

/**
 * About: a looping photo rail with Ken Burns on the current frame. Native scroll-snap does the swiping
 * on touch; the shared drag rail adds mouse drag and Shift/trackpad wheel; arrows, dots and ←/→ step it.
 * Auto-advances while in view (~4s), pauses on pointer/focus/drag, and skips motion when reduced.
 */
export function initAboutCarousel(root, { reducedMotion = false } = {}) {
  const frame = root?.querySelector("[data-about-carousel]");
  const rail = frame?.querySelector("[data-about-slides]");
  const dotsBox = root?.querySelector("[data-about-dots]");
  const status = root?.querySelector("[data-about-status]");
  if (!rail || !aboutPhotos.length) return;

  const n = aboutPhotos.length;
  const slideHTML = (p, i, clone) => `
      <li class="about__slide${clone ? " is-clone" : ""}" role="group" aria-roledescription="slide" aria-label="Photo ${i + 1} of ${n}"${clone ? " aria-hidden=\"true\"" : ""}>
        ${pictureHTML(
          [
            { jpg: p.srcSm, w: 506 },
            { jpg: p.src, w: 900 },
          ],
          {
            sizes: "(min-width: 900px) 26rem, 80vw",
            alt: clone ? "" : p.alt,
            width: 900,
            height: 1600,
            style: `object-position:${p.pos}`,
            loading: !clone && i === 0 ? "eager" : "lazy",
          }
        )}
      </li>`;

  const last = aboutPhotos[n - 1];
  const first = aboutPhotos[0];
  rail.innerHTML =
    slideHTML(last, n - 1, true) +
    aboutPhotos.map((p, i) => slideHTML(p, i, false)).join("") +
    slideHTML(first, 0, true);

  dotsBox.innerHTML = aboutPhotos
    .map((_, i) => `<button type="button" class="about__dot" data-about-dot="${i}" aria-label="Photo ${i + 1} of ${n}"></button>`)
    .join("");

  const slides = [...rail.children];
  const dots = [...dotsBox.children];
  initDragRail(rail);

  const slot = () => rail.clientWidth || 1;
  const realIndex = (raw) => ((raw - 1 + n) % n + n) % n;
  const currentRaw = () => Math.round(rail.scrollLeft / slot());

  let index = 0;
  let jumping = false;
  let hovering = false;
  let inView = false;
  let timer = 0;
  const ken = new Map();

  const kenBurns = (slide, on) => {
    const img = slide.querySelector("img");
    if (!img) return;
    ken.get(img)?.kill();
    gsap.killTweensOf(img);
    if (reducedMotion) {
      gsap.set(img, { scale: 1, xPercent: 0, yPercent: 0 });
      ken.delete(img);
      return;
    }
    if (!on) {
      ken.set(img, gsap.to(img, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.7, ease: "power2.out" }));
      return;
    }
    const dir = (Number(slide.getAttribute("aria-label")?.match(/\d+/)?.[0]) || 1) % 3;
    const x = dir === 1 ? -2.5 : dir === 2 ? 2.2 : -1.5;
    const y = dir === 1 ? -3 : dir === 2 ? 2 : -2;
    const tl = gsap.timeline();
    gsap.set(img, { scale: 1, xPercent: 0, yPercent: 0 });
    tl.to(img, { scale: 1.08, xPercent: x, yPercent: y, duration: 1.2, ease: "power2.out" });
    tl.to(img, {
      scale: 1.04,
      xPercent: x * 0.35,
      yPercent: y * 0.35,
      duration: 4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    ken.set(img, tl);
  };

  const markCurrent = (i) => {
    slides.forEach((s, k) => {
      const on = k === i + 1;
      s.classList.toggle("is-current", on);
      kenBurns(s, on);
    });
    dots.forEach((d, k) => (k === i ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current")));
    if (status) status.textContent = `Photo ${i + 1} of ${n}`;
  };

  if (!reducedMotion) frame.classList.add("is-ken-js");

  const jumpTo = (raw) => {
    jumping = true;
    rail.scrollTo({ left: raw * slot(), behavior: "auto" });
    jumping = false;
  };

  const go = (raw, { smooth = !reducedMotion } = {}) => {
    const t = raw;
    rail.scrollTo({ left: t * slot(), behavior: smooth ? "smooth" : "auto" });
  };

  const wrapIfClone = () => {
    const raw = currentRaw();
    if (raw <= 0) jumpTo(n);
    else if (raw >= n + 1) jumpTo(1);
  };

  const sync = () => {
    wrapIfClone();
    const i = realIndex(currentRaw());
    if (i === index && slides[i + 1]?.classList.contains("is-current")) return;
    index = i;
    markCurrent(i);
  };

  const stopAuto = () => {
    clearInterval(timer);
    timer = 0;
  };
  const startAuto = () => {
    stopAuto();
    if (reducedMotion || hovering || !inView) return;
    timer = setInterval(() => go(currentRaw() + 1), 4000);
  };

  jumpTo(1);
  markCurrent(0);

  let raf = 0;
  rail.addEventListener(
    "scroll",
    () => {
      if (jumping) return;
      raf ||= requestAnimationFrame(() => ((raf = 0), sync()));
    },
    { passive: true }
  );
  frame.querySelectorAll("[data-about-step]").forEach((b) =>
    b.addEventListener("click", () => {
      stopAuto();
      go(currentRaw() + Number(b.dataset.aboutStep));
      startAuto();
    })
  );
  dotsBox.addEventListener("click", (e) => {
    const d = e.target.closest("[data-about-dot]");
    if (!d) return;
    stopAuto();
    go(Number(d.dataset.aboutDot) + 1);
    startAuto();
  });
  rail.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      stopAuto();
      go(currentRaw() + (e.key === "ArrowLeft" ? -1 : 1));
      startAuto();
    }
  });
  window.addEventListener("resize", () => jumpTo(index + 1), { passive: true });
  slides.forEach((s) => s.addEventListener("focusin", () => sync()));

  frame.addEventListener("pointerenter", () => {
    hovering = true;
    stopAuto();
  });
  frame.addEventListener("pointerleave", () => {
    hovering = false;
    startAuto();
  });
  frame.addEventListener("pointerdown", () => stopAuto());
  frame.addEventListener("pointerup", () => startAuto());
  frame.addEventListener("focusin", () => {
    hovering = true;
    stopAuto();
  });
  frame.addEventListener("focusout", (e) => {
    if (frame.contains(e.relatedTarget)) return;
    hovering = false;
    startAuto();
  });

  new IntersectionObserver(
    (entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) startAuto();
      else stopAuto();
    },
    { threshold: 0.35 }
  ).observe(frame);

  if (!reducedMotion) {
    gsap.from(root.querySelectorAll(".about__quote, .about__chapter"), {
      opacity: 0,
      y: 22,
      duration: 0.7,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: { trigger: root.querySelector(".about__body"), start: "top 78%", once: true },
    });
  }
}
