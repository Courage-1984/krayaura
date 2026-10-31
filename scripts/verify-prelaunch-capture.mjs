import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

const base = "http://localhost:5173/krayaura/";
const out = join(process.cwd(), "tests", "qa", "__screenshots__", "verify-prelaunch");
mkdirSync(out, { recursive: true });

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "edge-861", width: 861, height: 800 },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
  { name: "mobile-320", width: 320, height: 568, isMobile: true },
];

const shots = [
  { file: "hero-top", url: "#top", fullPage: false },
  { file: "music-visuals", url: "#music", clip: async (page) => {
    const crate = page.locator(".crate__timeline");
    const visuals = page.locator("#visuals .yt-block__head");
    await crate.scrollIntoViewIfNeeded();
    const box1 = await crate.boundingBox();
    await visuals.scrollIntoViewIfNeeded();
    const box2 = await visuals.boundingBox();
    if (!box1 || !box2) return null;
    return { x: 0, y: box1.y - 40, width: page.viewportSize().width, height: box2.y + box2.height - box1.y + 80 };
  }},
  { file: "mia-actions", url: "#mia", selector: "[data-mia-actions]" },
  { file: "visuals-crash", url: "#visuals", selector: "[data-video]" },
  { file: "design-head", url: "#design", selector: ".design__head" },
  { file: "about-dots", url: "#about", selector: "[data-about-dots]" },
  { file: "connect-footer", url: "#connect", selector: ".connect__links" },
];

const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile ?? false,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("kr-intro", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  for (const shot of shots) {
    await page.goto(`${base}${shot.url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const path = join(out, `${vp.name}-${shot.file}.png`);
    if (shot.selector) {
      const el = page.locator(shot.selector).first();
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path });
    } else if (shot.clip) {
      const clip = await shot.clip(page);
      if (clip) await page.screenshot({ path, clip });
      else await page.screenshot({ path });
    } else {
      await page.screenshot({ path });
    }
  }

  if (vp.width >= 900) {
    await page.goto(`${base}#music`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const streamFab = page.locator('[data-stream-id="stream-fab"] button');
    if (await streamFab.isVisible()) {
      await streamFab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out, `${vp.name}-stream-fab-open.png`) });
    }
  }

  await context.close();
}

await browser.close();
console.log("Saved to", out);
