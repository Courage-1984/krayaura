import { projects, releaseById, MEDIA } from "./content.js";
import { coverPicture, hydratePicture, mediaPathPicture, pictureHTML, thumbRel } from "./media-picture.js";
import behanceData from "../data/behance.json";
import portfolio from "../data/portfolio.json";

// Case-study galleries by id: the Behance projects plus the Professional Portfolio pages (portfolio.json)
const behance = { ...behanceData, ...portfolio };
import { initDragRail } from "./drag-rail.js";
import { refreshPlayState } from "./audio.js";
import { icon } from "./icons.js";

const pad = (n) => String(n).padStart(2, "0");

/** Title letters as spans (for the entrance bounce); words stay unbroken, the button keeps the real name */
function lettersHTML(title) {
  let n = 0;
  return title
    .split(" ")
    .map(
      (word) =>
        `<span class="pi-word">${[...word].map((ch) => `<span class="pi-ch" style="--c:${n};--tr:${((n++ * 37) % 25) - 12}deg">${escapeHTML(ch)}</span>`).join("")}</span>`
    )
    .join(" ");
}
// The media column is 32% of the 1120px container on desktop, full width on phones
const MEDIA_SIZES = "(max-width: 720px) calc(100vw - 2.5rem), min(32vw, 360px)";

function galleryImages(project) {
  return (project.gallery && behance[project.gallery]?.images) || [];
}

/** The row's work, always in flow: one sticker image, or a fan of sleeves that each open the gallery */
function mediaHTML(project) {
  if (project.releases) {
    const sleeves = project.releases
      .map((id, i) => {
        const r = releaseById[id];
        if (!r) return "";
        return `<button type="button" class="sleeve" data-sleeve="${i}" aria-label="${r.title} cover art: open the gallery" aria-haspopup="dialog">
            ${coverPicture(r.cover, r.coverSm, { width: 480, height: 480, alt: "" })}
          </button>`;
      })
      .join("");
    return `<div class="project-item__media project-item__sleeves">${sleeves}</div>`;
  }
  if (!project.cover) return "";
  const pages = galleryImages(project);
  if (pages.length > 1) {
    const stack = pages
      .map(
        (img, i) =>
          `<span class="project-item__scrub-page${i === 0 ? " is-on" : ""}" data-scrub-page="${i}" aria-hidden="${i === 0 ? "false" : "true"}">${mediaPathPicture(MEDIA, thumbRel(img.src), {
            sizes: MEDIA_SIZES,
            width: img.w,
            height: img.h,
            alt: "",
            loading: "lazy",
            deferSrc: i > 0,
          })}</span>`
      )
      .join("");
    const ticks = pages.map((_, i) => `<i${i === 0 ? ' class="is-on is-now"' : ""}></i>`).join("");
    return `<figure class="project-item__media project-item__sticker project-item__scrub" data-scrub="${escapeHTML(project.id)}" style="aspect-ratio:${project.width} / ${project.height}" aria-label="${escapeHTML(project.title)}: hover to flip through ${pages.length} pages">
      ${stack}
      <span class="project-item__scrub-hint">Hover to flip pages</span>
      <span class="project-item__scrub-bar" data-scrub-bar aria-hidden="true">${ticks}</span>
      <span class="project-item__scrub-count" data-scrub-count>1 / ${pages.length}</span>
    </figure>`;
  }
  return `<figure class="project-item__media project-item__sticker" style="aspect-ratio:${project.width} / ${project.height}">
      ${pictureHTML(project.cover, {
        sizes: project.srcset ? MEDIA_SIZES : "",
        width: project.width,
        height: project.height,
        alt: "",
      })}
    </figure>`;
}

