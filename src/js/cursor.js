export function initCursor() {
  const cursor = document.querySelector(".cursor");
  if (!cursor) return () => {};

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (coarse || reduced) {
    document.body.classList.add(coarse ? "touch-device" : "has-native-cursor");
    return () => {};
  }

  const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const target = { ...pos };
  let raf = 0;

  const onMove = (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    cursor.classList.remove("is-hidden");
  };

  const onLeave = () => cursor.classList.add("is-hidden");

  const hoverables = "a, button, .project-item, .track-card, .social-link, .nav-toggle";

  document.addEventListener("pointerover", (e) => {
    if (e.target.closest(hoverables)) cursor.classList.add("is-hover");
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(hoverables)) cursor.classList.remove("is-hover");
  });

  window.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", onLeave);

  const tick = () => {
    pos.x += (target.x - pos.x) * 0.22;
    pos.y += (target.y - pos.y) * 0.22;
    cursor.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("mouseleave", onLeave);
  };
}
