# The verification loop

How to check a change in this repo without paying for checks that cannot fail,
and the measurements behind each choice. Every number below was taken on this
machine (12 logical CPUs, Windows 10, Node 20, warm filesystem cache) on
2026-10-21.

The rule the loop exists to protect: **a check you skip is not a check you
passed.** Everything here removes *redundant work*, never *coverage*.

---

## The loop

```
Understand → Plan briefly → Execute → Validate → Deliver
```

| Stage | Command | Median |
|---|---|---|
| assets + types + lint (no cache misses) | `npm run verify -w apps/frontend` | 11.4 s |
| the tests around what you touched | `vitest run <dir>` | 9.1 s for 10 files |
| the e2e spec you touched | `playwright test <spec> -c playwright.live.config.ts` | 20–30 s |
| full unit suite, before delivering | `npm test -w apps/frontend` | 96 s |
| full e2e contract suite, before delivering | `npm run test:e2e -w apps/frontend` | 262 tests |

During iteration, run the narrow row. Before delivering, run the wide row.
There is no stage that runs nothing.

---

## What changed, and why

### 1. `test:e2e` now means the contract suite (564 → 262 tests, 75 → 29 files)

`apps/frontend/e2e/` holds two unrelated families:

- **the contract suite** — 29 files with ordinary names, each asserting a
  behaviour the product is supposed to have;
- **the working files** — 45 `_*.spec.ts` and `*-shot(s).spec.ts` files. These
  are tools: ad-hoc audits, and screenshot capture that asserts almost nothing
  and spends multiple seconds per test in `waitForTimeout` so a chart has
  painted before the shutter fires.

`playwright.config.ts` now sets `testIgnore` to the working files, so the
default run is the contract suite. **281 of the 564 tests came from the
`_`-prefixed files alone** — half of every run was screenshots.

The working files are still one command away: `npm run test:e2e:all` uses
`playwright.all.config.ts`, which spreads the base config and empties the
ignore list, so the two runs can never drift apart.

Verified both directions:

```
playwright test --list -c playwright.config.ts      → Total: 262 tests in 29 files
playwright test --list -c playwright.all.config.ts  → Total: 564 tests in 75 files
```

### 2. A fast lint path exists: `lint:fast`

| Command | Cold | Warm |
|---|---|---|
| `npm run lint` (`next lint`) | 27.2–27.7 s | — |
| `eslint src --ext .ts,.tsx` (no cache) | 18.1–28.0 s | — |
| `npm run lint:fast` (content-hashed cache) | same as above | **3.7–4.1 s** |

`next lint` gives no cache control at all. `lint:fast` passes
`--cache --cache-location node_modules/.cache/eslint/.eslintcache`, so a run
that touches three files re-lints three files.

`npm run verify` chains `check:assets → typecheck → lint:fast`, which is the
same three gates CI's `quality` job runs, in the same order. Steady state —
nothing else touching the tree — is **10–15 s** (10.1, 10.6, 11.4, 12.1, 14.5
across five runs).

One caveat worth knowing: this repo is often being edited by more than one
session at once. A `verify` whose first invocation follows somebody else's
edit pays a near-cold lint, and the same command measured **59 s** under that
condition. That is the cache working correctly, not a regression.

### 3. `npx` costs ~1.5–2.5 s per invocation

| Invocation | Wall |
|---|---|
| `npx tsc --noEmit` | 5.8–6.7 s |
| `node ../../node_modules/typescript/bin/tsc --noEmit` | 3.8–3.9 s |
| `npx vitest run <file>` | 5.2 s |
| `node ../../node_modules/vitest/vitest.mjs run <file>` | 3.8 s |

In a `verify` chain with two tools, that is 3–5 s of pure launcher overhead per
loop. Inside npm scripts `npx` is unnecessary — npm already puts
`node_modules/.bin` on `PATH`. The measurement is recorded here so the next
person can decide; the scripts were left as they are because the difference
only matters when iterating by hand.

### 4. What was measured and deliberately NOT adopted

These were tried, cost real time, and lost. Recording them stops the next
person from re-spending that time.

