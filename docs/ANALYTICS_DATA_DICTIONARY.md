# ANALYTICS_DATA_DICTIONARY.md

> Field-level definition of every table and derived value the analytics layer
> reads. This is the contract that keeps a displayed number tied to a real
> column. If a metric's source is not here, the metric must not ship.
>
> Snapshot: 2026-10-07. All timestamps are **ISO-8601 UTC**. All amounts are
> integer **Toman (IRT)**. Display calendar is **Jalali (fa-IR)**; display
> timezone **Asia/Tehran**; all range arithmetic is UTC-safe.

---

## 1. Source tables

### 1.1 `subscriptions` (sales source of truth)
| Field | Type | Meaning | Analytics use |
|---|---|---|---|
| `id` | string | Subscription/order id (`sub-…`) | Key, drill-down |
| `user_id` | string | Owning user | Grouping (per-customer) |
| `plan_code` | `silver\|gold\|diamond` | Plan purchased | Plan breakdown |
| `plan_name_fa` | string | Persian plan name | Labels |
| `amount` | int IRT | Charged amount | Gross revenue, M |
| `currency` | string | `IRT` | Unit |
| `status` | enum | `pending\|active\|expired\|cancelled\|superseded` | Lifecycle |
| `status_fa` | string | Persian status | Legacy fallback in `orderStatus` |
| `start_at` | ISO | Activation instant | Grant date, L anchor |
| `end_at` | ISO | Term end | Active check (`end_at>now`) |
| `purchased_at` | ISO | Purchase instant | **Sales/date filter source** |
| `auto_renew` | 0/1 | Auto-renew flag | (informational) |
| `payment_id?` | string\|null | Linked payment | Payment coverage (G2) |
| `superseded_at?` | ISO\|null | When replaced | Lifecycle |
| `updated_at?` | ISO\|null | Last write | Freshness |

> **Rule:** a `subscriptions` row exists only after activation, so it counts as
> **one completed purchase**. There is no "unpaid order" row here — unpaid
> intents live in `payments` (`status="pending"`).

### 1.2 `payments` (post-fix persisted payments)
| Field | Type | Meaning |
|---|---|---|
| `id` | string | Payment id (`pay-…`) |
| `userId` | string | Owner |
| `planCode` | `silver\|gold\|diamond` | Target plan |
| `amount` | int IRT | Server-resolved amount |
| `currency` | string | `IRT` |
| `status` | enum | `pending\|paid\|failed\|cancelled\|refunded` |
| `method` | enum | `mock\|gateway\|manual\|admin\|free` |
| `subscriptionId` | string\|null | Activated subscription |
| `idempotencyKey` | string | `pay:<userId>:<planCode>:<nonce>` |
| `transactionId` | string\|null | PSP reference |
| `correlationId` | string | Log correlation |
| `createdAt`/`updatedAt`/`paidAt` | ISO | Timeline |

> **Caveat (G2):** only 2 rows exist and they cover **only** the post-fix
> checkout. Payment-health and payment-level revenue are therefore scoped to
> this table's real coverage and **not** extrapolated to the whole history.

### 1.3 `users`
`id`, `mobile`, `displayName`, `createdAt` (ISO) → population, new-user series,
cohort anchor, display name.

### 1.4 `reward_ledger` (reward-energy asset)
| Field | Meaning |
|---|---|
| `user_id` | Owner |
| `event_type` | `PROFILE_COMPLETED\|DAILY_VISIT\|REFERRAL_COMPLETED\|SUBSCRIPTION_*_PURCHASED\|REQUEST_CONSUMED` |
| `points_delta` | signed points (+earn / −spend) |
| `created_at` | ISO |

> Balance = `SUM(points_delta)`. `REQUEST_CONSUMED` rows are **skipped** as
> reward rows in the unified ledger but their delta still counts toward balance.

### 1.5 `usage_transactions` (consumption)
| Field | Meaning |
|---|---|
| `userId`, `subscriptionId` | Owner / bound subscription |
| `activityType` | `AI_MESSAGE\|DOCUMENT_ANALYSIS\|CONTRACT_DRAFT\|…` |
| `pointsCost` | points charged |
| `status` | `RESERVED\|COMPLETED\|REVERSED\|FAILED` (**FAILED excluded** from consumption) |
| `creditSource` | `SUBSCRIPTION\|REWARD\|NONE` |
| `createdAt` | ISO |

### 1.6 `subscription_daily_usage`
`userId`, `subscriptionId`, **`usageDate`** (Tehran `YYYY-MM-DD`),
`requestLimit`, `requestUsed`, `pointsTotal`, `pointsUsed`.
> Field name is **`usageDate`** (camelCase) — not `usage_day`.

### 1.7 `subscription_period_usage`
Period-scoped quotas: `aiMessagesUsed`, `tokensUsed`, `documentAnalysesUsed`,
`contractDraftsUsed`, `contractsCreatedUsed`, keyed by `subscriptionId`.

### 1.8 `activities` / `sessions`
- `activities.created_at` (ISO) — per-user activity time.
- `sessions.lastActiveAt` (ISO) — last session activity.
- R (recency) = `now − max(purchases, sessions.lastActiveAt, activities.created_at)`.

