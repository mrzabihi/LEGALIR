# LEGALIR — Subscription Platform: API, Migration & QA

> Companion to `TARGET_SUBSCRIPTION_ARCHITECTURE.md` (the design) and
> `CURRENT_ARCHITECTURE.md` (the as-is snapshot). This file records the **final,
> shipped** contracts, the **migration** that preserves existing data, and the
> **QA evidence** that the reported defect is fixed.
>
> Snapshot: 2026-10-07. Storage: file-backed JSON DB
> (`apps/frontend/.data/<table>.json`) via `readTable`/`writeTable`
> (`apps/frontend/src/lib/db.ts`). No SQL, no transaction manager.

---

## 1. The reported defect, and the fix

**Symptom.** A Gold subscriber selects Diamond, pays successfully, and the plan
stays Gold.

**Root cause.** Two readers disagreed about "the active subscription":

- `resolveEntitlement` (the engine, `lib/usage/engine.ts`) enforced the **newest**
  `active` row with `end_at > now` — so a Diamond purchase was actually being
  enforced.
- `queryActiveSubscription` (`lib/db.ts`) returned the **first** `active` row it
  found, ignoring `end_at` and recency — so the UI kept rendering Gold.

The write path also activated a plan from a click, and never superseded the
previous row, so both rows stayed `active`.

**Fix (minimal, at the shared primitives).**

1. `queryActiveSubscription` now mirrors the engine exactly: newest `active` row
   with `end_at > now` (same sort as `resolveActiveSubscription`).
2. Activation runs through one module, `lib/subscription/lifecycle.ts`, which
   **supersedes every other `active` row** of the user on activation. A plan
   change is now a *replacement*, not an addition.
3. Activation is triggered only by a **confirmed payment** (`lib/payments.ts`),
   never by a click.

---

## 2. API contracts (final)

All responses are wrapped as `{ data: … }` unless noted. Auth is the
`legalir-session` cookie; a missing/invalid session returns `401`
`{ code, message, correlationId, retryable }`.

### 2.1 Checkout

| Route | Method | Request | Response | Notes |
|---|---|---|---|---|
| `/api/v1/checkout/intents` | POST | `{ planCode }` | `CheckoutIntent` | Creates a **pending** payment + **pending** subscription. Price is resolved **server-side** from the catalog; the client sends only a plan code. Reuses an existing pending intent for the same `(user, plan)` so a double-click is safe. |
| `/api/v1/checkout/intents/:id` | GET | — | `CheckoutIntent` | Reads the **persisted** payment. For the mock gateway, a pending intent is auto-confirmed here (mimicking the PSP callback), so a poll transitions `pending → paid`. |
| `/api/v1/checkout/intents/:id/confirm` | POST | — | `CheckoutIntent` | **The only activation path.** Idempotent: a replay returns the existing paid payment without a second grant. `404` if the payment is unknown or not owned by the session user. |

`CheckoutIntent.status ∈ { pending, paid, failed, cancelled, idle }`.

### 2.2 Subscription & energy (user)

| Route | Method | Response | Notes |
|---|---|---|---|
| `/api/v1/subscriptions/current` | GET | `{ data: SubscriptionView \| null }` | The one active subscription, via `queryActiveSubscription`. Runs the one-time reconciliation sweep (§3) before resolving. |
| `/api/v1/energy/ledger` | GET | `{ data: EnergyLedgerResponse }` | The unified, read-time projection: `entries[]` (with `balanceBefore`/`balanceAfter` per `source`) + `summary`. Never stored. |

### 2.3 Admin (per-user billing dossier)

Dispatcher: `apps/frontend/src/app/api/v1/admin/[[...segments]]/route.ts`.
Permission-gated via `permissionFor(method, segments)` and audited via
`recordAudit`.

| Route | Method | Permission | Body | Effect |
|---|---|---|---|---|
| `/api/v1/admin/users/:id/subscription` | GET | `admin:users:read` | — | `AdminUserSubscriptionView` (current plan, status, dates, days remaining, energy summary, history, payments, ledger capped at 100). |
| `/api/v1/admin/users/:id/subscription` | POST | `admin:users:manage` | `AdminSubscriptionActionInput` | `activate` / `change_plan` / `extend` / `deactivate`. All reuse the lifecycle module, so the one-active invariant cannot be bypassed. **`reason` required.** Audit action `subscription.admin.action`. |
| `/api/v1/admin/users/:id/energy` | GET | `admin:energy:read` | — | Usage summary: today's subscription credit + period quotas + reward balance (`getUsageSummary`). |
| `/api/v1/admin/users/:id/energy` | POST | `admin:energy:manage` | `AdminEnergyActionInput` | Grant (`amount > 0`) or adjust (`amount < 0`) the reward asset. Writes `reward_ledger` (`ADMIN_GRANT` / `ADMIN_ADJUSTMENT`); refuses to drive the balance below zero. **`reason` required.** Audit action `energy.admin.adjust`. |

Permissions follow `permissionFor(method, segments)`: the `users` segment resolves
to `admin:users:read`/`admin:users:manage`, except `users/:id/energy`, which
resolves to `admin:energy:read`/`admin:energy:manage`. All four are granted in
`ROLE_PERMISSIONS`.

