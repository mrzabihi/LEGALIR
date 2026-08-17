# LEGALIR — Database Changes (Rewards & Profile)

## Storage Model

The development database is a JSON-file store (`apps/frontend/.data/*.json`) accessed
through `readTable` / `writeTable` in `src/lib/db.ts`. No second database was
introduced (Spec Task 22).

## New Table: `reward_ledger.json`

| field | type | notes |
| --- | --- | --- |
| `id` | string (uuid) | primary |
| `user_id` | string | FK → users.id |
| `event_type` | string | `RewardEventType` |
| `points_delta` | number | +1000 / +100 / +850 / +1000 / +1500 |
| `source_type` | string | `system` \| `profile` \| `subscription` |
| `source_id` | string | correlation id |
| `idempotency_key` | string | unique per award |
| `description` | string | Persian label |
| `metadata` | object | e.g. `{ uniqueKey: "2026-08-16" }` |
| `created_at` | string | UTC ISO-8601 |

### Unique protections (logical, enforced in `grantReward`)
- Daily reward: `UNIQUE(user_id, event_type, metadata.uniqueKey)`
- Profile reward: `UNIQUE(user_id, event_type)`
- Purchase reward: `UNIQUE(idempotency_key)`

Because writes are read-modify-write inside a single synchronous `grantReward` call,
and the JSON store is a single writer per process, these hold under the product's
concurrent request profile.

## Profile schema extension (`profiles.json`)

`DbProfile` gained the extended profile fields (all nullable):

```
userType: string | null
province: string | null
legalInterests: string[] | null
primaryUseCase: string | null
```

`completionPercent` remains a persisted field but is now **recomputed on every read**
from `computeProfileCompletion` — the persisted value is only a cache.

## Seed (Spec Task 52)

The dev seed (`seedDevData`) now writes a `reward_ledger` entry that is mathematically
consistent with the seeded Gold subscription:

- `SUBSCRIPTION_GOLD_PURCHASED` → `points_delta = 1000`
- `idempotency_key = purchase:subhist-001` (matches `subscriptions` row `subhist-001`)

Balance = 1000 = `SUM(points_delta)`. No phantom balances are seeded.

## Migration Path

Empty DB → `seedDevData` (dev only) → app startup → profile + rewards fully persisted
across restarts (`writeTable` persists to `.data/`). No destructive migration is required.
