import { contact } from "./content.js";
import { icon } from "./icons.js";

const OPTIONS = [
  { id: "instagram", label: "Instagram DM", sub: "@krayaura", href: contact.instagram, icon: "instagram", external: true },
  { id: "email", label: "Email", sub: contact.email, href: contact.mailto, icon: "mail", external: false },
  { id: "whatsapp", label: "WhatsApp", sub: contact.phone, href: contact.whatsapp, icon: "whatsapp", external: true },
];

const menus = [];

/**
 * "Connect with me": a button that opens a small menu of three ways in (Instagram DM, email, WhatsApp).
 * A disclosure, not an ARIA menu: it is a button that shows a list of links, so Tab walks the links in order.
 * Escape or a click outside closes it (focus goes back to the button); it flips above the button when
 * there isn't room below. Mount point: `<div data-contact-menu data-contact-variant="ghost|primary|fab" data-contact-id="…">`.
 */
export function initContactMenus() {
  document.querySelectorAll("[data-contact-menu]").forEach((root, n) => {
    const isFab = root.dataset.contactVariant === "fab";
    const variant = isFab ? "contact-fab__btn" : root.dataset.contactVariant === "primary" ? "btn--primary" : "btn--ghost";
    const id = `contact-menu-${root.dataset.contactId || n}`;
    root.classList.add("contact");
    if (isFab) root.classList.add("contact-fab");
    root.innerHTML = `
      <button type="button" class="${isFab ? "magnetic contact-fab__btn" : `btn ${variant} magnetic contact__button`}" aria-expanded="false" aria-controls="${id}" aria-haspopup="true">
        <span>Connect with me</span>
        <span class="${isFab ? "contact-fab__switch" : "contact__caret"}" aria-hidden="true">${isFab ? "<i></i>" : "↓"}</span>
      </button>
      <ul class="contact__panel" id="${id}" hidden>
        ${OPTIONS.map(
          (o) => `
          <li>
            <a class="contact__link" data-contact-link="${o.id}" href="${o.href}"${o.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>
              <span class="contact__badge">${icon(o.icon)}</span>
              <span class="contact__text"><strong>${o.label}</strong><small>${o.sub}</small></span>
              <span class="contact__arrow" aria-hidden="true">↗</span>
            </a>
          </li>`
        ).join("")}
      </ul>`;

    const button = root.querySelector("button");
    const panel = root.querySelector(".contact__panel");

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

    const setOpen = (open, { restoreFocus = false } = {}) => {
      if (open === !panel.hidden) return;
      if (open) menus.forEach((m) => m !== api && m.close());
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

    const api = { close: () => setOpen(false) };
    menus.push(api);

    button.addEventListener("click", () => setOpen(panel.hidden));
    root.addEventListener("focusout", (e) => {
      if (!panel.hidden && e.relatedTarget && !root.contains(e.relatedTarget)) setOpen(false);
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    window.addEventListener("resize", () => !panel.hidden && place(), { passive: true });

    if (isFab) bindFabVisibility(root, () => setOpen(false));
  });
}

function bindFabVisibility(root, close) {
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
