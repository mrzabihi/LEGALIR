# CURRENT_ARCHITECTURE.md — Subscription / Payment / Energy (as-is)

> Snapshot taken 2026-10-07, before the Subscription & Entitlement refactor.
> Every path is relative to the repo root. Storage is a **file-backed JSON DB**
> (`apps/frontend/.data/<table>.json`) written through `readTable` / `writeTable`
> in `apps/frontend/src/lib/db.ts`. There is no SQL, no transaction manager, and
> no native dependency.

---

## 1. Current Subscription Flow

### 1.1 Plan catalog (the "Plan" template)
- **Source of truth:** `apps/frontend/src/lib/usage/plans.ts`.
  - `TABLE = "subscription_plans"` → `.data/subscription_plans.json` (seeded from
    `DEFAULT_PLANS` on first read).
  - `AUDIT_TABLE = "plan_audit"` → `.data/plan_audit.json`.
  - `PLAN_DURATION_DAYS = 31`.
  - `readPlans()` / `getPlanByCode()` / `getPlanById()`.
  - `snapshotFor(plan)` freezes the entitlement numbers onto a purchase.
  - `FREE_TIER_SNAPSHOT` (10 req/day; all period quotas `0`).
  - `updatePlan` / `updatePlanWithAudit` (admin edit + per-field audit).
- **Canonical numbers** (silver / gold / diamond): `dailyRequestLimit` 50/150/300,
  `activityCostPoints` 100, `tokenLimit` 3m/4.5m/9m, `aiMessageLimit` 3k/4.5k/9k,
  `documentAnalysisLimit` 5/15/50, `contractDraftLimit` 3/10/30,
  `listPrice` 5m/7m/10m, `salePrice` 2.5m/3.5m/4.86m (IRT), duration 31 days.
- **Derived:** `dailyPoints = dailyRequestLimit × activityCostPoints`.

### 1.2 A user's subscription (the "Subscription" instance)
- **Table:** `"subscriptions"` → `.data/subscriptions.json`.
- **Stored shape** (`StoredSubscription`, `db.ts:192-207`, snake_case, duplicated in
  `engine.ts:55-70`):
  ```
  { id, user_id, plan_code, plan_name_fa, amount, currency,
    status, status_fa, start_at, end_at, purchased_at, auto_renew,
    plan_snapshot? }
  ```
- **Writers:** `createSubscription` (`db.ts:928-959`) — **append only**; never
  supersedes a previous row. Seeds at `db.ts:1826-1832` and `demo-seed.ts:993-1001`.
