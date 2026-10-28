import { expect, test } from "@playwright/test";
import { HERO_DIFF, HOVERS, SECTIONS } from "./config.mjs";
import { boot, clipShot, closeOverlay, gotoSection, hasDrawer, hasHover, settle, shot, withFrozenLoops } from "./helpers.mjs";

test.describe("phase 1 — visual", () => {
  test.describe.configure({ mode: "serial" });

  test("ATF of every section", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);

    for (const id of SECTIONS) {
      if (id !== "top") await gotoSection(page, id);
      else await settle(page, 240);

      const options = {};
      if (id === "top") {
        options.mask = [page.locator("canvas"), page.locator(".marquee")];
        options.maxDiffPixelRatio = HERO_DIFF;
      }
      if (id === "about") {
        options.mask = [page.locator("[data-about-carousel]")];
      }
      if (id === "crash") {
        options.mask = [page.locator(".crash__cover-video"), page.locator(".crash__video")];
      }
      await shot(page, `atf-${id}`, options);
    }
  });

  test("overlays open then close", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);

    if (hasDrawer(page)) {
      await page.locator(".nav-toggle").click();
      await page.waitForSelector(".nav-drawer.is-open");
      await settle(page, 700);
      await shot(page, "overlay-drawer");
      await page.locator(".nav-toggle").click();
      await page.waitForFunction(() => document.querySelector(".nav-toggle")?.getAttribute("aria-expanded") === "false");
      await settle(page, 400);
    }

    await gotoSection(page, "music");
    await page.locator("[data-open-release]").first().click();
    await page.waitForSelector("#record-sheet.is-open");
    await settle(page, 400);
    await shot(page, "overlay-sheet");
    await closeOverlay(page);
    await page.waitForSelector('#record-sheet[aria-hidden="true"]', { state: "attached" });

    await gotoSection(page, "design");
    await page.locator(".project-item__open").first().click();
    await page.waitForSelector("#lightbox.is-open");
    await settle(page, 400);
    await shot(page, "overlay-lightbox");
    await page.locator("[data-lightbox-close]").click();
    await page.waitForSelector('#lightbox[aria-hidden="true"]', { state: "attached" });
    await settle(page, 200);

    if (hasHover(page)) {
      await gotoSection(page, "music");
      const fab = page.locator(".contact-fab");
      await fab.waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.querySelector(".contact-fab")?.classList.contains("is-hidden"), null, {
        timeout: 8_000,
      });
      await page.locator(".contact-fab > button").click();
      await page.waitForSelector(".contact-fab.is-open");
      await settle(page, 280);
      await shot(page, "overlay-fab");
      await closeOverlay(page);
    }
  });

  test("hover clips on fine pointer", async ({ page }) => {
    test.skip(!hasHover(page), "touch viewport");
    test.setTimeout(120_000);
    await boot(page);

    const toaster = page.locator(HOVERS.find((h) => h.id === "toaster").selector);
    await toaster.hover();
    await settle(page, 280);
    await clipShot(toaster, "hover-toaster");

    const listen = page.locator(HOVERS.find((h) => h.id === "listen").selector);
    await listen.hover();
    await settle(page, 280);
    await clipShot(listen, "hover-listen");

    await gotoSection(page, "music");
    const crate = page.locator(HOVERS.find((h) => h.id === "crate").selector).first();
    await crate.hover();
    await settle(page, 400);
    await clipShot(crate, "hover-crate");

    await gotoSection(page, "mia");
    const cover = page.locator(HOVERS.find((h) => h.id === "mia-cover").selector);
    await cover.hover();
    await settle(page, 280);
    await clipShot(cover, "hover-mia-cover");

    await gotoSection(page, "design");
    const scrub = page.locator(HOVERS.find((h) => h.id === "design-scrub").selector).first();
    await scrub.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = document.querySelector("[data-scrub]");
      const header = document.querySelector("[data-header]");
      const navBottom = header ? header.getBoundingClientRect().bottom : 72;
      const top = el?.getBoundingClientRect().top ?? 0;
      if (top < navBottom + 16) window.scrollBy(0, top - navBottom - 16);
      document.querySelector(".contact-fab")?.style.setProperty("visibility", "hidden", "important");
    });
    await scrub.evaluate((el) => Promise.all([...el.querySelectorAll("img")].map((img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}))));
    const box = await scrub.boundingBox();
    await page.mouse.move(box.x + Math.min(16, box.width * 0.08), box.y + box.height / 2);
    await settle(page, 400);
    await withFrozenLoops(page, async () => {
      const r = await scrub.boundingBox();
      await expect(page).toHaveScreenshot("hover-design-scrub", {
        clip: {
          x: Math.max(0, Math.floor(r.x)),
          y: Math.max(0, Math.floor(r.y)),
          width: Math.max(1, Math.ceil(r.width)),
          height: Math.max(1, Math.ceil(r.height)),
        },
      });
    });
  });
});
