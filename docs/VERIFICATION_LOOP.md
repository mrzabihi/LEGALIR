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

Two independent causes, both from paths that no tsconfig owns:

1. `apps/frontend/.next/build/chunks/[root-of-the-server]__*.js` — flat-config
   `ignores` are resolved relative to the config file (the repo root), so the
   bare `".next"` entry only ever excluded `./.next`, not the workspace's.
2. root-level scratch directories such as `.tmp-qa/*.mjs`.

The correct fix is glob ignores (`**/.next/**`, `**/dist/**`, …) in
`eslint.config.mjs`. That edit is blocked by the `config-protection` hook, and
the guard is right to exist — weakening lint config to make a command pass is
the failure mode it is defending against. So the finding is recorded rather
than worked around. **Use `npm run verify`, `npm run lint:fast`, or
`npm run lint -w apps/frontend`; do not use root `npm run lint:strict` until
the config is fixed by someone with the authority to change it.**

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
