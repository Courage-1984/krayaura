import { projects } from "./content.js";

export function renderDesign(root, lightbox) {
  if (!root) return;

  const list = root.querySelector("[data-project-list]");
  if (!list) return;

  list.innerHTML = projects
    .map((project, i) => {
      const preview = project.cover
        ? `<img src="${project.cover}" alt="" loading="lazy" />`
        : `<div class="project-item__preview-fallback">${String(i + 1).padStart(2, "0")}</div>`;

      return `
        <li>
          <article
            class="project-item"
            tabindex="0"
            role="button"
            data-project-id="${project.id}"
            aria-label="Open project ${project.title}"
          >
            <div class="project-item__row">
              <span class="project-item__num">${String(i + 1).padStart(2, "0")}</span>
              <h3 class="project-item__title">${project.title}</h3>
              <span class="project-item__tag">${project.tag}</span>
            </div>
            <p class="project-item__desc">${project.description}</p>
            <div class="project-item__preview" aria-hidden="true">${preview}</div>
          </article>
        </li>
      `;
    })
    .join("");

  const openProject = (id) => {
    const project = projects.find((p) => p.id === id);
    if (!project || !lightbox) return;
    populateLightbox(lightbox, project);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  list.querySelectorAll(".project-item").forEach((item) => {
    const id = item.dataset.projectId;
    item.addEventListener("click", () => openProject(id));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProject(id);
      }
    });
  });

  lightbox?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

function populateLightbox(lightbox, project) {
  lightbox.querySelector("[data-lightbox-title]").textContent = project.title;
  lightbox.querySelector("[data-lightbox-meta]").textContent = project.tag;
  lightbox.querySelector("[data-lightbox-body]").textContent = project.description;
  const media = lightbox.querySelector("[data-lightbox-media]");
  if (project.cover) {
    media.innerHTML = `<img src="${project.cover}" alt="${project.title}" />`;
  } else {
    media.innerHTML = `<div class="project-item__preview-fallback">${project.title.slice(0, 1)}</div>`;
  }
  const link = lightbox.querySelector("[data-lightbox-link]");
  link.href = project.href;
}
