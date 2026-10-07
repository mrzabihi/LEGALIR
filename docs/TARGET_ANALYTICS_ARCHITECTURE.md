# TARGET_ANALYTICS_ARCHITECTURE.md

> The design contract for the LEGALIR **Business Intelligence / Product
> Analytics** layer. It sits *on top of* the shipped Subscription & Entitlement
> platform (`TARGET_SUBSCRIPTION_ARCHITECTURE.md`) and changes nothing about the
> transactional spine. It reads the real tables and projects them into
> decision-oriented metrics.
>
> Companion to `CURRENT_ANALYTICS_AUDIT.md` (the as-is state + gap register) and
> `ANALYTICS_DATA_DICTIONARY.md` (field-level definitions).
>
> Snapshot: 2026-10-07.

---

## 0. Prime principle (locked)

**Never produce a fake KPI, number, chart, or insight.** If the data cannot
support a metric, the metric is returned as `unavailable` with a reason (or
omitted), never as a zero that could be mistaken for a measurement. Every
figure shown must trace to a named table and field. This principle overrides
every layout or completeness consideration.

Three sub-rules:

1. **Revenue ≠ SUM of orders.** Revenue = SUM of completed (paid) purchases
   minus **settled** refunds. Orders that never paid are never revenue.
2. **Nothing simulated is presented as real.** The mock gateway is labelled.
3. **Comparisons require real previous data.** No previous window → no `%`; the
   UI shows «—» and, where useful, «دادهٔ کافی برای مقایسه وجود ندارد».

---

## 1. Layering

```
┌───────────────────────────────────────────────────────────────┐
│  UI  /admin/analytics  (tabs: Overview · Subscriptions ·        │
│      Customers · Energy · Finance · Operations)                 │
│      — shared date-range control, drill-down, export, RTL/Jalali│
├───────────────────────────────────────────────────────────────┤
│  API  /api/v1/admin/analytics/[[...segments]]  (hot route)      │
│      + the existing admin dispatcher serves the export/report   │
│      aliases; one shared computation core                       │
├───────────────────────────────────────────────────────────────┤
│  CORE  lib/admin/analytics/*                                    │
│      range.ts · metrics.ts · subscription-analytics.ts          │
│      energy-analytics.ts · customer-analytics.ts (LRFM)         │
│      finance-analytics.ts · quality.ts (data-quality/gaps)      │
│      — pure functions over readTable(); no writes (except the   │
│        idempotent reconcileSubscriptionStatuses already shipped)│
├───────────────────────────────────────────────────────────────┤
│  SOURCES  subscriptions · payments · users · reward_ledger ·    │
│           usage_transactions · subscription_daily_usage ·       │
│           subscription_period_usage · activities · sessions ·   │
│           subscription_plans · financial_adjustments(none yet)  │
└───────────────────────────────────────────────────────────────┘
```

### 1.1 Why a *hot* route in addition to the dispatcher
The existing admin dispatcher (`app/api/v1/admin/[[...segments]]/route.ts`) is a
large catch-all. Analytics adds a new, self-contained family of endpoints with
their own permission family. A dedicated route
`app/api/v1/admin/analytics/[[...segments]]/route.ts` keeps the dispatcher from
growing further and lets analytics be permission-gated and tested in isolation.
**Both layers share one core** (`lib/admin/analytics/*`) so there is exactly one
implementation of every metric — no drift.

### 1.2 Aggregation location
All heavy aggregation is **server-side**, in the core module, over the JSON
tables. The API returns already-computed metrics, not raw rows (except for
explicit table endpoints, which are paginated). No metric is computed in the
browser.

---

## 2. Metric catalogue (by layer)

### 2.1 Executive Overview (Level 1 — max ~9 cards)
| KPI | Source | Notes |
|---|---|---|
| درآمد خالص بازه | `subscriptions` (paid) − settled refunds | net revenue; refunds currently 0 (G1) |
| تعداد فروش بازه | `subscriptions.purchased_at ∈ window` | + real prev-period % |
| اشتراک‌های فعال | `subscriptions` status=active, `end_at>now` | live snapshot |
| کاربران جدید بازه | `users.createdAt ∈ window` | + prev-period % |
| نرخ تکرار خرید | users with ≥2 purchases ÷ purchasers | real, small-n warned |
| انرژی مصرف‌شده بازه | `usage_transactions` (excl. FAILED) | points |
| اعتبار انرژی جاری | reward balance + today's sub credit | two assets, summed clearly |
| نسبت پرداخت موفق | paid ÷ (paid+failed+cancelled) **if payments cover the window**, else `unavailable` | G2 data-quality guard |
| صف‌های نیازمند اقدام | lawyers pending, refunds pending, support overdue, requests awaiting | reuse `buildAttention` |

### 2.2 Subscriptions
- Sales by plan (silver/gold/diamond): count + amount, **per day** and **per range**.
- Grouped-bar chart: silver vs gold vs diamond per day (new primitive, G6).
- Filters: plan, payment-status, date range.
- Upgrade / downgrade: successive subscriptions per user ordered by `purchased_at`;
  plan-rank delta. (Historic rows carry no payment → rank from `plan_code` order.)
