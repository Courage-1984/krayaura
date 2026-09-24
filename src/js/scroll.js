import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initScroll() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-in"));
    return { lenis: null, destroy() {} };
  }

  const lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    touchMultiplier: 1.4,
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // opacity, not autoAlpha: until it's revealed a block must stay in the tab order and the accessibility
  // tree (visibility:hidden took the Connect CTA and cards out of both). Focus inside reveals it at once.
  document.querySelectorAll(".reveal").forEach((el) => {
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
        onStart() {
          el.classList.add("is-in");
        },
      }
    );
    el.addEventListener("focusin", () => tween.progress() < 1 && tween.play(), { passive: true });
  });

  // Records get dealt into the crate like cards
  const rail = document.querySelector("[data-track-rail]");
  if (rail) {
    const dealt = gsap.from(rail.querySelectorAll(".record"), {
      opacity: 0,
      y: 60,
      rotate: (i) => (i % 2 ? 5 : -5),
      duration: 0.8,
      stagger: 0.06,
      ease: "back.out(1.4)",
      scrollTrigger: { trigger: rail, start: "top 85%", once: true },
    });
    rail.addEventListener("focusin", () => dealt.progress() < 1 && dealt.play(), { passive: true });
  }

  return {
    lenis,
    destroy() {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    },
  };
}

export function initMagneticButtons(root = document) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  root.querySelectorAll(".magnetic").forEach((btn) => {
    const strength = 28;
    btn.addEventListener("pointermove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, {
        x: x / strength,
        y: y / strength,
        duration: 0.35,
        ease: "power3.out",
      });
    });
    btn.addEventListener("pointerleave", () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.55, ease: "power3.out" });
    });
  });
}
