# CURRENT_ANALYTICS_AUDIT.md

> The **as-is** analytical state of LEGALIR: what data really exists, where every
> number would come from, which reporting surfaces already ship, and — most
> importantly — **which metrics the current data cannot support at all**.
>
> This document is the evidence base for `TARGET_ANALYTICS_ARCHITECTURE.md`. No
> metric may be built unless its source is recorded here as REAL. Anything
> missing is recorded as a **Data Gap** with the minimum capture that would be
> needed to close it.
>
> Snapshot: **2026-10-07**. Storage: file-backed JSON at
> `apps/frontend/.data/<table>.json` via `readTable`/`writeTable`
> (`apps/frontend/src/lib/db.ts`). No SQL, no transaction manager, no OLAP.
> All amounts are integer **Toman (IRT)**. Display timezone **Asia/Tehran**;
> all stored timestamps are ISO-8601 UTC.

---

## 1. Runtime & storage

| Aspect | Reality |
|---|---|
| Stack | Next.js App Router monorepo (`apps/frontend`, `packages/*`) |
| DB | File-backed JSON tables, one file per table, re-read with an mtime+size cache |
| Writes | `writeTable` rewrites the whole array (no atomicity between tables) |
| Concurrency | Single node process; correctness relies on write-ordering + idempotency keys |
| Time | ISO-8601 UTC on every row; Jalali is presentation-only |
| Money | Integer Toman; `toPersianCurrency(x,"IRT")` prints `x × 10` Rial as «تومان» |

There is **no aggregation/index/materialized layer**. Every "report" is a
linear scan of a JSON array in-process. At the current sizes (≤ 400 rows/table)
this is fine; the design must not assume it scales beyond that.

---

## 2. Table inventory (row counts on 2026-10-07)

| Table | Rows | Role in analytics |
|---|---:|---|
| `users` | 286 | Population, new-user series, cohort anchor |
| `subscriptions` | 27 | **Primary sales/revenue source** (statuses: 10 active, 9 expired, 8 superseded) |
| `payments` | 2 | New persisted payments — **only 2 rows, both `paid`, both silver, both today** |
| `reward_ledger` | 325 | Reward-energy asset (delta ledger) |
| `usage_transactions` | 35 | Consumption log (spend) |
| `activities` | 231 | Per-user activity feed — last-activity + recency signal |
| `sessions` | 358 | Session rows with `lastActiveAt` — recency signal |
| `subscription_daily_usage` | 78 | Daily subscription credit (field **`usageDate`**) |
| `subscription_period_usage` | 56 | Period service quotas |
| `subscription_plans` | 3 | Catalog templates (silver/gold/diamond) |
| `legal_requests` | 22 | Product usage (requests) |
| `financial_adjustments` | **MISSING** | Refund/adjustment trail — file does not exist |

---

## 3. Domain models (as stored)

### 3.1 Subscription (`subscriptions.json` — snake_case)

```
id, user_id, plan_code, plan_name_fa, amount, currency,
status, status_fa, start_at, end_at, purchased_at, auto_renew,
plan_snapshot?, payment_id?, superseded_at?, updated_at?
```

Statuses observed: `active`, `expired`, `superseded`.
Declared union (`packages/types/src/index.ts`): `pending | active | expired | cancelled | superseded`.

**A subscription row exists only after activation** (confirmed-payment path).
Legacy rows were activated by the pre-fix click path and carry **no
`payment_id`** (25 of 27). Only 2 rows have a linked persisted payment.

### 3.2 Payment (`payments.json`)

```
id, userId, planCode, amount, currency, status, method, subscriptionId,
idempotencyKey, transactionId, correlationId, createdAt, updatedAt, paidAt
```

`status ∈ pending | paid | failed | cancelled | refunded`. Populated **only**
by the post-fix checkout flow (`lib/payments.ts`). `method` is `mock`.

### 3.3 Energy — two distinct assets

| Asset | Source table | Bounded by | Notes |
|---|---|---|---|
| **Subscription credit** | `subscriptions` (a grant at `start_at`) | the subscription; resets at Tehran midnight | `subscription_daily_usage.usageDate` |
| **Reward points** | `reward_ledger.points_delta` | persistent wallet | never reset by rollover |

Consumption = `usage_transactions` (`pointsCost`, `status ∈ RESERVED|COMPLETED|REVERSED|FAILED`,
`creditSource ∈ SUBSCRIPTION|REWARD|NONE`).

