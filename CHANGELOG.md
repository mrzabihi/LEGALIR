# Changelog

All notable changes to LEGALIR are recorded here.

## Version convention

`1.8.YYYYMMDD` — the `1.8` line is the product generation; the suffix is the
**release-preparation date**, not a build counter. Two releases prepared on the
same day share a version, so the version names *which preparation* a deployment
came from, not how many times the image was rebuilt.

The version lives in exactly two manifests and nowhere else:

| File | Field |
|------|-------|
| `package.json` (root, `legalir`) | `version` |
| `apps/frontend/package.json` (`@legalir/frontend`) | `version` |

`apps/frontend/src/app/api/health/route.ts` reads that field at request time, so
`GET /api/health` reports the deployed release without shell access. The
`packages/*` workspaces stay at their own independent `0.4.0` — they are
internal libraries, not products, and bumping them would imply a published
contract change that has not happened.

---

## 1.8.20261024 — 2026-10-24

Created from `main` at `c7935ba`. Covers all 11 commits since `v0.8.0`
(`031bfd1`, 2026-10-21).

This release is a **public-surface release**: the legal library became a
crawlable part of the site, every page gained a real social share card, and
three measured layout defects that had been shipping unnoticed were fixed.

### Added

- **Public legal library.** `/legal-library` and `/legal-library/[slug]` moved
  out of the `(app)` route group into `(public)`. The listing and every source
  detail page now render complete HTML for crawlers, are indexable, carry a
  self-canonical URL, and appear in `sitemap.xml`. `robots.txt` no longer
  disallows the section. An unknown slug returns `noindex` with no canonical
  rather than advertising a page that does not exist. The detail page stays a
  Server Component; bookmark / copy-citation / share live in one client island
  (`source-actions.tsx`), the same split the blog article page uses.
- **Social share card.** One Open Graph card at a 1.91:1 size, tagged on public
  pages with properly branded alt text. Pinned by `src/lib/__tests__/social-card.test.ts`
  (3 tests, including a pixel check that the declared dimensions match the real
  PNG).
- **Cross-host and speed gate.** `e2e/speed-and-sync.spec.ts` (13 tests) adds
  per-route performance budgets on **both** origins plus an assertion that the
  public and admin surfaces return identical payloads for the same entity.
- **Indexability gate.** `e2e/seo-indexability.spec.ts` (5 tests) pins the
  public/private split: public routes indexable and canonical, private routes
  `noindex`, and the sitemap containing only what it should.
- **Action-row regression gate.** `e2e/library-source-actions.spec.ts` (4 tests,
  320 / 390 / 768 / 1440) asserts that every child of the source-detail action
  row shares one height and that no action is clipped.

### Changed

- **Lawyer portraits are served at tile size.** `/lawyers` dropped from
  **6.50 MB to 1.46 MB** of portraits on a warm load, and the route boundary
  from 13.5 MB to 3.2 MB. `next.config.ts` gained `images.localPatterns` so the
  built-in optimizer will resize bundled assets instead of `<img>` shipping the
  full upload resolution.
- **Search landmark.** The shared search field's wrapper is now a labelled
  `search` landmark, so it is reachable by its role rather than by CSS class.
- **`robots.txt` and `sitemap.xml` now describe the real public surface** —
  previously the library was invisible to both.
- **Four E2E specs re-anchored** to the shared components they exercise. They
  were asserting against markup the components no longer emit, so they were
  passing on stale selectors rather than on behaviour.

### Fixed

- **Dashboard layout shift.** The stat row reserved no height, so the page moved
  when it resolved. Cumulative Layout Shift on the dashboard dropped from
  **0.4595 to 0.0156** at 1440px, and the fix holds across nine measured widths.
- **Judicial launcher layout shift.** The launcher stood outside the page's flow
  until it resolved. CLS fell from **0.4079 / 0.4082 to 0.0358** at 390px, from
  0.1516 to 0.0369 at 1024px, and from 0.1147 to 0.0232 at 1440px.
