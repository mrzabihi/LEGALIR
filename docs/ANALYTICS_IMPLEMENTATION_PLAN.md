# ANALYTICS_IMPLEMENTATION_PLAN.md

> The build order for the LEGALIR analytics layer, with the exact files, the
> dependency order, and the verification gates. Every step is additive and
> read-only over existing tables. No step requires a data migration.
>
> Snapshot: 2026-10-07.

---

## Phase 0 — Documents (done first, per the brief)
- [x] `docs/CURRENT_ANALYTICS_AUDIT.md` — as-is + gap register G1–G12.
- [x] `docs/TARGET_ANALYTICS_ARCHITECTURE.md` — layering, metric catalogue, controls, permissions.
- [x] `docs/ANALYTICS_DATA_DICTIONARY.md` — field-level definitions + derived metrics.
- [x] `docs/NLRFM_DEFINITION.md` — transparent LRFM + honest "no N" statement.
- [x] `docs/ANALYTICS_IMPLEMENTATION_PLAN.md` — this file.

---

## Phase 1 — Shared primitives (no data dependency)
| # | File | Change |
|---|---|---|
| 1.1 | `packages/types/src/platform.ts` | Add `admin:analytics:read`, `admin:analytics:export` to `Permission`; grant in `ROLE_PERMISSIONS` (finance/ADMIN/SUPER_ADMIN both; report-read roles get `read`). |
| 1.2 | `apps/frontend/src/lib/admin/permission-catalog.ts` | Add labels for the two new permissions (compile-fails until added — by design). |
| 1.3 | `apps/frontend/src/lib/persian-utils.ts` | Add pure `jalaliToIsoDate` / `isoToJalaliParts` helpers (G5) — no new data. |
| 1.4 | `apps/frontend/src/components/admin/charts.tsx` | Add `GroupedBarChart` (multi-series, G6) reusing the existing SVG/geometry conventions. |

**Gate:** `npx tsc --noEmit` clean after each.

---

## Phase 2 — Analytics core (`apps/frontend/src/lib/admin/analytics/`)
Read-only over `readTable`; one memoized read per table per request.

| # | File | Responsibility |
|---|---|---|
| 2.1 | `range.ts` | Window resolution (reuse `absoluteWindow` semantics), Jalali preset → ISO, day bucketing, prev-window derivation. |
| 2.2 | `quality.ts` | `analyticsDataQuality()` — the G1–G12 flags as `AnalyticsDataQualityFlag[]`. |
| 2.3 | `metrics.ts` | Shared KPI builders (`kpi`, `unavailableKpi`, `comparableKpi`) re-exported/adapted; population + new-user series; repeat-purchase; the Executive Overview aggregator `buildAnalyticsOverview(window)`. |
| 2.4 | `subscription-analytics.ts` | Sales by plan per day/range, grouped series, upgrade/downgrade, renewal vs new, lifecycle counts, plan performance (revenue share, ARPU, units). |
| 2.5 | `energy-analytics.ts` | Balance (two assets + sum), granted/consumed/remaining in range, expired=`unavailable`, top holders, distribution, source breakdown, consumption by activity, per-user table. |
| 2.6 | `customer-analytics.ts` | LRFM (per `NLRFM_DEFINITION.md`), segments, purchase-ranking rows, repurchase avg+median, new-vs-returning, at-risk heuristic, realized LTV, cohorts (small-n guard). |
| 2.7 | `finance-analytics.ts` | Gross/refunds/net, revenue quality (mock labelled), concentration (top 1/5/10/20%), payment health (coverage-scoped), reconcile vs orders. |

**Gate:** unit tests (`lib/__tests__/analytics-*.test.ts`) with seeded synthetic tables covering: no-sales day, user with no purchase, refund row present, expired energy request, empty range.

---

## Phase 3 — API
| # | File | Change |
|---|---|---|
| 3.1 | `apps/frontend/src/app/api/v1/admin/analytics/[[...segments]]/route.ts` | NEW hot route. GET endpoints: `overview`, `subscriptions`, `customers`, `energy`, `finance`, `operations`, `quality`, plus paginated table endpoints (`customers/ranking`, `energy/users`). `requirePermission(req, "admin:analytics:read")`; range via `?from&to` or `?rangeDays`; each response `{ data, quality }`. |
| 3.2 | `.../analytics/export/route.ts` | CSV/XLSX export gated by `admin:analytics:export`; audited via `recordAudit`. |
| 3.3 | `apps/frontend/src/lib/api/analytics.ts` | Client fetchers + `qs`/window params (reuse `lib/api/admin.ts` conventions). |
| 3.4 | `apps/frontend/src/hooks/useAnalytics.ts` | React Query hooks; keys include `from`/`to`/`rangeDays`; `useAdminMe().can("admin:analytics:read")` gating. |

**Gate:** route-level tests (pending→confirm→active reconciliation; duplicate confirm no-op) already covered by the subscription suite; add analytics route smoke tests.

---

