import { defineConfig } from "@playwright/test";
import { VIEWPORTS } from "./tests/qa/config.mjs";

const baseURL = "http://localhost:5174/krayaura/";

export default defineConfig({
  testDir: "./tests/qa",
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "allow",
      timeout: 20_000,
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "tests/qa/__screenshots__/{arg}-{projectName}.png",
  use: {
    baseURL,
    browserName: "chromium",
    deviceScaleFactor: 1,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 10_000,
  },
  webServer: {
    command: "npx vite --port 5174 --strictPort",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: VIEWPORTS.map((v) => ({
    name: v.name,
    use: {
      viewport: { width: v.width, height: v.height },
      hasTouch: v.touch,
      isMobile: v.touch,
    },
  })),
});
