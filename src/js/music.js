import gsap from "gsap";
import { releases, popular, site } from "./content.js";
import { initYtCarousel } from "./yt-carousel.js";
import { initDragRail } from "./drag-rail.js";
import { icon } from "./icons.js";
import { register, play, state, levels, onChange } from "./audio.js";
import { openRecordSheet } from "./record-sheet.js";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "album", label: "Album", test: (r) => r.type === "album" },
  { id: "single", label: "Singles", test: (r) => r.type === "single" },
  { id: "popular", label: "Popular", test: (r) => r.popular },
];

const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let crateRail = null;

/**
 * Bring a release to the front of the crate (the timeline dots and #r/<id> deep links): shows every record
 * if a filter hid it, slides the rail to it and flashes it.
 */
export function jumpToRelease(id) {
  const rail = crateRail;
  const rec = rail?.querySelector(`[data-release="${id}"]`);
  if (!rec) return false;
  if (rec.hidden) rail.closest("[data-crate]")?.querySelector('[data-filter="all"]')?.click();
  const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
  rail.scrollTo({ left: rec.offsetLeft - pad, behavior: reduced ? "auto" : "smooth" });
  rec.classList.remove("is-flash");
  void rec.offsetWidth;
  rec.classList.add("is-flash");
  return true;
}

/** @returns {{ video: { go(i: number): void, indexOf(id: string): number } | null }} */
export function renderMusic(root) {
  if (!root) return { video: null };

  releases.forEach((r) => register(r.playables));

  const platforms = root.querySelector("[data-platforms]");
  if (platforms) {
    platforms.innerHTML = `
      <a class="platform-link" href="${site.platforms.spotify}" target="_blank" rel="noopener noreferrer">${icon("spotify")}Spotify</a>
      <a class="platform-link" href="${site.platforms.apple}" target="_blank" rel="noopener noreferrer">${icon("apple")}Apple Music</a>
      <a class="platform-link" href="${site.platforms.youtube}" target="_blank" rel="noopener noreferrer">${icon("youtube")}YouTube</a>
    `;
  }

  const rail = root.querySelector("[data-track-rail]");
  if (rail) {
    crateRail = rail;
    rail.innerHTML = releases.map(recordHTML).join("");
    initDragRail(rail);
    initRecords(rail);
    initFilters(root.querySelector("[data-filters]"), rail);
    initTimeline(root.querySelector("[data-timeline]"), rail);
  }

  const video = root.querySelector("[data-video]");
  return { video: video ? initYtCarousel(video) : null };
}

function recordHTML(r) {
  const feat = r.features.length ? `<p class="record__feat">ft. ${r.features.join(" & ")}</p>` : "";
  const hot = r.popular
    ? `<span class="record__sticker" title="Popular on Spotify">${icon("flame")}<span>Popular</span></span>`
    : "";
  const lead = r.lead;
  return `
    <article class="record" data-release="${r.id}" data-tone="${r.tone}" data-type="${r.type}" data-year="${r.year}">
      <div class="record__stage">
        <div class="record__vinyl" aria-hidden="true">
          <span class="record__label" style="background-image:url('${r.coverSm}')"></span>
        </div>
        <button type="button" class="record__sleeve" data-open-release="${r.id}" data-cursor="Open"
          aria-label="Open ${r.title} — ${r.meta}, ${r.year}">
          <img src="${r.coverSm}" alt="" loading="lazy" draggable="false" width="480" height="480" />
        </button>
        ${hot}
        ${
          lead
            ? `<button type="button" class="record__play" data-play-key="${lead.key}" data-queue="crate" data-cursor="Play"
                 aria-label="Play preview: ${lead.title}">
                 <span class="record__play-icon record__play-icon--play">${icon("play")}</span>
                 <span class="record__play-icon record__play-icon--pause">${icon("pause")}</span>
                 <svg class="record__ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" /></svg>
               </button>`
            : ""
        }
      </div>
      <div class="record__meta">
        <p class="record__year">${r.year} · ${r.type === "album" ? `Album · ${r.trackCount} tracks` : "Single"}</p>
        <h3 class="record__title">${r.title}</h3>
        ${feat}
      </div>
    </article>`;
}