### 1.9 `subscription_plans`
Catalog: `code`, `nameFa`, `durationDays`, `salePrice` (int IRT), quotas.

### 1.10 `financial_adjustments` (**absent today** — G1)
Intended: `orderId`, `kind`, `amount`, `currency`, `status`
(`pending|completed|rejected`), `requestedBy`, `approvedBy`, `createdAt`.
> No file exists yet. Settled refunds = rows with `status="completed"`.
> Currently **0**, so net revenue = gross; the UI states this.

---

## 2. Derived metrics (definition → source)

| Metric | Formula | Source |
|---|---|---|
| Gross revenue in range | Σ `amount` where `purchased_at ∈ [from,to]` | `subscriptions` |
| Settled refunds in range | Σ `amount` where `status="completed"` and `createdAt ∈ window` | `financial_adjustments` |
| **Net revenue** | gross − settled refunds | above |
| Sales count | count of `subscriptions.purchased_at ∈ window` | `subscriptions` |
| Units by plan | count grouped by `plan_code` in window | `subscriptions` |
| Amount by plan | Σ `amount` grouped by `plan_code` | `subscriptions` |
| Active subscriptions | count where `status="active"` and `end_at>now` | `subscriptions` |
| New users in range | count `users.createdAt ∈ window` | `users` |
| Repeat-purchase rate | #users with ≥2 purchases ÷ #users with ≥1 purchase | `subscriptions` |
| ARPU (range) | gross ÷ distinct purchasing users in window | `subscriptions` |
| Reward balance (per user) | Σ `points_delta` | `reward_ledger` |
| Sub credit today (per user) | `pointsTotal − pointsUsed` for today's `usageDate` | `subscription_daily_usage` |
| Consumption in range | Σ `pointsCost` where `status≠FAILED` and `createdAt ∈ window` | `usage_transactions` |
| Energy granted in range | Σ positive `points_delta` (+ projected sub grants) | `reward_ledger`, `subscriptions` |
| Energy expired | **unavailable** (no `EXPIRATION` writer) | — (G3) |
| L / R / F / M | see `NLRFM_DEFINITION.md §2` | subscriptions/users/sessions/activities |
| Repurchase interval avg/median | gaps between sorted `purchased_at` per user (≥2) | `subscriptions` |
| Realized LTV | Σ net monetary per user (lifetime) | `subscriptions` |
| Revenue concentration | Σ net of top k% purchasers ÷ total net | `subscriptions` |
| Payment success ratio | `paid ÷ (paid+failed+cancelled)` **within payments coverage** | `payments` |
| Net revenue reconcile | analytics net vs `/admin/orders` net | both |

---

## 3. Range & comparison semantics

- **Input:** ISO `from`/`to` (`YYYY-MM-DD`). `to` is **inclusive to day end**
  (`23:59:59.999Z`) via `absoluteWindow`.
- **Previous window:** equal length immediately before `from`
  (`prevFrom = from − span`, `prevTo = from`). Rolled windows ("last 7 days")
  use the same span.
- **Comparison rule:** `% change` only when the previous base > 0; else `null`
  → UI «—» (existing `changePctOf`).
- **Day bucketing:** ISO date slice (`ts.slice(0,10)`); the day-boundary note in
  the UI states «مرز روز: نیمه‌شب تهران».
- **Jalali presets** require the new converter (G5); display always via `toPersianDate`.

---

## 4. Inclusion / exclusion policy

| Included | Excluded |
|---|---|
| `subscriptions` rows (post-activation) | — (no unpaid rows here) |
| `payments.status="paid"` for payment metrics | `pending/failed/cancelled` for revenue |
| `usage_transactions.status ∈ COMPLETED/RESERVED/REVERSED` for consumption | `FAILED` |
| `financial_adjustments.status="completed"` as refunds | `pending`/`rejected` |

---

## 5. Data-quality flags (per response)

Every analytics response carries a `dataQuality[]` block — the machine-readable
form of the gap register:

```ts
interface AnalyticsDataQualityFlag {
  id: string;              // "G1" … "G12"
  labelFa: string;
  status: "real" | "partial" | "unavailable" | "blocked";
  reasonFa: string;
  captureNeededFa: string | null;
}
```

Rules:
- `unavailable` metrics are never rendered as 0; the widget shows the reason.
- `partial` metrics show the real figure **and** its coverage note.
- `blocked` items name the missing primitive (e.g. Jalali converter, grouped bar).

---

## 6. Ownership & refresh

| Concern | Owner |
|---|---|
| Source rows | existing domain writers (subscription lifecycle, payments, energy engine, activity recorder) |
| Analytics readings | `lib/admin/analytics/*` (read-only) |
| Thresholds (LRFM) | `docs/NLRFM_DEFINITION.md` (single place to change) |
| Gap register | `docs/CURRENT_ANALYTICS_AUDIT.md §5` + `quality.ts` |

**Refresh:** computed on request from live tables; no cache, no stale snapshot.
`generatedAt` (ISO) is returned on every response and shown in the UI footer.