export function renderDesign(root, lightbox) {
  if (!root) return;

  const list = root.querySelector("[data-project-list]");
  if (!list) return;

  list.innerHTML = projects
    .map((project, i) => {
      const desc = summary(project);
      return `
        <li>
          <article class="project-item${project.releases ? " project-item--sleeves" : ""}">
            <div class="project-item__row">
              <span class="project-item__num" aria-hidden="true">${pad(i + 1)}</span>
              <h3 class="project-item__title"><button type="button" class="project-item__open" data-project-id="${project.id}" aria-haspopup="dialog" aria-label="${escapeHTML(project.title)}"><span aria-hidden="true">${lettersHTML(project.title)}</span></button></h3>
              <span class="project-item__tag">${project.tag}</span>
            </div>
            ${mediaHTML(project)}
            ${desc ? `<p class="project-item__desc">${desc}</p>` : ""}
          </article>
        </li>
      `;
    })
    .join("");

  // Entrances: each row plays its own as it scrolls in (CSS in design.css under .is-anim / .is-in).
  // Only with JS + motion allowed; focus arriving first (keyboard) shows the row at once.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    list.classList.add("is-anim");
    const items = [...list.querySelectorAll(".project-item")];
    const show = (el) => el.classList.add("is-in");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target);
          io.unobserve(e.target);
        }),
      { threshold: 0.3, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => {
      io.observe(el);
      el.addEventListener("focusin", () => show(el), { once: true });
    });
  }

  let returnFocus = null;

  const openProject = (id, trigger, index = 0) => {
    const project = projects.find((p) => p.id === id);
    if (!project || !lightbox) return;
    populateLightbox(lightbox, project, index);
    returnFocus = trigger;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    window.dispatchEvent(new CustomEvent("krayaura:modal", { detail: { open: true } }));
    lightbox.querySelector("[data-lightbox-close]")?.focus({ preventScroll: true });
  };

  const closeLightbox = () => {
    if (!lightbox?.classList.contains("is-open")) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    window.dispatchEvent(new CustomEvent("krayaura:modal", { detail: { open: false } }));
    returnFocus?.focus({ preventScroll: true });
  };

  document.addEventListener("keydown", (e) => {
    if (!lightbox?.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    // ← / → page the gallery (not while a ▶ or link has focus and wants the key for itself)
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      stepGallery(lightbox, e.key === "ArrowLeft" ? -1 : 1);
    }
  });

  lightbox?.querySelectorAll("[data-lightbox-step]").forEach((b) =>
    b.addEventListener("click", () => stepGallery(lightbox, Number(b.dataset.lightboxStep)))
  );

  // Real buttons: Enter / Space come for free. The title's stretched ::after makes the whole card a target;
  // the sleeves sit above it and open the gallery on their own release.
  list.addEventListener("click", (e) => {
    const sleeve = e.target.closest(".sleeve");
    const open = sleeve ? sleeve.closest(".project-item")?.querySelector(".project-item__open") : e.target.closest(".project-item__open");
    if (!open) return;
    openProject(open.dataset.projectId, sleeve || open, sleeve ? Number(sleeve.dataset.sleeve) : 0);
  });

  initHoverScrub(list, openProject);

  lightbox?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  lightbox?.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      // Only what's actually focusable right now (hidden arrows, a hidden description)
      const f = [...lightbox.querySelectorAll("button, a[href], [tabindex='0']")].filter(
        (el) => !el.disabled && !el.closest("[hidden]") && el.getClientRects().length
      );
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    }
  });
}

/** YouTube-timeline hover scrub on the two portfolio covers (fine pointer, motion allowed). */
function initHoverScrub(list, openProject) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || reduce.matches) return;

  list.querySelectorAll("[data-scrub]").forEach((el) => {
    const pages = [...el.querySelectorAll("[data-scrub-page]")];
    const count = el.querySelector("[data-scrub-count]");
    if (pages.length < 2) return;
    el.classList.add("is-live");
    const ticks = [...el.querySelectorAll("[data-scrub-bar] i")];
    let idx = 0;

    const show = (i) => {
      i = Math.max(0, Math.min(pages.length - 1, i));
      pages.forEach((p, k) => {
        p.classList.toggle("is-on", k === i);
        p.setAttribute("aria-hidden", String(k !== i));
      });
      ticks.forEach((t, k) => {
        t.classList.toggle("is-on", k <= i);
        t.classList.toggle("is-now", k === i);
      });
      idx = i;
      if (count) count.textContent = `${i + 1} / ${pages.length}`;
    };

    const fromX = (e) => {
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(0, e.clientX - r.left), Math.max(0, r.width - 0.001));
      return Math.floor((x / r.width) * pages.length);
    };

    const hydrate = () => el.querySelectorAll("[data-defer-src]").forEach(hydratePicture);
    el.addEventListener("pointerenter", hydrate, { once: true });
    el.addEventListener("focusin", hydrate, { once: true });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      hydrate();
      el.classList.add("is-scrubbing");
      show(fromX(e));
    });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("is-scrubbing");
      show(0);
    });
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = el.closest(".project-item")?.querySelector(".project-item__open");
      if (open) openProject(open.dataset.projectId, el, idx);
    });
  });
}

