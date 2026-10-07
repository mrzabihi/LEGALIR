# TARGET_SUBSCRIPTION_ARCHITECTURE.md

> The design contract for the Subscription & Entitlement platform. It builds on
> the existing engine (`lib/usage/*`, `reward_ledger`, `admin_audit_log`) and
> changes as little as possible while fixing the lifecycle defect and closing the
> extension gaps. See `CURRENT_ARCHITECTURE.md` for the as-is state.

---

## 0. Design principles (locked)

1. **One active subscription per user, at any instant.** Enforced structurally:
   `queryActiveSubscription` = newest `active` row with `end_at > now`.
2. **Payment success is the source of truth.** The plan is never switched from a
   click; only a verified payment activates a subscription.
3. **Idempotent activation.** A repeated success creates one subscription, one
   energy grant, one entitlement, one payment row.
4. **History is never deleted.** Old subscriptions move to a terminal status.
5. **Subscription energy ≠ reward energy.** Separate counters, separate ledgers,
   one unified read-time projection.
6. **Plans are templates; subscriptions are instances.** A live subscription holds
   a frozen snapshot; editing a plan never retro-changes a live subscription.
7. **Admin mutations are audited and permission-gated.**
8. **Idempotency over transactions.** The JSON store has no transactions, so
   correctness relies on write-ordering + idempotency keys + idempotent replays.

---

## 1. Domain model

```
User ──1:N── Subscription ──N:1── SubscriptionPlan (catalog template)
  │               │
  │               ├─ planSnapshot : PlanEntitlementSnapshot   (frozen)
  │               └─ paymentId    : string | null              (the payment that activated it)
  ├──1:N── Payment ──0:1── Subscription   (traceable both ways)
  ├──1:N── Entitlement counters            (daily credit + period quotas, from the engine)
  └──1:N── EnergyLedger (projection)       (subscription grant + reward ledger + usage tx)
```

- **SubscriptionPlan** — `packages/types.SubscriptionPlan` (catalog row, unchanged).
- **Subscription** — `StoredSubscription` gains `payment_id?`, `superseded_at?`,
  `updated_at?` and the wider status enum. All existing fields are kept.
- **Payment** — NEW table `payments`, type `Payment`
  (`packages/types/src/subscription.ts`).
- **EnergyLedgerEntry** — NEW derived type (`packages/types/src/subscription.ts`),
  never stored; computed on read from the three real sources.

### Status enum (extended)
```ts
type SubscriptionStatus =
  | "pending"      // created, awaiting payment confirmation
  | "active"       // paid & current
  | "expired"      // end_at passed
  | "cancelled"    // cancelled before term
  | "superseded";  // replaced by a newer subscription
```
`paused` is deliberately **not** added (no requirement yet). The status-fa label
map is extended accordingly.

---

## 2. State machine

```
            create (checkout)          confirm (payment success)
 (none) ─────────────────▶ pending ───────────────────────────▶ active
                             │                                     │
              payment failed │                          end_at<now │  new active sub
              / cancelled    ▼                                     ▼            │
                        cancelled                              expired     (this row)
                        (no grant)                                 │            │
                                                                   └──────┬─────┘
                                                                          ▼
                                                                    superseded / expired
```

Allowed transitions (only these are written):
- `pending → active`   on verified payment (idempotent).
- `pending → cancelled` on failed/cancelled payment.
- `active → expired`   on read when `end_at < now` (lazy) + activation-time sweep.
- `active → superseded` when a newer subscription activates.
- `active → cancelled` on explicit cancel / refund (future).
- Any terminal status never leaves terminal; a new purchase creates a new row
  (history preserved).

---

## 3. Payment flow (mock == real shape)