- Renewal vs new: same plan re-purchase vs first purchase.
- Lifecycle: counts by status (active/expired/superseded/cancelled/pending).
- Plan performance: revenue share, ARPU = amount ÷ purchasers, units.

### 2.3 Customers (see `NLRFM_DEFINITION.md`)
- LRFM per user (raw L/R/F/M + transparent score + segment).
- Purchase frequency distribution.
- Repurchase interval: **average AND median separately**; N/A for single-purchase users.
- New vs Returning: explicit flag (not part of LRFM).
- At-risk / dormant: transparent recency heuristic, labelled «هیوریستیک».
- LTV: **realized** (Σ completed purchases), never projected.
- Cohorts: registration month × first-purchase; counts + shares; small-n warning.
- Purchase ranking table (id/name, count, gross, refunded, net, first/last).

### 2.4 Energy
- Current total balance (two assets, shown separately AND summed).
- Granted / consumed / remaining **in range** from the ledger projection.
- Expired: **unavailable** (G3) — surfaced as such, never 0.
- Top holders, distribution buckets, source breakdown (subscription vs reward vs admin).
- Consumption by activity type (`usage_transactions.activityType`).
- Table: id/name, balance, received, consumed, last change; search/sort/filter by type & range.

### 2.5 Finance
- Revenue quality: gross, refunds (settled), net; mock vs real gateway labelled.
- Revenue concentration: top 1 / 5 / 10 / 20 % of purchasers' share of net revenue.
- Payment health: paid/failed/cancelled over the window the `payments` table covers.
- Reconciliation: analytics net revenue vs `/admin/orders` net — must agree.

### 2.6 Operations
- Request volume + state mix (reuse `legal_requests`).
- Support SLA, lawyer queue, audit freshness (reuse existing helpers).
- Data-quality panel: the **gap register** (§5) rendered with real status.

---

## 3. Shared controls

- **Date range control** — one component, three modes:
  - Presets: امروز / ۷ روز / ۳۰ روز / این ماه (Jalali) / بازهٔ دلخواه.
  - Backend receives **ISO `from`/`to`** (`YYYY-MM-DD`); `absoluteWindow` makes `to` inclusive-to-day and derives an equal-length **previous** window.
  - Jalali month presets need the new converter (G5).
- **Jalali display**: server returns ISO; UI formats via `toPersianDate`.
- **Toman** display via `toPersianCurrency(x,"IRT")`; underlying integers are IRT.
- **Timezone/day boundary**: arithmetic is UTC-safe (ISO compare); the label
  states «مرز روز: نیمه‌شب تهران». Day bucketing uses the ISO date slice — documented.
- **States**: loading (skeleton), error (retry block), empty (message + hint),
  partial (per-widget `unavailable` with reason).
- **Drill-down**: every KPI/graph links to the operative page (`/admin/orders`,
  `/admin/users`, `/admin/energy`) preserving the active range as query params.
- **Export**: CSV / XLSX via the existing export path, gated by `admin:analytics:export`.
- **Compare**: a toggle enabling the previous-period overlay — only for range-scoped
  metrics with a real previous value.

---

## 4. Permissions

New, lean family (added to `Permission` union, `ROLE_PERMISSIONS`, and
`PERMISSION_META`):

| Permission | Grants |
|---|---|
| `admin:analytics:read` | See every analytics tab and metric |
| `admin:analytics:export` | Download CSV/XLSX from analytics |

Granted to: `ADMIN_FINANCE`, `ADMIN`, `SUPER_ADMIN` get both; every other admin
role that already has `admin:reports:read` gets `admin:analytics:read`. The
frontend only hides affordances; the route re-checks server-side.

---

## 5. Data-quality contract (gaps rendered honestly)

The core exposes `analyticsDataQuality()` returning one row per gap (G1–G12)
with: `id`, `labelFa`, `status ∈ real|partial|unavailable|blocked`,
`reasonFa`, and the concrete capture needed. The Operations tab renders it.
This is the machine-readable form of `CURRENT_ANALYTICS_AUDIT.md §5` so the UI
can never imply a gap is a real number.

---

## 6. Performance

- Every metric is a single pass over the relevant table; group/aggregate once,
  reuse across KPIs within a request.
- The core memoizes per-request (one read of each table).
- No new indexes/DB needed at current sizes; documented ceiling (~10⁴ rows) at
  which an index/materialized layer would be required (additive, not a rewrite).
- Never `next build` while the dev server runs (project rule).

---

## 7. What this does NOT change
- No change to the subscription state machine, activation path, or energy rules.
- No new source of truth: the analytics layer is **read-only** over existing tables.
- The Overview (`/admin`) keeps its role; analytics **reframes**, never deletes.
- Existing permissions and routes keep working; analytics is purely additive.
