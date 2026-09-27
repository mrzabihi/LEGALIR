# LEGALIR — Handoff to CI/CD & DevOps

> **Release:** `v0.6.0` · **Branch:** `feature/legalir-v0.3-rewards-profile`
> **Commit:** `7a101007b83d73970b8244e519dfbb18f8fc7210` (`7a10100`)
> **Prepared:** 2026-09-27

This document is everything the CI/CD or DevOps team needs to build and run
this release. It is self-contained — no prior context required.

---

## 1. Repository

| Item | Value |
|------|-------|
| Remote URL | `https://github.com/mrzabihi/LEGALIR.git` |
| Owner / Repo | `mrzabihi/LEGALIR` |
| Platform | GitHub |

## 2. Branch

| Item | Value |
|------|-------|
| Branch name | `feature/legalir-v0.3-rewards-profile` |
| Base branch | `main` |
| Push status | ✅ pushed and in sync with `origin` |

**Clone the branch:**
```bash
git clone -b feature/legalir-v0.3-rewards-profile https://github.com/mrzabihi/LEGALIR.git
```

**Browse in browser:**
```
https://github.com/mrzabihi/LEGALIR/tree/feature/legalir-v0.3-rewards-profile
```

## 3. Version & Commit

| Item | Value |
|------|-------|
| Release tag | `v0.6.0` (annotated) |
| Commit SHA (full) | `7a101007b83d73970b8244e519dfbb18f8fc7210` |
| Commit SHA (short) | `7a10100` |
| Package version | `0.6.0` (both root and `apps/frontend`) |

> **Recommended for deploy:** pin to the **tag `v0.6.0`**, not the branch —
> the branch may move, the tag is immutable.
> ```bash
> git clone --branch v0.6.0 --depth 1 https://github.com/mrzabihi/LEGALIR.git
> ```

## 4. Runtime Requirements

| Item | Value |
|------|-------|
| Node.js | `>=20.0.0` (declared in `engines`) |
| Package manager | npm (workspaces) |
| Service port | `3000` |
| Architecture | monorepo — `apps/*` and `packages/*` |

**Install & run:**
```bash
npm install          # from the repo root (npm workspaces)
npm run dev          # dev server on port 3000
```

**Production build & start:**
```bash
npm run build
npm run start
```

> ⚠️ Do **not** run `npm run build` while a dev server is running against the
> same checkout — both write to the shared `.next/` directory and the build
> will clobber the live dev server.

## 5. Environment Variables

`.env.example` at the repo root documents every variable. **No variable is
required to run this release** — the default mode is `mock` (no external
services, no API keys).

Key values:
```env
NEXT_PUBLIC_API_MODE=mock          # mock | hybrid | real-dev | staging
NEXT_PUBLIC_OTP_DEV_MODE=true      # demo OTP is 405405
SESSION_SECRET=<32+ chars>         # production only
```

Server-only (optional, only for real AI / OTP):
```env
LEGALIR_AI_PROVIDER=mock           # mock | openai-compatible
LEGALIR_AI_API_KEY=
OTP_PROVIDER_API_KEY=
```

## 6. Data Storage

⚠️ **Important for DevOps:**

- This release uses a **JSON file store** — data lives in `.data/` at the
  process working directory. It is created and seeded automatically on first
  run.
- **No PostgreSQL / Redis / MinIO is required** for this release.
- The `docker-compose.yml` in the repo describes **Phase 0 future
  infrastructure** (pgvector + Redis + MinIO). It is **not used by the app
  today** — do not wire it up expecting the app to connect.
- `.data/` is git-ignored. On a server it **must be backed by a persistent
  volume**, otherwise all data is lost on every restart/redeploy.

## 7. CI/CD Status

| Item | Status |
|------|--------|
| GitHub Actions workflows | ❌ not configured (`.github/workflows/` does not exist) |
| Dockerfile | ❌ does not exist |
| docker-compose.yml | ✅ present (Phase 0 infra only — unused by the app) |

**Suggested pipeline steps:**
```bash
npm ci
npm run typecheck    # tsc --noEmit
npm run test         # vitest — 1210 tests
npm run build        # next build
```

## 8. Quality Verification (this release)

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ clean |
| Unit tests (vitest) | ✅ 1210 / 1210 (77 files) |
| E2E — `bottom-nav-selected-state` | ✅ 9 / 9 |
| E2E — `services-discovery` | ✅ 16 / 16 |
| `npm run build` | ⚠️ not run in this session (dev server was live) — run it in CI |

## 9. What's in this release

- **Human-lawyer consultation case room (PART 25)** — a consultation is a
  `LegalRequest`, never an AI conversation. Client picks a verified lawyer →
  `WAITING_FOR_ACCEPTANCE` → lawyer accepts/declines → private case-scoped
  message thread + attachment stream. Server enforces the client/lawyer split
  (client-facing transitions reject lawyer-only moves with 403).
- **`/services` discovery redesign** — full-width NDA feature banner with
  balanced secondary cards; six featured cards unified into one family.
- **Bottom-nav selected-state fix** — active capsule centred on the icon;
  shared `isNavItemActive` helper.
- **Supporting** — PWA shortcut for `/consultations/new`, mobile header drawer
  focus-trap, `/requests/[id]` → `/consultations/[id]` redirect, Persian search
  normalization, login-able demo lawyer (`09120000010`).

## 10. One-line summary

```
Repo:   https://github.com/mrzabihi/LEGALIR.git
Branch: feature/legalir-v0.3-rewards-profile
Tag:    v0.6.0  (commit 7a10100)
Node:   >=20   |   Port: 3000   |   npm workspaces monorepo
Run:    npm install && npm run build && npm run start
Data:   JSON store in .data/ (needs persistent volume; no DB required)
```

## 11. Open a Pull Request to `main`

```
https://github.com/mrzabihi/LEGALIR/compare/main...feature/legalir-v0.3-rewards-profile?expand=1
```