The unified **read-time projection** `getEnergyLedger(userId)`
(`lib/energy/ledger.ts`) merges the three into balanced `EnergyLedgerEntry[]`
with per-source `balanceBefore`/`balanceAfter`. It **never writes**.

`EnergyTransactionType` includes `EXPIRATION` — but **no code writes an
expiration row** (verified: no writer for `EXPIRATION` exists).

---

## 4. Existing reporting surfaces (do not duplicate)

| Surface | Page | Backend | KPIs / charts |
|---|---|---|---|
| Overview | `app/(admin)/admin/page.tsx` | `buildOverview`, `dailySales`, `revenueByPlan` (`lib/admin/metrics.ts`) | sales count/amount + prev-period %, new users, refunds, lawyers, requests, points; LineChart (revenue/requests), DonutChart (request states), BarChart (category, plan) |
| Reports | `/admin/reports` | `revenueByPlan`, `dailySales`, exports | revenue by plan, daily sales, export |
| Orders | `/admin/orders` | `listOrders` (`lib/admin/orders.ts`) | order table derived from `subscriptions`, refund state |
| Energy | `/admin/energy` | energy admin ledger (`lib/usage/energy.ts`) | per-user ledger admin view |
| Plans | `/admin/plans` | catalog CRUD | plan catalog |
| Users | `/admin/users` | user dossier | per-user subscription + energy drawer |

**Overlap risk.** The Overview already renders sales, revenue-by-plan and a
daily series. The new analytics surface must **reframe** these into a dedicated
Analytics section (deeper, filterable, exportable) and **not** add a second
competing "sales" card on the Overview.

### 4.1 Existing computation primitives

- `lib/admin/metrics.ts` — `OverviewWindow` (`fromIso`,`toIso`,`prevFromIso`,`prevToIso`),
  `rollingWindow(days)`, `absoluteWindow(from,to)` (inclusive-to-day, equal-length
  previous window), `changePctOf` (returns `null` when previous is 0/absent),
  `kpi`/`unavailableKpi` (honest "not derivable" KPI), `comparableKpi`.
- `lib/admin/orders.ts` — `toOrder`, `orderStatus`, `refundedFor`, `maskMobile`.
- `lib/subscription/lifecycle.ts` — `resolveActiveSubscription`, `listSubscriptions`, `reconcileSubscriptionStatuses`.
- `lib/energy/ledger.ts` — `getEnergyLedger`.
- `lib/persian-utils.ts` — `toPersianDate`, `toPersianCurrency`, `toPersianNumber`.

### 4.2 Chart primitives (`components/admin/charts.tsx`)

`ChartFrame`, `LineChart` (**single series only**), `BarChart` (horizontal),
`DonutChart`, `ChartSkeleton`, `ChartEmpty`.

**Gap:** no multi-series / grouped / stacked chart. A plan-by-day comparison
needs a new primitive (grouped bars) — the single-series `LineChart` cannot
express "silver vs gold vs diamond per day".

### 4.3 Formatting

- `toPersianDate(date, options)` forces `calendar:"persian"` (correct Jalali).
- `toPersianCurrency(amount,"IRT")` → `{n×10} تومان`.
- **Gap:** there is **no Jalali↔ISO converter**. Presets like "current Jalali
  month" cannot be computed into ISO bounds without one.

### 4.4 Permissions today

`Permission` union (`packages/types/src/platform.ts`): `…admin:reports:read`,
`admin:reports:export`, `admin:staff:*`, `admin:settings:*`. `ROLE_PERMISSIONS`
grants `admin:reports:read` broadly (every admin role) and `reports:export` to
finance/platform roles. `PERMISSION_META`
(`lib/admin/permission-catalog.ts`) is `Record<Permission,…>` — **adding a
permission forces this catalog to compile-fail until labelled**, by design.

---

## 5. DATA GAPS (the honest part)

Every item below is a metric the brief requested that the current data **cannot**
produce. Each is recorded with proof and the minimal capture to close it.

