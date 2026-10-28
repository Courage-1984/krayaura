import { expect, test } from "@playwright/test";
import { boot, gotoSection, hasDrawer, hasHover, hasPin, settle } from "./helpers.mjs";

test.describe("phase 2 — interact", () => {
  test("hero lever, listen, mini-player, play chip, nav", async ({ page }) => {
    await boot(page);

    const lever = page.locator("[data-lever-btn]");
    await expect(lever).toBeVisible();
    const hit = await lever.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(top && (top === el || el.contains(top)));
    });
    expect(hit, "lever is the hit target").toBeTruthy();

    const listen = page.locator("[data-hero-listen]");
    await listen.click({ force: true });
    await expect(page.locator(".mini-player")).toHaveClass(/is-open/);
    await expect(listen).toHaveClass(/is-current/);
    if (await listen.evaluate((el) => el.classList.contains("is-playing"))) {
      await listen.click({ force: true });
      await expect(listen).not.toHaveClass(/is-playing/);
    }

    if (hasDrawer(page)) {
      const toggle = page.locator(".nav-toggle");
      await toggle.click({ force: true });
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".nav-drawer")).toHaveClass(/is-open/);
      await settle(page, 400);
      await page.locator(".drawer-card[href='#music']").evaluate((el) => el.click());
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    } else {
      await page.locator('.nav-links a[href="#music"]').click({ force: true });
    }
    await expect(page.locator("#music")).toBeInViewport({ timeout: 12_000 });

    const playChip = page.locator("[data-nav-play]");
    await expect(playChip).toBeVisible();
    await expect(playChip).toHaveClass(/is-current/);
    await playChip.click({ force: true });
    await expect(playChip).toHaveClass(/is-current/);
  });

  test("crate filters and record sheet", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "music");

    const singles = page.locator('[data-filter="single"]');
    await singles.click();
    await expect(singles).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute("aria-pressed", "false");
    await page.locator('[data-filter="all"]').click();
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute("aria-pressed", "true");

    await page.locator("[data-open-release]").first().click();
    await expect(page.locator("#record-sheet")).toHaveClass(/is-open/);
    await expect(page.locator("#record-sheet")).toHaveAttribute("aria-hidden", "false");
    await page.keyboard.press("Escape");
    await expect(page.locator("#record-sheet")).toHaveAttribute("aria-hidden", "true");
  });

  test("visuals next/prev changes the slide", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "visuals");
    const before = await page.locator(".yt-slide.is-active").getAttribute("data-slide");
    await page.locator("[data-yt-carousel] [data-next]").click();
    await expect(page.locator(".yt-slide.is-active")).not.toHaveAttribute("data-slide", before);
    await page.locator("[data-yt-carousel] [data-prev]").click();
    await expect(page.locator(".yt-slide.is-active")).toHaveAttribute("data-slide", before);
  });

  test("M.I.A. pin, cover play, pills", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "mia");
    if (hasPin(page)) {
      await expect(page.locator("#mia .pin-spacer")).toHaveCount(1);
    } else {
      await expect(page.locator("#mia .pin-spacer")).toHaveCount(0);
    }

    await page.locator("[data-mia-cover-wrap]").click({ force: true });
    await expect(page.locator("[data-mia-seen]")).toHaveClass(/is-on/);
    await expect(page.locator("[data-mia-seen-title]")).not.toHaveText("");

    const playBox = await page.locator(".mia__play").boundingBox();
    const dateBox = await page.locator(".mia__date").boundingBox();
    if (playBox && dateBox && playBox.height > 0 && dateBox.height > 0) {
      expect(Math.abs(playBox.height - dateBox.height)).toBeLessThanOrEqual(2);
    }
  });

  test("crash pin and score play", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "crash");
    if (hasPin(page)) {
      await expect(page.locator("#crash .pin-spacer")).toHaveCount(1);
    }
    await page.locator("[data-crash-score]").click();
    await expect(page.locator("[data-crash-score]")).toHaveClass(/is-playing|is-gone/);
  });

  test("design lightbox", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "design");
    await page.locator(".project-item__open").first().click();
    await expect(page.locator("#lightbox")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#lightbox")).toHaveClass(/is-open/);
    const next = page.locator('[data-lightbox-step="1"]');
    if (await next.isVisible()) {
      await expect(next).toBeEnabled();
      await next.click();
    }
    await page.locator("[data-lightbox-close]").click();
    await expect(page.locator("#lightbox")).toHaveAttribute("aria-hidden", "true");
  });

  test("about next photo", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "about");
    const current = page.locator(".about__dot[aria-current='true']");
    const firstIdx = await current.getAttribute("data-about-dot");
    await page.locator('[data-about-step="1"]').click();
    await expect(page.locator(".about__dot[aria-current='true']")).not.toHaveAttribute("data-about-dot", firstIdx, {
      timeout: 8_000,
    });
  });

  test("connect menus and FAB", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "design");
    const fabBtn = page.locator(".contact-fab > button");
    await page.waitForFunction(() => !document.querySelector(".contact-fab")?.classList.contains("is-hidden"), null, {
      timeout: 8_000,
    });
    await fabBtn.click();
    await expect(fabBtn).toHaveAttribute("aria-expanded", "true");

    const designContact = page.locator("#design [data-contact-menu] > button");
    await designContact.scrollIntoViewIfNeeded();
    await designContact.click();
    await expect(designContact).toHaveAttribute("aria-expanded", "true");
    await expect(fabBtn).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Escape");

    if (page.viewportSize().width <= 720) {
      await gotoSection(page, "music");
      await page.locator(".record [data-play-key]").first().click({ force: true });
      await expect(page.locator(".mini-player")).toHaveClass(/is-open/);
      await settle(page, 500);
      const overlap = await page.evaluate(() => {
        const fab = document.querySelector(".contact-fab:not(.is-hidden) > button");
        const mp = document.querySelector(".mini-player.is-open");
        if (!fab || !mp) return false;
        const a = fab.getBoundingClientRect();
        const b = mp.getBoundingClientRect();
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      });
      expect(overlap, "FAB button does not cover the mini-player").toBeFalsy();
    }
  });

  test("hover computed styles", async ({ page }) => {
    test.skip(!hasHover(page), "touch viewport");
    await boot(page);

    const btn = page.locator("[data-hero-listen]");
    const beforeShadow = await btn.evaluate((el) => getComputedStyle(el).boxShadow);
    await btn.hover();
    await settle(page, 280);
    const afterShadow = await btn.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(afterShadow).not.toEqual(beforeShadow);

    await gotoSection(page, "mia");
    const img = page.locator(".mia__cover img");
    const beforeScale = await img.evaluate((el) => getComputedStyle(el).scale || getComputedStyle(el).transform);
    await page.locator(".mia__cover").hover();
    await settle(page, 450);
    const afterScale = await img.evaluate((el) => getComputedStyle(el).scale || getComputedStyle(el).transform);
    expect(afterScale).not.toEqual(beforeScale);

    const row = page.locator(".tracklist--mia .tracklist__row").first();
    await row.scrollIntoViewIfNeeded();
    const beforeBg = await row.evaluate(
      (el) => `${getComputedStyle(el).transform}|${getComputedStyle(el).boxShadow}|${getComputedStyle(el).backgroundColor}`,
    );
    await row.hover();
    await settle(page, 280);
    const afterBg = await row.evaluate(
      (el) => `${getComputedStyle(el).transform}|${getComputedStyle(el).boxShadow}|${getComputedStyle(el).backgroundColor}`,
    );
    expect(afterBg).not.toEqual(beforeBg);
  });
});

test.describe("reduced motion", () => {
  test("mia is static and unpinned", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "run once");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await boot(page);
    await gotoSection(page, "mia");
    await expect(page.locator("#mia")).toHaveClass(/is-static/);
    await expect(page.locator("#mia .pin-spacer")).toHaveCount(0);
  });
});
