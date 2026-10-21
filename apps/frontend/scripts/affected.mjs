#!/usr/bin/env node
// ============================================================
// affected — the smallest test set that can actually fail
// ============================================================
// Iterating against the full unit suite costs 81–96s (227 files, 3391
// tests; the spread is machine load, not the code). Vitest's own two
// answers to that question were measured and lost (see
// docs/VERIFICATION_LOOP.md): `--changed` took 90.3s — slower than the
// full run it replaces — and `related <file>` blew past 180s because it
// compiles a module graph per invocation.
//
// The reason both are slow is that they invoke TypeScript. This script
// does not: it scans import specifiers with a regex, resolves them
// against the tsconfig aliases, and answers from a cached reverse graph
// in well under a second. That is not a compromise for these files —
// every import in this repo is a static ES import or a CSS side-effect
// import, which is exactly what a specifier scan sees.
//
// WHAT IT IS NOT: it never narrows below the truth. If a change is
// something the import graph cannot see (a stylesheet, a build config, a
// workspace package, a route file with no importers), the tier escalates
// and the script says so with the reason. A check you skip is not a check
// you passed.
//
// Usage
//   node scripts/affected.mjs                 # working tree vs HEAD
//   node scripts/affected.mjs --base=origin/main
//   node scripts/affected.mjs --files=src/lib/x.ts,src/app/y/page.tsx
//   node scripts/affected.mjs --json
//   node scripts/affected.mjs --run           # execute the unit command
//   node scripts/affected.mjs --run --e2e     # ...and the e2e command
//
// Tiers
//   T0  nothing executable changed (docs, assets, scratch) — no tests
//   T1  every changed file is a module with importers — graph is authority
//   T2  a graph-invisible but SCOPED change (css, a page/route entry,
//       public assets) — affected tests + route-matched e2e specs
//   T3  a GLOBAL change (workspace package, api route, auth, build/test
//       config) — full unit suite + full e2e contract suite, selection off

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const ROOT = path.resolve(APP, "../..");
const SRC = path.join(APP, "src");
const E2E = path.join(APP, "e2e");
const PACKAGES = path.join(ROOT, "packages");
const CACHE_DIR = path.join(APP, "node_modules", ".cache", "legalir");
const CACHE_FILE = path.join(CACHE_DIR, "affected-graph.json");

const argv = process.argv.slice(2);
const opt = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};

// ------------------------------------------------------------
// Workspace package resolution, read from each package's manifest so the
// two can never drift. `@legalir/types` -> packages/types/src
// ------------------------------------------------------------
function packageAliases() {
  const map = new Map();
  for (const dir of fs.readdirSync(PACKAGES, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const manifest = path.join(PACKAGES, dir.name, "package.json");
    if (!fs.existsSync(manifest)) continue;
    let name;
    try {
      name = JSON.parse(fs.readFileSync(manifest, "utf8")).name;
    } catch {
      continue;
    }
    if (name) map.set(name, path.join(PACKAGES, dir.name, "src"));
  }
  return map;
}

const PKG_ALIASES = packageAliases();

// ------------------------------------------------------------
// Import scanning
// ------------------------------------------------------------
// Deliberately over-matching is fine (a false edge only widens the test
// set); under-matching is not, so both quote styles, both import forms,
// `require` and dynamic `import()` are all covered. Comments that happen
// to contain the word `from "x"` can only add edges, never remove them.
const SPEC_RE =
  /(?:^|[^\w$.])(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']|(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g;

function scanSpecifiers(code) {
  const out = [];
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(code))) {
    const spec = m[1] ?? m[2];
    if (spec) out.push(spec);
  }
  return out;
}

const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".json"];
const INDEX_FILES = RESOLVE_EXTS.map((e) => `index${e}`);