function initRecords(rail) {
  const records = [...rail.querySelectorAll(".record")];
  const byId = new Map(records.map((el) => [el.dataset.release, el]));

  rail.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open-release]");
    if (open) openRecordSheet(open.dataset.openRelease, open);
  });

  // Hover-to-hear: only after the visitor has pressed play once (never surprise audio), only on a
  // deliberate hover (the pointer really moved, the page isn't scrolling under it), never during a run
  if (fine) {
    const html = document.documentElement;
    let mx = -1e4;
    let my = -1e4;
    let dwell = 0;
    let arming = null;

    const disarm = () => {
      clearTimeout(dwell);
      arming?.classList.remove("is-arming");
      arming = null;
    };

    const consider = (rec) => {
      if (!rec || rec === arming) return;
      disarm();
      if (!state.unlocked || state.queue.length || rail.classList.contains("is-dragging")) return;
      if (html.classList.contains("lenis-scrolling")) return; // (consider() only runs on a real move)
      const r = releases.find((x) => x.id === rec.dataset.release);
      if (!r?.lead || state.current?.releaseId === r.id || rec.classList.contains("is-live")) return;
      const ring = rec.querySelector(".record__ring circle");
      if (ring) {
        ring.style.strokeDashoffset = ""; // the live ring's inline progress would pin the fill
        getComputedStyle(ring).strokeDashoffset; // flush, so the fill starts from empty
      }
      arming = rec;
      rec.classList.add("is-arming");
      dwell = setTimeout(() => {
        disarm();
        if (state.queue.length || html.classList.contains("lenis-scrolling")) return;
        if (state.current?.releaseId !== r.id) play(r.lead);
      }, 600);
    };

    // Content moving under a parked pointer (wheel scroll, FLIP, the pill sliding away after ×) fires
    // pointerover and ~0-travel moves: those never arm. Only real travel (>3px) over a record does.
    window.addEventListener(
      "pointermove",
      (e) => {
        if (Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) <= 3) return;
        mx = e.clientX;
        my = e.clientY;
        const rec = e.target.closest?.(".record");
        if (rec && rail.contains(rec)) consider(rec);
      },
      { passive: true }
    );
    rail.addEventListener("pointerover", (e) => {
      const rec = e.target.closest(".record");
      if (rec !== arming) disarm(); // arrived somewhere else without moving: drop the old arm
    });
    rail.addEventListener("pointerout", (e) => {
      const rec = e.target.closest(".record");
      if (rec && rec === arming && !rec.contains(e.relatedTarget)) disarm();
    });
  }

  // Playing record: vinyl slides out + spins (speed rides the music), ring shows progress.
  // The loop runs only while something plays AND the crate is on screen; otherwise the ring is set once.
  let active = null;
  let playingNow = false;
  let onScreen = false;
  let running = false;
  let angle = 0;
  let last = 0;

  const paintRing = () => {
    const ring = active?.querySelector(".record__ring circle");
    if (ring) ring.style.strokeDashoffset = String(138.2 * (1 - state.progress));
  };
  const wanted = () => !!active && playingNow && onScreen;
  const tick = (now) => {
    if (!wanted()) {
      running = false;
      paintRing();
      return;
    }
    requestAnimationFrame(tick);
    const dt = Math.min(now - last, 64) / 1000;
    last = now;
    paintRing();
    if (!active.classList.contains("is-spinning") || reduced) return;
    const { energy, bass } = levels();
    angle = (angle + dt * (200 + energy * 260)) % 360; // ~33 rpm, faster when it slaps
    const vinyl = active.querySelector(".record__vinyl");
    vinyl.style.setProperty("--spin", `${angle}deg`);
    vinyl.style.setProperty("--kick", String(1 + bass * 0.05));
  };
  const sync = () => {
    paintRing();
    if (!wanted() || running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };

  onChange(({ current, playing }) => {
    const el = current ? byId.get(current.releaseId) : null;
    if (active && active !== el) active.classList.remove("is-spinning", "is-live");
    active = el;
    playingNow = playing;
    if (el) {
      el.classList.add("is-live");
      el.classList.toggle("is-spinning", playing);
    }
    sync();
  });
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  }).observe(rail);
}

function initFilters(bar, rail) {
  if (!bar) return;
  bar.innerHTML = FILTERS.map(
    (f, i) => `
      <button type="button" class="chip${i === 0 ? " is-active" : ""}" data-filter="${f.id}" aria-pressed="${i === 0}">
        ${f.id === "popular" ? icon("flame") : ""}${f.label}
        <span class="chip__count">${releases.filter(f.test).length}</span>
      </button>`
  ).join("");

  bar.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip || chip.classList.contains("is-active")) return;
    bar.querySelectorAll(".chip").forEach((c) => {
      const on = c === chip;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    const f = FILTERS.find((x) => x.id === chip.dataset.filter);
    const records = [...rail.querySelectorAll(".record")];

    // FLIP: remember where visible records were, re-filter, animate from old → new
    const first = new Map(records.map((el) => [el, el.hidden ? null : el.getBoundingClientRect()]));
    records.forEach((el) => {
      el.hidden = !f.test(releases.find((r) => r.id === el.dataset.release));
    });
    rail.scrollLeft = 0;
    rail.dispatchEvent(new Event("scroll"));
    if (reduced) return;
    records
      .filter((el) => !el.hidden)
      .forEach((el, i) => {
        const was = first.get(el);
        const now = el.getBoundingClientRect();
        if (was) {
          gsap.fromTo(el, { x: was.left - now.left }, { x: 0, duration: 0.7, ease: "power3.out" });
        } else {
          gsap.fromTo(
            el,
            { opacity: 0, y: 30, rotate: -4 },
            { opacity: 1, y: 0, rotate: 0, duration: 0.6, delay: i * 0.04, ease: "back.out(1.6)" }
          );
        }
      });
  });
}

