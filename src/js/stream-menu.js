import { hasMiaAlbumLinks, heroPreviewLabel, miaDate, miaStreamOptions, miaStreaming } from "./content.js";
import { icon } from "./icons.js";

const menus = [];

function panelHTML(options) {
  if (!options.length) {
    return `<li><p class="stream__soon">Full album on streaming <strong>${miaDate}</strong>. Links go live as platforms publish.</p></li>`;
  }
  return options
    .map(
      (o) => `
          <li>
            <a class="contact__link stream__link" data-stream-link="${o.id}" href="${o.href}" target="_blank" rel="noopener noreferrer">
              <span class="contact__badge">${icon(o.icon)}</span>
              <span class="contact__text"><strong>${o.label}</strong><small>Stream M.I.A.</small></span>
              <span class="contact__arrow" aria-hidden="true">↗</span>
            </a>
          </li>`
    )
    .join("");
}

function wire(root, { isFab, isHero, label }) {
  const button = root.querySelector("button");
  const panel = root.querySelector(".contact__panel");
  if (!button || !panel) return;

  const place = () => {
    root.classList.remove("is-up");
    if (isFab) {
      root.classList.add("is-up");
      return;
    }
    const room = window.innerHeight - button.getBoundingClientRect().bottom;
    const need = panel.offsetHeight + 16;
    if (room < need && button.getBoundingClientRect().top > need) root.classList.add("is-up");
  };

  let open = false;
  const setOpen = (next, { restoreFocus = false } = {}) => {
    if (next === open) return;
    if (next) menus.forEach((m) => m.close?.());
    open = next;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) {
      place();
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onKey);
    } else {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey);
      if (restoreFocus) button.focus();
    }
  };

  function onOutside(e) {
    if (!root.contains(e.target)) setOpen(false);
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false, { restoreFocus: true });
    }
  }

  button.addEventListener("click", () => {
    if (button.disabled) return;
    setOpen(panel.hidden);
  });
  root.addEventListener("focusout", (e) => {
    if (open && e.relatedTarget && !root.contains(e.relatedTarget)) setOpen(false);
  });
  panel.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  window.addEventListener("resize", () => open && place(), { passive: true });

  if (isFab) bindStreamFabVisibility(root, () => setOpen(false));

  return {
    close: () => setOpen(false),
    refresh: () => {
      const options = miaStreamOptions();
      const live = hasMiaAlbumLinks();
      panel.innerHTML = panelHTML(options);
      button.disabled = false;
      const btnLabel = root.querySelector("[data-stream-btn-label]");
      if (btnLabel) btnLabel.textContent = live || !isHero ? label : "Coming soon";
    },
  };
}

export function mountStreamMenu(root) {
  if (!root || root.dataset.streamReady) return menus.find((m) => m.root === root) || null;
  root.dataset.streamReady = "1";

  const variant = root.dataset.streamVariant || "inline";
  const isFab = variant === "fab-left";
  const isHero = variant === "hero";
  const id = `stream-menu-${root.dataset.streamId || menus.length}`;
  root.classList.add("contact", "stream");
  if (isFab) root.classList.add("stream-fab");

  const defaultLabel = isHero ? "Listen to M.I.A." : isFab ? "Streaming platforms" : "Listen to M.I.A.";
  const label = root.dataset.streamLabel || defaultLabel;
  const options = miaStreamOptions();
  const live = hasMiaAlbumLinks();
  const btnClass = isFab
    ? "magnetic stream-fab__btn"
    : "btn btn--mia-stream magnetic contact__button";

  root.innerHTML = `
      <button type="button" class="${btnClass}" aria-expanded="false" aria-controls="${id}" aria-haspopup="true">
        <span data-stream-btn-label>${live || !isHero ? label : "Coming soon"}</span>
        <span class="${isFab ? "stream-fab__switch" : "contact__caret"}" aria-hidden="true">${isFab ? "<i></i>" : "↓"}</span>
      </button>
      <ul class="contact__panel stream__panel" id="${id}" hidden>
        ${panelHTML(options)}
      </ul>`;

  const api = { root, ...wire(root, { isFab, isHero, label }) };
  menus.push(api);
  return api;
}

function bindStreamFabVisibility(root, close) {
  const html = document.documentElement;
  const connect = document.querySelector("#connect");
  let connectIn = false;
  let modalOpen = false;

  const sync = () => {
    const hide = html.classList.contains("hero-controls-visible") || connectIn || modalOpen;
    root.classList.toggle("is-hidden", hide);
    root.toggleAttribute("inert", hide);
    if (hide) close();
  };

  if (connect) {
    new IntersectionObserver(
      (entries) => {
        connectIn = entries[entries.length - 1].isIntersecting;
        sync();
      },
      { threshold: 0.18 }
    ).observe(connect);
  }
  window.addEventListener("krayaura:modal", (e) => {
    modalOpen = !!e.detail?.open;
    sync();
  });
  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ["class"] });
  sync();
}

function syncHeroPreview() {
  document.querySelectorAll("[data-hero-preview]").forEach((el) => {
    const presave = miaStreaming.presave && !hasMiaAlbumLinks();
    const label = el.querySelector("[data-preview-label]");
    if (label) label.textContent = heroPreviewLabel();

    if (presave && el.tagName === "BUTTON") {
      const a = document.createElement("a");
      a.className = el.className;
      a.href = miaStreaming.presave;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.dataset.heroPreview = "";
      a.innerHTML = el.innerHTML;
      el.replaceWith(a);
    } else if (presave && el.tagName === "A") {
      el.href = miaStreaming.presave;
    }
  });
}

export function initStreamMenus() {
  document.querySelectorAll("[data-stream-menu]").forEach((root) => mountStreamMenu(root));
  syncHeroPreview();
  if (!initStreamMenus.ready) {
    initStreamMenus.ready = true;
    window.addEventListener("krayaura:mia-streaming", () => {
      menus.forEach((m) => m.refresh?.());
      syncHeroPreview();
    });
  }
}

export function refreshStreamMenus() {
  window.dispatchEvent(new Event("krayaura:mia-streaming"));
}
