# LEGALIER — Test Plan

Two layers: **unit** (Vitest, `src/**/__tests__/*.test.ts`) and **E2E**
(Playwright, `e2e/*.spec.ts`). Run with `npm test` and `npm run test:e2e`
from `apps/frontend`.

> **Never run `next build` while the dev server is running** — it clobbers
> the shared `.next` directory. Verify with `tsc --noEmit` + Playwright.

---

## 1. Unit — domain invariants

### State machine (PART 7) — highest priority

| # | Case | Expected |
|---|---|---|
| 1 | `canTransitionLegalRequest("DRAFT","AI_INTAKE")` | `true` |
| 2 | `canTransitionLegalRequest("DRAFT","ACCEPTED")` | `false` |
| 3 | `canTransitionLegalRequest("CLOSED", any)` | `false` |
| 4 | Every state in `LEGAL_REQUEST_TRANSITIONS` is a valid `LegalRequestState` | no unknown keys |
| 5 | `CANCELLED` reachable from every active state | `true` |
| 6 | `transitionRequest` on an illegal move | `{ ok:false, reason:"illegal_transition" }`, **no event written** |
| 7 | `transitionRequest` on a legal move | `{ ok:true }`, exactly one event appended, actor = caller |

### Matching engine (PART 4)

| # | Case | Expected |
|---|---|---|
| 8 | Non-VERIFIED candidate | excluded, reason present |
| 9 | Candidate over `maxFee` | excluded |
| 10 | Category mismatch | excluded |
| 11 | `matchLawyers` result length | `<= DEFAULT_MATCH_LIMIT` (3) |
| 12 | Scores | within 0–100, sorted descending |
| 13 | Engine output | **never** a single auto-selected lawyer |

### Intake schemas (PART 5)

| # | Case | Expected |
|---|---|---|
| 14 | `buildIntakeSchema("family")` | 9 steps, `version === 1` |
| 15 | Unknown category | `isSupportedCategory` false; API 404 |
| 16 | Category extra fields | injected into the subject step only |

### Grounding / no-citation rule (PART 12)

| # | Case | Expected |
|---|---|---|
| 17 | Query with no matching source | `sources === []`, `contextBlock === ""` |
| 18 | Query with a match | source carries a real locator; no invented article number |

### Account model (PART 1)

| # | Case | Expected |
|---|---|---|
| 19 | `normalizeAccountType("individual")` | `"PERSONAL"` |
| 20 | `normalizeAccountType("legal")` | `"BUSINESS"` |
| 21 | `normalizeAccountType(null)` | `"PERSONAL"` |

---

## 2. API — authorization & IDOR (PARTs 14, 22)

| # | Case | Expected |
|---|---|---|
| 22 | Any `/api/v1/legal-requests*` without a session | `401` |
| 23 | `GET /api/v1/legal-requests/<other-user-id>` | `404` (not 403) |
| 24 | `POST .../transition` with a foreign id | `404` |
| 25 | `POST .../transition` with an invalid `to` | `400 VALIDATION_ERROR` |
| 26 | `POST .../transition` illegal move | `409 ILLEGAL_TRANSITION`, state unchanged |
| 27 | Actor in the written event | equals the session user, never the body |
| 28 | `GET /api/v1/lawyers/<unverified-id>` | `404` |
| 29 | `GET /api/v1/intake/schemas/<unknown>` | `404` |

---

## 3. Cross-module flow (PART 11)

| # | Case | Expected |
|---|---|---|
| 30 | Transition to `ACCEPTED` | a `Case` is created and `caseId` written back |
| 31 | Transition to `ACCEPTED` twice | only **one** case created |
| 32 | Illegal move toward `ACCEPTED` | `409`, **no orphan case** |

---

## 4. E2E — user journeys (Playwright)

| # | Journey | Assertions |
|---|---|---|
| 33 | `/intake` → pick category → complete wizard | draft persists; resumable after reload |
| 34 | `/lawyers` → filter → open profile | «نمونه» badge on demo rows; pricing renders |
| 35 | `/requests` → open detail → legal transition | badge + timeline update together |
| 36 | `/requests/[id]` → illegal transition attempt | Persian error shown, state unchanged |
| 37 | `/cases` → create → open | card appears; timeline has «ایجاد پرونده» |
| 38 | RTL & a11y | `dir="rtl"`; interactive targets ≥ 44px; focus visible |

---

## 5. Regression guardrails

- All pre-existing suites must stay green. Known pre-existing failure:
  `phase11-profile-settings` (1 stale assertion) — **not** a regression.
- `tsc --noEmit` must be clean before any commit.
- New endpoints must be exercised live (curl) against the dev server, not
  only type-checked.