Error codes map through `lib/admin/http.ts` (`PLAN_REQUIRED`, `NO_ACTIVE_SUBSCRIPTION`,
`INVALID_DAYS`, `INSUFFICIENT_BALANCE`, `UNKNOWN_ACTION`, `REASON_REQUIRED`,
`USER_NOT_FOUND`, `LAST_SUPERADMIN`, …).

---

## 3. Migration (data preserved)

**New tables:** `payments` only. **No field is removed.**
**Additive subscription fields:** `payment_id`, `superseded_at`, `updated_at`.
Legacy rows without them read as `payment_id: null`.

### 3.1 Reconciliation sweep (the `active`-duplicate fix)

Legacy stores can hold:

- (a) `active` rows whose `end_at` has passed, and
- (b) more than one `active` row for a user (the reported Gold+Diamond case).

`reconcileSubscriptionStatuses(now?)` (`lib/subscription/lifecycle.ts`) normalises
both **without deleting anything**:

- (a) `active` + `end_at ≤ now` → `expired`.
- (b) more than one `active` per user → newest kept, the rest → `superseded`
  (+ `superseded_at`).

It is **idempotent** and writes **only when a row actually changes**, so it is
safe on a read path. It runs once per process from
`/api/v1/subscriptions/current` (the canonical read) — the concrete realisation
of the "one-time sweep" described in `TARGET_SUBSCRIPTION_ARCHITECTURE.md §8`
(named there `migrateSubscriptionStatuses`). The load-bearing guarantee remains
`queryActiveSubscription` choosing the newest active row; the sweep only tidies
persisted status/history.

### 3.2 Post-migration invariant

For every user, `count(status = "active" AND end_at > now) ≤ 1`.
This is asserted by `subscription-lifecycle.test.ts › reconcileSubscriptionStatuses`.

---

## 4. QA evidence

### 4.1 Unit / integration (Vitest)

Run:

```bash
cd apps/frontend
npx vitest run src/lib/__tests__/subscription-lifecycle.test.ts \
                 src/lib/__tests__/payments.test.ts \
                 src/lib/__tests__/energy-ledger.test.ts \
                 src/lib/__tests__/admin-subscription.test.ts
```

Expected: **47 passed**.

| Suite | Protects |
|---|---|
| `subscription-lifecycle.test.ts` | create grants nothing; activate sets the term from the activation instant; **activate supersedes the previous active row** (the reported bug); cancel/expire/extend are terminal-safe; `resolveActiveSubscription` returns the newest active row and ignores past-term rows; reconciliation sweep expires + supersedes and is idempotent. |
| `payments.test.ts` | intent creates pending only (no reward/activity); confirm activates once and records exactly one reward + one activity; **replayed confirm is a no-op**; cross-user confirm is rejected; Gold → Diamond replacement end-to-end; failed payment is terminal and grants nothing; `listPayments` ordering + traceability. |
| `energy-ledger.test.ts` | per-`source` running balances; the two assets stay separate (§19); `REQUEST_CONSUMED` reward rows are skipped while the balance still counts them; `FAILED` usage is excluded; summary reconciles daily credit + reward balance. |
| `admin-subscription.test.ts` | view falls back to free (never an error); actions require a reason and respect the one-active invariant; `change_plan` supersedes; extend requires an active plan and positive days; energy grant/adjust write the right ledger event and cannot go negative; audit records the route identifiers and redacts secrets. |

### 4.2 End-to-end (Playwright, live dev server)

Run:

```bash
cd apps/frontend
npx playwright test e2e/subscription-checkout.spec.ts
```

Expected: **2 passed**.

| Test | Protects |
|---|---|
| `select → pay → the plan becomes active without a manual refresh` | The §7/§32 flow: choose a plan → confirm → the mock gateway settles while polling → the current-plan card shows an active plan **without a reload** (§34). Drives the real `POST /checkout/intents`, the mock auto-confirm on `GET /checkout/intents/:id`, and the page's `useEffect` refresh. |
| `the active subscription survives a reload` | The activation was persisted, not just held in client state. |

### 4.3 Full-suite status

- **Full frontend Vitest run:** the only persistent failure is the
  **known pre-existing** `usage-engine.test.ts` date-bomb (12 tests) — documented
  in project memory and unrelated to this work. Everything else is green; a
  `subscription-page.test.tsx` failure seen under a fully-parallel run passes
  17/17 in isolation (worker/parallelism flakiness).
- **Typecheck:** `npx tsc --noEmit` is clean.
- **Regression guard:** `queryActiveSubscription` (the root-cause fix) is exercised
  by the engine suites and the subscription-page component test.

---

## 5. Security posture (§45)

- The client sends only a `planCode`; **price and duration are resolved
  server-side** from the catalog. No client can set a price.
- A subscription is never activated by a click, only by `confirmPayment`, which
  guards `payment.userId === session userId`.
- Admin mutations require the mapped permission and write an audit row on the
  same synchronous pass (`subscription.admin.action` / `energy.admin.adjust`).
- The last platform super-admin cannot be demoted (server-enforced).
- All state transitions are idempotent, so replayed success callbacks are no-ops.
