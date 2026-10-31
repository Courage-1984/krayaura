import { expect } from "@playwright/test";
import { DRAWER_MAX_WIDTH, HOVER_MIN_WIDTH, PIN_MIN_WIDTH } from "./config.mjs";

export function viewportOf(page) {
  return page.viewportSize() ?? { width: 1440, height: 900 };
}

export function hasDrawer(page) {
  return viewportOf(page).width <= DRAWER_MAX_WIDTH;
}

export function hasHover(page) {
  return viewportOf(page).width >= HOVER_MIN_WIDTH;
}

export function hasPin(page) {
  return viewportOf(page).width >= PIN_MIN_WIDTH;
}

export async function settle(page, ms = 320) {
  await page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);
}

/** Skip the intro curtain, hide the custom cursor, wait for boot — never networkidle. */
export async function boot(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("kr-intro", "1");
    } catch {
      /* file: / blocked storage */
    }
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content: ".cursor{display:none!important;visibility:hidden!important;pointer-events:none!important}",
  });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-ready"), null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  // Listen + lever stay GSAP-hidden until the toaster lands (~1.2s after boot).
  await page.waitForFunction(() => {
    if (document.documentElement.classList.contains("hero-pending")) return false;
    const listen = document.querySelector("[data-hero-preview]");
    if (listen) {
      const s = getComputedStyle(listen);
      if (s.visibility === "hidden" || Number(s.opacity) < 0.95) return false;
    }
    const lever = document.querySelector("[data-lever-btn]");
    if (!lever) return true;
    const r = lever.getBoundingClientRect();
    return r.width > 8 && r.top >= 0 && r.bottom <= innerHeight;
  }, null, { timeout: 15_000 });
  await settle(page, 200);
}

/** Scroll a section so its top sits under the header; wait for Lenis + pin spacers to settle. */
export async function gotoSection(page, id) {
  await page.evaluate((sid) => {
    const el = document.querySelector(`#${sid}`);
    if (!el) throw new Error(`missing #${sid}`);
    const header = document.querySelector("[data-header]");
    const navH = header ? header.getBoundingClientRect().height : 72;
    const y = Math.max(0, window.scrollY + el.getBoundingClientRect().top - navH);
    window.scrollTo(0, y);
    document.documentElement.scrollTop = y;
  }, id);
  await page
    .waitForFunction(
      (sid) => {
        const el = document.querySelector(`#${sid}`);
        if (!el) return false;
        const header = document.querySelector("[data-header]");
        const navH = header ? header.getBoundingClientRect().height : 72;
        const top = el.getBoundingClientRect().top;
        return top <= navH + 48 && top >= navH - 160;
      },
      id,
      { timeout: 8_000 },
    )
    .catch(() => {});
  await waitVisibleImages(page);
  await settle(page, 360);
}

export async function waitVisibleImages(page) {
  await page.evaluate(async () => {
    const pics = [...document.querySelectorAll("img")].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    await Promise.all(
      pics.map((img) =>
        img.complete && img.naturalWidth
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener("load", res, { once: true });
              img.addEventListener("error", res, { once: true });
              setTimeout(res, 2500);
            }),
      ),
    );
  });
}

/**
 * Pause CSS loops (and freeze the GSAP marquee transform) only for the snapshot, then restore.
 * Does not use Playwright's global `animations: disabled`.
 */
export async function withFrozenLoops(page, fn) {
  const tag = await page.addStyleTag({
    content: `
      html.qa-freeze *,html.qa-freeze *::before,html.qa-freeze *::after{
        animation-play-state:paused!important;
        transition:none!important;
      }
      html.qa-freeze canvas,html.qa-freeze video,html.qa-freeze .marquee{visibility:hidden!important}
    `,
  });
  await page.evaluate(() => {
    document.documentElement.classList.add("qa-freeze");
    document.querySelector("[data-about-carousel]")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    });
    const track = document.querySelector("[data-marquee-track]");
    if (track) {
      track.style.setProperty("transform", getComputedStyle(track).transform, "important");
    }
  });
  await settle(page, 80);
  try {
    await fn();
  } finally {
    try {
      if (!page.isClosed()) {
        await page.evaluate(() => {
          document.documentElement.classList.remove("qa-freeze");
          document.querySelector("[data-marquee-track]")?.style.removeProperty("transform");
        });
        await tag.evaluate((el) => el.remove());
      }
    } catch {
      /* page already closed */
    }
  }
}

export async function shot(page, name, options = {}) {
  await withFrozenLoops(page, async () => {
    await expect(page).toHaveScreenshot(name, options);
  });
}

export async function clipShot(locator, name) {
  const page = locator.page();
  await withFrozenLoops(page, async () => {
    await locator.evaluate((el) => {
      el.classList.remove("magnetic");
      el.style.setProperty("transform", "none", "important");
    });
    await locator.hover({ force: true });
    await settle(page, 80);
    await expect(locator).toHaveScreenshot(name);
  });
}

export async function closeOverlay(page) {
  await page.keyboard.press("Escape");
  await settle(page, 280);
}

/** px tolerance for document/section horizontal overflow (subpixel rounding). */
export const OVERFLOW_TOLERANCE = 1;