```
POST /api/v1/checkout/intents { planCode }        → server prices from CATALOG
   1. resolve session user
   2. plan = getPlanByCode(planCode)              (client never sends a price)
   3. reuse an existing PENDING payment for (user, plan) or create one
   4. create Subscription { status: pending, expiresAt: null, snapshot }
   5. persist Payment { status: pending, idempotencyKey, subscriptionId }
   6. return intent { id, paymentUrl: mockGatewayUrl(id), status: "pending" }
        ↓ (user "pays" on the mock gateway)
POST /api/v1/checkout/intents/:id/confirm         → the ONLY activation path
   activateSubscriptionFromPayment(paymentId, { userId, method })
      BEGIN (emulated, write-ordered)
        1. load Payment; if already SUCCESS → return existing (idempotent replay)
        2. guard: payment.userId === session user (403 otherwise)
        3. mark payment SUCCESS (+ transactionId, paidAt)
        4. resolve latest PENDING subscription for this payment
        5. supersede every other `active` subscription of the user
        6. ACTIVATE: status=active, start_at=now, end_at=now+duration
        7. snapshot entitlements (already frozen on the pending row)
        8. grant initial subscription energy / reset daily bucket for the new id
        9. reward: claimPurchaseReward (idempotent by subscription id)
       10. recordActivity + audit + log
      COMMIT
   GET /api/v1/checkout/intents/:id               → reads the PERSISTED payment
```

`verifyPayment` is a seam: the mock gateway always verifies; a real PSP would
verify server-side with the gateway's callback signature. The route shape and the
idempotency key do not change.

**Prices come only from the server catalog.** A plan id alone never sets a price.

---

## 4. Entitlement model

- **Template:** `SubscriptionPlan` (catalog).
- **Frozen instance:** `PlanEntitlementSnapshot` on the subscription row.
- **Live counters:** `subscription_daily_usage` (daily credit) +
  `subscription_period_usage` (period quotas) — owned by the engine, keyed by
  `subscriptionId`, so a new subscription automatically starts fresh counters.
- **Free fallback:** `FREE_TIER_SNAPSHOT` — a user is **never** without a valid
  entitlement (Option B: free is a fallback state, not a catalog plan).

The engine's `resolveEntitlement` already does the right thing (newest active,
checks `end_at`). We keep it and make every other reader agree with it.

---

## 5. Energy ledger

Two real sources, one projection:

| Source | Table | Nature |
|---|---|---|
| Subscription grant | derived from `subscriptions` (a grant at `start_at`) | bounded by the subscription |
| Reward points | `reward_ledger` | persistent |
| Consumption | `usage_transactions` | the spend log |

`getEnergyLedger(userId)` (`lib/energy/ledger.ts`) merges these into
`EnergyLedgerEntry[]` sorted by `createdAt`, computing `balanceBefore`/`balanceAfter`
along the way:

```ts
type EnergyTransactionType =
  | "SUBSCRIPTION_GRANT" | "DAILY_REWARD" | "REFERRAL_REWARD" | "CAMPAIGN_REWARD"
  | "ADMIN_GRANT" | "PURCHASE" | "USAGE" | "REFUND" | "EXPIRATION" | "ADJUSTMENT";

interface EnergyLedgerEntry {
  id: string; userId: string;
  type: EnergyTransactionType;
  amount: number;                       // +grant / -spend
  balanceBefore: number; balanceAfter: number;
  source: "SUBSCRIPTION" | "REWARD";    // which asset
  referenceId: string | null;
  referenceType: string | null;
  subscriptionId: string | null;
  description: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}
```

- **FEFO:** the two assets carry different lifetimes (daily credit resets at Tehran
  midnight; reward points are persistent). The engine already consumes the
  soonest-expiring asset first (daily before reward). Documented, not rewritten.
- **No new store.** The projection is read-time, exactly like the existing
  `lib/usage/energy.ts` admin ledger. This avoids a second source of truth.

---

## 6. Admin architecture

Reuse the single dispatcher (`admin/[[...segments]]/route.ts`), `requirePermission`,
`recordAudit`, and `ADMIN_NAV`. New nested routes:

