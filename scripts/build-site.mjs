// Dual-host build wrapper: stamp SITE, write robots/sitemap/404, share stubs, then vite.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteFromEnv, writeSiteFiles } from "./site.mjs";

if (process.argv.includes("--live")) process.env.SITE = "live";
else if (!process.env.SITE) process.env.SITE = "pages";

const site = siteFromEnv();
writeSiteFiles(site);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const stubs = path.join(root, "scripts", "build-share-stubs.mjs");

const run = (file, args = []) => {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status) process.exit(result.status);
};

run(stubs);
run(viteBin, ["build"]);
console.log(`built ${site.live ? "live" : "pages"} → ${site.outDir}/ (${site.url})`);
