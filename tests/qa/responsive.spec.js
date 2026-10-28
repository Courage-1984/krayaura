import { expect, test } from "@playwright/test";
import { SECTIONS } from "./config.mjs";
import {
  assertNoDocumentOverflow,
  assertPrimaryCTAs,
  auditOverlayControls,
  boot,
  closeOverlay,
  gotoSection,
  hasDrawer,
  hasPin,
  measureSectionOverflows,
  settle,
} from "./helpers.mjs";

test.describe("responsive — strict", () => {
  test("no horizontal overflow and hero CTAs at top", async ({ page }) => {
    await boot(page);
    await assertNoDocumentOverflow(page);
    await assertPrimaryCTAs(page, { hero: true, nav: true });
  });

  test("sections scroll without page overflow", async ({ page }) => {
    await boot(page);
    for (const id of SECTIONS) {
      if (id === "top") continue;
      await gotoSection(page, id);
      await assertNoDocumentOverflow(page);
      const sections = await measureSectionOverflows(page);
      expect(sections, `#${id}`).toEqual([]);
    }
  });

  test("nav play chip when scrolled past hero", async ({ page }) => {
    await boot(page);
    await gotoSection(page, "connect");
    await assertPrimaryCTAs(page, { nav: true });
  });

  test("pin spacers at desktop widths", async ({ page }) => {
    test.skip(!hasPin(page), "mobile layout");
    await boot(page);
    await gotoSection(page, "mia");
    await expect(page.locator("#mia .pin-spacer")).toHaveCount(1);
    await gotoSection(page, "crash");
    await expect(page.locator("#crash .pin-spacer")).toHaveCount(1);
  });

  test("overlays keep controls on screen", async ({ page }) => {
    await boot(page);
    if (hasDrawer(page)) {
      await page.locator(".nav-toggle").click({ force: true });
      await page.waitForSelector(".nav-drawer.is-open");
      await settle(page, 350);
      expect(await auditOverlayControls(page)).toEqual([]);
      await page.locator(".nav-toggle").click({ force: true });
      await settle(page, 250);
    }

    await gotoSection(page, "music");
    await page.locator("[data-open-release]").first().click({ force: true });
    await page.waitForSelector("#record-sheet.is-open");
    await settle(page, 300);
    expect(await auditOverlayControls(page)).toEqual([]);
    await closeOverlay(page);

    await gotoSection(page, "design");
    await page.locator(".project-item__open").first().click({ force: true });
    await page.waitForSelector("#lightbox.is-open");
    await settle(page, 300);
    expect(await auditOverlayControls(page)).toEqual([]);
    await page.locator("[data-lightbox-close]").click({ force: true });
  });
});
