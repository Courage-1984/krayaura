/**
 * Horizontal rail: mouse drag with momentum + Shift/trackpad wheel, snapping to cards.
 * Touch keeps native swipe.
 */
export function initDragRail(rail) {
  if (!rail) return;

  rail.dataset.cursor = "Drag";
  rail.setAttribute("data-lenis-prevent-touch", "");

  const maxScroll = () => rail.scrollWidth - rail.clientWidth;
  const clamp = (v) => Math.max(0, Math.min(maxScroll(), v));

  let raf = 0;
  let idleTimer = 0;

  const stopMotion = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(idleTimer);
  };

  const snapToNearest = (from = rail.scrollLeft) => {
    const cards = [...rail.children].filter((c) => !c.hidden);
    if (!cards.length) {
      rail.classList.remove("is-dragging");
      return;
    }
    const padStart = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    const current = from;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card) => {
      const left = clamp(card.offsetLeft - padStart);
      const dist = Math.abs(left - current);
      if (dist < bestDist) {
        bestDist = dist;
        best = left;
      }
    });
    rail.scrollTo({ left: best, behavior: "smooth" });
    // Re-enable CSS snap once the smooth scroll has had time to land.
    idleTimer = setTimeout(() => rail.classList.remove("is-dragging"), 450);
  };

  // --- Mouse / pen drag ---
  let pointerId = null;
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let moved = false;
  let samples = [];

  rail.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    stopMotion();
    wheeling = false;
    rail.classList.remove("is-dragging");
    pointerId = e.pointerId;
    startX = e.clientX;
    startScroll = rail.scrollLeft;
    dragging = false;
    moved = false;
    samples = [{ x: e.clientX, t: performance.now() }];
  });

  rail.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < 5) return;
      dragging = true;
      moved = true;
      try {
        rail.setPointerCapture(pointerId);
      } catch {
        /* pointer already released */
      }
      rail.classList.add("is-dragging");
    }
    rail.scrollLeft = clamp(startScroll - dx);
    const now = performance.now();
    samples.push({ x: e.clientX, t: now });
    samples = samples.filter((s) => now - s.t < 100);
  });

  const endDrag = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!dragging) return;
    dragging = false;
    // The swallowing click fires synchronously after pointerup; clear afterwards so keyboard clicks still work.
    setTimeout(() => (moved = false), 0);

    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    // px per frame (~16ms), inverted: drag right = scroll left
    let velocity = (-(last.x - first.x) / dt) * 16;

    const glide = () => {
      velocity *= 0.92;
      const next = clamp(rail.scrollLeft + velocity);
      const hitEdge = next === 0 || next === maxScroll();
      rail.scrollLeft = next;
      if (Math.abs(velocity) > 0.5 && !hitEdge) {
        raf = requestAnimationFrame(glide);
      } else {
        raf = 0;
        snapToNearest();
      }
    };
    raf = requestAnimationFrame(glide);
  };

  rail.addEventListener("pointerup", endDrag);
  rail.addEventListener("pointercancel", endDrag);

  // Swallow the click that ends a drag so links don't open.
  rail.addEventListener(
    "click",
    (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    },
    true
  );

  rail.addEventListener("dragstart", (e) => e.preventDefault());

  // --- Shift+wheel / horizontal trackpad ---
  let wheelTarget = 0;
  let wheeling = false;

  const wheelStep = () => {
    const diff = wheelTarget - rail.scrollLeft;
    if (Math.abs(diff) < 0.5) {
      rail.scrollLeft = wheelTarget;
      raf = 0;
      return;
    }
    rail.scrollLeft += diff * 0.18;
    raf = requestAnimationFrame(wheelStep);
  };

  rail.addEventListener(
    "wheel",
    (e) => {
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!e.shiftKey && !horizontal) return; // plain vertical wheel scrolls the page

      e.preventDefault();
      e.stopPropagation(); // keep Lenis from scrolling the page

      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? rail.clientWidth : 1;
      const delta = (horizontal ? e.deltaX : e.deltaY) * unit;

      if (!wheeling) {
        // Take over from any drag glide or pending snap.
        stopMotion();
        wheeling = true;
        wheelTarget = rail.scrollLeft;
      }
      clearTimeout(idleTimer);
      rail.classList.add("is-dragging");
      wheelTarget = clamp(wheelTarget + delta);
      if (!raf) raf = requestAnimationFrame(wheelStep);

      idleTimer = setTimeout(() => {
        wheeling = false;
        stopMotion();
        snapToNearest(wheelTarget);
      }, 160);
    },
    { passive: false }
  );
}
