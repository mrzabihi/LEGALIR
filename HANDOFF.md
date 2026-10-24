# LEGALIR — Handoff to CI/CD & DevOps

> **Version:** `1.8.20261024` · **Branch:** `pr/10-release-v1.8.20261024`
> **Prepared:** 2026-10-24 · **Base:** `main` at `c7935ba`
>
> This document is everything the CI/CD or DevOps team needs to build and run
> this release. Every fact below was verified against the working tree on the
> date above — the previous revision of this file described v0.7.0 and had
> drifted (wrong branch, wrong version, and it predated the public library).

---

## 1. Repository

| Item | Value |
|------|-------|
| Remote URL | `https://github.com/mrzabihi/LEGALIR.git` |
| Owner / Repo | `mrzabihi/LEGALIR` |
| Platform | GitHub |
| Default branch | `main` |

## 2. Branch

| Item | Value |
|------|-------|
| Working branch | `pr/10-release-v1.8.20261024` |
| Base branch | `main` |
| Base commit | `c7935ba` (= `origin/main` when the branch was cut) |
| Push status | pushed; opened as a single PR into `main` (see §11) |

> `main` currently sits at the merge of PR #9. Everything shipped since `v0.8.0`
> lives on this branch and is opened as one pull request against `main`.
> **Pin deployments to a commit SHA or a tag, not to a branch** — branches move.
> No tag has been cut for `1.8.20261024`; cutting one is a separate, explicitly
> authorised step.

**Clone the branch:**
```bash
git clone -b pr/10-release-v1.8.20261024 https://github.com/mrzabihi/LEGALIR.git
```

## 3. Version & Commit

| Item | Value |
|------|-------|
| Version | `1.8.20261024` (`1.8` = product generation, suffix = release-preparation date) |
| Package version | `1.8.20261024` (both root `legalir` and `apps/frontend` `@legalir/frontend`) |
| Previous release | `v0.8.0` (2026-10-21, `031bfd1`) |
| Commits in this release | 11 since `v0.8.0` |

The version is not cosmetic: `GET /api/health` reports `package.json`'s
`version`, so the deployed container's release is readable without shell
access. The `packages/*` workspaces remain at `0.4.0` by design — they are
internal libraries and nothing about their contract changed.

> **Recommended for deploy:** pin to the release commit SHA once this PR is
> merged, or to an annotated tag cut from it.

## 4. Runtime Requirements

| Item | Value |
|------|-------|
| Node.js | `>=20.0.0` (declared in `engines`) |
| Package manager | npm (workspaces: `apps/*`, `packages/*`) |
| Service port | `3000` |
| Image base | `node:20-slim` (Next.js standalone output) |

**Local development:**
```bash
npm install          # from the repo root (npm workspaces)
npm run dev          # Turbopack dev server on port 3000
```

**Production build & start (without Docker):**
```bash
npm run build
npm run start
```

> ⚠️ Do **not** run `npm run build` while a dev server is running against the
> same checkout — both write to the shared `.next/` directory and the build
> will clobber the live dev server. CI builds in a clean checkout, so this
> restriction does not apply there.

## 5. Environment Variables

`.env.example` at the repo root documents every variable. The default mode is
`mock` (no external services, no API keys), so the app boots without secrets —
**but `NEXT_PUBLIC_SITE_URL` is now required for this release to be correct.**

Key values:
```env
NEXT_PUBLIC_API_MODE=mock          # mock | hybrid | real-dev | staging
NEXT_PUBLIC_OTP_DEV_MODE=true      # demo OTP is 405405
NEXT_PUBLIC_SITE_URL=https://...   # REQUIRED — see the warning below
SESSION_SECRET=<32+ chars>         # production only
LEGALIR_DEV_ADMIN_MOBILE=+989120000000   # dev-only admin seed
LEGALIR_DEV_ADMIN_PASSWORD=...           # optional; enables the password tab
```

> ⚠️ **`NEXT_PUBLIC_SITE_URL` is not set in `docker-compose.prod.yml`.** This
> release publishes `sitemap.xml`, `robots.txt` and a self-canonical URL on
> every public page, all built from `src/lib/site.ts`. With the variable unset
> they fall back to `http://localhost:3000` — verified live against the dev
> server. Set it to the real public origin (e.g. `https://legalir.ir`) in the
> deployment environment or compose file before starting the container,
> otherwise the release ships canonical URLs pointing at localhost.

Server-only (optional, only for real AI / OTP):
```env
LEGALIR_AI_PROVIDER=mock           # mock | openai-compatible
LEGALIR_AI_API_KEY=
OTP_PROVIDER_API_KEY=
```

The dev-only staff seed (`instrumentation.ts` → `lib/admin/staff-seed.ts`) is
idempotent and **never runs outside development**. It does not overwrite an
existing operator.

## 6. Data Storage

⚠️ **Important for DevOps:**

- This release uses a **JSON file store** — data lives in `.data/` at the
  process working directory. It is created and seeded automatically on first
  run.
- **No PostgreSQL / Redis / MinIO is required.** The old `docker-compose.yml`
  describes Phase 0 future infrastructure and is **not** used by the app.