| Candidate | Result | Verdict |
|---|---|---|
| `vitest --changed` | 90.3 s | Slower than the 96 s full run it replaces — it pays the same startup and then still collects widely. A `test:changed` script was added and then removed again, so nobody reaches for it by name. |
| `vitest related <file>` | >180 s (timed out) | Compiles a module graph per invocation. Worse than the full run. Use a **directory** filter instead: `vitest run src/components/contracts` → 10 files, 126 tests, 9.1 s. |
| `vitest --no-isolate` | 106 s, **554 failures** | Slower *and* breaks the suite: tests share module state. Never adopt without a full green run. |
| `tsc --tsBuildInfoFile <dir>` | 27.9 s first, 5.8 s after | No better than the default `dist/tsconfig.tsbuildinfo` (6.2 s cold, 5.7 s warm). `tsc`'s own program build is the floor: `--extendedDiagnostics` reports 2.6 s program + 0.8 s bind out of 3.4 s total; only ~0.5 s is file resolution. |

### 5. Known broken: `eslint .` at the repo root

`npx eslint .` exits **2** with:

```
Error while loading rule '@typescript-eslint/consistent-type-imports':
You have used a rule which requires type information, but don't have
parserOptions set to generate type information for this file.
```

Three independent causes, each from a path that no tsconfig owns:

1. **Nested build output.** Flat-config `ignores` resolve relative to the config
   file (the repo root), so the bare `".next"` entry only ever excluded
   `./.next` — not `apps/frontend/.next`, whose generated chunks were then
   linted. Same shape for `dist` and `coverage`.
2. **Root-level scratch directories** — `.tmp-qa/*.mjs`, `.tmp-pptx/capture.mjs`,
   and loose `_*.js` helpers.
3. **A typed rule applied to untyped files.** The rule block has no `files`
   restriction, so `@typescript-eslint/consistent-type-imports` (which needs
   type information) also runs on `.mjs` config files such as
   `apps/frontend/postcss.config.mjs` — where a typed rule cannot work at all.

**Fixing (1) and (2) is not enough to get a green run.** Measured with the
ignore globs supplied on the command line, so the config file stayed untouched:

```
eslint . --ignore-pattern "**/.next/**" --ignore-pattern "**/node_modules/**" \
         --ignore-pattern "**/dist/**" --ignore-pattern "**/coverage/**" \
         --ignore-pattern "**/.tmp-*/**" --ignore-pattern "**/*.js" \
         --ignore-pattern "**/*.mjs" --ignore-pattern "**/*.cjs"
→ 67 errors, 81 warnings (148 problems) across 22 files
```

Concentrated, not diffuse: `packages/types/src/index.ts` (20 — mostly
`no-invalid-void-type`), `packages/testing/src/index.ts` (12 unused vars),
generated `apps/frontend/next-env.d.ts` (1), a few `packages/ui` files, and
~10 throwaway `e2e/_*-verify.spec.ts` harnesses that are deliberately
uncommitted.

So the root config differs from the gate in two ways that compound: it lints a
wider tree, and it applies `tseslint.configs.strict` to packages that were
authored against the frontend's looser preset. A green root `eslint .` needs a
config edit **and** a separate repo-wide cleanup — a decision of its own, not a
side effect of fixing ignores.

The correct fix is glob ignores (`**/.next/**`, `**/dist/**`, …) plus a `files`
scope on the typed rules in `eslint.config.mjs`. That edit is blocked by the
`config-protection` hook, and the guard is right to exist — weakening lint
config to make a command pass is the failure mode it is defending against. So
the finding is recorded rather than worked around. **Use `npm run verify`,
`npm run lint:fast`, or `npm run lint -w apps/frontend`; do not use root
`npm run lint:strict` until the config is fixed by someone with the authority
to change it.**

---

## The e2e specs: how the sleep was taken out of them

`e2e/landing-polish.spec.ts` went from **68 s to 20–23 s** without dropping a
single assertion. Three changes, each one strictly *more* deterministic:

- **`waitUntil: "networkidle"` → a settlement loop.** Network silence cost
  ~1.5 s per navigation and, worse, hid a real bug. The page grows ~750 px as
  its lazy plates decode; the helper now waits for `document.fonts.ready`
  and then for `scrollHeight` to hold still for two frames. Images are
  deliberately *not* awaited — an off-screen lazy image never fires `load`, so
  waiting on it hangs until timeout.
