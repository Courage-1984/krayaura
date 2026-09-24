/**
 * Krayaura social icon set — one family: 32px grid, chunky round strokes in currentColor,
 * one accent piece per glyph (var(--icon-accent)), cartoon offset shadow via CSS.
 */
const glyphs = {
  instagram: `
    <rect x="5" y="5" width="22" height="22" rx="7.5" />
    <circle cx="16" cy="16" r="5.4" />
    <circle class="i-fill" cx="22.4" cy="9.6" r="1.9" />`,

  tiktok: `
    <g class="i-ghost" transform="translate(-1.7 -1.3)">
      <path d="M17.5 5v15.5" /><circle cx="13" cy="20.5" r="4.5" /><path d="M17.5 5c.4 3.6 3 6 6.5 6.3" />
    </g>
    <path d="M17.5 5v15.5" /><circle cx="13" cy="20.5" r="4.5" /><path class="i-accent" d="M17.5 5c.4 3.6 3 6 6.5 6.3" />`,

  youtube: `
    <rect x="3.5" y="7.5" width="25" height="17" rx="6" />
    <path class="i-fill i-accent" d="M13.6 12.3v7.4l6.4-3.7z" />`,

  spotify: `
    <circle cx="16" cy="16" r="12" />
    <path class="i-accent" d="M9.4 12.6c4.5-1.4 9.4-1 13.4 1.2" />
    <path d="M10.4 16.6c3.7-1 7.6-.6 10.8 1.1" />
    <path d="M11.4 20.4c2.8-.7 5.6-.4 8 .8" />`,

  apple: `
    <path d="M12 22.8V9.6M24 20V7.1" />
    <path class="i-accent" d="M12 9.6 24 7.1" />
    <circle cx="9.3" cy="22.8" r="2.7" />
    <circle cx="21.3" cy="20" r="2.7" />`,

  behance: `
    <path d="M4.5 9h5.4a3.5 3.5 0 0 1 0 7H4.5zM4.5 16h6.3a3.75 3.75 0 0 1 0 7.5H4.5z" />
    <path d="M18.5 18.5h9A4.5 4.5 0 1 0 26.2 21.7" />
    <path class="i-accent" d="M20 11.6h6" />`,

  play: `
    <path class="i-fill i-accent" d="M11.5 8.6v14.8L23.8 16z" />`,

  pause: `
    <path class="i-accent" d="M12 9.5v13M20 9.5v13" />`,

  next: `
    <path class="i-fill i-accent" d="M9 9v14l11-7z" />
    <path d="M23.5 9v14" />`,

  share: `
    <path d="M16 4.5v14" />
    <path class="i-accent" d="M10.5 10 16 4.5l5.5 5.5" />
    <path d="M10 14.5H7.5v12h17v-12H22" />`,

  close: `
    <path d="M10.5 10.5l11 11M21.5 10.5l-11 11" />`,

  flame: `
    <path d="M16 4.5c1.2 4.4 6.8 6.5 6.8 12.6a6.8 6.8 0 0 1-13.6 0c0-3.1 1.6-5 3.1-6.5.3 2 1.3 3.3 2.6 3.9C14 10.5 14.8 7.4 16 4.5z" />
    <path class="i-fill" d="M16 18.2c1.9 1.5 3 2.9 3 4.5a3 3 0 0 1-6 0c0-1.6 1.1-3 3-4.5z" />`,

  disc: `
    <circle cx="16" cy="16" r="12" />
    <path d="M9.5 12.5a7.5 7.5 0 0 1 4-4" />
    <circle class="i-fill" cx="16" cy="16" r="3.6" />`,

  linktree: `
    <path d="M16 4.5v9M5.5 13.5h21M8.6 20.9l7.4-7.4 7.4 7.4" />
    <path class="i-accent" d="M16 19.5v8" />`,
};

export function icon(name, className = "icon") {
  const body = glyphs[name];
  if (!body) return "";
  return `<svg class="${className}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
