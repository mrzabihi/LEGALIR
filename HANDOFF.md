# LEGALIR — Handoff to CI/CD & DevOps

> **Release:** `v0.7.0` · **Branch:** `chore/post-merge-baseline`
> **Prepared:** 2026-10-20
>
> This document is everything the CI/CD or DevOps team needs to build and run
> this release. Every fact below was verified against the working tree on the
> date above — the previous revision of this file described v0.6.0 and had
> drifted (it claimed there was no Dockerfile and no CI, both of which exist).

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
| Working branch | `chore/post-merge-baseline` |
| Base branch | `main` |
| Push status | ✅ pushed and in sync with `origin` |

> `main` currently sits at the merge of PR #8. Everything shipped since then
> lives on `chore/post-merge-baseline` and is opened as a pull request against
> `main` (see §11). **Pin deployments to the annotated tag, not to either
> branch** — branches move, tags do not.

**Clone the branch:**
```bash
git clone -b chore/post-merge-baseline https://github.com/mrzabihi/LEGALIR.git
```

## 3. Version & Commit

| Item | Value |
|------|-------|
| Release tag | `v0.7.0` (annotated) — cut from the release commit |
| Package version | `0.7.0` (both root `legalir` and `apps/frontend` `@legalir/frontend`) |
| Previous release | `v0.6.0` (2026-09-27) |

The version is not cosmetic: `GET /api/health` reports `package.json`'s
`version`, so the deployed container's release is readable without shell
access.

> **Recommended for deploy:** pin to the tag.
> ```bash
> git clone --branch v0.7.0 --depth 1 https://github.com/mrzabihi/LEGALIR.git
> ```

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

`.env.example` at the repo root documents every variable. **No variable is
required to run this release** — the default mode is `mock` (no external
services, no API keys).

Key values:
```env
NEXT_PUBLIC_API_MODE=mock          # mock | hybrid | real-dev | staging
NEXT_PUBLIC_OTP_DEV_MODE=true      # demo OTP is 405405
NEXT_PUBLIC_SITE_URL=...           # canonical origin for metadata/canonical URLs
SESSION_SECRET=<32+ chars>         # production only
LEGALIR_DEV_ADMIN_MOBILE=+989120000000   # dev-only admin seed
LEGALIR_DEV_ADMIN_PASSWORD=...           # optional; enables the password tab
```

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
| `npm run lint` | ✅ 0 errors (warnings only) |
| Unit + integration tests (Vitest) | ✅ **218 files / 3208 tests passed** |
| `npm run build` | not run locally (dev server was live) — CI `build` job covers it |

## 9. What's in this release

- **Lawyer workbench** — referral queue with server-side filtering, search,
  sorting and pagination; SLA engine (breached / at-risk / met) driven by a
  work calendar with holidays; derived referral **priority**
  (BREACHED→URGENT, AT_RISK→HIGH, open→NORMAL, waiting/done→LOW) computed on
  every read, never persisted.
- **Admin contract lifecycle** — «مراحل و گردش کار قرارداد» derived
  server-side from the contract's own records; one current stage; per-stage
  detail dialog; stamp eligibility with an ordered, server-authored blocker
  list so no disabled action is ever unexplained; current-version PDF built
  from the frozen version.
- **Contract signing & verification** — version-bound, hash-verified
  signatures; public verification endpoint that attests only FINAL documents
  and exposes no personal data.
- **Judicial declarations** — one declaration identity on every discovery
  surface; final petition artifact issuance.
- **Landing refresh** — reworked topic grid and a unified CTA card family,
  scoped to the `.landing` wrapper so no app surface moves.
- **Operations** — `GET|HEAD /api/health` liveness probe (version + uptime,
  `Cache-Control: no-store`); container healthcheck moved off `/`; atomic
  JSON writes and corrupt-table quarantine.
- **Shared UI fixes** — `Dialog` is portalled to `<body>`, so a dialog opened
  inside a transformed drawer is anchored to the viewport instead of the
  drawer's scrolled content.

## 10. One-line summary

```
Repo:   https://github.com/mrzabihi/LEGALIR.git
Branch: chore/post-merge-baseline   (opened as a PR into main)
Tag:    v0.7.0
Node:   >=20   |   Port: 3000   |   npm workspaces monorepo
Run:    npm install && npm run build && npm run start
Deploy: docker compose -f docker-compose.prod.yml up -d --build
Health: GET /api/health  → 200 {status, version, uptimeSeconds}
Data:   JSON store in .data/ (needs the legalir-data volume; no DB required)
```

## 11. Open a Pull Request to `main`

```
https://github.com/mrzabihi/LEGALIR/compare/main...chore/post-merge-baseline?expand=1
```
