import { projects, releaseById, MEDIA } from "./content.js";
import behance from "../data/behance.json";
import { initDragRail } from "./drag-rail.js";
import { refreshPlayState } from "./audio.js";
import { icon } from "./icons.js";

const pad = (n) => String(n).padStart(2, "0");
// The media column is 32% of the 1120px container on desktop, full width on phones
const MEDIA_SIZES = "(max-width: 720px) calc(100vw - 2.5rem), min(32vw, 360px)";

/** The row's work, always in flow: one sticker image, or a fan of sleeves that each open the gallery */
function mediaHTML(project) {
  if (project.releases) {
    const sleeves = project.releases
      .map((id, i) => {
        const r = releaseById[id];
        if (!r) return "";
        return `<button type="button" class="sleeve" data-sleeve="${i}" aria-label="${r.title} cover art: open the gallery" aria-haspopup="dialog">
            <img src="${r.coverSm}" alt="" width="480" height="480" loading="lazy" decoding="async" draggable="false" />
          </button>`;
      })
      .join("");
    return `<div class="project-item__media project-item__sleeves">${sleeves}</div>`;
  }
  if (!project.cover) return "";
  const srcset = project.srcset ? ` srcset="${project.srcset}" sizes="${MEDIA_SIZES}"` : "";
  return `<figure class="project-item__media project-item__sticker" style="aspect-ratio:${project.width} / ${project.height}">
      <img src="${project.cover}"${srcset} alt="" width="${project.width}" height="${project.height}" loading="lazy" decoding="async" draggable="false" />
    </figure>`;
}

export function renderDesign(root, lightbox) {
  if (!root) return;

  const list = root.querySelector("[data-project-list]");
  if (!list) return;

  list.innerHTML = projects
    .map((project, i) => {
      const desc = describe(project);
      return `
        <li>
          <article class="project-item${project.releases ? " project-item--sleeves" : ""}">
            <div class="project-item__row">
              <span class="project-item__num" aria-hidden="true">${pad(i + 1)}</span>
              <h3 class="project-item__title"><button type="button" class="project-item__open" data-project-id="${project.id}" aria-haspopup="dialog">${project.title}</button></h3>
              <span class="project-item__tag">${project.tag}</span>
            </div>
            ${mediaHTML(project)}
            ${desc ? `<p class="project-item__desc">${desc}</p>` : ""}
          </article>
        </li>
      `;
    })
    .join("");

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
    if (e.key === "Escape" && lightbox?.classList.contains("is-open")) closeLightbox();
  });

  // Real buttons: Enter / Space come for free. The title's stretched ::after makes the whole card a target;
  // the sleeves sit above it and open the gallery on their own release.
  list.addEventListener("click", (e) => {
    const sleeve = e.target.closest(".sleeve");
    const open = sleeve ? sleeve.closest(".project-item")?.querySelector(".project-item__open") : e.target.closest(".project-item__open");
    if (!open) return;
    openProject(open.dataset.projectId, sleeve || open, sleeve ? Number(sleeve.dataset.sleeve) : 0);
  });

  lightbox?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  lightbox?.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      const f = [...lightbox.querySelectorAll("button, a[href]")];
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

function describe(project) {
  return (project.gallery && behance[project.gallery]?.description) || project.description || "";
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
        <img src="${r.cover}" srcset="${r.coverSm} 480w, ${r.cover} 1200w" sizes="(max-width: 720px) 80vw, 27rem"
          alt="${r.title} cover art" width="1200" height="1200" loading="${eager ? "eager" : "lazy"}" decoding="async" draggable="false" />
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
  body.textContent = describe(project);
  body.hidden = !body.textContent;
  const media = lightbox.querySelector("[data-lightbox-media]");
  const images = (project.gallery && behance[project.gallery]?.images) || [];
  const sleeves = (project.releases || []).map((id) => releaseById[id]).filter(Boolean);

  if (sleeves.length) {
    // Cover art: a swipeable gallery of the sleeves, opened on the one that was clicked, each with its preview
    media.classList.add("is-gallery");
    media.innerHTML = `<div class="lightbox__gallery lightbox__gallery--sleeves" data-gallery>${sleeves.map((r, i) => releaseSlide(r, i === index)).join("")}</div>`;
    const gallery = media.querySelector("[data-gallery]");
    initDragRail(gallery);
    const slide = gallery.children[index];
    if (slide) gallery.scrollLeft += slide.getBoundingClientRect().left - gallery.getBoundingClientRect().left;
    refreshPlayState(); // a ▶ whose track is already playing shows it straight away
  } else if (images.length) {
    // Swipeable gallery (drag / Shift+scroll / touch), same rail behaviour as the crate
    media.classList.add("is-gallery");
    media.innerHTML = `<div class="lightbox__gallery" data-gallery>${[project.cover, ...images.map((p) => `${MEDIA}/${p}`)]
      .map((src, i) => `<figure class="lightbox__slide"><img src="${src}" alt="${project.title} — image ${i + 1}" loading="lazy" draggable="false" /></figure>`)
      .join("")}</div>`;
    initDragRail(media.querySelector("[data-gallery]"));
  } else {
    media.classList.remove("is-gallery");
    media.innerHTML = project.cover
      ? `<img src="${project.cover}"${project.srcset ? ` srcset="${project.srcset}" sizes="(max-width: 720px) 100vw, 640px"` : ""} alt="${project.title}" />`
      : `<div class="project-item__preview-fallback">${project.title.slice(0, 1)}</div>`;
  }
  const link = lightbox.querySelector("[data-lightbox-link]");
  link.href = project.href;
  link.textContent = project.tag === "Behance" ? "Full project on Behance ↗" : "View project ↗";
}