- **Readers (INCONSISTENT — this is defect #1):**
  - `queryActiveSubscription` (`db.ts:721-738`) → `.find(status === "active")`
    — **first inserted**, ignores `end_at`.
  - `resolveEntitlement` (`engine.ts:129-166`) → filters `status === "active"`
    **AND** `end_at > now`, sorts newest-first, takes `[0]`.
  - `hasExpiredSubscription` (`db.ts:792-804`) → another, third notion of active.
- `querySubscriptionHistory` (`db.ts:909-926`) → newest-first DTO for the UI.

### 1.3 Status vocabulary
`SubscriptionStatus = "pending" | "active" | "expired" | "cancelled"`
(`packages/types/src/index.ts:173`). **No `superseded`, no `paused`.** No runtime
code ever writes a non-`active` status — expiry is detected only by comparing
`end_at` at read time.

---

## 2. Current Payment Flow

### 2.1 The live path (subscription page)
```
SubscriptionPage.handleConfirmCheckout   (page.tsx:590-599)
  → useCheckoutIntent (useSubscription.ts:99-110)
    → POST /api/v1/checkout/intents { planCode }      (api/v1.ts:220-222)
```
`POST /api/v1/checkout/intents` (`app/api/v1/checkout/intents/route.ts`):
1. validates the plan code against `["silver","gold","diamond"]` (line 34);
2. **immediately** `createSubscription({ status: "active", ... })` (lines 48-57);
3. `claimPurchaseReward(...)` (line 61);
4. `recordActivity(...)`;
5. builds a `CheckoutIntent` **already `status: "paid"`** (line 75) and stores it in
   an **in-memory** `Map` (`globalThis.__v1CheckoutIntents`) — lost on restart;
6. returns `201 { data: intent }`.

The page then polls `GET /api/v1/checkout/intents/:id`
(`intents/[id]/route.ts`), which just reads the same in-memory `Map`.

### 2.2 Root cause of "Gold user pays for Diamond but stays Gold"
- **Defect A — no supersede.** `createSubscription` only appends. After buying
  Diamond the table holds an `active` Gold row **and** an `active` Diamond row.
- **Defect B — first-active wins.** `queryActiveSubscription` returns the
  **first** active row (Gold, inserted earlier), so every display surface
  (`/subscriptions/current`, `/entitlements`, dashboard, header chip, sidebar)
  shows Gold.
- **Defect C — read/enforce divergence.** The engine (`resolveEntitlement`) sorts
  newest-first, so **quota enforcement** uses Diamond while the **badge** shows
  Gold. Evidence: `.data/subscriptions.json` user `d9c1267c…` has a gold row
  (2026-10-06) then three diamond rows (2026-10-07); the UI shows Gold.
- **Defect D — no payment record.** The "payment" is a synchronous branch inside
  the POST — there is no persisted payment, no pending state, no verify step, and
  therefore no idempotency key. A retried POST would create a second subscription.

### 2.3 Legacy / parallel checkout (not wired to the v1 UI)
- `POST /api/checkout` (`app/api/checkout/route.ts`) prices from
  `@legalir/testing.fixturePlans` (silver diverges: 100 vs 50 req/day) and writes
  to a **different** Map `globalThis.__checkoutIntents`.
- `GET/POST /api/checkout/[id]` can flip an intent to `paid`.
- Front-end `subscription/checkout/[planCode]/page.tsx` simulates payment with
  client-only timers and never calls a confirm endpoint.

### 2.4 MSW mocks (`apps/frontend/src/mocks/handlers/index.ts`)
- `POST /checkout/intents` → `pending` + `paymentUrl` (lines 833-860).
- `GET /checkout/intents/:id` → **flips `pending` → `paid` on first poll**
  (lines 863-882). The subscription-page test relies on this.

---

## 3. Current Energy / Entitlement Flow

There are **two parallel usage systems** and **three things called "energy."**

### System A — the Engine (enforced)
`apps/frontend/src/lib/usage/engine.ts`, tables:
`subscription_daily_usage`, `subscription_period_usage`, `usage_transactions`,
`platform_settings`.
- `resolveEntitlement(userId)` (`:129`) → live snapshot (frozen `plan_snapshot`,
  else catalog, else `FREE_TIER_SNAPSHOT`); synthetic `subscriptionId = "free"`.
- Daily credit = a **mutable counter row** per `(user,subscriptionId,TehranDay)`:
  `requestLimit/Used`, `pointsTotal = dailyRequestLimit × activityCostPoints`,
  `pointsUsed`. **Resets at Tehran midnight, never carries over, never deleted.**
- Period quotas = rest-of-period counters (`AI_MESSAGES`, `TOKENS`,
  `DOCUMENT_ANALYSIS`, `CONTRACT_DRAFT`, `CONTRACT_CREATION`).
- `checkEntitlement` (`:359`) → check without consuming.
- `reserveUsage` (`:469`) → the **only** sanctioned consumer; idempotent by
  `idempotencyKey`; debits daily bucket **or** reward wallet.
- `completeUsage` / `reverseUsage` / `failUsage` (`:602/:644/:684`).
- `getUsageSummary` (`:698`) / `getUsageHistory` (`:757`).
- Precedence: daily subscription credit first; reward points only as a fallback
  **when** `allow_reward_points_after_subscription_limit === true` (default
  **false**, `:94-99`). The two assets are deliberately separate.
- Concurrency: all read-modify-write is **synchronous** — Node's single thread
  serializes requests (documented assumption at `engine.ts:15-17`).

### System B — the legacy DB quota (display only, dead consumer)
`db.ts`: `usage_stats`, `queryProfileUsage` (`:744`), `queryDailyQuota` (`:831`),
`consumeDailyRequest` (`:863`, **no production caller**). `/api/v1/quota`,
`/usage`, `/usage/summary`, `/entitlements`, `/dashboard/summary` still read these
hard-coded totals (e.g. `entitlements/route.ts:25-27`).

### Reward points — the only true ledger
`db.ts` `reward_ledger` (`RewardLedgerEntry`, `:264-275`): append-only,
`balance = SUM(points_delta)`, idempotent by `idempotency_key` + per-event unique
key. Rules in `lib/rewards.ts` (`REWARD_RULES`): `PROFILE_COMPLETED` 1000,
`DAILY_VISIT` 100 (once/day), `REFERRAL_COMPLETED` **disabled**, `SUBSCRIPTION_*`
850/1000/1500 (once/purchase). `grantReward` (`db.ts:1256`),
`spendRewardPoints` (`db.ts:1426`), `spendEnergy` (`db.ts:1367`, flat 200 —
**defined but never called in production**).

### The admin "energy" pricing model (not a balance)
`lib/usage/energy.ts` + `service_cost_profiles` / `service_cost_rules`: a
**pricing** layer that rewrites the charged points per activity. `UsageLedgerEntry`
is a **derived projection** over `usage_transactions` (not a second store).

**No `balanceBefore` / `balanceAfter` exists anywhere** — balances are recomputed
on read.

---

## 4. Current Admin Flow

- **Shell:** `app/(admin)/admin/**` inside `AdminShell`
  (`components/admin/admin-shell.tsx`), nav filtered by `can(permission)`
  (`lib/admin-nav.ts`).
- **Single API dispatcher:** `app/api/v1/admin/[[...segments]]/route.ts`
  (GET top-level `GET_ROUTES:201`, nested `handleNestedGet:395`; `handlePost:661`;
  `handlePatch:1055`).
- **RBAC:** authoritative matrix `ROLE_PERMISSIONS` in
  `packages/types/src/platform.ts:191-448`; enforced server-side by
  `requirePermission` (`lib/rbac.ts:136`); `permissionFor(method,segments)`
  (`route.ts:1318-1352`); client affordance via `useAdmin.ts:143`.
- **Audit:** real append-only `admin_audit_log` (`lib/admin/audit.ts`,
  `recordAudit` / `listAudit`), type `AdminAuditEntry`
  (`packages/types/src/admin.ts:26-47`). Second domain log: `plan_audit`.
- **Subscription/energy surfaces today:**
  - `/admin/plans` (`admin/plans/page.tsx`) — read catalog; edit gated by
    `admin:system:manage` → `PATCH /admin/plans/:code`
    (`app/api/v1/admin/plans/[code]/route.ts`).
  - `/admin/orders` — orders are **derived from the `subscriptions` table**
    (`lib/admin/orders.ts`); refunds = `financial_adjustments` (two-person rule).
  - `/admin/energy` — service-cost pricing + a read-only usage ledger.
  - `/admin/users` — list + masked mobile + inline role change + a boolean
    `hasActiveSubscription` badge (`route.ts:214-248`). **No per-user
    subscription detail, no energy grant/adjust.**
- **Storage:** JSON tables in `.data/` (`admin_audit_log`, `financial_adjustments`,
  `subscription_plans`, `plan_audit`, `service_cost_*`, …).

---

## 5. Current Database Schema (tables touched by this system)

| Table (`.data/<name>.json`) | Shape | Notes |
|---|---|---|
| `subscription_plans` | `SubscriptionPlan` | catalog; admin-editable |
| `plan_audit` | `PlanAuditEntry` | per-field plan edits |
| `subscriptions` | `StoredSubscription` | instances; append-only |
| `subscription_daily_usage` | `SubscriptionDailyUsage` | daily counter (not a ledger) |
| `subscription_period_usage` | `SubscriptionPeriodUsage` | period counters |
| `usage_transactions` | `UsageTransaction` | consumption log |
| `reward_ledger` | `RewardLedgerEntry` | reward ledger (balance = SUM) |
| `usage_stats` | `UsageStatsRow` | legacy display counters (consumer dead) |
| `platform_settings` | `{key,value}` | e.g. reward-after-limit flag |
| `admin_audit_log` | `AdminAuditEntry` | admin trail |
| `financial_adjustments` | refunds | order-level money |
| **missing** | payments | **no persisted payment exists** |

---

## 6. Current API (subscription/payment/plan)

| Route | Method | Effect |
|---|---|---|
| `/api/v1/plans` | GET | `readPlans()` projected |
| `/api/v1/subscriptions/current` | GET | `queryActiveSubscription` (first-active) |
| `/api/v1/subscription-history` | GET | `querySubscriptionHistory` |
| `/api/v1/entitlements` | GET | usage_stats (not the catalog) |
| `/api/v1/usage`, `/usage/summary`, `/profile/usage`, `/quota` | GET | legacy counters |
| `/api/v1/subscription/usage`, `/usage/today`, `/usage/history` | GET | engine summary |
| `/api/v1/checkout/intents` | POST | **activates synchronously**, returns `paid` |
| `/api/v1/checkout/intents/:id` | GET | in-memory Map read |
| `/api/checkout`, `/api/checkout/:id` | POST/GET | legacy, divergent prices |
| `/api/v1/admin/plans/:code` | GET/PATCH | plan catalog edit + audit |

---

## 7. Current Frontend

- `app/(app)/subscription/page.tsx` — current-plan card, usage meters, payment
  history, plan carousel; buy handler `handleConfirmCheckout` (`:590-599`).
- `hooks/useSubscription.ts` — `usePlansV1`, `useCurrentSubscription`,
  `useEntitlements`, `useUsage`, `useSubscriptionUsage(History)`,
  `useCheckoutIntent`, `useCheckoutIntentPoll`.
- `lib/subscription.ts` — `deriveSubscriptionStatus` (canonical display state);
  `lib/subscription/plan-visuals.ts` — `PLAN_ORDER`, discounts, gradients.
- `components/subscription/**` — plan-card, plan-carousel, subscription-status
  (header chip / sidebar badge / settings details).

---

## 8. Current Problems (ranked)

1. **Purchase does not change the active plan** (Gold→Diamond stays Gold) —
   defects A/B/C above. *This is the reported bug.*
2. **No payment record / no pending state / no idempotency.** Payment is a
   synchronous branch; intents live in RAM; a double-submit double-charges.
3. **No subscription lifecycle.** No `superseded`, no expiry transition, no
   cancel/upgrade/downgrade/renew primitives; previous rows are never closed.
4. **Three inconsistent notions of "active"** across read surfaces.
5. **Catalog bypass.** `usage_stats`, `fixturePlans`, and the `/entitlements` +
   `/usage` routes ignore `subscription_plans` (duplicate numbers drift).
6. **No unified energy ledger** with a source distinction and balance before/after.
7. **No admin per-user subscription/energy management** or energy grant/adjust.
8. **Duplicate legacy checkout** with divergent prices.

---

## 9. Technical Debt / Risks

- **Read-modify-write on JSON files** with a process-local cache — no real
  transactions; "transactional activation" must be emulated (write-ordered +
  idempotent replay), not assumed.
- **Duplicate `StoredSubscription` interface** in `db.ts` and `engine.ts`.
- **Duplicated plan numbers** in `packages/testing.fixturePlans` and
  `db.FREE_DAILY_REQUESTS`.
- **In-memory checkout Maps** (`__v1CheckoutIntents`, `__checkoutIntents`) split
  the source of truth and vanish on restart.
- **Date-bomb test** `lib/__tests__/usage-engine.test.ts` (seeded `end_at`
  `2026-10-02`) — pre-existing failures, unrelated to this work.
- Middleware guarantees only a session cookie; authorization is per-route.

## 10. Non-negotiable invariants to preserve

- A user has **exactly one** active subscription at a time.
- **Payment success is the only trigger** that activates a subscription.
- Activation is **idempotent** (one subscription, one grant, one entitlement).
- Subscription **history is never deleted**.
- Subscription energy and reward energy stay **separate assets**.
- Admin mutations are **audited** and **permission-gated**.

---

## 11. As-built reconciliation (2026-10-07, post-refactor)

This section records which §8/§9 problems are resolved in the shipped code, so
the "Current Problems" above are read as the *pre-refactor* baseline.

### Fixed

1. **Purchase does not change the active plan (§8.1)** — fixed. Activation runs
   through `lib/subscription/lifecycle.ts`; `queryActiveSubscription` returns the
   newest `active` row with `end_at > now` (agreeing with `resolveEntitlement`),
   and activation supersedes every other `active` row. See
   `SUBSCRIPTION_PLATFORM_API_AND_QA.md §1`.

2. **No payment record / no pending state / no idempotency (§8.2)** — fixed. A
   persisted `payments` table exists; `POST /api/v1/checkout/intents` creates a
   *pending* payment + subscription; `POST .../intents/:id/confirm` is the only
   activation path and is idempotent on `idempotencyKey`.

3. **Legacy `usage_stats` read path — frozen counters (§3 System B).** The routes
   `/api/v1/entitlements`, `/usage`, `/usage/summary`, `/quota`, `/profile/usage`,
   and `/dashboard/summary` used to derive every counter from `usage_stats` — a
   table written **only** by `consumeDailyRequest`, which has no production
   caller. The counters were therefore frozen while real consumption landed in
   the engine (`usage_transactions` / `subscription_daily_usage` /
   `subscription_period_usage`). All six routes now project the usage engine's
   canonical `SubscriptionUsageSummary` through the pure mappers in
   **`apps/frontend/src/lib/usage/views.ts`** (`entitlementsFromSummary`,
   `usageCountersFromSummary`, `profileUsageFromSummary`, `dailyQuotaFromSummary`).
   Response shapes are **unchanged**; only the source moved. Follow-up cleanup:
   the now-dead `queryProfileUsage` / `queryDailyQuota` helpers and the unversioned
   `/api/profile/usage` route were deleted, and `computeDashboardMetrics` no longer
   reads the table. `usage_stats` is left in place — no data migration — and is
   still written by `lib/ai/store.ts` and read by the admin AI-provider aggregate
   (`lib/admin/ai-providers.ts`), but **no per-user usage route reads it any more**.

4. **Dead legacy checkout (§8.8) — removed.** `/api/checkout` and
   `/api/checkout/[id]` (which priced from `@legalir/testing.fixturePlans` and
   kept intents in the in-memory `globalThis.__checkoutIntents` Map) had **zero
   callers** — the live client (`lib/api/v1.ts`) hits `/api/v1/checkout/intents*`,
   a separate tree. Both files are deleted; the `__checkoutIntents` Map and the
   divergent fixture pricing are gone. `fixturePlans` itself stays (the MSW
   handlers and one component test still use it).

5. **`fixturePlans` silver divergence (§9) — aligned.** `packages/testing`
   carried `dailyRequestLimit: 100` for silver vs the catalog's `50`
   (`lib/usage/plans.ts` `DEFAULT_PLANS`). The fixture now mirrors the catalog
   (`dailyRequestLimit: 50`, and the matching `"۵۰ درخواست روزانه"` feature
   string), so the MSW handlers and the plan-card component test no longer serve
   numbers the real catalog would never produce.

6. **Duplicate `StoredSubscription` interface (§9) — consolidated.** The
   `subscriptions` row shape was declared independently in `db.ts`,
   `usage/engine.ts`, `subscription/lifecycle.ts`, `admin/orders.ts`,
   `admin/metrics.ts` and (as `StoredSubscriptionRow`) `energy/ledger.ts`. It is
   now declared **once** in `@legalir/types` (`packages/types/src/index.ts`) and
   imported everywhere. The canonical shape is the superset: the shared fields
   plus the optional `plan_snapshot`, `payment_id`, `superseded_at`,
   `updated_at` and `tracking_id` (the last read by `admin/orders.ts`).
   `lifecycle.ts` re-exports the type so `@/lib/subscription/lifecycle` importers
   are untouched. **Type-only — the persisted JSON row and every runtime path are
   unchanged.** Verified with `tsc --noEmit` (frontend + types) and the 62
   subscription/payment/energy/admin/orders tests.

### Still open (unchanged by choice)

_None that this pass scoped._ The `usage_stats` table stays in place (no data
migration); it is still written by `lib/ai/store.ts` and read by the admin
AI-provider aggregate, but no per-user usage route reads it any more.
`db.FREE_DAILY_REQUESTS` (10) still mirrors `FREE_TIER_SNAPSHOT.dailyRequestLimit`
(also 10) — both agree, and deriving one from the other would introduce a
`db.ts → plans.ts → db.ts` import cycle for a constant read only by the dead
`consumeDailyRequest` path, so the duplication is left deliberately.