function resolveSpec(spec, fromFile) {
  if (spec.startsWith(".")) {
    return resolveFile(path.resolve(path.dirname(fromFile), spec));
  }
  if (spec.startsWith("@/")) {
    return resolveFile(path.join(SRC, spec.slice(2)));
  }
  const pkgHit = [...PKG_ALIASES.keys()].find((n) => spec === n || spec.startsWith(`${n}/`));
  if (pkgHit) {
    const rest = spec.slice(pkgHit.length).replace(/^\//, "");
    return resolveFile(path.join(PKG_ALIASES.get(pkgHit), rest));
  }
  return null; // bare node_modules specifier — no edge
}

function resolveFile(base) {
  const candidates = [
    base,
    ...RESOLVE_EXTS.map((e) => base + e),
    ...INDEX_FILES.map((i) => path.join(base, i)),
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* next */
    }
  }
  return null;
}

// ------------------------------------------------------------
// The file universe: everything vitest could compile, plus e2e.
// Scratch and build output are skipped — they are never imported.
// ------------------------------------------------------------
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|css|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

const isTestFile = (f) => /\.(test|spec)\.(ts|tsx)$/.test(f);

function collectSources() {
  const frontend = walk(SRC).filter((f) => !f.endsWith(".json"));
  const packages = walk(PACKAGES).filter(
    (f) => f.includes(`${path.sep}src${path.sep}`) && !f.endsWith(".json")
  );
  return [...frontend, ...packages];
}

// ------------------------------------------------------------
// Cache: keyed by the exact (path, mtimeMs, size) triples of the file
// universe. Any add, remove, rename, or content write changes the key,
// which is the invalidation rule that matters here — a stale graph is
// worse than no graph, because it silently under-selects.
// ------------------------------------------------------------
function statKey(files) {
  const h = createHash("sha256");
  for (const f of files) {
    let s;
    try {
      s = fs.statSync(f);
    } catch {
      continue;
    }
    h.update(`${f}\0${Math.round(s.mtimeMs)}\0${s.size}\n`);
  }
  return h.digest("hex").slice(0, 32);
}

function buildGraph(files) {
  const forward = new Map(); // file -> Set(imports)
  const reverse = new Map(); // file -> Set(importers)
  const specs = new Map(); // file -> Set(raw specifiers)

  for (const file of files) {
    if (file.endsWith(".css") || file.endsWith(".json")) {
      forward.set(file, new Set());
      continue;
    }
    let code;
    try {
      code = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const deps = new Set();
    const raw = new Set();
    for (const spec of scanSpecifiers(code)) {
      raw.add(spec);
      const target = resolveSpec(spec, file);
      if (target) deps.add(target);
    }
    forward.set(file, deps);
    specs.set(file, raw);
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, new Set());
      reverse.get(dep).add(file);
    }
  }

  return {
    forward: [...forward].map(([k, v]) => [k, [...v]]),
    reverse: [...reverse].map(([k, v]) => [k, [...v]]),
    specs: [...specs].map(([k, v]) => [k, [...v]]),
  };
}

function loadGraph(files) {
  const key = statKey(files);
  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (cached.key === key) return { graph: cached.graph, key, cacheHit: true };
  } catch {
    /* rebuild */
  }
  const graph = buildGraph(files);
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ key, graph }), "utf8");
  } catch {
    /* a cache that cannot be written is only slower, not wrong */
  }
  return { graph, key, cacheHit: false };
}

