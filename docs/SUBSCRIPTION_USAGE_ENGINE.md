# LEGALIR — Subscription, Points & Usage Engine

> The single business engine that governs every billable activity. No feature
> may subtract points or decrement a quota on its own — everything passes
> through `lib/usage/engine.ts`.

---

## 1. The two assets (never conflate them)

LEGALIR has **two completely different assets**. The UI must never show a
single big number called "امتیاز" — that is the exact confusion this engine
exists to prevent.

| | اعتبار امروز اشتراک (Subscription Daily Credit) | امتیازهای شما (Reward Points) |
|---|---|---|
| **Source** | The active subscription's plan | The reward ledger (activity, daily visit, profile completion…) |
| **Lifetime** | Resets at **Tehran midnight** | **Persistent** — never reset by the daily rollover |
| **Carry-over** | Never carries over | Accumulates indefinitely |
| **Formula** | `dailyRequestLimit × activityCostPoints` | `SUM(points_delta)` over the ledger |
| **Storage** | `subscription_daily_usage` (one row per user+subscription+date) | `reward_ledger` (append-only) |
| **Spent when** | Always first | Only if `allow_reward_points_after_subscription_limit` is enabled |

**Rule:** the daily rollover creates a *new* `subscription_daily_usage` row. It
never deletes or mutates the reward ledger. History is kept for audit.

---

## 2. Source-of-truth business rules

| Plan | Requests/day | Daily points | Tokens | AI messages | Doc analysis | Contract draft | Contract creation |
|---|---|---|---|---|---|---|---|
| SILVER | 50 | 5,000 | 3,000,000 | 3,000 | 5 | 3 | 3 |
| GOLD | 150 | 15,000 | 4,500,000 | 4,500 | 15 | 10 | 10 |
| DIAMOND | 300 | 30,000 | 9,000,000 | 9,000 | 50 | 30 | 30 |

- **Global activity cost** = `100` points (`BASE_ACTIVITY_COST`).
- **Duration** = **31 days** for every plan (`PLAN_DURATION_DAYS`).
- Diamond contract creation is **30**, not unlimited.
- Every number above lives in the `subscription_plans` table, seeded from
  `DEFAULT_PLANS` in `lib/usage/plans.ts`. Nothing is hard-coded in a route,
  a component or a fixture.

---

## 3. Architecture

```
Plan (template)  ──snapshot──▶  Subscription (instance)
                                      │
                                      ▼
                              Entitlement resolution
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
  Daily credit bucket          Period usage row              Reward ledger
  (resets at midnight)         (resets at period end)        (never resets)
        │                             │                             │
        └─────────────┬───────────────┴───────────────┬─────────────┘
                      ▼                               ▼
              reserveUsage()  ──▶  Service executes  ──▶  completeUsage()
                      │                                       │
                      └──────────  reverseUsage()  ◀──────────┘
                                   (internal failure only)
```

### Files

| File | Responsibility |
|---|---|
| `packages/types/src/index.ts` | Domain types: `SubscriptionPlan`, `PlanEntitlementSnapshot`, `SubscriptionDailyUsage`, `SubscriptionPeriodUsage`, `UsageTransaction`, `UsageErrorCode`, `SubscriptionUsageSummary`, `PlanAuditEntry` |
| `lib/usage/activities.ts` | The central activity registry — point cost, daily-request flag, service quota per activity |
| `lib/usage/plans.ts` | The plan catalog (single source of truth) + `snapshotFor`, `dailyPointsFor`, `updatePlanWithAudit` |
| `lib/usage/engine.ts` | `checkEntitlement`, `reserveUsage`, `completeUsage`, `reverseUsage`, `failUsage`, `getUsageSummary`, `getUsageHistory` |

---

## 4. Data model

### `subscription_plans` (template, admin-editable)
`id, code, nameFa, descriptionFa, durationDays, activityCostPoints,
dailyRequestLimit, tokenLimit, aiMessageLimit, documentAnalysisLimit,
contractDraftLimit, contractCreationLimit, contractCreationUnlimited,
listPrice, salePrice, currency, features[], isActive, createdAt, updatedAt`

### `subscriptions` (instance)
The existing row, extended with `plan_snapshot: PlanEntitlementSnapshot`.
**The snapshot is frozen at purchase time** — a later admin edit to the plan
must never retroactively change a live subscription's terms.

### `subscription_daily_usage`
`id, userId, subscriptionId, usageDate (YYYY-MM-DD, Tehran), requestLimit,
requestUsed, pointsTotal, pointsUsed, createdAt, updatedAt`
One row per user + subscription + local date. **Never deleted.**

