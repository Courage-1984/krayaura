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
  let seen = false;

  const hoverables = "a, button, .project-item, .record, .social-link, .nav-toggle, [data-toaster]";

  /** Hover ring + contextual label (e.g. "Drag", "Prev", "Play") for whatever is under the pointer. */
  const sync = (el) => {
    cursor.classList.toggle("is-hover", !!el?.closest?.(hoverables));
    const label = el?.closest?.("[data-cursor]")?.dataset.cursor;
    if (label) cursor.dataset.label = label;
    else delete cursor.dataset.label;
  };

  const onMove = (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    seen = true;
    cursor.classList.remove("is-hidden");
    sync(e.target);
    if (!raf) raf = requestAnimationFrame(tick); // asleep since the ring caught up
  };

  // Content moves under a still pointer (wheel scroll, playback state flips) → re-read what's there
  let pending = 0;
  const refresh = () => {
    if (!seen || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      sync(document.elementFromPoint(target.x, target.y));
    });
  };

  const onLeave = () => cursor.classList.add("is-hidden");

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("krayaura:cursor-refresh", refresh);
  document.documentElement.addEventListener("mouseleave", onLeave);

  // Eases after the pointer; sleeps once it has caught up (pointermove wakes it)
  function tick() {
    pos.x += (target.x - pos.x) * 0.22;
    pos.y += (target.y - pos.y) * 0.22;
    const still = Math.abs(target.x - pos.x) < 0.1 && Math.abs(target.y - pos.y) < 0.1;
    if (still) {
      pos.x = target.x;
      pos.y = target.y;
    }
    cursor.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    raf = still ? 0 : requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("scroll", refresh);
    window.removeEventListener("krayaura:cursor-refresh", refresh);
    document.documentElement.removeEventListener("mouseleave", onLeave);
  };
}
