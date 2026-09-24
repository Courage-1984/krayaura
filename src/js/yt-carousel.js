import { videos } from "./content.js";
import { stop as stopPreview } from "./audio.js";

/**
 * 3D-ish YouTube carousel — center stage plays, flanks show thumbs.
 * Side slides use the ~8KB 320×180 webp; only the active slide pulls maxres (≈50–116KB), swapped in once loaded.
 * @returns {{ go(i: number): void, indexOf(id: string): number } | null} for #v/<id> deep links
 */
export function initYtCarousel(root) {
  if (!root || !videos.length) return null;

  let index = 0;
  let loaded = new Set();

  root.innerHTML = `
    <div class="yt-carousel" data-yt-carousel>
      <div class="yt-carousel__stage" data-stage></div>
      <div class="yt-carousel__controls">
        <button type="button" class="yt-carousel__nav" data-prev aria-label="Previous video">←</button>
        <div class="yt-carousel__dots" data-dots></div>
        <button type="button" class="yt-carousel__nav" data-next aria-label="Next video">→</button>
      </div>
      <a class="yt-carousel__watch" data-watch href="#" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>
    </div>
  `;

  const stage = root.querySelector("[data-stage]");
  const dots = root.querySelector("[data-dots]");
  const watch = root.querySelector("[data-watch]");

  stage.innerHTML = videos
    .map(
      (v, i) => `
      <article class="yt-slide" data-slide="${i}" data-offset="${i}">
        <div class="yt-slide__frame">
          <img class="yt-slide__thumb" src="${v.thumbLite}" alt="" width="320" height="180" loading="lazy" decoding="async" data-thumb />
          <div class="yt-slide__embed" data-embed></div>
          <button type="button" class="yt-slide__play" data-play aria-label="Play ${v.title}">
            <span>Play</span>
          </button>
          <div class="yt-slide__meta">
            <span class="yt-slide__index">${v.index}</span>
            <span class="yt-slide__title">${v.title}<em class="yt-slide__kind">${v.kind}</em></span>
          </div>
        </div>
      </article>`
    )
    .join("");

  dots.innerHTML = videos
    .map(
      (_, i) =>
        `<button type="button" class="yt-carousel__dot" data-dot="${i}" aria-label="Go to video ${i + 1}"></button>`
    )
    .join("");

  const slides = [...stage.querySelectorAll(".yt-slide")];

  const thumbs = slides.map((slide) => slide.querySelector("[data-thumb]"));
  // A missing webp falls back to the same size as a jpg
  thumbs.forEach((img, i) =>
    img.addEventListener("error", function lite() {
      img.removeEventListener("error", lite);
      if (img.dataset.hi !== "1") img.src = videos[i].thumbLiteFallback;
    })
  );

  /**
   * The active slide's big thumb: maxres, then the existing fallbacks (maxresdefault doesn't exist for every
   * upload — YouTube serves a 120×90 grey placeholder). Loaded off-DOM, swapped in only once it's good.
   */
  let near = false; // like the lazy thumbs: no maxres until the carousel is close to the viewport
  const upgrade = (i) => {
    const img = thumbs[i];
    if (!near || img.dataset.hi) return;
    img.dataset.hi = "pending";
    const queue = [videos[i].thumb, ...(videos[i].thumbFallbacks || [])];
    const tryNext = () => {
      const src = queue.shift();
      if (!src) return;
      const probe = new Image();
      probe.decoding = "async";
      probe.onload = () => {
        if (probe.naturalWidth <= 120) return tryNext();
        img.src = src;
        img.dataset.hi = "1";
      };
      probe.onerror = tryNext;
      probe.src = src;
    };
    tryNext();
  };

  const unloadAll = () => {
    slides.forEach((slide) => {
      const embed = slide.querySelector("[data-embed]");
      embed.innerHTML = "";
      slide.classList.remove("is-playing");
    });
    loaded.clear();
  };

  const loadEmbed = (i) => {
    const slide = slides[i];
    const embed = slide.querySelector("[data-embed]");
    if (loaded.has(i)) return;
    stopPreview(); // one soundtrack at a time
    embed.innerHTML = `<iframe
      src="${videos[i].embedUrl}&autoplay=1"
      title="${videos[i].title}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      loading="eager"
    ></iframe>`;
    loaded.add(i);
    slide.classList.add("is-playing");
  };

  const render = () => {
    const n = videos.length;
    slides.forEach((slide, i) => {
      let offset = i - index;
      if (offset > n / 2) offset -= n;
      if (offset < -n / 2) offset += n;
      slide.dataset.offset = String(offset);
      slide.classList.toggle("is-active", offset === 0);
      slide.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
      slide.inert = offset !== 0; // side slides are click targets for the stage, not focus stops
    });
    dots.querySelectorAll("[data-dot]").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
    });
    watch.href = videos[index].watchUrl;
    watch.textContent = `Watch ${videos[index].title} on YouTube ↗`;
    upgrade(index);
  };

  const go = (next) => {
    unloadAll();
    index = (next + videos.length) % videos.length;
    render();
  };

  // A music preview started elsewhere → stop the video
  window.addEventListener("krayaura:audio-play", () => {
    if (loaded.size) unloadAll();
  });

  root.querySelector("[data-prev]").addEventListener("click", () => go(index - 1));
  root.querySelector("[data-next]").addEventListener("click", () => go(index + 1));

  dots.querySelectorAll("[data-dot]").forEach((dot) => {
    dot.addEventListener("click", () => go(Number(dot.dataset.dot)));
  });

  // Which side of the centre slide a point falls on: -1 prev, 1 next, 0 on the active slide.
  const sideOf = (e) => {
    if (e.target.closest(".yt-slide.is-active")) return 0;
    const r = slides[index].getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? -1 : 1;
  };

  /* Drag (mouse, pen, touch): the slides follow the pointer live; on release a short flick moves one
     video, a long drag up to three. Starts only past a few px so plain clicks still work, and ignores
     drags that begin on a playing embed (its iframe eats pointer events anyway). */
  let drag = null;
  let swiped = false;
  const slideStep = () => slides[index].getBoundingClientRect().width * 0.42; // ≈ one slide's travel
  const setDrag = (px) => stage.style.setProperty("--drag", `${px}px`);

  stage.addEventListener("dragstart", (e) => e.preventDefault()); // no native image dragging

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("iframe")) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, live: false, t: performance.now(), vx: 0, lx: e.clientX, lt: performance.now() };
    swiped = false;
  });

  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.live) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return; // not (yet) a horizontal drag
      drag.live = true;
      stage.classList.add("is-dragging");
      stage.dataset.cursor = "Drag";
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    const now = performance.now();
    drag.vx = (e.clientX - drag.lx) / Math.max(1, now - drag.lt); // px/ms, for flicks
    drag.lx = e.clientX;
    drag.lt = now;
    drag.dx = dx;
    const max = slideStep() * 3.2;
    setDrag(Math.max(-max, Math.min(max, dx)) * 0.9);
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { live, dx, vx } = drag;
    drag = null;
    if (!live) return;
    swiped = true; // the click that follows a drag must not play / navigate
    stage.classList.remove("is-dragging");
    let steps = Math.round(-dx / slideStep());
    if (!steps && (Math.abs(dx) > 40 || Math.abs(vx) > 0.45)) steps = dx < 0 ? 1 : -1;
    steps = Math.max(-3, Math.min(3, steps));
    setDrag(0); // eases back (translate transition) as the new layout slides in
    if (steps) go(index + steps);
    setTimeout(() => (swiped = false), 0);
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  stage.addEventListener("click", (e) => {
    if (swiped) {
      swiped = false;
      return;
    }
    const side = sideOf(e);
    if (side === 0) loadEmbed(index);
    else go(index + side);
  });

  stage.addEventListener("pointermove", (e) => {
    if (drag?.live) return; // "Drag" label while dragging
    const side = sideOf(e);
    if (side === 0) delete stage.dataset.cursor;
    else stage.dataset.cursor = side < 0 ? "Prev" : "Next";
  });
  stage.addEventListener("pointerleave", () => delete stage.dataset.cursor);

  // Focusable for the arrow keys: named, or it announces every slide's text as its name
  root.tabIndex = 0;
  root.setAttribute("role", "region");
  root.setAttribute("aria-roledescription", "carousel");
  root.setAttribute("aria-label", "Videos, use left and right arrow keys");
  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  });

  new IntersectionObserver(
    ([entry], obs) => {
      if (!entry.isIntersecting) return;
      near = true;
      upgrade(index);
      obs.disconnect();
    },
    { rootMargin: "600px 0px" }
  ).observe(root);

  // Pause off-screen
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) unloadAll();
    },
    { threshold: 0.15 }
  );
  io.observe(root);

  render();

  return {
    go,
    indexOf: (id) => videos.findIndex((v) => v.id === id),
  };
}
