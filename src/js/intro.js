import gsap from "gsap";

/**
 * Once-per-session intro: counter climbs while fonts + first hero frame get ready (max 1.6s),
 * then the curtain wipes up. Resolves when the page should run its own entrance.
 */
export function runIntro() {
  const html = document.documentElement;
  const el = document.querySelector("[data-intro]");
  if (!el || !html.classList.contains("has-intro")) {
    el?.remove();
    return Promise.resolve();
  }

  try {
    sessionStorage.setItem("kr-intro", "1");
  } catch {
    /* storage blocked — intro just plays again next time */
  }

  const count = el.querySelector("[data-intro-count]");
  const logo = el.querySelector(".intro__logo");
  const word = el.querySelector(".intro__word span");
  const ready = Promise.race([
    Promise.all([document.fonts?.ready, new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))]),
    new Promise((r) => setTimeout(r, 1600)),
  ]);

  return new Promise((resolve) => {
    const n = { v: 0 };
    const tl = gsap.timeline();
    tl.fromTo(logo, { scale: 0.4, rotate: -18, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.7, ease: "back.out(2.2)" })
      .fromTo(word, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: "power4.out" }, 0.25)
      .to(n, { v: 82, duration: 0.9, ease: "power2.out", onUpdate: () => (count.textContent = Math.round(n.v)) }, 0);

    ready.then(() => {
      tl.to(n, { v: 100, duration: 0.35, ease: "power1.in", onUpdate: () => (count.textContent = Math.round(n.v)) })
        .to(logo, { scale: 1.25, rotate: 8, duration: 0.25, ease: "power2.in" })
        .to(el, {
          clipPath: "inset(0 0 100% 0)",
          duration: 0.8,
          ease: "expo.inOut",
          onStart: resolve,
          onComplete: () => {
            html.classList.remove("has-intro");
            el.remove();
          },
        });
    });
  });
}
