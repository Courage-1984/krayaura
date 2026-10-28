#!/usr/bin/env node
/** Walk public/ (+ dist/assets if present): bytes, optional dimensions, flag heavy files. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [path.join(root, "public"), path.join(root, "dist", "assets")].filter((d) =>
  fs.existsSync(d)
);

const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const HEAVY = 500 * 1024;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

const files = dirs.flatMap((d) => walk(d));
const byExt = new Map();
let total = 0;
const heavy = [];

for (const f of files) {
  const st = fs.statSync(f);
  total += st.size;
  const ext = path.extname(f).toLowerCase() || "(none)";
  const rel = path.relative(root, f).replace(/\\/g, "/");
  if (!byExt.has(ext)) byExt.set(ext, { count: 0, bytes: 0, files: [] });
  const g = byExt.get(ext);
  g.count++;
  g.bytes += st.size;
  g.files.push({ rel, bytes: st.size });
  if (st.size >= HEAVY) heavy.push({ rel, mb: (st.size / (1024 * 1024)).toFixed(2) });
}

heavy.sort((a, b) => Number(b.mb) - Number(a.mb));
for (const g of byExt.values()) g.files.sort((a, b) => b.bytes - a.bytes);

console.log("Asset report —", dirs.map((d) => path.relative(root, d)).join(", "));
console.log("Total:", (total / (1024 * 1024)).toFixed(2), "MB\n");
console.log("By type:");
for (const [ext, g] of [...byExt.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${ext.padEnd(8)} ${String(g.count).padStart(4)}  ${(g.bytes / (1024 * 1024)).toFixed(2).padStart(7)} MB`);
}

console.log("\nLargest files (≥500 KB):");
for (const h of heavy.slice(0, 25)) console.log(`  ${h.mb} MB  ${h.rel}`);

const rasters = files.filter((f) => RASTER.has(path.extname(f).toLowerCase()));
if (rasters.length && fs.existsSync(path.join(root, "scripts", "lib", "optimize_image.py"))) {
  const py = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    [
      "-c",
      `import json,sys
from pathlib import Path
from PIL import Image
root=Path(${JSON.stringify(root)})
rows=[]
for line in sys.stdin:
 p=root/line.strip()
 try:
  im=Image.open(p)
  rows.append({"path":line.strip(),"w":im.width,"h":im.height})
 except Exception:
  pass
print(json.dumps(rows))`,
    ],
    {
      input: rasters
        .slice(0, 120)
        .map((f) => path.relative(root, f).replace(/\\/g, "/"))
        .join("\n"),
      encoding: "utf-8",
    }
  );
  if (py.status === 0 && py.stdout) {
    try {
      const dims = JSON.parse(py.stdout);
      if (dims.length) {
        console.log("\nSample dimensions (first rasters, max 120):");
        for (const d of dims.slice(0, 15)) console.log(`  ${d.w}x${d.h}  ${d.path}`);
        if (dims.length > 15) console.log(`  … +${dims.length - 15} more`);
      }
    } catch {
      /* ignore */
    }
  }
}