/** Full description: his own text from Behance (description.txt) wins over the placeholder line */
function describe(project) {
  return (project.gallery && behance[project.gallery]?.description) || project.description || "";
}

/** The row shows one line: the first paragraph, cut at its first sentence when it runs long */
function summary(project) {
  const first = describe(project).split(/\n\s*\n/)[0].trim();
  if (first.length <= 170) return first;
  const cut = first.match(/^.{40,170}?[.!?](?=\s)/);
  return cut ? cut[0] : `${first.slice(0, 167).replace(/\s+\S*$/, "")}…`;
}

/** The slide nearest the gallery's centre (at either end: the first / last one, which can't reach it) */
function currentSlide(gallery) {
  const max = gallery.scrollWidth - gallery.clientWidth;
  if (gallery.scrollLeft <= 2) return 0;
  if (gallery.scrollLeft >= max - 2) return gallery.children.length - 1;
  const box = gallery.getBoundingClientRect();
  const mid = box.left + box.width / 2;
  let best = 0;
  let bestD = Infinity;
  [...gallery.children].forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - mid);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Scroll slide i to the middle of the gallery */
function centreSlide(gallery, i, smooth = true) {
  const slide = gallery.children[i];
  if (!slide) return;
  const box = gallery.getBoundingClientRect();
  const r = slide.getBoundingClientRect();
  const left = gallery.scrollLeft + (r.left - box.left) - (box.width - r.width) / 2;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gallery.scrollTo({ left, behavior: smooth && !reduce ? "smooth" : "auto" });
}

/** Arrows + "03 / 18" + ←/→ for the open gallery (hidden when there's one image or none) */
function wireGallery(lightbox, gallery, start) {
  const counter = lightbox.querySelector("[data-lightbox-counter]");
  const [prev, next] = lightbox.querySelectorAll("[data-lightbox-step]");
  lightbox._gallery = gallery;
  const n = gallery ? gallery.children.length : 0;
  const multi = n > 1;
  prev.hidden = next.hidden = !multi;
  counter.hidden = !multi;
  lightbox.classList.toggle("has-nav", multi);
  if (!gallery) return;
  let raf = 0;
  const sync = () => {
    raf = 0;
    const i = currentSlide(gallery);
    counter.innerHTML = `<b>${pad(i + 1)}</b> / ${pad(n)}`;
    const max = gallery.scrollWidth - gallery.clientWidth;
    prev.disabled = gallery.scrollLeft <= 2;
    next.disabled = gallery.scrollLeft >= max - 2;
  };
  gallery.addEventListener("scroll", () => (raf ||= requestAnimationFrame(sync)), { passive: true });
  // Opened on the sleeve that was clicked: centre it once the panel has its size
  requestAnimationFrame(() => {
    centreSlide(gallery, start, false);
    sync();
  });
}

function stepGallery(lightbox, dir) {
  const gallery = lightbox._gallery;
  if (!gallery?.isConnected || gallery.children.length < 2) return;
  const i = Math.max(0, Math.min(gallery.children.length - 1, currentSlide(gallery) + dir));
  centreSlide(gallery, i);
}

const escapeHTML = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** One case-study slide: the module at its own aspect ratio, its caption under it */
function workSlide(project, img, i) {
  const caption = img.caption || project.title;
  return `
      <figure class="lightbox__slide">
        ${mediaPathPicture(MEDIA, img.src, {
          thumb: true,
          alt: escapeHTML(caption),
          width: img.w,
          height: img.h,
          style: `--ar:${(img.w / img.h).toFixed(4)}`,
          loading: i < 2 ? "eager" : "lazy",
        })}
        <figcaption>
          <span class="lightbox__caption">${escapeHTML(caption)}</span>
        </figcaption>
      </figure>`;
}