/** scrollWidth − clientWidth on html/body. */
export async function measureDocumentOverflow(page) {
  return page.evaluate((tol) => {
    const delta = (el) => (el ? el.scrollWidth - el.clientWidth : 0);
    const htmlD = delta(document.documentElement);
    const bodyD = delta(document.body);
    const maxDelta = Math.max(htmlD, bodyD);
    return {
      htmlDelta: htmlD,
      bodyDelta: bodyD,
      maxDelta,
      overflow: maxDelta > tol,
    };
  }, OVERFLOW_TOLERANCE);
}

/** Sections whose content is wider than their box (only when the page itself overflows horizontally). */
export async function measureSectionOverflows(page) {
  const doc = await measureDocumentOverflow(page);
  if (!doc.overflow) return [];
  return page.evaluate((tol) => {
    const failures = [];
    for (const el of document.querySelectorAll("section[id], main > .section")) {
      const delta = el.scrollWidth - el.clientWidth;
      if (delta > tol) {
        failures.push({
          id: el.id || el.className.split(/\s+/).slice(0, 2).join("."),
          delta,
        });
      }
    }
    return failures;
  }, OVERFLOW_TOLERANCE);
}

/**
 * Strict primary CTA checks at the current scroll position.
 * @param {{ drawerNav?: boolean, hero?: boolean, nav?: boolean }} opts
 */
export async function auditPrimaryCTAs(page, opts = {}) {
  const drawerNav = opts.drawerNav ?? hasDrawer(page);
  const checkHero = opts.hero !== false && opts.nav === undefined;
  const checkNav = opts.nav !== false && opts.hero === undefined;
  const heroOnly = opts.hero === true;
  const navOnly = opts.nav === true;
  const doHero = heroOnly || (checkHero && !navOnly);
  const doNav = navOnly || (checkNav && !heroOnly);

  return page.evaluate(({ mobile, doHero, doNav }) => {
    const issues = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const header = document.querySelector("[data-header]");
    const navH = header ? header.getBoundingClientRect().height : 72;

    const check = (el, name) => {
      if (!el) {
        issues.push({ name, reason: "missing" });
        return;
      }
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.1) {
        issues.push({ name, reason: "hidden" });
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) {
        issues.push({ name, reason: "too_small", w: Math.round(r.width), h: Math.round(r.height) });
        return;
      }
      if (r.left < -2 || r.right > vw + 2 || r.top < -2 || r.bottom > vh + 2) {
        issues.push({
          name,
          reason: "out_of_viewport",
          rect: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) },
        });
        return;
      }
      const cx = Math.min(vw - 1, Math.max(1, r.left + r.width / 2));
      const cy = Math.min(vh - 1, Math.max(1, r.top + r.height / 2));
      const hit = document.elementFromPoint(cx, cy);
      const hitControl = hit?.closest?.("button, a, [role='button']");
      if (
        hit &&
        hit !== el &&
        !el.contains(hit) &&
        !(hitControl && (el === hitControl || el.contains(hitControl)))
      ) {
        issues.push({ name, reason: "obscured", hit: hit.className?.slice?.(0, 60) || hit.tagName });
      }
    };

    if (doHero) {
      check(document.querySelector("[data-hero-preview]"), "hero-preview");
      check(document.querySelector("[data-lever-btn]"), "hero-lever");
    }

    if (doNav) {
      if (mobile) {
        check(document.querySelector(".nav-toggle"), "nav-toggle");
      } else {
        check(document.querySelector('.nav-links a[href="#music"]'), "nav-music-link");
      }
      const heroControlsVisible = document.documentElement.classList.contains("hero-controls-visible");
      if (!(doHero && heroControlsVisible)) {
        check(document.querySelector("[data-nav-play]"), "nav-play");
      }
    }

    return { issues, navH: Math.round(navH) };
  }, { mobile: drawerNav, doHero, doNav });
}

/** Overlay close controls must sit inside the viewport when open. */
export async function auditOverlayControls(page) {
  return page.evaluate(() => {
    const issues = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const inView = (el, name) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) {
        issues.push({ name, reason: "off_screen", rect: { l: Math.round(r.left), t: Math.round(r.top) } });
      }
    };
    if (document.querySelector(".nav-drawer.is-open")) {
      inView(document.querySelector(".nav-toggle"), "drawer-close-toggle");
    }
    if (document.querySelector("#record-sheet.is-open")) {
      inView(document.querySelector("#record-sheet [data-sheet-close], #record-sheet .sheet__close"), "sheet-close");
    }
    if (document.querySelector("#lightbox.is-open")) {
      inView(document.querySelector("[data-lightbox-close]"), "lightbox-close");
    }
    return issues;
  });
}

export async function assertNoDocumentOverflow(page) {
  const m = await measureDocumentOverflow(page);
  expect(m.overflow, `horizontal overflow maxDelta=${m.maxDelta}`).toBeFalsy();
}

export async function assertPrimaryCTAs(page, opts) {
  const { issues } = await auditPrimaryCTAs(page, opts);
  expect(issues, JSON.stringify(issues)).toEqual([]);
}