### `subscription_period_usage`
`id, userId, subscriptionId, aiMessagesUsed, tokensUsed,
documentAnalysesUsed, contractDraftsUsed, contractsCreatedUsed, …`
One row per user + subscription. Resets only when a new period begins.

### `usage_transactions` (the ledger)
`id, userId, subscriptionId, activityType, pointsCost, requestCost, tokenCost,
serviceQuotaType, serviceQuotaCost, creditSource (SUBSCRIPTION|REWARD|NONE),
source, relatedEntityId, status (RESERVED|COMPLETED|REVERSED|FAILED),
idempotencyKey, createdAt, updatedAt`

### `plan_audit`
`id, planId, planCode, changedBy, field, oldValue, newValue, createdAt`

---

## 5. The lifecycle

1. **Resolve** — `resolveEntitlement(userId)` finds the newest `active`
   subscription whose `end_at > now`. An "active" row past its end grants
   **no** quota. No subscription → the free-tier snapshot (10 requests/day).
2. **Check** — `checkEntitlement` verifies, in order: activity enabled →
   daily request allowance → daily points → period service quota. It returns
   a structured `UsageErrorCode` and the resolved `creditSource`.
3. **Reserve** — `reserveUsage` re-checks, then atomically debits the daily
   bucket (or the reward wallet) **and** the period quota, and writes a
   `RESERVED` transaction.
4. **Execute** — the feature runs.
5. **Complete** — `completeUsage(txId, { tokens })` marks it `COMPLETED` and
   records the provider's **real** token usage.
6. **Reverse** — on an *internal* failure only, `reverseUsage` refunds the
   daily credit, the period quota and the tokens. A user-initiated stop does
   **not** reverse (the work was delivered).

---

## 6. Concurrency & correctness

Every read-modify-write in the engine is **fully synchronous**. Node is
single-threaded and there is no `await` inside a critical section, so two
simultaneous requests are serialized and can never overspend a quota.

- **No negative balances** — every debit is guarded by a check in the same
  synchronous pass.
- **Idempotent** — `reserveUsage` keys on `idempotencyKey`. A replay returns
  the existing transaction without charging again. Keys in use:
  `chat:${userMessageId}`, `document:${docId}`, `contract:${contractId}`.
- **Atomic reserve** — the check and the debit happen together; there is no
  window between them.

---

## 7. Error codes

| Code | Meaning | Resets |
|---|---|---|
| `DAILY_REQUEST_LIMIT_EXCEEDED` | The day's request allowance is spent | Tehran midnight |
| `DAILY_POINTS_EXCEEDED` | The day's points budget is spent | Tehran midnight |
| `AI_MESSAGE_LIMIT_EXCEEDED` | Period AI-message quota spent | Period end |
| `TOKEN_LIMIT_EXCEEDED` | Period token quota spent | Period end |
| `DOCUMENT_ANALYSIS_LIMIT_EXCEEDED` | Period document quota spent | Period end |
| `CONTRACT_LIMIT_EXCEEDED` | Period contract quota spent | Period end |
| `SUBSCRIPTION_EXPIRED` | The subscription lapsed | Renewal |
| `NO_ACTIVE_SUBSCRIPTION` | No subscription at all | Purchase |

The frontend switches on these codes to choose the right copy and CTA.

---

## 8. API surface

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/v1/subscription/usage` | `SubscriptionUsageSummary` |
| `GET` | `/api/v1/subscription/usage/today` | `DailyCreditView` |
| `GET` | `/api/v1/subscription/usage/history` | `UsageHistoryResponse` |
| `GET` | `/api/v1/plans` | `Plan[]` (projected from the catalog) |
| `GET` | `/api/v1/admin/plans/[code]` | `{ plan, audit }` |
| `PATCH` | `/api/v1/admin/plans/[code]` | `SubscriptionPlan` (audited) |

Enforcement is **backend-only**. The frontend never decides whether an
activity is allowed — it renders the engine's answer.

---

## 9. Timezone

The daily boundary is **Asia/Tehran** via the IANA zone
(`tehranDateString()` in `lib/rewards.ts`), not a fixed `+03:30` offset, so
Iran's DST history is handled correctly. `nextTehranMidnight()` supplies the
`resetAt` the UI counts down to.

---

## 10. Admin

Plans are editable at runtime through `PATCH /api/v1/admin/plans/[code]`
(staff-only, `admin:system:manage`). Every changed field writes one
`plan_audit` row in the same synchronous pass — a change can never land
without its trail. Editing a plan does **not** touch live subscriptions; they
keep their frozen snapshot until renewal.