- **Fixed sleeps → `expect.poll`.** The anchor test polls until the heading
  has settled below the sticky header instead of guessing how long Lenis
  eases. A miss still fails; it just fails when the scroll stalls rather than
  when a constant is too small.
- **Pointer-driving → a CSSOM contract walk.** Hovering a card was not
  reproducible: the page runs its own smooth scroller and the lazy plates keep
  growing the document, so every retry slid the card out from under the
  pointer. The test now walks `document.styleSheets` and asserts that the
  hover rule declares the lift and the elevation. Two subtleties it encodes:
  `CSSStyleRule.cssRules` is *always* truthy in modern Chrome (nested CSS), so
  a truthiness check silently skips every style rule; and `globals.css`
  deliberately ships a `.landing-card:hover` reset inside
  `@media (prefers-reduced-motion: reduce)`, so the assertion is existential
  (`some(...)`) rather than universal.

The parallax assertion is the strictest of the set and has no timing
dependency at all: `[data-ln-depth]` tweens `yPercent: 0 → -7`, and `yPercent`
is relative to the element's own height, so the resting headroom is compared
against `clientHeight * 0.07`. No scroll, no scrub to settle, no flake.

---

## Baselines, for the next measurement

Recorded so a future change can be compared against something.

| Measurement | Value |
|---|---|
| Full unit suite | 225 files, **3360 tests**, 96 s, green |
| Full e2e contract suite | 262 tests, 29 files |
| Full e2e, working files included | 564 tests, 75 files |
| `vitest` per-invocation startup | ~3.8 s (3.0 s in-process duration) |
| `tsc --noEmit` (warm) | 3.9 s direct, 5.7 s via `npx` |
| `next lint` | 27.7 s |
| `npm run verify` (warm) | 11.4 s |
| `check:assets` | 2.8 s |
| Landing e2e spec | 22.5 s, 8/8 |

The vitest duration breakdown (transform 56 s, setup 255 s, environment 248 s,
collect 89 s, tests 239 s) is the shape of the remaining cost: it is per-file
`jsdom` + MSW setup multiplied by 225, not slow tests. Disabling isolation
would remove it but breaks 554 tests, so the floor stands.

---

# Part 2 — the loop after the 2026-10-21 profile

Part 1 removed redundant *work* inside each command. Part 2 changes which
commands run and when. Every number below was taken on the same machine, in
the same session, with the same warm caches as Part 1.

The rule is unchanged: **a check you skip is not a check you passed.** The
new machinery is built so that it either widens the check or says out loud
that it narrowed it — never neither.

## What changed

| Piece | Before | After |
|---|---|---|
| `npm run verify` | `check:assets && typecheck && lint:fast`, sequential | three gates spawned together, plus a fourth self-check |
| Choosing tests for a change | the full suite, every time | `npm run affected` — a reverse-import query |
| Orientation for a cold start | re-derived by hand | `npm run repo-map` → `docs/CODEMAPS/REPO_MAP.md` |

These are three files. Nothing was added to `node_modules`; every one is
plain Node ESM using only `node:fs`, `node:path`, `node:crypto` and
`node:child_process`.

## 1. `verify` runs its gates concurrently — 2.1×

The gates answer unrelated questions and share no state. Their runtimes were
`assets 0.5 s + types 3.9 s + lint 2.6 s` (plus `harness 1.6 s`, added in
Part 2), and the `&&` chain made the wall clock their **sum**.

| Run | Wall | Sequential equivalent |
|---|---|---|
| `verify` (cold lint cache, three gates) | 9.4 s | 15.3 s |
| `verify` (warm, four gates) | 4.0–5.2 s, median **4.6 s** | 8.6 s |

On the run that produced the gate table (4.0 s wall, 8.6 s of gate time) the
ratio is **2.1×**; the median of three consecutive warm runs is 4.6 s. Same
four gates, same exit code. The runner prints a timing table every run, so a
gate that quietly gets slower is visible rather than absorbed.

