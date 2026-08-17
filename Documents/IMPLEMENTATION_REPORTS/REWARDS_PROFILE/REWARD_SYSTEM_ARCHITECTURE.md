# LEGALIR — Reward & Loyalty System Architecture

## Overview

LEGALIR Points («امتیاز لیگالیر») is a backend-authoritative loyalty ledger. The
frontend only displays values it receives — it never decides how many points to award
(Spec Task 37).

## Reward Rules (Spec Tasks 16–17, 21)

Typed domain config: `src/lib/rewards.ts` — `REWARD_RULES`.

| eventType | points | frequency | enabled |
| --- | --- | --- | --- |
| `PROFILE_COMPLETED` | 1000 | once_per_account | true |
| `DAILY_VISIT` | 100 | once_per_day | true |
| `REFERRAL_COMPLETED` | 500 | once_per_account | **false** (feature flag) |
| `SUBSCRIPTION_SILVER_PURCHASED` | 850 | once_per_purchase | true |
| `SUBSCRIPTION_GOLD_PURCHASED` | 1000 | once_per_purchase | true |
| `SUBSCRIPTION_DIAMOND_PURCHASED` | 1500 | once_per_purchase | true |

## Ledger (Spec Task 20)

Entity `RewardLedgerEntry` (in `src/lib/db.ts`):

```
id, user_id, event_type, points_delta, source_type, source_id,
idempotency_key, description, metadata, created_at
```

Balance = `SUM(points_delta)` (`getRewardBalance`). The ledger is authoritative;
no cached balance is trusted independently.

## Idempotency (Spec Tasks 18, 38)

`grantReward` refuses to award when:

- the rule is missing or `enabled === false`, or
- an entry already exists with the same `idempotency_key`, or
- the per-event `uniqueKey` already exists for that user+event.

Keys:
- Daily visit → `idempotency_key = daily-visit:{userId}:{tehranDate}`, `uniqueKey = tehranDate`.
- Profile completion → `idempotency_key = profile-completed:{userId}`.
- Purchase → `idempotency_key = purchase:{subscriptionId}`.

This makes refresh farming, multi-tab farming, duplicate purchase events, and
repeated profile completion all no-ops after the first successful award.

## Business Timezone (Spec Task 17)

Timestamps are stored in UTC. The "reward day" is derived in `Asia/Tehran` via
`tehranDateString()` (Intl `en-CA` formatToParts), so "once per calendar day"
follows the Iranian business day.

## Trigger Points

- **Profile completed** — `PATCH /api/v1/me/profile`: when `completionPercent >= 100`,
  `claimProfileCompletedReward(userId)` fires (idempotent; not re-awarded on later edits).
- **Purchase** — `POST /api/v1/checkout/intents`: after `createSubscription` succeeds,
  `claimPurchaseReward(userId, planCode, subscription.id)` fires, using the subscription id
  as the idempotency key (a duplicate checkout never double-awards).
- **Daily visit** — `POST /api/v1/rewards/daily-visit/claim` (and auto-claimed once on
  authenticated app entry via `DailyVisitToast`).

## Future Referral (Spec Task 17)

`REFERRAL_COMPLETED` is fully configured but `enabled: false`. No fake referral
success path exists.

## Future Redemption (Spec Tasks 19, 30–31)

- No conversion rate is invented (spec forbids it).
- Architecture supports a future `RewardRedemption` and compensating ledger entries
  (e.g. a refund as a negative `points_delta`), without deleting historical entries.
- UI shows a «به‌زودی» teaser with no functional purchase button.
