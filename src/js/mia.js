import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { miaAlbum, miaStory, miaDate } from "./content.js";
import { tracklistHTML } from "./tracklist.js";
import { onChange, register } from "./audio.js";
import { onSignal } from "./signal.js";
import { icon } from "./icons.js";
import { initMiaLetters, markMia } from "./mia-letters.js";
import { installCoverPicture } from "./media-picture.js";

gsap.registerPlugin(ScrollTrigger);

const TAPES = [
  { text: "MISSING", cls: "mia-tape--missing" },
  { text: "WHERE?", cls: "mia-tape--seen" },
  { text: "M.I.A.", cls: "mia-tape--mia" },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wrapWords = (text) =>
  String(text)
    .split(/(\s+)/)
    .map((tok) => (/^\s+$/.test(tok) ? tok : tok ? `<span class="w">${tok}</span>` : ""))
    .join("");

/** Mark highlight phrases, then wrap every word so the pin can light the dossier in. */
function dossierHTML(text, hits = []) {
  const marked = markMia(text);
  if (!hits.length) return wrapWords(marked);
  const re = new RegExp(`(${hits.map(escapeRe).join("|")})`, "gi");
  return marked
    .split(re)
    .map((part) => {
      if (!part) return "";
      const hit = hits.find((h) => h.toLowerCase() === part.toLowerCase());
      if (!hit) return wrapWords(part);
      const hot = /silence/i.test(part);
      return `<em class="mia-hit${hot ? " mia-hit--hot" : ""}">${wrapWords(part)}</em>`;
    })
    .join("");
}

const showOnFocus = (el, tween) => {
  const on = () => tween.progress() < 1 && tween.play();
  el?.addEventListener("focusin", on, { passive: true });
  return () => el?.removeEventListener("focusin", on);
};

/**
 * The M.I.A. block in Albums: a missing-person poster (pin on desktop) then a 2-col tracklist.
 * Title is the cover's blue brush wordmark. No streaming links yet — the pill says when it lands.
 */
export function initMia(root, { reducedMotion = false } = {}) {
  if (!root || !miaAlbum) return;
  register(miaAlbum.playables);
  const $ = (s) => root.querySelector(s);

  const coverWrap = $("[data-mia-cover-wrap]");
  const leadKey = miaAlbum.playables[0]?.key ?? "mia:1";
  if (coverWrap) {
    coverWrap.dataset.playKey = leadKey;
    coverWrap.dataset.queue = miaAlbum.id;
  }
  installCoverPicture($("[data-mia-cover]"), miaStory.cover, miaAlbum.coverSm, {
    sizes: "(min-width: 900px) 30rem, 88vw",
    alt: "M.I.A. album cover art: a blurred figure in a cap, in black and white, with the title in blue",
    width: 1200,
    height: 1200,
    loading: "lazy",
  });
  const coverImg = coverWrap?.querySelector("img");
  const stamp = $("[data-mia-stamp]");
  const tapesBox = $("[data-mia-tapes]");
  const score = $("[data-mia-score]");
  const scoreIcon = $("[data-mia-score-icon]");
  const title = $(".mia__title");
  const develop = $("[data-mia-develop]");
  const seen = $("[data-mia-seen]");
  const seenTitle = $("[data-mia-seen-title]");

  if (tapesBox) {
    tapesBox.innerHTML = TAPES.map((t) => `<span class="mia-tape ${t.cls}">${t.text}</span>`).join("");
  }
  if (scoreIcon) scoreIcon.innerHTML = icon("play");

  $("[data-mia-kicker]").textContent = miaStory.kicker;
  $("[data-mia-story]").innerHTML = miaStory.chapters
    .map(
      (c) => `<article class="mia__chapter">
      <p class="mia__chapter-label">${c.label}</p>
      <p>${dossierHTML(c.text, c.hits)}</p>
    </article>`
    )
    .join("");
  $("[data-mia-closer]").innerHTML = dossierHTML(miaStory.closer, miaStory.closerHits);
  $("[data-mia-call]").innerHTML = miaStory.call
    .map((line, i) => `<span class="${i === miaStory.call.length - 1 ? "is-red" : ""}">${line}</span>`)
    .join("");

  $("[data-mia-actions]").innerHTML = `
    <button type="button" class="btn btn--primary btn--listen mia__play magnetic" data-play-key="${leadKey}" data-queue="${miaAlbum.id}" data-cursor="Play">
      <span class="btn__icon">${icon("play")}</span><span>Play the album</span>
    </button>
    <p class="mia__date"><span class="mia__date-dot" aria-hidden="true"></span>Out ${miaDate}</p>`;

  const guests = [...new Set(miaAlbum.tracks.flatMap((t) => t.features))];
  $("[data-mia-meta]").textContent = `${miaAlbum.trackCount} tracks · ${miaDate}${guests.length ? ` · with ${guests.join(", ")}` : ""}`;
  $("[data-mia-tracklist]").innerHTML = tracklistHTML(miaAlbum, { className: "tracklist tracklist--album tracklist--mia" });

  initMiaLetters($("[data-mia-letters]"), { reducedMotion });

  const tapes = [...root.querySelectorAll(".mia-tape")];

  let miaLive = false;
  onChange(({ current, playing }) => {
    const up = current?.releaseId === miaAlbum.id;
    miaLive = up && playing;
    coverWrap?.classList.toggle("is-live", up);
    if (seen && seenTitle) {
      if (up && current?.title) {
        seenTitle.textContent = current.title;
        seen.classList.add("is-on");
      } else {
        seen.classList.remove("is-on");
      }
    }
    if (!score || score.classList.contains("is-gone") === up) return;
    if (up && document.activeElement === score && title) {
      title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    }
    score.classList.toggle("is-gone", up);
  });

  let onScreen = false;
  new IntersectionObserver(
    ([e]) => {
      onScreen = e.isIntersecting;
      if (!onScreen) {
        root.style.setProperty("--scan", "0");
        root.style.setProperty("--punch", "0");
        root.style.setProperty("--hop", "0");
        root.style.setProperty("--flutter", "0");
      }
    },
    { rootMargin: "80px 0px" }
  ).observe(root);

  onSignal((s) => {
    if (!onScreen) return;
    root.style.setProperty("--scan", (s.kick * 0.75 + s.energy * 0.25).toFixed(3));
    if (reducedMotion || s.lite || !miaLive) {
      root.style.setProperty("--punch", "0");
      root.style.setProperty("--hop", "0");
      root.style.setProperty("--flutter", "0");
      return;
    }
    root.style.setProperty("--punch", s.kick.toFixed(3));
    root.style.setProperty("--hop", (s.kick * 8).toFixed(2));
    root.style.setProperty("--flutter", (s.kick * 4).toFixed(2));
  });

  if (reducedMotion) {
    root.classList.add("is-static");
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    const pin = $("[data-mia-pin]");
    const viewport = $(".mia__viewport");
    const copy = $(".mia__copy");
    const kicker = $("[data-mia-kicker]");
    const labels = root.querySelectorAll(".mia__chapter-label");
    const words = root.querySelectorAll(".mia__story .w, .mia__closer .w");
    const closer = $("[data-mia-closer]");
    const callBits = root.querySelectorAll(".mia__call span");
    const actions = $("[data-mia-actions]");

    gsap.set(coverImg, { filter: "blur(22px)" });
    gsap.set(coverWrap, { yPercent: 8, rotation: -8 });
    gsap.set(stamp, { scale: 2.4, autoAlpha: 0, rotation: 48 });
    gsap.set(tapes, { autoAlpha: 0, scale: 0.7 });
    gsap.set(develop, { autoAlpha: 1 });
    gsap.set(kicker, { opacity: 0.4 });
    gsap.set(labels, { opacity: 0, y: 12 });
    gsap.set(words, { opacity: 0.08 });
    gsap.set(closer, { y: 18 });
    gsap.set(callBits, { opacity: 0, y: 36, scale: 0.86 });
    gsap.set(actions, { opacity: 0, y: 16 });

    const travel = () => Math.max(0, copy.scrollHeight - viewport.clientHeight);

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 2.8)}`,
        pin: true,
        pinSpacing: true,
        zIndex: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    const onScoreFocus = () => {
      const st = tl.scrollTrigger;
      const r = score?.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect();
      if (st && r && (r.top < vr.top + vr.height * 0.14 || r.bottom > vr.bottom)) {
        window.scrollTo({ top: st.start, behavior: "instant" });
      }
    };
    score?.addEventListener("focus", onScoreFocus);

    // Starts with the pin, the way Crash's cover pops on arrival, instead of holding the blur.
    // 0.00–0.20 · the poster develops, the stamp slams, tapes slap on. The title rides with the copy.
    tl.to(kicker, { opacity: 1, duration: 0.1 }, 0)
      .fromTo(copy, { y: 0 }, { y: () => -travel(), duration: 1 }, 0)
      .to(develop, { autoAlpha: 0, duration: 0.08, ease: "power2.in" }, 0)
      .to(coverImg, { filter: "blur(0px)", duration: 0.2, ease: "power3.out" }, 0)
      .to(coverWrap, { yPercent: 0, rotation: -2, duration: 0.2, ease: "back.out(1.8)" }, 0)
      .to(stamp, { scale: 1, autoAlpha: 1, rotation: 10, duration: 0.14, ease: "back.out(2.4)" }, 0.1);

    const tapeRest = [-14, 8, 4];
    tapes.forEach((tape, i) => {
      tl.fromTo(
        tape,
        { y: i === 1 ? -28 : 24, rotation: tapeRest[i] + (i === 1 ? 12 : -10) },
        { autoAlpha: 1, y: 0, scale: 1, rotation: tapeRest[i], duration: 0.1, ease: "back.out(2)" },
        0.14 + i * 0.04
      );
    });

    // 0.14–0.54 · case file lights up, word by word. The white reveal starts a beat after the poster.
    const wordDur = 0.32 / Math.max(words.length, 1);
    tl.to(labels, { opacity: 1, y: 0, duration: 0.1, stagger: 0.05, ease: "power2.out" }, 0.14)
      .to(words, { opacity: 1, duration: wordDur, stagger: wordDur, ease: "none" }, 0.18)
      .to(closer, { y: 0, duration: 0.1, ease: "power2.out" }, 0.46)
      // 0.62–0.84 · verdict stamps slam, then the story holds, the way Crash lands and stays
      .to(callBits, { opacity: 1, y: 0, scale: 1, duration: 0.1, stagger: 0.04, ease: "back.out(2.2)" }, 0.62)
      .to(actions, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.74);

    return () => {
      score?.removeEventListener("focus", onScoreFocus);
      gsap.set(
        [coverImg, coverWrap, stamp, develop, kicker, closer, actions, copy, ...tapes, ...labels, ...words, ...callBits].filter(Boolean),
        { clearProps: "all" }
      );
    };
  });

  mm.add("(max-width: 899px)", () => {
    const copy = $(".mia__copy");
    const offs = [];
    if (coverImg) {
      offs.push(
        showOnFocus(
          coverWrap,
          gsap.fromTo(
            coverImg,
            { filter: "blur(22px)" },
            {
              filter: "blur(0px)",
              duration: 1.2,
              ease: "power3.out",
              clearProps: "filter",
              scrollTrigger: { trigger: coverWrap, start: "top 88%", once: true },
            }
          )
        )
      );
    }
    if (develop) {
      gsap.fromTo(
        develop,
        { autoAlpha: 1 },
        {
          autoAlpha: 0,
          duration: 0.6,
          ease: "power2.in",
          scrollTrigger: { trigger: coverWrap, start: "top 88%", once: true },
        }
      );
    }
    offs.push(
      showOnFocus(
        stamp,
        gsap.fromTo(
          stamp,
          { scale: 1.8, autoAlpha: 0 },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.55,
            ease: "back.out(2.4)",
            scrollTrigger: { trigger: stamp, start: "top 88%", once: true },
          }
        )
      )
    );
    gsap.from(tapes, {
      opacity: 0,
      y: 18,
      rotate: -12,
      duration: 0.55,
      stagger: 0.08,
      ease: "back.out(2)",
      scrollTrigger: { trigger: tapesBox, start: "top 88%", once: true },
    });
    offs.push(
      showOnFocus(
        copy,
        gsap.from(root.querySelectorAll(".mia__chapter, .mia__closer, .mia__call span, .mia__actions > *"), {
          opacity: 0,
          y: 28,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: copy, start: "top 88%", once: true },
        })
      )
    );
    return () => offs.forEach((off) => off());
  });

  const tracklist = $("[data-mia-tracklist]");
  showOnFocus(
    tracklist,
    gsap.from(root.querySelectorAll(".tracklist--mia li"), {
      opacity: 0,
      x: -24,
      duration: 0.5,
      stagger: 0.035,
      ease: "power2.out",
      scrollTrigger: { trigger: tracklist, start: "top 85%", once: true },
    })
  );
}