`--only=types,lint`, `--quiet` and `--json` exist for when one gate is what
you need. `--json` reports `{ wallMs, gates: [{ name, ok, code, ms }] }`.

## 2. `affected` — the smallest test set, in 0.32 s

This is the piece that changes the shape of the loop. Vitest's own answers
were already measured and rejected in Part 1 (`--changed` 90.3 s,
`related` >180 s, both slower than the suite they replace). The reason both
lose is that they invoke TypeScript; this one scans import specifiers with
a regex and resolves them against the tsconfig aliases, then answers from a
cached reverse graph.

| | Time |
|---|---|
| cold (graph built) | 1.10 s |
| warm (cache hit) | **0.32 s** |

The graph covers 1,316 files and 227 test files. It is cached at
`node_modules/.cache/legalir/affected-graph.json`, keyed by a SHA-256 over
every `(path, size, mtime)` in the universe — so any add, remove, rename or
write invalidates it. A stale graph under-selects silently, so the key is
deliberately sensitive to mtime alone: a `touch` costs one rebuild, which is
cheap, and a missed rebuild is not.

### What it selects, measured

| Changed file | Test files selected | Selected-test wall |
|---|---|---|
| `src/lib/services/catalog.ts` | 2 / 227 | 9.6 s |
| `src/lib/calculators/engine.ts` | 26 / 227 | 21.1 s |
| `src/lib/lawyer-portal/sla.ts` | 83 / 227 | 35.4 s |
| `src/lib/persian-utils.ts` | 147 / 227 | 66.0 s |
| full suite, for comparison | 227 / 227 | **81.2 s** |

Four consecutive `--run` invocations on an otherwise idle machine, all green,
`vitest`'s own reported duration never more than 2 s under the wall clock.
The small selection is the headline: a leaf module costs **9.6 s instead of
81.2 s**, an 8.5× reduction, against 227 files and 3391 tests.

The two large selections are honest, not a leak. `persian-utils` and
`lawyer-portal/sla` are both reached through shared hubs — `sla.ts` is
imported by `lib/db.ts`, which most of the API surface imports. `--why`
proves it in one line:

```
$ node scripts/affected.mjs --files=src/lib/lawyer-portal/sla.ts \
    --why=src/lib/__tests__/authorization.test.ts

src/lib/__tests__/authorization.test.ts reaches a changed file in 3 hop(s):
  → apps/frontend/src/lib/__tests__/authorization.test.ts
  → apps/frontend/src/app/api/v1/cases/[id]/route.ts
  → apps/frontend/src/lib/db.ts
  → apps/frontend/src/lib/lawyer-portal/sla.ts
```

A selection you cannot explain is one you learn to distrust, so every
surprising count is one command away from its explanation.

### Tiers — where selection switches itself off

The graph sees static imports. What it cannot see, it must not guess.

- **T0** — only docs, asset binaries, design material, scratch. Nothing runs.
- **T1** — every changed file is a module with importers. The graph decides.
- **T2** — a graph-invisible but scoped change: a stylesheet, a page/layout
  entry, a public asset. Unit selection still applies where it can; e2e is
  chosen by matching the route.
- **T3** — a global change: `packages/*`, an API route, auth/db/store,
  middleware, any build or test config. Selection is off; both full suites
  run, and the report names the file that forced it.

CSS is the interesting case. A stylesheet has no unit-level assertion to
fail — vitest processes it, but nothing reads computed styles — so sending
it to the full suite bought 80 s of tests that could not observe the change.
`affected` reports `unit — none`, says why, and hands the change to the
contract suite, which is the gate that can see it.

The reverse case matters as much: a component that **no test imports** is
reported under `NO UNIT COVERAGE` rather than being quietly assigned zero
tests. It is not a skip; it is a named gap.

### The property that makes it safe

Each of these is asserted by `affected --selftest`, which now runs as a
fourth gate inside `verify` (1.6 s, concurrent, so free in wall time):

```
✓ stylesheet skips the unit suite
✓ stylesheet is gated by e2e
✓ covered module selects its own test
✓ covered module does not run the whole suite
✓ uncovered module is reported
✓ uncovered module still gets a gate
✓ API route runs the full unit suite
✓ a new file changes the cache key
```

