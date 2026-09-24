import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Connect's bookend: the toaster is the Back-to-top button. The two cassette-toast slices beside it are
 * decoration only: they pop up out of it the first time it scrolls into view, and again on a press.
 */
export function initConnect({ lenis, reducedMotion } = {}) {
  const btn = document.querySelector("[data-back-top]");
  if (!btn) return;
  const slices = [...btn.querySelectorAll("[data-toast-slice]")];
  const art = btn.querySelector(".connect__toaster-art");
  const UP = -60;

  if (reducedMotion) gsap.set(slices, { y: UP });
  else {
    gsap.set(slices, { y: 40 });
    ScrollTrigger.create({
      trigger: btn,
      start: "top 92%",
      once: true,
      onEnter: () => gsap.fromTo(slices, { y: 40 }, { y: UP, duration: 0.7, ease: "back.out(2.4)", stagger: 0.12 }),
    });
  }

  const toTop = () => {
    const top = document.querySelector("#top");
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    top?.focus({ preventScroll: true }); // keyboard users continue from the top too
  };

  btn.addEventListener("click", () => {
    if (reducedMotion) return toTop();
    // Squash the toaster, fire the toast, then ride back up to the hero
    gsap
      .timeline()
      .to(art, { scaleY: 0.82, scaleX: 1.1, transformOrigin: "50% 100%", duration: 0.12, ease: "power2.in" })
      .to(slices, { y: 40, duration: 0.12, ease: "power2.in" }, 0)
      .to(art, { scaleY: 1, scaleX: 1, duration: 0.45, ease: "elastic.out(1.1, 0.4)" })
      .to(slices, { y: UP - 40, duration: 0.3, ease: "back.out(2)", stagger: 0.06 }, "<")
      .to(slices, { y: UP, duration: 0.35, ease: "power2.inOut" }, ">-0.05")
      .add(toTop, 0.2); // the scroll starts as the toast fires
  });
}
