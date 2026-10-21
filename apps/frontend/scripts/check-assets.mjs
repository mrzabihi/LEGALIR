#!/usr/bin/env node
/**
 * check-assets — guard against asset references that break outside a dev box.
 *
 * The app must render after clone / push / PR / deploy with no dependency on a
 * developer's local disk. This scan fails (exit 1) when source or config
 * references an asset in a way that cannot survive that trip:
 *
 *   1. an absolute path        — `D:\...`, `C:/...`, `file://`, `/Users/…`,
 *                                `/home/…`
 *   2. a missing public asset  — a root-relative ref like `/logo.png` that has
 *                                no matching file under `public/`
 *   3. a casing mismatch       — the file exists but with different letter
 *                                case, which 404s on Linux/CI even though it
 *                                works on a case-insensitive dev machine
 *
 * Dependency-free (Node built-ins only). Run via `npm run check:assets`.
 * Comment lines are skipped so doc examples / URLs do not cause false hits;
 * dynamic refs built from template literals (e.g. `/x-${n}.webp`) are skipped
 * because they cannot be resolved statically.
 *
 * The absolute-path rule (1) is not applied to test files: a suite that feeds
 * `C:\Users\…` or `file://…` to a sanitiser is asserting the attack is
 * rejected, and a string in a test cannot break a clone or a deploy. Rules (2)
 * and (3) still apply everywhere — a test naming a truly missing asset is a
 * real defect.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/frontend/scripts
const frontend = path.resolve(here, "..");                  // apps/frontend
const repo = path.resolve(frontend, "..", "..");            // repo root
const PUBLIC = path.join(frontend, "public");

const SCAN_DIRS = [
  path.join(frontend, "src"),
  path.join(repo, "packages"),
  PUBLIC, // manifest.json, sw.js, offline.html reference icons too
];
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|html|txt)$/i;

// Root-relative asset reference: "/something.ext" after a quote/backtick, an
// opening paren, or CSS `url(`. Asset extensions keep URLs from matching.
const ROOT_REF = new RegExp(
  `(?:["'\`(]|url\\(\\s*)(\\/[^"'\`\\s()]*?\\.(?:png|jpe?g|svg|webp|ico|gif|avif|pdf))`,
  "gi"
);
// Absolute / non-portable path shapes. Each requires a boundary before the
// path so URL schemes (`https://`) and regex escapes never match.
const ABS_PATTERNS = [
  { name: "windows-drive", re: /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/][^\s"'`,)]+/ },
  { name: "file-url", re: /file:\/\/[^\s"'`,)]+/ },
  { name: "posix-home", re: /(?:^|[\s"'`(])\/(?:Users|home)\/[A-Za-z0-9._-]+/ },
];

// Test suites deliberately feed hostile inputs to the sanitizers under test —
// traversal names, Windows drive paths, `file://` URIs — and assert the code
// rejects or strips them. Those literals are the ATTACK, not a shipped asset
// reference, so the absolute-path rule stands down for test files. Missing /
// mis-cased public assets are still real defects there and stay enforced.
const TEST_PATH = /(?:^|\/)(?:__tests__|__mocks__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

const offenders = { absolute: [], missing: [], casing: [] };

function walk(dir, visit) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, visit);
    else visit(full);
  }
}

const isCommentLine = (line) => {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

/** Resolve a root-relative path inside public/ and check its exact casing. */
function probePublic(refPath) {
  const segments = refPath.replace(/^\//, "").split("/").filter(Boolean);
  let cur = PUBLIC;
  for (const seg of segments) {
    let names;
    try {
      names = fs.readdirSync(cur);
    } catch {
      return { state: "missing" };
    }
    if (names.includes(seg)) {
      cur = path.join(cur, seg);
    } else {
      const ci = names.find((n) => n.toLowerCase() === seg.toLowerCase());
      return ci ? { state: "casing", actual: ci } : { state: "missing" };
    }
  }
  return { state: "ok" };
}

for (const dir of SCAN_DIRS) {
  walk(dir, (file) => {
    if (!CODE_EXT.test(file)) return;
    const rel = path.relative(repo, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const isTest = TEST_PATH.test(rel);

    for (const raw of lines) {
      if (isCommentLine(raw)) continue;

      if (!isTest) {
        for (const { name, re } of ABS_PATTERNS) {
          const m = raw.match(re);
          if (m) offenders.absolute.push({ file: rel, kind: name, sample: m[0].trim().slice(0, 80) });
        }
      }

      for (const m of raw.matchAll(ROOT_REF)) {
        const ref = m[1];
        if (ref.includes("$") || ref.startsWith("/api/")) continue; // dynamic / route
        if (/^\/(?:Users|home)\//.test(ref)) continue; // absolute, reported above
        const probe = probePublic(ref);
        if (probe.state === "missing") offenders.missing.push({ file: rel, ref });
        else if (probe.state === "casing")
          offenders.casing.push({ file: rel, ref, actual: probe.actual });
      }
    }
  });
}

const total = offenders.absolute.length + offenders.missing.length + offenders.casing.length;
const line = (s) => console.log(`  ${s}`);

if (total === 0) {
  console.log("check-assets: OK — no absolute, missing, or mis-cased asset refs.");
  process.exit(0);
}

console.error(`check-assets: ${total} problem(s) found\n`);
if (offenders.absolute.length) {
  console.error("Absolute / non-portable paths (must be repo-relative):");
  offenders.absolute.forEach((o) => line(`${o.file}  [${o.kind}]  ${o.sample}`));
  console.error("");
}
if (offenders.missing.length) {
  console.error("Referenced but missing from public/:");
  offenders.missing.forEach((o) => line(`${o.ref}  (${o.file})`));
  console.error("");
}
if (offenders.casing.length) {
  console.error("Case mismatch (breaks on Linux/CI):");
  offenders.casing.forEach((o) => line(`${o.ref}  — on disk it is "${o.actual}" (${o.file})`));
  console.error("");
}
process.exit(1);