- **Source-detail action row had three heights.** Measured on a 390px viewport:
  the buttons stood 44px, the source link 48px (`.touch-target`'s floor), and
  the "link not recorded" status chip **62px** because its sentence wrapped to
  two lines beside three icon-only buttons. The row is `items-center`, so it
  read as a mis-alignment rather than as hierarchy. All four peers now share one
  box contract: 40px above the desktop breakpoint, 44px below it — the `Button`
  primitive's `h-10` plus `max-desktop:min-h-11`. The link branch reaches that
  contract through the exported `buttonClasses()` instead of hand-rolling a
  lookalike.
- **Flaky E2E assertions.** Specs that failed only under parallel workers were
  made order-independent; they now pass serially and in parallel.
- **Rate-change history could be read backwards.** `listLawyerRateChanges`
  sorted only by `createdAt`. Two price changes written inside the same
  millisecond share that value, and a stable sort then leaves the pair in table
  order — oldest first, the exact opposite of the newest-first contract the list
  is read under (the admin slices the first 30 as "the 30 most recent"). The
  visible effect was a history that sometimes showed the first change as the
  latest, and a `slice` that could drop the newest row instead of the oldest.
  Found because it failed CI twice on 2026-10-24 on two different commits; now
  pinned by a test that freezes the clock so the collision is guaranteed rather
  than occasional.

### Notable fixes with no user-visible surface

Recorded because they cost real debugging time and are easy to reintroduce:

- **A page-level `notFound()` could not produce a 404** on any page that awaits
  `cookies()`. Such a page streams, and Next flushes `<head>` once metadata
  resolves, so the status was already on the wire — an invalid URL answered
  HTTP 200 with a "not found" body. The library detail page now calls
  `notFound()` from `generateMetadata`, where the status can still be set.
- **A value exported from a `"use client"` module and imported by a Server
  Component arrives as a client-reference proxy.** `Math.max(1, proxy)` is
  `NaN`, and `slice(0, NaN)` is `[]` — a page that looked correct in the editor
  rendered an empty list. Constants shared across the boundary must live in a
  server-safe module.

### Documentation

- **`CHANGELOG.md`** (this file) — new; the repo previously had no changelog.
- **`HANDOFF.md`** — rewritten against this release; the previous revision
  described `v0.7.0` on `chore/post-merge-baseline` and predated the public
  library.
- **`PUBLISH-PROMPT.md`** — new; a runbook written as a pasteable prompt for the
  session that takes this version live, including the origin question in
  "Deployment requirements" below, which it refuses to guess.

### Deployment requirements

- **`NEXT_PUBLIC_SITE_URL` must be set before the image is built.**
  `docker-compose.prod.yml` does **not** set it and `Dockerfile` declares no
  build arg for it. Without it the app falls back to `http://localhost:3000`
  (`src/lib/site.ts`) and will publish `sitemap.xml`, `robots.txt` and every
  canonical URL pointing at localhost — which defeats the purpose of this
  release. Confirmed live against the dev server.

  Which path carries it is not settled by reading the code: `lib/site.ts` reads
  the value with bracket notation (`process.env["…"]`), which Next does not
  statically replace, and every importer of that module is server-only — but a
  `NEXT_PUBLIC_` variable may still be inlined at build time. Set it in **both**
  places to the same literal and let the deployed `sitemap.xml` prove which one
  is live. `PUBLISH-PROMPT.md` STEP 2 has the exact edits.

  The origin itself is unconfirmed: `docker-compose.prod.yml` names
  `api.simotech.ai`, `.env.example` names `legalir.ir` as an example. A wrong
  origin renders perfectly and is wrong only in search results.
- **No database migration.** The app uses the JSON file store in `.data/`; no
  schema in this release changed shape and no table needs rewriting. The
  `legalir-data` volume requirement is unchanged.
- **No new dependencies.** `package.json` dependency blocks are untouched by
  this release; `package-lock.json` changed in three version lines only (the
  version bump itself).
- **Node.js `>=20`**, port `3000`, one container. Unchanged.
- Manual deploy, as before: a human runs
  `docker compose -f docker-compose.prod.yml up -d --build`. No CI job publishes.

### Known issues

- **`eslint .` from the repo root still fails** (exit 2), for three separate
  reasons: it walks `apps/frontend/.next/build`, it picks up root scratch
  directories, and the typed rules meet untyped `.mjs`. Behind those config
  problems sits real residue — 67 errors across 22 files. CI is green because it
  runs `npm run lint`, which lints `src` only. Fixing this is a repo-wide
  cleanup and its own decision; it is documented in
  `docs/VERIFICATION_LOOP.md` §5 rather than patched locally.
- **One seeded source has `body: null`**, so its detail page shows the summary
  and metadata with no body text. It is real fixture data, not a rendering bug.

### Verification for this release

| Check | Result |
|-------|--------|
| `npm run verify` (types, lint, harness, assets) | ✅ 4/4 gates, 7.4 s |
| Vitest, locally | ✅ 229 files / 3420 tests |
| `repo-map --check` | ✅ fresh |
| `e2e/library-source-actions.spec.ts` | ✅ 4/4 (320 / 390 / 768 / 1440) |
| `e2e/seo-indexability.spec.ts` | ✅ 5/5 |
| `e2e/speed-and-sync.spec.ts` | ✅ 13/13 (both origins) |
| CI on the release PR | ✅ typecheck/lint/assets · ✅ unit+integration · ✅ production build |

`next build` was not run locally because a dev server holds the shared `.next`
directory; the CI `build` job is the authority and it passed. CI's `e2e` job is
manual-dispatch only, so the e2e rows above are local runs against a live dev
server, not CI output.

---

## Previous releases

Tags are annotated and dated by their tag date. `v1.0.0` (2026-08-18) was cut
outside the `0.x` sequence and does not supersede it; the `0.x` line continued
past it.

| Tag | Date | Subject |
|-----|------|---------|
| `v0.8.0` | 2026-10-21 | shared overlay layer stack |
| `v0.7.0` | 2026-10-20 | lawyer workbench, admin contract lifecycle, signing & verification, judicial declarations, ops hardening |
| `v0.6.0` | 2026-09-27 | human-lawyer consultation case room, services discovery redesign, bottom-nav selected state, CI/CD handoff |
| `v0.5.0` | 2026-09-20 | property-contract builder, document preview, notifications, calculators & subscription |
| `v0.3.0` | 2026-08-17 | favicon, profile completion, rewards & loyalty |
| `v0.1.0` | 2026-08-15 | legal library & blog, UX stabilization |