- `.data/` is git-ignored. On a server it **must** be backed by a persistent
  volume (`legalir-data` in `docker-compose.prod.yml`), otherwise all data is
  lost on every restart/redeploy.
- Writes are **atomic**: each table is written to a sibling temp file and
  renamed into place, so a crash mid-write cannot truncate a table.
- A table whose bytes fail to parse is **quarantined** as
  `<name>.corrupt-<timestamp>.json` (at most three copies per process) and
  logged, instead of being silently read as empty and overwritten by the next
  write.

**Backup:** copy the whole `.data/` directory while the container is stopped,
or snapshot the `legalir-data` volume.

## 7. CI/CD Status

| Item | Status |
|------|--------|
| GitHub Actions | ✅ `.github/workflows/ci.yml` |
| Dockerfile | ✅ repo root — Next.js standalone, multi-stage |
| Production compose | ✅ `docker-compose.prod.yml` |
| Deployment | **manual** — a human runs `docker compose -f docker-compose.prod.yml up -d --build`; no CI job publishes |

**CI jobs** (`.github/workflows/ci.yml`):

| Job | Runs |
|-----|------|
| `quality` | `npm run check:assets` → `npm run typecheck` → `npm run lint` |
| `test` | `npm test` (Vitest) |
| `build` | `npm run build` with `NEXT_PUBLIC_SITE_URL` set |
| `e2e` | manual dispatch only — `e2e/smoke.spec.ts` + `e2e/not-found.spec.ts` |

CI triggers on pushes to `main` and `pr/**`, and on pull requests into
`main`. **A push to a differently named branch does not trigger it** — that is
why the release branch is opened as a PR.

## 8. Quality Verification (this release)

| Check | Result |
|-------|--------|
| `npm run check:assets` | ✅ OK |
| `npm run typecheck` (`tsc --noEmit`) | ✅ clean |
| `npm run lint` | ✅ 0 errors, 38 warnings |
| Unit + integration tests (Vitest) | ✅ **229 files / 3419 tests passed** |
| `npm run verify` (types + lint + harness + assets) | ✅ all four gates pass, 7.4 s wall |
| `repo-map --check` | ✅ fresh |
| `npm run build` | not run locally (dev server holds the shared `.next`) — CI `build` job is the authority |
| E2E | run serially via `playwright.live.config.ts`; parallel "failures" were flakes and pass serially |

## 9. What's in this release

Full detail and reasoning is in `CHANGELOG.md`. In deployment terms:

- **The legal library is now public and crawlable.** `/legal-library` and
  `/legal-library/[slug]` moved from the `(app)` group to `(public)`:
  server-rendered HTML for crawlers, indexable, self-canonical, present in
  `sitemap.xml`, and no longer disallowed by `robots.txt`. An unknown slug is
  `noindex` with no canonical. Interactive parts (bookmark, copy citation,
  share) are one client island.
- **Every page has a real social share card** — a 1.91:1 Open Graph image with
  brand alt text, pinned by a test that checks the PNG's actual pixels.
- **Lawyer portraits are served at tile size.** `/lawyers` dropped from
  6.50 MB to 1.46 MB of portraits warm; the route boundary from 13.5 MB to
  3.2 MB. Requires `images.localPatterns` in `next.config.ts` (already added).
- **Three measured layout shifts fixed.** Dashboard CLS 0.4595 → 0.0156 at
  1440px (holding across nine widths); judicial launcher 0.4079 → 0.0358 at
  390px. The source-detail action row, which rendered at three different
  heights (44 / 48 / 62px), is now one contract: 40px desktop, 44px below it.
- **Two server/client boundary bugs fixed** with no visible surface: a page-level
  `notFound()` on a streaming page could not set a 404 status, and a constant
  exported from a `"use client"` module arrived as a proxy in Server Components
  (`Math.max(1, proxy)` → `NaN` → an empty list).
- **New regression gates**: `speed-and-sync` (11 tests, both origins),
  `seo-indexability` (5), `library-source-actions` (4). CI will run them only
  if dispatched — this release's gate evidence is `/tmp`-style local runs, not
  CI output.

Not in this release: no dependency changes, no schema changes, no data
migration, no new external service.

## 10. One-line summary

```
Repo:   https://github.com/mrzabihi/LEGALIR.git
Branch: pr/10-release-v1.8.20261024   (one PR into main)
Tag:    none yet for 1.8.20261024
Node:   >=20   |   Port: 3000   |   npm workspaces monorepo
Run:    npm install && npm run build && npm run start
Deploy: docker compose -f docker-compose.prod.yml up -d --build
Env:    NEXT_PUBLIC_SITE_URL must be set, or canonicals point at localhost
Health: GET /api/health  → 200 {status, version:"1.8.20261024", uptimeSeconds}
Data:   JSON store in .data/ (needs the legalir-data volume; no DB required)
```

## 11. Open a Pull Request to `main`

```
https://github.com/mrzabihi/LEGALIR/compare/main...pr/10-release-v1.8.20261024?expand=1
```
