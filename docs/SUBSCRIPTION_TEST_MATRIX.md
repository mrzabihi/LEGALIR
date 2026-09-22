# LEGALIR — Subscription & Usage Test Matrix

> What is verified, by which test, and what each test protects. The engine
> tests live in `apps/frontend/src/lib/__tests__/usage-engine.test.ts`.

---

## 1. Plan matrix

| # | Case | Expected | Test |
|---|---|---|---|
| 1.1 | Silver numbers | 50 req/day · 3M tokens · 3,000 msgs · 5 docs · 3 drafts · 3 contracts · 31 days | `plan matrix › seeds the three plans…` |
| 1.2 | Gold numbers | 150 · 4.5M · 4,500 · 15 · 10 · 10 | same |
| 1.3 | Diamond numbers | 300 · 9M · 9,000 · 50 · 30 · 30 | same |
| 1.4 | Daily points derived | Silver 5,000 · Gold 15,000 · Diamond 30,000 | `plan matrix › derives daily points…` |

---

## 2. Daily credit

| # | Case | Expected | Test |
|---|---|---|---|
| 2.1 | Fresh day | `pointsTotal` = plan's full daily points, `pointsUsed` = 0 | `daily credit › starts at the plan's full daily points` |
| 2.2 | One AI message | −100 points, −1 request | `daily credit › debits points and one request per AI message` |
| 2.3 | Midnight rollover | New bucket at full; old bucket preserved | `daily credit › resets at Tehran midnight and does NOT carry over` |
| 2.4 | Request allowance spent | 51st request blocked with `DAILY_REQUEST_LIMIT_EXCEEDED` | `daily credit › blocks when the daily request allowance is exhausted` |

---

## 3. Reward points (the separate asset)

| # | Case | Expected | Test |
|---|---|---|---|
| 3.1 | Survives the rollover | Balance unchanged across midnight | `reward points › are NOT reset by the daily rollover` |
| 3.2 | Not spent while credit remains | Balance unchanged after a covered activity | `reward points › are not spent while the daily credit still covers…` |
| 3.3 | Fallback disabled (default) | Blocked with `DAILY_REQUEST_LIMIT_EXCEEDED` | `reward points › are only used after the daily credit…` |
| 3.4 | Fallback enabled | `creditSource: "REWARD"`, balance −100 | same |

---

## 4. Service quotas (separate from daily credit)

| # | Case | Expected | Test |
|---|---|---|---|
| 4.1 | Doc quota spent, credit left | Blocked with `DOCUMENT_ANALYSIS_LIMIT_EXCEEDED`; `requestsRemaining > 0` | `service quotas › blocks document analysis once the period quota…` |
| 4.2 | Quota does not reset daily | `used` unchanged after midnight | `service quotas › does NOT reset the period quota at midnight` |
| 4.3 | Contract quota | 4th contract blocked with `CONTRACT_LIMIT_EXCEEDED` | `service quotas › enforces the contract creation quota` |

---

## 5. Idempotency

| # | Case | Expected | Test |
|---|---|---|---|
| 5.1 | Repeated key | Same transaction id, charged once | `idempotency › never double-charges on a repeated idempotency key` |

---

## 6. Reverse & complete

| # | Case | Expected | Test |
|---|---|---|---|
| 6.1 | Reverse | Daily credit, request count and period quota all refunded | `reverse › refunds the daily credit and the period quota` |
| 6.2 | Complete with tokens | Period token quota += real usage | `reverse › records real token usage on completion` |

---

## 7. Expiry & free tier

| # | Case | Expected | Test |
|---|---|---|---|
| 7.1 | Lapsed subscription | `hasSubscription: false`, `subscriptionExpired: true`, free-tier 10 req/day | `expiry › grants no plan quota once the subscription has lapsed` |
| 7.2 | No subscription | `hasSubscription: false`, `planCode: null` | `expiry › reports no subscription for a user with none` |
| 7.3 | Credit source | `creditSource: "SUBSCRIPTION"` | `expiry › checkEntitlement reports the resolved credit source` |

---

## 8. Concurrency

The engine's read-modify-write is fully synchronous — there is no `await`
inside a critical section. Node's single-threaded event loop therefore
serializes concurrent requests, so two simultaneous reservations cannot both
pass the same check. This is a structural guarantee rather than a test: the
absence of `await` in `reserveUsage` / `completeUsage` / `reverseUsage` is the
invariant. Any future change that introduces an `await` between the check and
the debit would break it and must be reviewed.

---

## 9. Running the tests

```bash
cd apps/frontend
npx vitest run src/lib/__tests__/usage-engine.test.ts
```

Expected: **18 passed**.

---

## 10. UI surfaces that read the engine

Every surface below reads `GET /api/v1/subscription/usage` — there is no
parallel computation and no hard-coded number.

| Surface | File | Shows |
|---|---|---|
| Dashboard card | `components/dashboard/subscription-usage-card.tsx` | اعتبار امروز اشتراک · امتیازهای شما · سهمیه‌های دوره |
| Usage & history page | `app/(app)/settings/usage/page.tsx` | The same two assets, the period quotas and the usage-transaction ledger |
| Quota-exhausted modal | `features/quota-exhausted/QuotaExhaustedModal.tsx` | Switches copy on the engine's `UsageErrorCode`; shows both assets |
| Pricing | `app/(public)/pricing/PricingClient.tsx` | Plan numbers from `GET /api/v1/plans` (the catalog) |
| Chat sidebar quota | `GET /api/v1/quota` → `dailyRequestAllowance` | Reads `subscription_plans.dailyRequestLimit` — never a hard-coded copy |

