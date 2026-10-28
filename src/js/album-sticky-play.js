import { icon } from "./icons.js";
import { onChange } from "./audio.js";

const pad = (n) => String(n).padStart(2, "0");

function markAlbumNumbers(ol) {
  [...ol.children].forEach((li) => {
    const n = li.querySelector(".tracklist__n");
    if (n && !n.dataset.albumN) n.dataset.albumN = n.textContent;
  });
}

function numberRows(ol, shuffled) {
  [...ol.children].forEach((li, i) => {
    const n = li.querySelector(".tracklist__n");
    if (!n) return;
    n.textContent = shuffled ? pad(i + 1) : n.dataset.albumN || pad(i + 1);
  });
}

/** When shuffle is on, the album's tracklist rows follow the play order. */
function bindShuffledTracklist(section) {
  const ol = section.querySelector(".tracklist");
  if (!ol) return;
  markAlbumNumbers(ol);
  const home = [...ol.children];
  const byKey = new Map(home.map((li) => [li.querySelector("[data-play-key]")?.dataset.playKey, li]));
  const id = section.id;

  onChange(({ shuffled, queue }) => {
    const keys = shuffled && queue.releaseId === id ? queue.keys : null;
    if (!keys?.length) {
      home.forEach((li) => ol.append(li));
      numberRows(ol, false);
      return;
    }
    keys.forEach((k) => {
      const li = byKey.get(k);
      if (li) ol.append(li);
    });
    numberRows(ol, true);
  });
}

/**
 * Sticky Play chips on #mia / #crash: sit under the header on top of the pin and the tracklist.
 */
export function initAlbumStickyPlay() {
  document.querySelectorAll("[data-album-sticky-icon]").forEach((el) => {
    el.innerHTML = icon("play");
  });
  document.querySelectorAll("[data-shuffle-icon]").forEach((el) => {
    el.innerHTML = icon("shuffle");
  });

  document.querySelectorAll("[data-album-sticky-play]").forEach((chip) => {
    chip.hidden = false;
    chip.removeAttribute("aria-hidden");
  });

  document.querySelectorAll("#mia, #crash").forEach(bindShuffledTracklist);
}