| # | Requested metric | Status | Evidence | Minimum capture |
|---|---|---|---|---|
| G1 | **Refunded / net revenue** | **Derivable only as 0** | `financial_adjustments.json` does not exist; `payments.status` never `refunded` | No new capture needed — the refund model (`AdminOrder` + `createAdjustment`) already exists; it simply has no rows yet. Report refunds as a real, currently-zero figure with a "no refunds recorded" note. |
| G2 | **Payment-level revenue for history** | **Partial** | 27 subscriptions vs 2 payments; legacy rows have `payment_id: null` | Backfill is a decision, not code. Report revenue from `subscriptions` (authoritative for legacy) and expose `payments` coverage as a data-quality KPI. |
| G3 | **Expired energy** | **Unavailable** | No writer emits `EXPIRATION`; reward points never expire in code | A future expiry job. Until then the metric is reported `unavailable`, never 0. |
| G4 | **Subscription funnel** (viewed→started→paid) | **Unavailable** | No `subscription_viewed`/`checkout_started` telemetry exists | Client event capture (new table + writer). Only the **paid** stage is real today. |
| G5 | **Jalali month/quarter presets** | **Blocked** | No Jalali↔ISO converter in `lib/persian-utils.ts` | Add a pure converter (no new data). |
| G6 | **Plan-by-day comparison chart** | **Blocked** | `LineChart` is single-series; no grouped/stacked primitive | Add a grouped-bar chart primitive. |
| G7 | **Repurchase / repurchase-interval** | **Derivable** | Multiple `subscriptions` per `user_id` exist; `purchased_at` is present | None — compute intervals; median requires ≥2 purchases per user (else N/A). |
| G8 | **"Last activity" per user** | **Derivable** | `sessions.lastActiveAt` (358 rows) and `activities.created_at` (231 rows) | None. Use max of the two; label the source. |
| G9 | **NLRFM "N" dimension** | **Undefined** | Zero references to `NLRFM|RFM|LRFM|churn|cohort|LTV` anywhere in the repo | Do not invent. Ship transparent **LRFM**; expose an explicitly-labelled, separate «New vs Returning» flag (see `NLRFM_DEFINITION.md`). |
| G10 | **Churn / at-risk** | **Derivable as a heuristic** | Derived from recency vs a plan term; not a stored label | Label as a transparent heuristic, never an ML score. |
| G11 | **LTV** | **Derivable, bounded** | Sum of completed purchases per user (lifetime) | Present as *historical* LTV (realized), never a projected/future LTV. |
| G12 | **Cohort retention** | **Derivable on small n** | `users.createdAt` + first `subscriptions.purchased_at` | Present counts + shares; **suppress %** where the cohort base is 0; warn that small cohorts are noisy. |

### 5.1 Figures that must NEVER be shown as real
- Any refund amount other than what `financial_adjustments` actually contains (**currently 0**).
- Store/payment conversion rates (no telemetry → G4).
- Expired energy (no writer → G3).
- "% change" when the previous window base is 0 (existing `changePctOf` already returns `null` → UI shows «—»).
- Any hero KPI whose source window cannot be reconstructed.

---

## 6. What can be built honestly **today**

| Capability | Verdict |
|---|---|
| Sales by plan (count + amount) per day & per range, with prev-period compare | ✅ Real (`subscriptions`) |
| Refunds / net revenue | ✅ Real, currently **0**, shown with a "no data yet" note |
| User energy: current balance, granted, consumed, remaining in range | ✅ Real (`reward_ledger` + `usage_transactions` + grant projection) |
| Energy: expired | ❌ Unavailable (G3) |
| Top energy holders / distribution | ✅ Real |
| Purchase ranking (count, gross, net, first/last) | ✅ Real (`subscriptions` + refunds) |
| LRFM segmentation | ✅ Real (transparent thresholds) |
| Repurchase intervals (avg **and** median separately) | ✅ Real (N/A for single-purchase users) |
| New vs Returning | ✅ Real (explicitly defined flag, not part of LRFM) |
| Cohorts (registration / first-purchase) | ✅ Real on small n |
| Funnel / conversion | ❌ Unavailable (G4) |

---

## 7. Conclusion

The platform has a **solid, real subscription + energy + payment spine**. The
analytics layer can be built entirely on real data for **sales, revenue,
purchases, energy, and customer behaviour**, with **three honest gaps**
(expired energy, funnel telemetry, refund rows) surfaced as `unavailable` /
zero-with-note rather than fabricated. The two engineering prerequisites with
no data dependency are the **Jalali↔ISO converter** (G5) and the **grouped-bar
chart primitive** (G6).

See `TARGET_ANALYTICS_ARCHITECTURE.md` for the design, `ANALYTICS_DATA_DICTIONARY.md`
for field-level definitions, `NLRFM_DEFINITION.md` for the segmentation model,
and `ANALYTICS_IMPLEMENTATION_PLAN.md` for the build order.