/** One gallery slide per release: sleeve + "Signal · Single · 2026" + a ▶ for its lead preview */
function releaseSlide(r, eager) {
  const lead = (r.lead && r.playables.find((p) => p.key === r.lead.key)) || r.playables[0];
  const play = lead
    ? `<button type="button" class="lightbox__play" data-play-key="${lead.key}" data-cursor="Play" aria-label="Play preview: ${lead.title}">
          <span class="lightbox__play-icon lightbox__play-icon--play">${icon("play")}</span>
          <span class="lightbox__play-icon lightbox__play-icon--pause">${icon("pause")}</span>
          <span class="lightbox__play-label lightbox__play-label--play">Play</span>
          <span class="lightbox__play-label lightbox__play-label--pause">Pause</span>
        </button>`
    : "";
  return `
      <figure class="lightbox__slide">
        ${coverPicture(r.cover, r.coverSm, {
          sizes: "(max-width: 720px) 80vw, 36rem",
          alt: `${r.title} cover art`,
          width: 1200,
          height: 1200,
          loading: "eager",
          fetchpriority: eager ? "high" : "low",
        })}
        <figcaption>
          <span class="lightbox__caption">${r.title} · ${r.type === "album" ? "Album" : "Single"} · ${r.year}</span>
          ${play}
        </figcaption>
      </figure>`;
}

function populateLightbox(lightbox, project, index = 0) {
  lightbox.querySelector("[data-lightbox-title]").textContent = project.title;
  lightbox.querySelector("[data-lightbox-meta]").textContent = project.tag;
  const body = lightbox.querySelector("[data-lightbox-body]");
  const paragraphs = describe(project)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  body.innerHTML = paragraphs.map((p) => `<p>${escapeHTML(p)}</p>`).join("");
  body.hidden = !paragraphs.length;
  const media = lightbox.querySelector("[data-lightbox-media]");
  const images = (project.gallery && behance[project.gallery]?.images) || [];
  const sleeves = (project.releases || []).map((id) => releaseById[id]).filter(Boolean);
  // Case-study galleries get a wider panel so tall pages and wide spreads both read
  lightbox.classList.toggle("is-wide", !sleeves.length && images.length > 1);

  if (sleeves.length) {
    // Cover art: a swipeable gallery of the sleeves, opened on the one that was clicked, each with its preview
    media.classList.add("is-gallery");
    media.innerHTML = `<div class="lightbox__gallery lightbox__gallery--sleeves" data-gallery>${sleeves.map((r, i) => releaseSlide(r, i === index)).join("")}</div>`;
    const gallery = media.querySelector("[data-gallery]");
    initDragRail(gallery);
    refreshPlayState(); // a ▶ whose track is already playing shows it straight away
  } else if (images.length) {
    // Swipeable gallery (drag / Shift+scroll / touch), same rail behaviour as the crate
    media.classList.add("is-gallery");
    media.innerHTML = `<div class="lightbox__gallery lightbox__gallery--work" data-gallery data-cursor="Drag"
        role="group" aria-label="${escapeHTML(project.title)}: ${images.length} images — drag or scroll sideways">${images
      .map((img, i) => workSlide(project, img, i))
      .join("")}</div>`;
    const gallery = media.querySelector("[data-gallery]");
    gallery.scrollLeft = 0;
    initDragRail(gallery);
  } else {
    media.classList.remove("is-gallery");
    media.innerHTML = project.cover
      ? pictureHTML(project.cover, {
          sizes: project.srcset ? "(max-width: 720px) 100vw, 640px" : "",
          alt: project.title,
        })
      : `<div class="project-item__preview-fallback">${project.title.slice(0, 1)}</div>`;
  }
  wireGallery(lightbox, media.querySelector("[data-gallery]"), index);
  const link = lightbox.querySelector("[data-lightbox-link]");
  link.href = project.href;
  link.textContent = project.linkLabel || (project.tag === "Behance" ? "Full project on Behance ↗" : "View project ↗");
  if (project.linkLabel) link.setAttribute("download", ""); // the PDF: save it rather than navigate
  else link.removeAttribute("download");
}
