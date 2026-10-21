#!/usr/bin/env node
// ============================================================
// repo-map — the compact, verifiable orientation document
// ============================================================
// Every session that starts cold spends its first minutes re-deriving the
// same facts: which routes exist, where the data layer lives, which
// directories hold tests, which tokens own the design system. That work is
// real, it is repeated, and it is exactly what a *generated* artifact is
// good at.
//
// The point of generating it rather than hand-writing it is the `fingerprint`
// line: a SHA-256 over every source file's (path, size, mtime). If the
// fingerprint in the document matches the tree, the map is current. If it
// does not, the map is stale and `npm run repo-map` regenerates it. That is
// the whole invalidation mechanism — no timestamps to eyeball, no judgement
// call about whether a doc "feels" out of date.
//
// It is deliberately a SUMMARY, not an index. A map that lists 1,300 files
// costs more to read than to regenerate. What it records is the shape a
// reader cannot guess: route groups, feature areas with their sizes, the
// invariants the code enforces, and the commands that gate delivery.
//
// Usage
//   node scripts/repo-map.mjs            # write docs/CODEMAPS/REPO_MAP.md
//   node scripts/repo-map.mjs --check    # exit 1 if the file is stale
//   node scripts/repo-map.mjs --stdout   # print, write nothing

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const ROOT = path.resolve(APP, "../..");
const SRC = path.join(APP, "src");
const OUT = path.join(ROOT, "docs", "CODEMAPS", "REPO_MAP.md");

const argv = process.argv.slice(2);
const check = argv.includes("--check");
const toStdout = argv.includes("--stdout");

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
// Paths inside the app are stored app-relative and printed under `apps/frontend/`.
const appRel = (p) => path.relative(APP, p).split(path.sep).join("/");
const repoRel = (p) => `apps/frontend/${appRel(p)}`;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const isCode = (f) => /\.(ts|tsx|js|jsx|mjs|cjs|css)$/.test(f);
const isTest = (f) => /\.(test|spec)\.(ts|tsx)$/.test(f);

// ------------------------------------------------------------
// Fingerprint — the invalidation key. Sorted so it is stable across
// filesystem enumeration order; content-addressed so an mtime touch with
// no content change still refreshes it (a touch CAN change behaviour for
// build caches, so treating it as a change is the conservative choice).
// ------------------------------------------------------------
const tracked = walk(SRC).filter(isCode).sort();
const fp = createHash("sha256");
for (const f of tracked) {
  const s = fs.statSync(f);
  fp.update(`${rel(f)}\0${s.size}\0${Math.round(s.mtimeMs)}\n`);
}
const fingerprint = fp.digest("hex").slice(0, 16);

// ------------------------------------------------------------
// Routes — from the App Router's own filename convention
// ------------------------------------------------------------
function routes() {
  const appDir = path.join(SRC, "app");
  const found = [];
  for (const f of walk(appDir)) {
    // Normalise before matching: on Windows `path.join` hands back
    // backslashes, and a `/\/(page)\.tsx$/` test then never matches. That
    // produced a route table with zero routes in it, which looks like an
    // app with no pages rather than a broken scan.
    if (!/\/(page|route|layout|template)\.(tsx?|jsx?)$/.test(f.split(path.sep).join("/"))) continue;
    const kind = path.basename(f).replace(/\.(tsx?|jsx?)$/, "");
    // Route groups are organisational, not URL segments: `(home)/page.tsx` → `/`.
    // Collapse the empty segments a removed group leaves behind, so
    // `(public)/about` becomes `/about` and not `//about`.
    const url =
      "/" +
      appRel(path.dirname(f))
        .replace(/^src\/app\/?/, "")
        .replace(/\/?\([^)]+\)/g, "")
        .split("/")
        .filter(Boolean)
        .join("/");
    const groups = (appRel(f).match(/\([^)]+\)/g) ?? []).join(" ");
    const dynamic = /\[/.test(url);
    found.push({ url: url === "" ? "/" : url, kind, groups, dynamic, file: repoRel(f) });
  }
  return found.sort((a, b) => (a.url === b.url ? a.kind.localeCompare(b.kind) : a.url.localeCompare(b.url)));
}

// A page is a route; a layout/template is chrome; a `route` file is an API
// endpoint. Collapsing them would misreport the surface.
function summariseRoutes(all) {
  return {
    pages: all.filter((r) => r.kind === "page"),
    apis: all.filter((r) => r.kind === "route"),
    chrome: all.filter((r) => r.kind === "layout" || r.kind === "template"),
  };
}

