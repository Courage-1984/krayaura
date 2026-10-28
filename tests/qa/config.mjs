/** Viewports already used on this site. Touch viewports skip hover clips. */
export const VIEWPORTS = [
  { name: "ultrawide", width: 2560, height: 1600, touch: false },
  { name: "fhd", width: 1920, height: 1080, touch: false },
  { name: "macbook", width: 1512, height: 982, touch: false },
  { name: "desktop", width: 1440, height: 900, touch: false },
  { name: "short-laptop", width: 1280, height: 720, touch: false },
  { name: "breakpoint-edge", width: 861, height: 800, touch: false },
  { name: "laptop", width: 1100, height: 700, touch: false },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "iphone-plus", width: 414, height: 896, touch: true },
  { name: "mobile", width: 390, height: 844, touch: true },
  { name: "iphone-se", width: 320, height: 568, touch: true },
];

export const SECTIONS = ["top", "music", "visuals", "mia", "crash", "design", "about", "connect"];

/** Overlay shots: open, capture, close. `when` is evaluated against the current viewport. */
export const OVERLAYS = [
  { id: "drawer", when: (vp) => vp.width <= 768 },
  { id: "sheet", when: () => true },
  { id: "lightbox", when: () => true },
  { id: "fab", when: (vp) => vp.width >= 1100 },
];

/** Clipped hover screenshots — pointer:fine viewports only. */
export const HOVERS = [
  { id: "toaster", selector: ".brand-mark" },
  { id: "listen", selector: "[data-hero-listen]" },
  { id: "crate", selector: ".record" },
  { id: "mia-cover", selector: ".mia__cover" },
  { id: "design-scrub", selector: "[data-scrub]" },
];

export const PIN_MIN_WIDTH = 900;
export const DRAWER_MAX_WIDTH = 768;
export const HOVER_MIN_WIDTH = 1100;

export const HERO_DIFF = 0.04;
