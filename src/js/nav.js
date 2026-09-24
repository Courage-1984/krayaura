import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { onChange } from "./audio.js";
import { onSignal } from "./signal.js";
import { socials, releaseById } from "./content.js";
import { icon } from "./icons.js";

const SECTIONS = ["music", "crash", "design", "about", "connect"];
const DRAWER_SOCIALS = ["instagram", "tiktok", "youtube", "spotify", "apple", "behance"];

/**
 * Header: brand toaster (hover pops its cassettes, they hop with the kick) · slot capsule whose
 * active marker is a slice of toast that sinks and pops up under the next link · a browning page
 * meter · one play chip · and on mobile a menu served out of the toaster on his orange.
 */
export function initNav({ lenis = null, reducedMotion = false } = {}) {
  const header = document.querySelector("[data-header]");
  const drawer = document.querySelector(".nav-drawer");
  if (!header || !drawer) return;
  const html = document.documentElement;
  const nav = header.querySelector(".nav-links");
  const links = [...nav.querySelectorAll("a")];
  const toast = nav.querySelector("[data-nav-toast]");
  const progress = nav.querySelector("[data-nav-progress]");
  const play = header.querySelector("[data-nav-play]");
  const playLabel = play.querySelector("[data-nav-play-label]");
  const eq = [...play.querySelectorAll(".nav-play__eq i")];
  const hop = header.querySelector("[data-brand-hop]");
  const toggle = header.querySelector(".nav-toggle");
  const toggleLabel = toggle.querySelector("[data-toggle-label]");
  const cards = [...drawer.querySelectorAll(".drawer-card")];

  header.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  drawer.querySelector("[data-drawer-socials]").innerHTML = socials
    .filter((s) => DRAWER_SOCIALS.includes(s.icon))
    .map(
      (s) =>
        `<a class="drawer-social" href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="${s.label}">${icon(s.icon)}</a>`
    )
    .join("");

  /* ── 1. Scroll state (never hides: it holds the play control) + the browning meter ── */
  let scrolled = null;
  const onScroll = (y, p) => {
    const s = y > 80;
    if (s !== scrolled) {
      scrolled = s;
      header.dataset.state = s ? "scrolled" : "top";
    }
    // pathLength=1: offset 1 = empty, 0 = full. At the very top it's hidden (a round cap would leave a dot)
    const f = Math.min(1, Math.max(0, p || 0));
    progress.style.strokeDashoffset = String(1 - f);
    progress.style.opacity = f < 0.004 ? "0" : "1";
    surfaces(y);
  };

  /* The meter's path hugs the capsule's lower outline: from half-way up the left end, round the bottom-left
     corner, along the bottom, and round up into the right end. Rebuilt when the capsule resizes. */
  const brownSvg = nav.querySelector("[data-nav-brown]");
  const track = nav.querySelector("[data-nav-track]");
  const gradient = brownSvg?.querySelector("linearGradient");
  // Out of the capsule (it clips to inside its own border) and laid over its border box
  if (brownSvg) nav.after(brownSvg);
  const drawBrown = () => {
    const w = nav.offsetWidth;
    const h = nav.offsetHeight;
    if (!brownSvg) return;
    brownSvg.style.display = w && h ? "" : "none"; // phones: no capsule, no meter
    if (!w || !h) return;
    Object.assign(brownSvg.style, { left: `${nav.offsetLeft}px`, top: `${nav.offsetTop}px`, width: `${w}px`, height: `${h}px` });
    // Centred ON the capsule's 1px border line
    const border = parseFloat(getComputedStyle(nav).borderBottomWidth) || 1;
    const inset = border / 2;
    const r = Math.max(0, Math.min(parseFloat(getComputedStyle(nav).borderBottomLeftRadius) || h / 2, h / 2) - inset);
    const cy = h - inset - r; // centre height of both end arcs
    const yb = h - inset;
    // Starts / ends part-way round each end: SPAN of the quarter arc from the bottom (90° = half-way up)
    const SPAN = (55 * Math.PI) / 180;
    const sx = r * Math.sin(SPAN);
    const sy = cy + r * Math.cos(SPAN);
    const d = `M ${inset + r - sx} ${sy} A ${r} ${r} 0 0 0 ${inset + r} ${yb} L ${w - inset - r} ${yb} A ${r} ${r} 0 0 0 ${w - inset - r + sx} ${sy}`;
    brownSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    track.setAttribute("d", d);
    progress.setAttribute("d", d);
    gradient?.setAttribute("x2", String(w));
  };
  drawBrown();
  const brownRO = new ResizeObserver(drawBrown);
  brownRO.observe(nav);
  brownRO.observe(nav.parentElement); // the capsule can move without resizing (header layout changes)

  /* ── 1b. What's under the stickers: over the orange Design flood and the gold Connect finale the
     orange / gold chip (and the brand's orange shadow) would melt into the page, so header.css turns them
     void. Section edges are cached (re-read on ScrollTrigger refresh / resize); per scroll it's arithmetic.
     Both floods slant 3.5vw (tan 2° × 100vw): Design top and bottom, Connect top only. ── */
  const floods = [
    { el: document.getElementById("design"), name: "orange", slantBottom: true },
    { el: document.getElementById("connect"), name: "gold", slantBottom: false },
  ].filter((f) => f.el);
  const brand = header.querySelector(".brand-mark");
  let spans = [];
  let probes = [];
  let shown = {};
  const measure = () => {
    const sy = window.scrollY;
    const w = document.documentElement.clientWidth || window.innerWidth;
    spans = floods.map((f) => {
      const r = f.el.getBoundingClientRect();
      return { ...f, top: r.top + sy, bottom: r.bottom + sy };
    });
    probes = [
      ["surfacePlay", play],
      ["surfaceBrand", brand],
    ]
      .filter(([, el]) => el)
      .map(([key, el]) => {
        // Layout box (offset*), not the painted one: the entrance, hover nudge and hide-scale transform them
        const hr = header.getBoundingClientRect();
        return { key, fx: (hr.left + el.offsetLeft + el.offsetWidth / 2) / w, y: hr.top + el.offsetTop + el.offsetHeight / 2 };
      });
    surfaces(sy);
  };
  function surfaces(y) {
    const slant = (document.documentElement.clientWidth || window.innerWidth) * 0.035;
    probes.forEach(({ key, fx, y: vy }) => {
      const at = y + vy;
      const hit = spans.find(
        (f) => at >= f.top + slant * (1 - fx) && at <= f.bottom - (f.slantBottom ? slant * fx : 0)
      );
      const name = hit?.name ?? "";
      if (shown[key] === name) return;
      shown[key] = name;
      if (name) header.dataset[key] = name;
      else delete header.dataset[key];
    });
  }
  ScrollTrigger.addEventListener("refresh", measure);
  window.addEventListener("load", measure);
  new ResizeObserver(measure).observe(document.body);
  const nativeScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    onScroll(window.scrollY, max > 0 ? window.scrollY / max : 0);
  };
  if (lenis) lenis.on("scroll", (l) => onScroll(l.scroll, l.progress));
  else window.addEventListener("scroll", nativeScroll, { passive: true });
  nativeScroll();

  /* ── 2. Active section → the toast slice ── */
  gsap.set(toast, { x: 0, y: 64 });
  let active = null;
  let move = null;
  const place = (link) => {
    toast.style.width = `${link.offsetWidth}px`; // only ever changed while the slice is sunk
    gsap.set(toast, { x: link.offsetLeft });
  };

  function setActive(link) {
    if (link === active) return;
    const prev = active;
    active = link;
    links.forEach((a) => (a === link ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
    cards.forEach((c) => {
      const on = !!link && c.hash === link.hash;
      c.classList.toggle("is-current", on);
      if (on) c.setAttribute("aria-current", "location");
      else c.removeAttribute("aria-current");
    });
    move?.kill();
    if (reducedMotion || !nav.offsetWidth) {
      if (link) place(link);
      gsap.set(toast, { y: link ? 0 : 64, rotation: 0 });
      return;
    }
    move = gsap.timeline();
    if (prev) move.to(toast, { y: 64, rotation: 0, duration: 0.16, ease: "power2.in" });
    if (link) {
      move.add(() => place(link)).fromTo(toast, { y: 64, rotation: -8 }, { y: 0, rotation: 0, duration: 0.45, ease: "back.out(2.2)" });
    }
  }

  const seen = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
      const id = SECTIONS.find((s) => seen.has(s));
      setActive(id ? links.find((a) => a.hash === `#${id}`) : null); // over the hero: none, the slice stays sunk
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  SECTIONS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
  new ResizeObserver(() => active && place(active)).observe(nav); // fonts landing, breakpoints

  /* ── 3. Play chip: toggles whatever is loaded (audio.js runs the click through data-play-key) ── */
  onChange(({ current, playing, finished, finishedRelease }) => {
    // "Play CRASH" starts the album run; once something's loaded the chip only pauses / resumes it.
    // A whole-release run that has played out starts over from its first track, as a run again.
    const again = current && finished && finishedRelease ? releaseById[finishedRelease] : null;
    play.dataset.playKey = again ? (again.playables[0]?.key ?? current.key) : (current?.key ?? "crash:1");
    if (!current) play.dataset.queue = "crash";
    else if (again) play.dataset.queue = again.id;
    else delete play.dataset.queue;
    const verb = !current ? "Play" : playing ? "Pause" : finished ? "Play again" : "Resume";
    const label = current ? verb : "Play CRASH";
    if (playLabel.textContent !== label) playLabel.textContent = label;
    play.setAttribute("aria-label", !current ? "Play CRASH" : again ? `Play ${again.title} again` : `${verb} ${current.title}`);
  });

  onSignal((s) => {
    if (!html.classList.contains("hero-controls-visible")) {
      for (let i = 0; i < 4; i++) eq[i].style.transform = `scaleY(${Math.min(1, 0.25 + s.eq[i] * 0.95)})`;
    }
    if (hop && !reducedMotion) {
      const h = s.bass * 40; // user units up the slot axis
      hop.setAttribute("transform", `translate(${(h * 0.28).toFixed(1)} ${(-h).toFixed(1)})`);
    }
  });

  /* ── 4. Mobile drawer ── */
  const main = document.querySelector("main");
  const drawerToaster = drawer.querySelector(".nav-drawer__toaster");
  const drawerSlices = drawer.querySelector("[data-drawer-slices]");
  const fades = drawer.querySelectorAll("[data-drawer-fade]");
  const outside = () => [main, document.querySelector(".mini-player"), header.querySelector(".brand-mark"), play];
  let open = false;
  let tl = null;

  function animateDrawer(o) {
    tl?.kill();
    if (o) drawer.classList.add("is-open");
    if (reducedMotion) {
      if (!o) drawer.classList.remove("is-open"); // CSS does a 150ms fade
      return;
    }
    const r = toggle.getBoundingClientRect();
    const at = `${Math.round(r.left + r.width / 2)}px ${Math.round(r.top + r.height / 2)}px`;
    if (o) {
      tl = gsap
        .timeline()
        .fromTo(drawer, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 0.5, ease: "power3.inOut" })
        .fromTo(drawerToaster, { yPercent: 70 }, { yPercent: 0, duration: 0.45, ease: "back.out(1.4)" }, 0.12)
        .fromTo(drawerSlices, { x: 0, y: 0 }, { x: 20, y: -70, duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1 }, 0.4)
        // opacity, not autoAlpha: the first card takes focus before it's fully in
        .fromTo(cards, { y: 80, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)", stagger: { each: 0.06, from: "end" } }, 0.3)
        .fromTo(fades, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05 }, 0.5);
    } else {
      tl = gsap
        .timeline({
          onComplete: () => {
            drawer.classList.remove("is-open");
            gsap.set(drawer, { clearProps: "clipPath" });
          },
        })
        .to(cards, { y: 60, opacity: 0, duration: 0.18, ease: "power2.in", stagger: 0.03 })
        .to(drawer, { clipPath: `circle(0% at ${at})`, duration: 0.35, ease: "power3.in" }, 0.12);
    }
  }

  function setOpen(next, { returnFocus = true } = {}) {
    if (next === open) return;
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    toggleLabel.textContent = open ? "Close" : "Menu";
    drawer.inert = !open;
    // (a closed mini-player stays inert: it has nothing to offer until something plays)
    outside().forEach((el) => el && (el.inert = open || (el.classList.contains("mini-player") && !el.classList.contains("is-open"))));
    html.classList.toggle("is-menu-open", open);
    if (!lenis) document.body.style.overflow = open ? "hidden" : "";
    window.dispatchEvent(new CustomEvent("krayaura:modal", { detail: { open } })); // stops / starts Lenis
    animateDrawer(open);
    if (open) (drawer.querySelector(".drawer-card.is-current") || cards[0]).focus({ preventScroll: true });
    else if (returnFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener("click", () => setOpen(!open));
  // Capture phase: close (and restart Lenis) before main.js's anchor handler scrolls
  drawer.addEventListener("click", (e) => e.target.closest('a[href^="#"]') && setOpen(false, { returnFocus: false }), true);
  document.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key !== "Tab") return;
    const f = [toggle, ...drawer.querySelectorAll("a[href]")];
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  });
  window.matchMedia("(min-width: 860px)").addEventListener("change", (e) => e.matches && setOpen(false, { returnFocus: false }));
}
