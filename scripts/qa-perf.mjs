#!/usr/bin/env node
/**
 * PageSpeed-style gate: production build → gzip static server → Lighthouse mobile + desktop.
 * Fails if either performance score is under 70 (unless --allow-fail).
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const outDir = join(root, "test-results", "lighthouse");
const BASE = "/krayaura";
const PORT = Number(process.env.PERF_PORT || 4177);
const THRESHOLD = 70;
const allowFail = process.argv.includes("--allow-fail");
const skipBuild = process.argv.includes("--skip-build");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

function run(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", shell: cmd === "npm" && process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolvePromise() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

function fileFor(pathname) {
  let rel = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  if (!rel || rel === "/") rel = "/index.html";
  const candidate = normalize(join(dist, decodeURIComponent(rel).replace(/^[/\\]+/, "")));
  if (relative(dist, candidate).startsWith("..")) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, "index.html");
    if (existsSync(index)) return index;
  }
  const html = join(dist, "index.html");
  return existsSync(html) ? html : null;
}

function listenGzip() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    const file = fileFor(url.pathname);
    if (!file) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    const gzip = /\bgzip\b/i.test(req.headers["accept-encoding"] || "");
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Vary", "Accept-Encoding");
    try {
      if (gzip) {
        res.setHeader("Content-Encoding", "gzip");
        res.writeHead(200);
        await pipeline(createReadStream(file), createGzip(), res);
      } else {
        res.writeHead(200);
        await pipeline(createReadStream(file), res);
      }
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(PORT, "127.0.0.1", () => resolvePromise(server));
  });
}

function lighthouse(url, formFactor, outJson) {
  const cli = join(root, "node_modules", "lighthouse", "cli", "index.js");
  const args = [
    cli,
    url,
    "--only-categories=performance",
    "--throttling-method=simulate",
    "--output=json",
    `--output-path=${outJson}`,
    "--chrome-flags=--headless --no-sandbox --disable-gpu",
    "--quiet",
    "--disable-full-page-screenshot",
  ];
  if (formFactor === "desktop") args.push("--preset=desktop");
  else args.push("--form-factor=mobile", "--screenEmulation.mobile");
  return run(process.execPath, args);
}

function scoreOf(jsonPath) {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  return Math.round((raw.categories?.performance?.score ?? 0) * 100);
}

const url = `http://127.0.0.1:${PORT}${BASE}/`;

if (!skipBuild) await run("npm", ["run", "build"]);
if (!existsSync(dist)) throw new Error("dist/ missing — run npm run build");

mkdirSync(outDir, { recursive: true });
const server = await listenGzip();
console.log(`gzip preview ${url}`);

const results = {};
try {
  for (const form of ["mobile", "desktop"]) {
    const jsonPath = join(outDir, `${form}.json`);
    console.log(`\nLighthouse ${form}…`);
    await lighthouse(url, form, jsonPath);
    const score = scoreOf(jsonPath);
    results[form] = score;
    console.log(`${form}: ${score}`);
  }
} finally {
  server.close();
}

writeFileSync(join(outDir, "summary.json"), JSON.stringify({ url, threshold: THRESHOLD, results }, null, 2));
const failed = Object.entries(results).filter(([, n]) => n < THRESHOLD);
console.log("\nPerformance", results);
if (failed.length) {
  const msg = failed.map(([k, n]) => `${k} ${n} < ${THRESHOLD}`).join(", ");
  if (!allowFail) {
    console.error(msg);
    process.exit(1);
  }
  console.warn("allow-fail:", msg);
}
