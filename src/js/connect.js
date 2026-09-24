import gsap from "gsap";

/** Connect's bookend: the toaster is the Back-to-top button. A press squashes it, then rides back up to the hero. */
export function initConnect({ lenis, reducedMotion } = {}) {
  const btn = document.querySelector("[data-back-top]");
  if (!btn) return;
  const art = btn.querySelector(".connect__toaster-art");

  const toTop = () => {
    const top = document.querySelector("#top");
    if (lenis) lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    top?.focus({ preventScroll: true }); // keyboard users continue from the top too
  };

  btn.addEventListener("click", () => {
    if (reducedMotion) return toTop();
    gsap
      .timeline()
      .to(art, { scaleY: 0.82, scaleX: 1.1, transformOrigin: "50% 100%", duration: 0.12, ease: "power2.in" })
      .to(art, { scaleY: 1, scaleX: 1, duration: 0.45, ease: "elastic.out(1.1, 0.4)" })
      .add(toTop, 0.2); // the scroll starts as the toaster springs back
  });
}
