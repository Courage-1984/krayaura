#!/usr/bin/env node
/**
 * Strict responsive audit: viewport matrix → overflow, CTAs, sections, overlays, pins.
 * Output: test-results/responsive-audit/report.json + report.md
 *
 * Usage: node scripts/qa-responsive.mjs [--base=http://localhost:5174/krayaura/]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { DRAWER_MAX_WIDTH, HOVER_MIN_WIDTH, PIN_MIN_WIDTH, SECTIONS } from "../tests/qa/config.mjs";
import {
  auditOverlayControls,
  auditPrimaryCTAs,
  boot,
  closeOverlay,
  gotoSection,
  hasDrawer,
  hasPin,
  measureDocumentOverflow,
  measureSectionOverflows,
  settle,
} from "../tests/qa/helpers.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = join(root, "test-results", "responsive-audit");

const WIDTHS = [320, 360, 375, 390, 414, 480, 520, 768, 861, 899, 900, 1024, 1100, 1280, 1440, 1512, 1600, 1800, 1920, 2560];
const DEFAULT_HEIGHT = 844;
const EXTRA_TUPLES = [
  [390, 667],
  [768, 1024],
  [1024, 600],
  [1440, 720],
  [1920, 1080],
  [2560, 1600],
  [320, 568],
  [861, 800],
  [1280, 720],
];

function buildViewportMatrix() {
  const seen = new Set();
  const list = [];
  const add = (w, h, label) => {
    const key = `${w}x${h}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ width: w, height: h, label: label || key });
  };
  for (const w of WIDTHS) add(w, DEFAULT_HEIGHT, `${w}x${DEFAULT_HEIGHT}`);
  for (const [w, h] of EXTRA_TUPLES) add(w, h, `${w}x${h}`);
  return list;
}

function parseBaseUrl() {
  const arg = process.argv.find((a) => a.startsWith("--base="));
  return arg ? arg.slice("--base=".length) : process.env.QA_BASE_URL || "http://localhost:5174/krayaura/";
}

async function auditOverlays(page, width) {
  const overlayIssues = [];

  if (width <= DRAWER_MAX_WIDTH) {
    await page.locator(".nav-toggle").click({ force: true });
    await page.waitForSelector(".nav-drawer.is-open", { timeout: 5_000 }).catch(() => {});
    await settle(page, 400);
    overlayIssues.push(...(await auditOverlayControls(page)));
    await page.locator(".nav-toggle").click({ force: true });
    await settle(page, 300);
  }

  await gotoSection(page, "music");
  await page.locator("[data-open-release]").first().click({ force: true });
  await page.waitForSelector("#record-sheet.is-open", { timeout: 5_000 }).catch(() => {});
  await settle(page, 350);
  overlayIssues.push(...(await auditOverlayControls(page)));
  await closeOverlay(page);
  await settle(page, 250);

  await gotoSection(page, "design");
  await page.locator(".project-item__open").first().click({ force: true });
  await page.waitForSelector("#lightbox.is-open", { timeout: 5_000 }).catch(() => {});
  await settle(page, 350);
  overlayIssues.push(...(await auditOverlayControls(page)));
  await page.locator("[data-lightbox-close]").click({ force: true }).catch(() => closeOverlay(page));
  await settle(page, 200);

  return overlayIssues;
}

async function auditViewport(browser, baseURL, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.width <= DRAWER_MAX_WIDTH,
    isMobile: vp.width <= DRAWER_MAX_WIDTH,
    baseURL,
  });
  context.setDefaultTimeout(25_000);
  const page = await context.newPage();
  const failures = [];

  try {
    await boot(page);

    let doc = await measureDocumentOverflow(page);
    if (doc.overflow) failures.push({ kind: "document_overflow", at: "hero", ...doc });

    let cta = await auditPrimaryCTAs(page, { hero: true, nav: true });
    if (cta.issues.length) failures.push({ kind: "cta", at: "hero", issues: cta.issues });

    if (hasPin(page)) {
      const miaPin = await page.locator("#mia .pin-spacer").count();
      const crashPin = await page.locator("#crash .pin-spacer").count();
      if (miaPin !== 1) failures.push({ kind: "pin", section: "mia", count: miaPin, expected: 1 });
    }

    for (const id of SECTIONS) {
      if (id === "top") continue;
      await gotoSection(page, id);
      doc = await measureDocumentOverflow(page);
      if (doc.overflow) failures.push({ kind: "document_overflow", at: `#${id}`, ...doc });

      const sections = await measureSectionOverflows(page);
      if (sections.length) failures.push({ kind: "section_overflow", at: `#${id}`, sections });

      if (id === "connect") {
        cta = await auditPrimaryCTAs(page, { nav: true });
        if (cta.issues.length) failures.push({ kind: "cta", at: `#${id}`, issues: cta.issues });
      }
    }

    await gotoSection(page, "top");
    const overlayIssues = await auditOverlays(page, vp.width);
    if (overlayIssues.length) failures.push({ kind: "overlay", issues: overlayIssues });

    if (vp.width >= HOVER_MIN_WIDTH) {
      doc = await measureDocumentOverflow(page);
      if (doc.overflow) failures.push({ kind: "document_overflow", at: "after_overlays", ...doc });
    }
  } catch (err) {
    failures.push({ kind: "error", message: String(err?.message || err) });
  } finally {
    await context.close();
  }

  return { viewport: vp, failures, pass: failures.length === 0 };
}

function renderMarkdown(results) {
  const failed = results.filter((r) => !r.pass);
  const lines = [
    "# Responsive audit report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `**Summary:** ${results.length - failed.length}/${results.length} viewports passed (strict).`,
    "",
  ];
  if (!failed.length) {
    lines.push("All viewports passed.");
    return lines.join("\n");
  }
  lines.push("## Failures", "");
  for (const r of failed) {
    lines.push(`### ${r.viewport.label} (${r.viewport.width}×${r.viewport.height})`, "");
    for (const f of r.failures) {
      lines.push("```json");
      lines.push(JSON.stringify(f, null, 2));
      lines.push("```", "");
    }
  }
  return lines.join("\n");
}

async function main() {
  const baseURL = parseBaseUrl();
  const matrix = buildViewportMatrix();
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  console.log(`Auditing ${matrix.length} viewports at ${baseURL} …`);
  for (const vp of matrix) {
    process.stdout.write(`  ${vp.label} … `);
    const r = await auditViewport(browser, baseURL, vp);
    results.push(r);
    console.log(r.pass ? "ok" : `FAIL (${r.failures.length})`);
  }
  await browser.close();

  const report = { baseURL, generatedAt: new Date().toISOString(), results };
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, "report.md"), renderMarkdown(results));

  const failCount = results.filter((r) => !r.pass).length;
  console.log(`\nReport: ${join(outDir, "report.md")}`);
  if (failCount) {
    console.error(`${failCount} viewport(s) failed.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