| Route | Method | Permission | Effect |
|---|---|---|---|
| `/api/v1/admin/users/:id/subscription` | GET | `admin:users:read` | current plan, status, dates, remaining days, energy/quota summary, history, payments, ledger |
| `/api/v1/admin/users/:id/energy` | POST | `admin:energy:manage` | grant / adjust energy (reward asset) with **reason**, audited |
| `/api/v1/admin/users/:id/subscription` | POST | `admin:subscription:manage` | activate / extend / deactivate / change-plan, audited |

Add permissions to `packages/types/src/platform.ts` (ROLE_PERMISSIONS) and the
catalog, then map them in `permissionFor`. **No admin route bypasses
`recordAudit`.** Energy grants write to `reward_ledger` (real balance) via
`grantReward`/`spendRewardPoints`; subscription changes reuse the lifecycle module.

---

## 7. API contracts (final)

| Route | Method | Notes |
|---|---|---|
| `/api/v1/plans` | GET | unchanged |
| `/api/v1/subscriptions/current` | GET | now via `resolveEntitlement`-consistent read; null when none |
| `/api/v1/subscription-history` | GET | unchanged shape; status gains `superseded` |
| `/api/v1/checkout/intents` | POST | creates **pending** payment + **pending** subscription |
| `/api/v1/checkout/intents/:id` | GET | reads persisted payment |
| `/api/v1/checkout/intents/:id/confirm` | POST | **the only activation path** |
| `/api/v1/energy/ledger` | GET | the user's unified energy ledger |
| `/api/v1/admin/users/:id/subscription` | GET/POST | admin view + actions |
| `/api/v1/admin/users/:id/energy` | POST | admin grant/adjust |

---

## 8. Migration strategy (data preserved)

- **New tables only:** `payments`. No field is removed.
- **Additive subscription fields:** `payment_id`, `superseded_at`, `updated_at`.
  Legacy rows without them read as `payment_id: null`.
- **Existing `active` duplicates** (e.g. the seeded Gold+Diamond case): a lazy
  reconciliation — `resolveActiveSubscription` picks the newest and the read path
  marks older `active` rows `superseded`. The shipped one-time sweep is
  `reconcileSubscriptionStatuses()` (in `lib/subscription/lifecycle.ts`), run once
  per process from `GET /api/v1/subscriptions/current`; it is idempotent and
  writes only when a row actually changes. See `SUBSCRIPTION_PLATFORM_API_AND_QA.md §3`.
- **Existing energy balances** are untouched (`reward_ledger` unchanged).
- **Integrity check:** after migration, `count(active) ≤ 1` per user.

---

## 9. Security

- Plan price is resolved server-side; the client sends only `planCode`.
- Confirm requires a session whose `userId` owns the payment (else 403).
- A user cannot activate, extend, or supersede from the frontend.
- Energy can only be increased by the engine (subscription grant / reward rule) or
  by an audited, permission-gated admin action.
- Admin actions require the mapped permission; every mutation is audited.
- Idempotency keys make replay attacks no-ops.

---

## 10. Testing strategy

- **Unit:** lifecycle (create/activate/supersede/expire/cancel), idempotent
  activation, energy-ledger projection (balance before/after, sources), admin
  actions + audit.
- **Integration (route-level):** checkout pending→confirm→active; duplicate
  confirm; failed payment leaves the prior plan active; switching plans updates
  `/subscriptions/current`.
- **Acceptance scenarios 1-6** (from the brief) as explicit tests.
- **Frontend:** subscription page updates current plan/energy after confirm.
- Existing suites must stay green (except the known pre-existing date-bomb in
  `usage-engine.test.ts`).

---

## 11. What this unlocks without a rewrite

Monthly/annual plans = `durationDays` (data). Coupons/discounts = a payment
pre-step. Trial = a zero-price payment. Renewal/auto-renew = `auto_renew` + a
scheduled lifecycle job. Scheduled downgrade = a future-dated subscription row.
Refund = `payment → reverse` reusing `reverseUsage`. Gift/promo energy = new
`EnergyTransactionType`s. Add-ons = additional entitlement rows beside the base
subscription. None require changing the state machine or the activation path.
