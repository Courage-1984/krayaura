import { icon } from "./icons.js";

const fmt = (ms) => {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** 170000 → "2 minutes 50 seconds", for the row's accessible name */
const spoken = (ms) => {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const unit = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return [m && unit(m, "minute"), r && unit(r, "second")].filter(Boolean).join(" ");
};

/** Numbered tracklist; every row is a [data-play-key] button handled by audio.js. */
export function tracklistHTML(release, { className = "tracklist" } = {}) {
  const rows = release.tracks
    .map((t, i) => {
      const p = release.playables.find((x) => x.key === `${release.id}:${t.n ?? 1}`);
      const feat = t.features.length ? `<span class="tracklist__feat">ft. ${t.features.join(" & ")}</span>` : "";
      const hot = t.popular ? `<span class="tracklist__hot" title="Popular on Spotify">${icon("flame")}</span>` : "";
      return `
        <li>
          <button type="button" class="tracklist__row" ${p ? `data-play-key="${p.key}" data-queue="${release.id}" data-cursor="Play"` : "disabled"}
            aria-label="Play preview: ${t.title}${t.durationMs ? `, ${spoken(t.durationMs)}` : ""}">
            <span class="tracklist__n">${String(t.n ?? i + 1).padStart(2, "0")}</span>
            <span class="tracklist__state" aria-hidden="true">
              <span class="tracklist__play">${icon("play")}</span>
              <span class="tracklist__eq"><i></i><i></i><i></i></span>
            </span>
            <span class="tracklist__title">${t.title}${feat}</span>
            ${hot}
            <span class="tracklist__time">${fmt(t.durationMs)}</span>
          </button>
        </li>`;
    })
    .join("");
  return `<ol class="${className}">${rows}</ol>`;
}

export function releaseLinksHTML(release, { big = false } = {}) {
  const cls = big ? "release-link release-link--big" : "release-link";
  return [
    release.spotify &&
      `<a class="${cls}" href="${release.spotify}" target="_blank" rel="noopener noreferrer">${icon("spotify")}<span>Spotify</span></a>`,
    release.apple &&
      `<a class="${cls}" href="${release.apple}" target="_blank" rel="noopener noreferrer">${icon("apple")}<span>Apple Music</span></a>`,
    release.youtube &&
      `<a class="${cls}" href="${release.youtube}" target="_blank" rel="noopener noreferrer">${icon("youtube")}<span>Video</span></a>`,
  ]
    .filter(Boolean)
    .join("");
}