// ------------------------------------------------------------
// Changed files
// ------------------------------------------------------------
// A path from `git` is repo-root-relative; a path a human types on the
// command line is almost always app-relative (`src/lib/x.ts`). Both resolve,
// the existing file wins.
function toAbs(p) {
  if (path.isAbsolute(p)) return p;
  const fromRoot = path.resolve(ROOT, p);
  const fromApp = path.resolve(APP, p);
  if (fs.existsSync(fromRoot)) return fromRoot;
  if (fs.existsSync(fromApp)) return fromApp;
  return fromRoot;
}
const toRel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
// Vitest's root is `apps/frontend`, so anything positional (test filters,
// e2e spec paths) must be relative to THAT, not to the repo root.
const appRel = (rel) => rel.replace(/^apps\/frontend\//, "");

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function lines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function changedFromGit(base) {
  const out = new Set();
  if (base) {
    for (const l of lines(git(["diff", "--name-only", "--diff-filter=ACMR", base, "--"]))) out.add(l);
  } else {
    for (const l of lines(git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"]))) out.add(l);
    // Staged-but-new files are already in `diff HEAD`; untracked files are not.
    for (const l of lines(git(["ls-files", "--others", "--exclude-standard"]))) out.add(l);
  }
  return [...out].filter((p) => {
    try {
      return fs.statSync(toAbs(p)).isFile();
    } catch {
      return false;
    }
  });
}

const filesOpt = opt("files");
const baseOpt = opt("base");
const changed = filesOpt
  ? String(filesOpt)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : changedFromGit(typeof baseOpt === "string" ? baseOpt : undefined);

// ------------------------------------------------------------
// Classification — what the graph cannot see decides the tier
// ------------------------------------------------------------
const GLOBAL_REASONS = [
  [/^packages\//, "workspace package — every consumer can change"],
  [/^apps\/frontend\/src\/app\/api\//, "API route — no importer edge exists"],
  [/^apps\/frontend\/src\/middleware\./, "middleware — runs on every request"],
  [/^apps\/frontend\/src\/lib\/(auth|db|store|persistence)/, "data/auth boundary"],
  [/^apps\/frontend\/(next|tailwind|postcss|vitest\.config)\./, "build/test config"],
  [/^apps\/frontend\/(tsconfig|package)\.json$/, "build config"],
  [/^apps\/frontend\/playwright\.(all\.)?config\.ts$/, "e2e config"],
  [/^apps\/frontend\/e2e\//, "e2e spec — the contract suite itself"],
  [/^(apps\/frontend\/)?package(-lock)?\.json$/, "dependency graph"],
  [/^eslint\.config\./, "lint config"],
];

const SCOPED_REASONS = [
  [/\.css$/, "stylesheet — the import graph carries no selector edges"],
  [/^apps\/frontend\/src\/app\/.*\.(tsx?)$/, "route entry — a page/layout has no importers by construction"],
  [/^apps\/frontend\/public\//, "shipped asset"],
];

const INERT_REASONS = [
  [/^docs\//, "documentation"],
  [/\.md$/, "documentation"],
  [/^apps\/frontend\/public\/.*\.(png|jpe?g|webp|avif|svg|ico|woff2?)$/, "asset binary"],
  // These ARE this harness. No unit test imports them, so classifying them
  // as modules would escalate every edit to the tooling into a full suite
  // run — noise that trains people to ignore the output.
  [/^apps\/frontend\/scripts\//, "repo tooling — not in the app graph"],
  [/^\.tmp-/, "scratch"],
  [/^DESIGN\//, "source design material"],
];

function classify(p) {
  for (const [re, why] of GLOBAL_REASONS) if (re.test(p)) return { level: 3, why };
  for (const [re, why] of SCOPED_REASONS) if (re.test(p)) return { level: 2, why };
  for (const [re, why] of INERT_REASONS) if (re.test(p)) return { level: 0, why };
  return { level: 1, why: "module — the import graph is authoritative" };
}

// ------------------------------------------------------------
// Route -> e2e specs
// ------------------------------------------------------------
function routeOf(file) {
  // Normalise BEFORE matching. On Windows an absolute path is
  // `D:\…\src\app\(home)\page.tsx`, and a `/src/app/` pattern against
  // backslashes never matches — which returned "no spec names this route"
  // for every route on this machine, quietly turning each route change into
  // a full contract-suite run.
  const m = /\/src\/app\/(.*)$/.exec(file.split(path.sep).join("/"));
  if (!m) return null;
  return (
    "/" +
    m[1]
      .replace(/\/(page|layout|template|route|loading|error|not-found)\.(tsx?|jsx?)$/, "")
      // Route groups are organisational, not URL segments. The `(^|\/)`
      // alternative matters: in `(home)/page.tsx` the group is the FIRST
      // segment, so a pattern anchored on a leading slash left the route
      // reading `/(home)` — which matches no spec, and every landing-page
      // change fell through to the full contract suite.
      .replace(/(^|\/)\([^)]+\)/g, "")
      .replace(/\[[^\]]+\]/g, "*")
      .split("/")
      .filter(Boolean)
      .join("/")
  );
}

function buildE2eIndex() {
  const specs = walk(E2E).filter((f) => f.endsWith(".spec.ts"));
  const index = [];
  for (const spec of specs) {
    const base = path.basename(spec);
    const working = base.startsWith("_") || /-shots?\.spec\.ts$/.test(base);
    let code = "";
    try {
      code = fs.readFileSync(spec, "utf8");
    } catch {
      /* ignore */
    }
    const routes = new Set();
    // Two patterns, because they answer different questions.
    //
    // A non-root route literal (`"/admin/users"`) is unambiguous — it can
    // only be a route. The bare `"/"` is not: it appears in `split("/")`,
    // in `path.join`, in any number of ordinary string operations, so
    // treating every `"/"` as "this spec tests the site root" matched
    // nearly every spec in the drawer. It counts only where it is actually
    // a navigation target.
    const routeRe = /["'`](\/[A-Za-z0-9_\-[\]]+(?:\/[A-Za-z0-9_\-[\]]*)*)["'`]/g;
    let m;
    while ((m = routeRe.exec(code))) {
      const r = m[1];
      if (r.startsWith("/_next") || r.startsWith("//")) continue;
      routes.add(r.split("?")[0]);
    }
    // `[,)]` rather than `\)`: `page.goto("/", { waitUntil: … })` is the
    // common form, and requiring the paren immediately after the literal
    // dropped `landing-polish.spec.ts` — the single spec that guards the
    // landing page — from the landing route's own selection.
    const navRe = /(?:goto|visit|toHaveURL)\s*\(\s*["'`]\/["'`]\s*[,)]|url\s*:\s*["'`]\/["'`]\s*[,}]/g;
    if (navRe.test(code)) routes.add("/");
    index.push({ spec: toRel(spec), base, working, routes });
  }
  return index;
}

function e2eForRoutes(routePaths, e2eIndex) {
  const hits = new Set();
  for (const route of routePaths) {
    const segs = route.split("/").filter(Boolean);
    for (const entry of e2eIndex) {
      if (entry.working) continue; // the contract suite is what gates delivery
      const matchesRoute = [...entry.routes].some((r) => {
        if (route === "/" || r === "/") return r === route;
        const rs = r.split("/").filter(Boolean);
        if (rs.length < segs.length) return false;
        return segs.every((s, i) => s === "*" || rs[i] === s);
      });
      // Fall back to the filename only for a DISTINCTIVE single segment.
      // `admin` is not distinctive — a dozen specs carry it in their name
      // — but `calculators` or `dashboard` is, and those specs often never
      // spell out the URL because they click their way there.
      const lastSegment = segs[segs.length - 1];
      const distinctive = Boolean(lastSegment) && lastSegment.length >= 5 && !lastSegment.includes("*");
      const matchesName =
        distinctive && new RegExp(`(^|[-_])${lastSegment}($|[-_.])`).test(entry.base);
      if (matchesRoute || matchesName) hits.add(entry.spec);
    }
  }
  return [...hits].sort();
}

// ------------------------------------------------------------
// Reverse reachability: which tests can see the changed modules
// ------------------------------------------------------------
function dependentsOf(seeds, reverse) {
  const seen = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const cur = queue.pop();
    const importers = reverse.get(cur);
    if (!importers) continue;
    for (const imp of importers) {
      if (seen.has(imp)) continue;
      seen.add(imp);
      queue.push(imp);
    }
  }
  return seen;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
const allSources = collectSources();
const { graph, key, cacheHit } = loadGraph(allSources);
const forward = new Map(graph.forward);
const reverse = new Map(graph.reverse);
const testFiles = allSources.filter(isTestFile);

// Normalise every changed path to repo-relative before classifying. The
// patterns below are written repo-relative (that is what `git diff` emits),
// and an app-relative `--files=src/app/…` input would otherwise skip the
// route-entry rule and be classified as an ordinary module — which then
// escalated a landing-page edit to the full unit suite.
const classified = changed.map((p) => {
  const repoRelative = toRel(toAbs(p));
  return { path: repoRelative, ...classify(repoRelative) };
});
const worst = classified.reduce((max, c) => Math.max(max, c.level), 0);

const reasons = [];
const notes = [];
/** Changed modules that no unit test can observe. Never silent — reported. */
const report_untested = [];

// Unit and e2e answer different questions and are decided separately:
// a stylesheet can be invisible to every test yet still need the contract
// suite, and a pure lib module needs unit tests that no browser run would
// catch as fast. Collapsing them into one "tier" forced one of the two to
// be either wasteful or dishonest.
const verdict = {
  unit: { mode: "none", files: [], command: null, why: "" },
  e2e: { mode: "none", files: [], command: null, why: "" },
};

if (worst >= 3) {
  reasons.push(...classified.filter((c) => c.level >= 3).map((c) => `${c.path} — ${c.why}`));
  verdict.unit = { mode: "full", files: [], command: "npm test", why: "global change" };
  verdict.e2e = { mode: "full", files: [], command: "npm run test:e2e", why: "global change" };
} else if (worst === 0) {
  verdict.unit.why = "nothing executable changed";
  verdict.e2e.why = "nothing executable changed";
} else {
  const seeds = classified
    .filter((c) => c.level >= 1)
    .map((c) => toAbs(c.path))
    .filter((p) => forward.has(p));
  const reachable = dependentsOf(seeds, reverse);
  const directTests = classified.filter((c) => isTestFile(toAbs(c.path))).map((c) => toAbs(c.path));
  const selected = [...new Set([...reachable, ...directTests])].filter(isTestFile).map(toRel).sort();

  const touchedOnlyStyles = classified.every((c) => /\.css$/.test(c.path));

  if (selected.length) {
    verdict.unit = {
      mode: "selected",
      files: selected,
      command: null,
      why: `reachable from ${seeds.length} changed module(s)`,
    };
  } else if (touchedOnlyStyles) {
    // A stylesheet has no unit-level assertion to fail: vitest processes it
    // but nothing reads computed styles. Sending it to the full unit suite
    // bought 96s of tests that cannot observe the change. The contract
    // suite is the real gate for CSS, and it runs instead.
    verdict.unit.why = "stylesheets have no unit-level assertion — e2e is the gate";
    classified.forEach((c) => {
      if (!/\.css$/.test(c.path)) notes.push(`${c.path} — not a stylesheet, see below`);
    });
    verdict.e2e = { mode: "full", files: [], command: "npm run test:e2e", why: "stylesheet — no unit test can see it" };
  } else {
    // No test reaches the changed module. Running all 226 tests would not
    // make that module observable — it would just spend 96s proving that a
    // module nothing tests still isn't tested. Say so loudly instead and
    // hand the change to the gate that CAN see it.
    // `.length`, not `.size`: the graph is JSON-serialised between runs, so
    // its adjacency values are arrays whether the graph was rebuilt or read
    // from the cache. Using `.size` silently reported 0 importers for every
    // module and told the reader the change was orphaned.
    const importerCount = seeds.reduce((n, s) => n + (reverse.get(s)?.length ?? 0), 0);
    verdict.unit = {
      mode: "none",
      files: [],
      command: null,
      why:
        importerCount > 0
          ? `no unit test covers it (${importerCount} app importer(s)) — e2e/build is the gate`
          : "no importer and no test — new or orphaned code",
    };
    report_untested.push(...seeds.map(toRel));
  }

  if (verdict.e2e.mode === "none") {
    reasons.push(...classified.filter((c) => c.level === 2).map((c) => `${c.path} — ${c.why}`));
    const routes = classified.map((c) => routeOf(toAbs(c.path))).filter(Boolean);
    const specs = e2eForRoutes(routes, buildE2eIndex());
    if (specs.length) {
      verdict.e2e = {
        mode: "selected",
        files: specs,
        command: `npx playwright test -c playwright.live.config.ts ${specs.map(appRel).join(" ")}`,
        why: `route match for ${routes.join(", ")}`,
      };
    } else if (worst === 2 || verdict.unit.mode === "none") {
      // Either a route/asset changed that no contract spec names, or the
      // change has no unit coverage at all. In both cases the contract suite
      // is the only thing that can observe it — running nothing would be a
      // skip disguised as a saving.
      verdict.e2e = {
        mode: "full",
        files: [],
        command: "npm run test:e2e",
        why: worst === 2 ? "no spec names this route" : "no unit coverage — this is the only gate",
      };
    }
  }
}

// A repo-relative `apps/frontend/src/...` filter matches nothing, and
// vitest exits having run only the filters that did match — which is how a
// 2-file selection silently became 1 file.
const FILTER_FILES = testFiles.map((f) => appRel(toRel(f)));
if (verdict.unit.mode === "selected") {
  verdict.unit.command = `vitest run ${verdict.unit.files.map(shortestUnique).join(" ")}`;
}

/**
 * Vitest's positional filters are substring matches, so a basename is
 * enough to name a spec only when no OTHER file contains that string.
 *
 * The first version compared basenames — `catalog.test.ts` looked unique
 * while `contract-services/__tests__/catalog.test.ts` and
 * `calculators/__tests__/catalog.test.ts` both also contain it, so
 * selecting 2 files ran 4. Extra tests are not a correctness problem, but
 * they are a lie about the selection, and a lie is worse than a longer
 * command line. Compare against every test file in the tree instead.
 */
function shortestUnique(rel) {
  const local = appRel(rel);
  const base = path.basename(local);
  const otherHits = FILTER_FILES.filter((f) => f !== local && f.includes(base)).length;
  return otherHits === 0 ? base : local;
}

const report = {
  changed: classified,
  reasons,
  notes,
  untestedModules: report_untested,
  graph: { files: allSources.length, tests: testFiles.length, cacheHit, key },
  unit: {
    mode: verdict.unit.mode,
    selected: verdict.unit.mode === "full" ? testFiles.length : verdict.unit.files.length,
    total: testFiles.length,
    files: verdict.unit.files,
    command: verdict.unit.command,
    why: verdict.unit.why,
  },
  e2e: {
    mode: verdict.e2e.mode,
    selected: verdict.e2e.mode === "full" ? "contract suite" : verdict.e2e.files.length,
    files: verdict.e2e.files,
    command: verdict.e2e.command,
    why: verdict.e2e.why,
  },
};

if (opt("json")) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else if (!opt("selftest")) {
  const pad = (s, n) => String(s).padEnd(n);
  const label = { none: "—", selected: "selected", full: "full" };
  process.stdout.write(
    `\n${changed.length} changed · graph ${allSources.length} files / ${testFiles.length} tests · ${cacheHit ? "cache hit" : "rebuilt"}\n`
  );
  for (const c of classified) process.stdout.write(`  ${pad(c.path, 64)} T${c.level}\n`);
  if (reasons.length) {
    process.stdout.write("\nwhy:\n");
    for (const r of reasons) process.stdout.write(`  • ${r}\n`);
  }
  for (const n of notes) process.stdout.write(`  ! ${n}\n`);
  process.stdout.write(
    `\nunit    ${pad(label[verdict.unit.mode], 10)}${pad(verdict.unit.mode === "full" ? `${testFiles.length} files` : `${verdict.unit.files.length}/${testFiles.length}`, 12)}  ${verdict.unit.why}\n`
  );
  if (verdict.unit.mode === "selected" && verdict.unit.files.length <= 15) {
    for (const f of verdict.unit.files) process.stdout.write(`${" ".repeat(22)}${f}\n`);
  }
  process.stdout.write(
    `e2e     ${pad(label[verdict.e2e.mode], 10)}${pad(verdict.e2e.mode === "full" ? "contract suite" : `${verdict.e2e.files.length} spec(s)`, 12)}  ${verdict.e2e.why}\n`
  );
  if (verdict.e2e.files.length) {
    for (const f of verdict.e2e.files) process.stdout.write(`${" ".repeat(22)}${f}\n`);
  }
  if (report_untested.length) {
    process.stdout.write("\nNO UNIT COVERAGE (validate by hand before delivering):\n");
    for (const f of report_untested) process.stdout.write(`  ! ${f}\n`);
  }
  process.stdout.write("\nbefore delivering:  npm run verify && npm test && npm run test:e2e\n");
}

// ------------------------------------------------------------
// --selftest — check the selector against the invariants its safety rests
// on, using real files in this tree.
//
// A selector fails in the quiet direction: if it under-selects, the tests
// it dropped do not report themselves, and a green run means less than it
// looks like it means. So the properties that make it trustworthy are
// asserted on every `verify`, and each assertion is one a real regression
// has broken before:
//
//   • a stylesheet is never sent to the unit suite (it can't be observed)
//   • a module WITH a covering test always selects that test
//   • a module with no covering test is reported, not silently dropped
//   • `--json` stays valid JSON with the fields the reporter reads
//   • the cache key changes when a file changes (stale graph = under-select)
// ------------------------------------------------------------
if (opt("selftest")) {
  const failures = [];
  const check = (name, ok, detail) => {
    process.stdout.write(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}\n`);
    if (!ok) failures.push(name);
  };

  const invoke = (args) =>
    JSON.parse(
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...args, "--json"], {
        cwd: APP,
        encoding: "utf8",
      })
    );

  // 1. stylesheet → e2e is the gate, unit is not run
  const css = invoke(["--files=src/app/globals.css"]);
  check("stylesheet skips the unit suite", css.unit.mode === "none", css.unit.mode);
  check("stylesheet is gated by e2e", css.e2e.mode === "full", css.e2e.mode);

  // 2. a covered module selects its own test
  const covered = invoke(["--files=src/lib/persian-utils.ts"]);
  const ownTest = covered.unit.files.find((f) => f.endsWith("lib/__tests__/persian-utils.test.ts"));
  check("covered module selects its own test", Boolean(ownTest), ownTest ?? "missing");
  check("covered module does not run the whole suite", covered.unit.mode === "selected", covered.unit.mode);

  // 3. an uncovered module is reported rather than silently skipped
  const uncovered = invoke(["--files=src/components/public/landing/landing-services.tsx"]);
  check(
    "uncovered module is reported",
    uncovered.untestedModules.length > 0,
    uncovered.untestedModules.join(", ") || "nothing reported"
  );
  check("uncovered module still gets a gate", uncovered.e2e.mode !== "none", uncovered.e2e.mode);

  // 4. global changes switch selection off entirely
  const global = invoke(["--files=apps/frontend/src/app/api/v1/admin/[[...segments]]/route.ts"]);
  check("API route runs the full unit suite", global.unit.mode === "full", global.unit.mode);

  // 5. the cache key is content-sensitive
  const alpha = collectSources();
  const keyA = statKey(alpha);
  // NOT a dotfile: the source walker skips `.`-prefixed entries, so a probe
  // named `.selftest-probe.ts` would never enter the universe and the key
  // would never change — the check would fail for the wrong reason.
  const probe = path.join(SRC, "lib", "selftest-probe.ts");
  const existed = fs.existsSync(probe);
  try {
    if (!existed) fs.writeFileSync(probe, "export const selftestProbe = 1;\n", "utf8");
    const keyB = statKey(collectSources());
    check("a new file changes the cache key", keyA !== keyB);
  } finally {
    if (!existed) fs.rmSync(probe, { force: true });
  }

  if (failures.length) {
    process.stderr.write(`\naffected --selftest: ${failures.length} invariant(s) broken\n`);
    process.exit(1);
  }
  process.stdout.write("\naffected --selftest: all invariants hold\n");
  process.exit(0);
}

// ------------------------------------------------------------
// --why=<test file> — the shortest import chain from that test back to a
// changed file. This is the trust mechanism: a selection you cannot explain
// is one you learn to distrust, and a selection that is larger than expected
// is usually one shared hub module away from obvious.
// ------------------------------------------------------------
const whyOpt = opt("why");
if (typeof whyOpt === "string") {
  const target = toAbs(whyOpt);
  const seeds = new Set(
    classified.filter((c) => c.level >= 1).map((c) => toAbs(c.path))
  );
  // BFS from the test through its imports; first seed hit is the shortest path.
  const prev = new Map([[target, null]]);
  const queue = [target];
  let found = null;
  while (queue.length && !found) {
    const cur = queue.shift();
    for (const dep of forward.get(cur) ?? []) {
      if (prev.has(dep)) continue;
      prev.set(dep, cur);
      if (seeds.has(dep)) {
        found = dep;
        break;
      }
      queue.push(dep);
    }
  }
  if (!found) {
    process.stdout.write(`\n${whyOpt} does not import any changed file.\n`);
  } else {
    const chain = [];
    for (let n = found; n !== null; n = prev.get(n)) chain.unshift(toRel(n));
    process.stdout.write(`\n${whyOpt} reaches a changed file in ${chain.length - 1} hop(s):\n`);
    for (const link of chain) process.stdout.write(`  → ${link}\n`);
  }
}

// ------------------------------------------------------------
// --run
// ------------------------------------------------------------
// Commands are spawned as argv arrays, never as shell strings. The
// `../../node_modules/.bin/vitest` shim this started as is a `.cmd` on
// Windows, and `cmd.exe` refuses a relative path that begins with `..` —
// it printed "'..' is not recognized" and exited 1 having run nothing.
// Passing the JS entry point to `node` by absolute path sidesteps both the
// shim and the quoting.
const VITEST = path.join(ROOT, "node_modules", "vitest", "vitest.mjs");
const PLAYWRIGHT = path.join(ROOT, "node_modules", "@playwright", "test", "cli.js");

function run(label, cmd, args) {
  process.stdout.write(`\n$ ${label}\n`);
  const r = spawnSync(cmd, args, { cwd: APP, stdio: "inherit", shell: false });
  if (r.error) {
    process.stderr.write(`failed to spawn: ${r.error.message}\n`);
    return 1;
  }
  return r.status ?? 1;
}

if (opt("run")) {
  let status = 0;

  if (verdict.unit.mode === "full") {
    status |= run("npm test", process.platform === "win32" ? "npm.cmd" : "npm", ["test"]);
  } else if (verdict.unit.mode === "selected") {
    status |= run(
      verdict.unit.command,
      process.execPath,
      [VITEST, "run", ...verdict.unit.files.map(shortestUnique)]
    );
  }

  if (opt("e2e")) {
    if (verdict.e2e.mode === "full") {
      status |= run("npm run test:e2e", process.platform === "win32" ? "npm.cmd" : "npm", ["run", "test:e2e"]);
    } else if (verdict.e2e.mode === "selected") {
      status |= run(
        verdict.e2e.command,
        process.execPath,
        [PLAYWRIGHT, "test", "-c", "playwright.live.config.ts", ...verdict.e2e.files]
      );
    }
  }

  process.exit(status);
}
