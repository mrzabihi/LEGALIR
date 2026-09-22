# LEGALIR — Points & Rewards

> Reward points are a **persistent asset**, completely separate from the
> subscription's daily credit. This document covers how they are earned,
> stored, spent and displayed.

---

## 1. What reward points are (and are not)

- **Are:** a persistent, ledger-backed balance the user accumulates through
  activity — daily visits, profile completion, purchases, campaigns.
- **Are not:** the subscription's daily credit. That resets at Tehran midnight
  and is governed by the usage engine (`docs/SUBSCRIPTION_USAGE_ENGINE.md`).

The two must never be shown as one number. The dashboard renders them as two
distinct cards: **اعتبار امروز اشتراک** and **امتیازهای شما**.

---

## 2. The ledger

Points are **never stored as a balance**. The balance is always derived:

```
balance = SUM(points_delta) over reward_ledger WHERE user_id = ?
```

`reward_ledger` is append-only. Each row:

| Field | Meaning |
|---|---|
| `id` | Row id |
| `user_id` | Owner |
| `event_type` | `DAILY_VISIT`, `PROFILE_COMPLETED`, `PURCHASE`, `REQUEST_CONSUMED`, … |
| `points_delta` | Signed change (positive = earn, negative = spend) |
| `source_type` / `source_id` | What caused it |
| `idempotency_key` | Prevents a duplicate grant/spend |
| `description` | Persian, user-facing |
| `metadata` | Free-form |
| `created_at` | ISO timestamp |

Because the balance is a sum, it can never drift out of sync with its history,
and every change is auditable.

---

## 3. Earning

| Event | Trigger | Idempotency key |
|---|---|---|
| `DAILY_VISIT` | The user opens the app on a new Tehran day | `daily-visit:${userId}:${date}` |
| `PROFILE_COMPLETED` | Profile reaches 100% (once per account) | `profile-completed:${userId}` |
| `PURCHASE` | A subscription purchase is confirmed | `purchase:${subscriptionId}` |

Every grant is idempotent: a retried request, a double-click or a duplicate
checkout can never award the same points twice.

---

## 4. Spending

Reward points are spent **only** when the subscription's daily credit is
exhausted **and** the platform setting
`allow_reward_points_after_subscription_limit` is `true` (default `false`).

- The setting lives in the `platform_settings` table and is read by
  `allowRewardPointsAfterLimit()`.
- When enabled, `checkEntitlement` returns `creditSource: "REWARD"` and
  `reserveUsage` debits the ledger via `spendRewardPoints`.
- The spend key is `reward-spend:${sourceType}:${sourceId}`, so a replay is a
  no-op.

**Default behaviour:** when the daily credit runs out, the activity is blocked
with `DAILY_REQUEST_LIMIT_EXCEEDED` / `DAILY_POINTS_EXCEEDED`. The product has
not decided to auto-spend reward points, so the engine does not invent it.

---

## 5. The daily rollover must not touch reward points

This is the single most important invariant:

> At Tehran midnight the subscription's daily credit resets to full. The
> reward ledger is **not** read, written or cleared by that rollover.

The engine creates a new `subscription_daily_usage` row for the new date and
leaves `reward_ledger` untouched. The test
`usage-engine.test.ts › reward points › are NOT reset by the daily rollover`
pins this.

---

## 6. API surface

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/v1/rewards/summary` | Balance + summary |
| `GET` | `/api/v1/rewards/history` | Paginated ledger |
| `POST` | `/api/v1/rewards/daily-visit/claim` | Claim the daily-visit reward |
| `GET` | `/api/v1/points` | `PointsAccount` (ledger aggregates) |
| `GET` | `/api/v1/points/transactions` | Paginated transactions |

The dashboard's `SubscriptionUsageCard` reads the balance from
`GET /api/v1/subscription/usage` (`rewardPoints`), which itself calls
`getRewardBalance` — the same source the header badge uses. There is no
parallel computation.

---

## 7. UI rules

- **Two assets, two cards.** Never a single "امتیاز" number.
- The reward card is labelled **امتیازهای شما** and states it is persistent
  («دائمی — با بازنشانی روزانه از بین نمی‌رود»).
- The credit card is labelled **اعتبار امروز اشتراک** and states it resets at
  Tehran midnight.
- The quota-exhausted modal shows both, so the user can see that their reward
  points survived the daily reset.