A selector fails quietly — if it under-selects, the tests it dropped do not
report themselves and the run is green for the wrong reason. That is a
failure mode no other gate in this repo can catch, so the selector checks
itself.

Correctness was also confirmed end to end, not just by inspection: a
throwaway `proof.test.ts` importing `@/lib/persian-utils` with a
deliberately false assertion was created, `--files=src/lib/persian-utils.ts`
selected it, and it failed with the expected message. The fixture was
removed afterwards. (An earlier attempt to prove this by injecting a
regression into a real tracked file was refused — correctly, with concurrent
sessions editing the same tree — and the disposable fixture replaced it.)

## 3. `repo-map` — orientation with a real invalidation key

`docs/CODEMAPS/REPO_MAP.md` is generated in 0.44 s: area sizes, the full
route table (derived from the App Router's own filename convention), the
gates, and the invariants a change can silently violate.

Its first line is a fingerprint — SHA-256 over every source file's
`(path, size, mtime)`. `--check` exits 1 when the map is stale. There is no
"last updated" date to interpret, and no judgement call about whether a doc
feels current.

It is a summary, not an index: listing 1,250 files costs more to read than
to regenerate.

## 4. Measured and deliberately not adopted

| Candidate | Result | Verdict |
|---|---|---|
| `vitest --minWorkers=1 --maxWorkers=6` | 102 s vs 96 s default | Default parallelism is already optimal on 12 logical CPUs; the suite is per-file `jsdom` setup, which more workers cannot divide further. |
| `playwright.live.config.ts` for the whole contract suite | >10 min, killed | Its `workers: 1` is deliberate (specs share server state), which makes it the wrong config for a full run — and why the *selected* e2e command is the only place it is used. |
| Selecting e2e by filename alone | 10 specs for one `/dashboard` change | Filenames repeat (`admin`, `mobile`). Route literals are the reliable signal; the filename is only consulted for a distinctive segment of 5+ characters. |

## 5. Rollback

Every piece is additive and independent. Nothing was deleted.

| To undo | Do this |
|---|---|
| the parallel `verify` | `"verify": "npm run check:assets && npm run typecheck && npm run lint:fast"` in `apps/frontend/package.json` |
| the selector | delete `scripts/affected.mjs` and the `affected*` scripts |
| the repo map | delete `scripts/repo-map.mjs` and `docs/CODEMAPS/` |
| all of it | `git revert <this commit>` — no `node_modules` change, no lockfile change, no config edit |

`npm test`, `npm run test:e2e`, `npm run typecheck` and `npm run lint` are
untouched. Anything that worked before still works the same way.

## 6. The loop, restated

```
Understand  →  read docs/CODEMAPS/REPO_MAP.md (or `npm run repo-map --check`)
Plan        →  brief
Execute     →  edit
Validate    →  npm run verify            (4.6 s, four gates)
               npm run affected --run    (0.3 s + the selected tests)
Deliver     →  npm run verify && npm test && npm run test:e2e
```

Time from "file saved" to "I know whether this is sound" for a leaf-module
change: **~10 s** (`affected` 0.3 s, then 2 test files in 9.6 s; `verify` runs
alongside or before it in 4.6 s), against **~90 s** before (8.1 s chain +
81.2 s suite). For a module near the `db.ts` hub the selected run grows to
35–66 s — an honest reflection of how much of the suite can observe the
change, still under the full 81.2 s, and the report says so before you run it.

Full regression before delivering is unchanged and still mandatory. The
selector is an iteration tool, never a delivery gate.

---

## Where the landing's own numbers live

`docs/LANDING_MOBILE.md` is the companion to this document for the public
landing: the mobile bento grammar per section, the 320/360/390/430 sweep with
CLS/LCP/image bytes, and a rollback table for each piece. Its measurements come
from `e2e/_mobile-measure.spec.ts`, which prints the tables rather than
asserting them — the *assertions* (`no horizontal overflow`, `no non-hero image
> 0.5 screens`) are the four added to `landing-polish.spec.ts`, which is why
they cost 1.2–1.8 s per width and belong in the contract suite rather than a
scratch file.