/** 2021 → now line; dot per release; playhead follows whichever record is centred in the crate. */
function initTimeline(root, rail) {
  if (!root) return;
  const times = releases.map((r) => new Date(r.date).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  // Newest on the left, matching the crate order
  const pos = (t) => (max === min ? 50 : 4 + ((max - t) / (max - min)) * 92);
  const edge = (p) => (p < 12 ? " is-start" : p > 88 ? " is-end" : ""); // keep tooltips on-screen
  const years = [];
  for (let y = new Date(max).getFullYear(); y >= new Date(min).getFullYear(); y--) years.push(y);

  const popularIds = new Set(popular.map((p) => p.release));
  root.innerHTML = `
    <div class="timeline" role="group" aria-label="Release timeline">
      <span class="timeline__line"></span>
      <span class="timeline__head" data-head></span>
      ${years
        .map(
          (y) =>
            `<span class="timeline__year" style="left:${Math.min(96, Math.max(4, pos(new Date(`${y}-07-01`).getTime())))}%">${y}</span>`
        )
        .join("")}
      ${releases.map((r, i) => `<span class="timeline__stem" style="left:${pos(times[i])}%" data-stem="${r.id}"></span>`).join("")}
      ${releases
        .map(
          (r, i) => `
          <button type="button" class="timeline__dot${r.type === "album" ? " is-album" : ""}${
            popularIds.has(r.id) ? " is-hot" : ""
          }${edge(pos(times[i]))}" style="left:${pos(times[i])}%" data-jump="${r.id}" aria-label="${r.title}, ${r.date}">
            <span class="timeline__tip">${r.title}<em>${new Date(r.date).toLocaleDateString("en-ZA", {
              month: "short",
              year: "numeric",
            })}</em></span>
          </button>`
        )
        .join("")}
    </div>`;

  const head = root.querySelector("[data-head]");
  const dots = new Map([...root.querySelectorAll("[data-jump]")].map((d) => [d.dataset.jump, d]));

  root.addEventListener("click", (e) => {
    const dot = e.target.closest("[data-jump]");
    if (dot) jumpToRelease(dot.dataset.jump);
  });

  // Clustered releases (two singles three weeks apart are ~4px apart on a phone) stack into up to 3 lanes
  // above the line, each on a 1px stem. In px, left to right: a dot takes the first lane whose last dot is
  // clear of it (hit areas ≥26px apart). Lanes are 24.8px apart, so the ~25px hit areas never overlap.
  const line = root.querySelector(".timeline");
  const ordered = [...dots.values()];
  const stems = new Map([...root.querySelectorAll("[data-stem]")].map((s) => [s.dataset.stem, s]));
  const layoutLanes = () => {
    const w = line.clientWidth;
    if (!w) return;
    const hit = (d) => d.offsetWidth / 2 + 6; // ::before reaches 8px past the padding box = 6px past the 2px border
    const items = ordered.map((d) => ({ d, x: (parseFloat(d.style.left) / 100) * w, r: hit(d) })).sort((a, b) => a.x - b.x);
    const lanes = [null, null, null];
    let deepest = 0;
    items.forEach((it) => {
      let lane = lanes.findIndex((last) => !last || it.x - last.x >= Math.max(26, last.r + it.r));
      if (lane < 0) lane = lanes.reduce((best, last, i) => (last.x < lanes[best].x ? i : best), 0); // most room
      lanes[lane] = it;
      deepest = Math.max(deepest, lane);
      it.d.style.setProperty("--lane", lane);
      stems.get(it.d.dataset.jump)?.style.setProperty("--lane", lane);
      it.d.classList.toggle("is-stacked", lane > 0);
    });
    line.style.setProperty("--lanes", deepest);
  };

  let raf = 0;
  const update = () => {
    raf = 0;
    // The "current" record is the first one mostly past the rail's left padding (the snap line)
    const anchor = rail.getBoundingClientRect().left + (parseFloat(getComputedStyle(rail).paddingLeft) || 0);
    const visible = [...rail.querySelectorAll(".record:not([hidden])")];
    const best =
      visible.find((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 > anchor;
      }) || visible[visible.length - 1];
    dots.forEach((d) => d.classList.remove("is-current"));
    const dot = best && dots.get(best.dataset.release);
    if (dot) {
      dot.classList.add("is-current");
      head.style.left = dot.style.left;
    }
  };
  rail.addEventListener("scroll", () => (raf ||= requestAnimationFrame(update)), { passive: true });
  window.addEventListener("resize", () => {
    raf ||= requestAnimationFrame(update);
    layoutLanes();
  });
  layoutLanes();
  update();
}