// ------------------------------------------------------------
// Feature areas — directories that hold a meaningful amount of code
// ------------------------------------------------------------
function areas() {
  const buckets = new Map();
  for (const f of tracked) {
    const parts = appRel(f).replace(/^src\//, "").split("/");
    let key;
    if (parts[0] === "app") {
      const cleaned = parts.filter((p) => !p.startsWith("(") && !p.startsWith("["));
      key = cleaned.length > 2 ? `app/${cleaned[1]}` : "app";
    } else if (parts.length > 2) {
      key = `${parts[0]}/${parts[1]}`;
    } else {
      key = parts[0];
    }
    if (!buckets.has(key)) buckets.set(key, { files: 0, tests: 0, lines: 0 });
    const b = buckets.get(key);
    const code = fs.readFileSync(f, "utf8");
    b.files++;
    b.lines += code.split("\n").length;
    if (isTest(f)) b.tests++;
  }
  return [...buckets].sort((a, b) => b[1].lines - a[1].lines);
}

const allRoutes = routes();
const { pages, apis, chrome } = summariseRoutes(allRoutes);
const areasRows = areas();
const testFiles = tracked.filter(isTest);

// ------------------------------------------------------------
// The document
// ------------------------------------------------------------
const doc = `# LEGALIR — repo map

<!-- GENERATED by \`npm run repo-map -w apps/frontend\`. Do not edit by hand. -->
<!-- stale-check: \`npm run repo-map -w apps/frontend -- --check\` exits 1 when this file is out of date. -->

fingerprint: \`${fingerprint}\`
source files: ${tracked.length} · test files: ${testFiles.length}

The fingerprint is a SHA-256 over every file path, byte size and mtime under
\`apps/frontend/src\`. If it matches the tree, this map is current. It is the
only staleness signal: there is no "last updated" date to interpret.

## Where things live

| Area | Files | Tests | Lines |
|---|---:|---:|---:|
${areasRows
  .slice(0, 30)
  .map(([k, b]) => `| \`${k}\` | ${b.files} | ${b.tests} | ${b.lines.toLocaleString("en-US")} |`)
  .join("\n")}

## Route surface

${pages.length} page routes · ${apis.length} API routes · ${chrome.length} layout/template files.

### Pages

${pages
  .map((r) => `- \`${r.url}\`${r.dynamic ? " (dynamic)" : ""}${r.groups ? ` — ${r.groups}` : ""}`)
  .join("\n")}

### API routes

${apis.map((r) => `- \`${r.url}\``).join("\n")}

## The gates

| Question | Command | Where it is decided |
|---|---|---|
| Do the static gates pass? | \`npm run verify -w apps/frontend\` | assets + tsc + eslint, run concurrently |
| What is the smallest test set for this change? | \`npm run affected -w apps/frontend\` | import graph over \`src\` + \`packages\` |
| Full unit regression | \`npm test -w apps/frontend\` | ${testFiles.length} vitest files |
| Full e2e contract suite | \`npm run test:e2e -w apps/frontend\` | \`e2e/\` minus \`_*\` and \`*-shot(s)\` |

## Invariants this repo enforces

These are the ones a change can quietly violate, so they are stated where a
new reader will hit them first:

- **Persian, RTL.** Every user-facing string is Persian; layout is \`dir="rtl"\`.
  Logical CSS properties (\`inline-start/end\`) resolve mirrored — for an icon
  that must point a specific physical way, use the physical property.
- **Tokens, not literals.** Colour, radius, spacing and motion come from the
  token layer in \`src/app/globals.css\`. The landing page has its own
  \`.landing\`-scoped \`--ln-*\` layer and does not read the app's MD3 tokens.
- **Admin actions are real.** UI → API → DB with a server-side permission
  check, audit logging, and a confirmation before anything destructive. An
  unconfigured external service reports «نیازمند تنظیمات», never a fake success.
- **No build while a dev server runs.** \`next build\` and \`next dev\` share
  \`.next\`; running both in this tree breaks the live server. Verify with
  \`verify\` + Playwright instead.
- **Workspace package edits need a dev-server restart** — Turbopack does not
  watch \`packages/*\`.

## Reading order for a cold start

1. \`src/app/globals.css\` — the token layer and the shared primitives.
2. \`src/app/(home)/page.tsx\` — the public landing (the biggest single surface).
3. \`src/lib/db.ts\` — the local JSON store; nearly every lib module reaches it,
   which is why a change under \`lib/\` selects a large share of the suite.
4. \`src/components/app/\` — the authenticated shell (sidebar, top bar).
5. \`e2e/\` — the contract suite. Read \`playwright.config.ts\` first: the
   \`_\`-prefixed specs are tools, not gates.
`;

if (check) {
  let current = "";
  try {
    current = fs.readFileSync(OUT, "utf8");
  } catch {
    console.error(`repo-map: ${rel(OUT)} does not exist — run: npm run repo-map -w apps/frontend`);
    process.exit(1);
  }
  const m = /fingerprint: `([0-9a-f]+)`/.exec(current);
  if (!m) {
    console.error("repo-map: the map has no fingerprint line — regenerate it");
    process.exit(1);
  }
  if (m[1] !== fingerprint) {
    console.error(
      `repo-map: STALE — map says ${m[1]}, tree is ${fingerprint}. Run: npm run repo-map -w apps/frontend`
    );
    process.exit(1);
  }
  console.log(`repo-map: current (${fingerprint})`);
  process.exit(0);
}

if (toStdout) {
  process.stdout.write(doc);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc, "utf8");
console.log(`repo-map: wrote ${rel(OUT)} (${fingerprint}, ${tracked.length} files)`);