## Phase 4 — UI
| # | File | Change |
|---|---|---|
| 4.1 | `apps/frontend/src/app/(app)/admin/analytics/page.tsx` | NEW page. `Tabs`: Overview · Subscriptions · Customers · Energy · Finance · Operations. Shared `RangeControl` (today/7/30/Jalali-month/custom). RTL, Jalali dates, Toman. |
| 4.2 | `apps/frontend/src/components/admin/analytics/*.tsx` | Tab panels + widgets (KPI row, grouped-bar plan chart, energy ledger table, ranking table, LRFM table + segment cards, cohort table, finance concentration, data-quality panel). Reuse `StatCard`, `DataTable`, `ChartFrame`, `StateView`, `ExportButton`, `FilterPills`. |
| 4.3 | `apps/frontend/src/lib/admin-nav.ts` | Add nav entry `analytics` → `/admin/analytics`, permission `admin:analytics:read`. |
| 4.4 | `apps/frontend/src/components/admin/admin-shell.tsx` | Ensure an icon key exists for the nav entry (reuse `Dashboard`/`Download`). |

**Gate:** Playwright screenshot spec (project's OTP-session auth pattern) for desktop + mobile; verify Jalali filter, Toman, empty/error/loading, and drill-down links.

---

## Phase 5 — Verification (real results only)
1. `npx tsc --noEmit` — must be clean.
2. `npx eslint` on changed files — must pass.
3. `npx vitest run` the new analytics suites + the subscription/energy/admin suites — record actual pass counts.
4. Scenario coverage: no-sales day, user without purchase, refund present, expired energy transaction, empty range.
5. Access: confirm the analytics route 403s without `admin:analytics:read` and that the UI only hides affordances (server enforces).
6. Reconcile analytics net revenue against `/admin/orders` net — must be equal.
7. **Do not** run `next build` while the dev server runs (project rule).

---

## Risk / non-goals
- **Non-goal:** funnel/conversion (G4) and expired energy (G3) — no data; reported as `unavailable`.
- **Non-goal:** changing the transaction spine, activation path, or energy rules.
- **Risk:** small datasets make shares noisy → every share carries a small-n caveat.
- **Risk:** Jalali↔ISO conversion correctness → covered by unit tests with known fixed dates before any UI depends on it.

---

## As-built status (2026-10-07)

What actually shipped — reconciled against the plan above, with every deviation
stated.

### Shipped
- **Phase 1** — `admin:analytics:read` / `admin:analytics:export` in `platform.ts`
  + `permission-catalog.ts`; Jalali ⇄ ISO helpers in `persian-utils.ts`;
  `GroupedBarChart` in `charts.tsx`.
- **Phase 2** — `lib/admin/analytics/{range,quality,metrics,subscription-analytics,
  energy-analytics,customer-analytics,finance-analytics,export,sources}.ts`.
- **Phase 3** — route `app/api/v1/admin/analytics/[[...segments]]/route.ts` with
  GET `overview · subscriptions · customers(/ranking) · energy(/users) · finance ·
  quality` and POST `export` (kinds: subscriptions, customers, energy, finance);
  `lib/api/analytics.ts`; `hooks/useAnalytics.ts`.
- **Phase 4** — page `app/(admin)/admin/analytics/page.tsx` with five tabs
  (نمای کلی · فروش اشتراک · مشتریان · انرژی کاربران · تطبیق مالی), shared
  `RangeControl` (today/7d/30d/Jalali-month/custom); nav entry + shell icon.

### Deviations from plan
- **No dedicated «Operations» tab.** The plan's Operations tab had three jobs:
  request volume/state mix, support SLA/lawyer-queue/audit freshness, and the gap
  register. The **gap register is rendered on every tab** (each tab calls
  `analyticsDataQuality()` and renders `QualityPanel`) — stricter than one tab,
  since a metric's caveat sits beside the metric. The remaining operational items
  overlap the existing `/admin` overview, lawyer and request console surfaces, so
  they are **intentionally deferred** rather than duplicated here.
  `/admin/analytics/quality` still exposes the register standalone.
- **No previous-period overlay toggle.** Comparison is computed server-side per
  KPI and surfaced as a trend chip; a separate overlay control was not built.

### Verification (real results)
- `npx tsc --noEmit` — clean for every analytics file.
- `npx eslint` on the analytics files — 0 errors.
- `npx vitest run` — `lib/__tests__/analytics.test.ts` **18/18** and
  `app/__tests__/analytics-tabs.test.tsx` **6/6** (24 total).
- Scenario coverage: no-sales day, user without purchase, refund present,
  FAILED/REVERSED energy, empty range — all asserted.
- **Access:** live `GET /api/v1/admin/analytics/*` return **401** unauthenticated;
  the route calls `requirePermission(…, "admin:analytics:read")` on GET and
  `"admin:analytics:export"` on POST, with `recordAudit` on export.
- **Reconcile:** `finance.buildFinanceAnalytics().reconcile.matches === true`
  asserts analytics net equals the `/admin/orders` model net (covered by a test).
