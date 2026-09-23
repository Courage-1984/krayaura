import { tracks, featuredVideo, site } from "./content.js";

export function renderMusic(root) {
  if (!root) return;

  const rail = root.querySelector("[data-track-rail]");
  const platforms = root.querySelector("[data-platforms]");
  const video = root.querySelector("[data-video]");

  if (platforms) {
    platforms.innerHTML = `
      <a class="platform-link" href="${site.platforms.spotify}" target="_blank" rel="noopener noreferrer">Spotify</a>
      <a class="platform-link" href="${site.platforms.apple}" target="_blank" rel="noopener noreferrer">Apple Music</a>
      <a class="platform-link" href="${site.platforms.youtube}" target="_blank" rel="noopener noreferrer">YouTube</a>
    `;
  }

  if (rail) {
    rail.innerHTML = tracks
      .map((track, i) => {
        const links = Object.entries(track.links)
          .map(
            ([key, href]) =>
              `<a href="${href}" target="_blank" rel="noopener noreferrer">${formatLink(key)}</a>`
          )
          .join("");
        return `
          <article class="track-card" data-tone="${track.tone}" data-track="${track.id}">
            <span class="track-card__index">${String(i + 1).padStart(2, "0")}</span>
            <h3 class="track-card__title">${track.title}</h3>
            <p class="track-card__meta">${track.meta}</p>
            <div class="track-card__links">${links}</div>
          </article>
        `;
      })
      .join("");
  }

  if (video) {
    if (featuredVideo.embedUrl) {
      video.innerHTML = `
        <p class="section-label">On screen</p>
        <div class="music__video-frame">
          <iframe
            src="${featuredVideo.embedUrl}"
            title="${featuredVideo.title}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <a class="platform-link" href="${featuredVideo.fallbackHref}" target="_blank" rel="noopener noreferrer">Open YouTube</a>
      `;
    } else {
      video.innerHTML = `
        <p class="section-label">On screen</p>
        <a class="music__yt-card" href="${featuredVideo.fallbackHref}" target="_blank" rel="noopener noreferrer">
          <span class="music__yt-card-title">${featuredVideo.title}</span>
          <span class="music__yt-card-meta">Reactions · visuals · drops →</span>
        </a>
      `;
    }
  }
}

function formatLink(key) {
  const map = { spotify: "Spotify", apple: "Apple", youtube: "YouTube" };
  return map[key] || key;
}
