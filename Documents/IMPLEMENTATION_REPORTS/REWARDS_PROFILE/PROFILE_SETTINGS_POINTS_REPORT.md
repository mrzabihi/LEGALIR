# Profile, Settings & Points System — Production-Ready Implementation Report

**Date:** 2026-09-16
**Branch:** `feature/legalir-v0.3-rewards-profile`
**Scope:** Profile, Settings, Points System — Frontend + Backend + DB Model + API + Validation + Authorization + Routing + UX

---

## 1. Executive Summary

The Profile, Settings and Points surfaces were rebuilt as an integrated whole rather than a UI-only pass. The monolithic 1404-line `/settings` page was split into a navigation-only hub plus seven dedicated sub-pages, each owning its own data source. The Points system was promoted from a display-only balance to a real ledger with derived aggregates. Account identity (mobile) is now immutable end-to-end, and the account-type transition is one-way and backend-enforced.

No mock data, hard-coded balances, fake sessions, fake notification settings or placeholder routes were used in the production output.

### Quality gates

| Gate | Result |
|------|--------|
| TypeScript (`tsc --noEmit`) | PASS (2 pre-existing unrelated errors in `legal-corpus.test.ts`) |
| Unit tests (Vitest) | PASS — 591/591 across 35 files |
| E2E tests (Playwright) | PASS — 18/18 new spec (`profile-settings-points.spec.ts`) |

---

## 2. Profile — Summary + Details

`src/app/(app)/profile/page.tsx`

- **Profile Summary** (hero): avatar initial, display name, mobile, account type badge, completion status. Answers the four questions in seconds — who is signed in, what the primary account number is, what the account type is, and whether the profile is complete.
- **Account identity section** («هویت حساب»): mobile shown read-only with the explicit explanation «این شماره هنگام ثبت‌نام حساب ثبت شده و قابل تغییر نیست.» plus the account-type row and the conversion entry point.
- **Profile Details** (collapsible): every pre-existing editable field retained — name, family name, email, gender, birth date, city, occupation, user type, province, legal interests, primary use case. Nothing was removed.
- **Breadcrumb**: داشبورد → پروفایل.

---

## 3. Mobile Immutability

- `DbUser.mobile` is the account identity and is never exposed as an editable field.
- The profile PATCH route (`src/app/api/v1/me/profile/route.ts`) forwards only a fixed `knownFields` allow-list that deliberately excludes `mobile`, so a crafted request body cannot mutate the identity.
- Covered by unit tests: `mobile immutability` describe block in `src/lib/__tests__/points-account.test.ts`.

---

## 4. Account Type — One-Way Transition

- New `accountType: "individual" | "legal"` field on the user record, kept separate from the existing `userType` profile field.
- `convertAccountToLegal(userId)` in `src/lib/db.ts` enforces the rule in the backend: `individual → legal` succeeds once; `legal → individual` returns `{ ok: false, reason: "already_legal" }`.
- API: `POST /api/v1/profile/convert-to-legal` returns `409 ACCOUNT_TYPE_LOCKED` for a legal account — a direct API call cannot bypass the UI.
- UI: a confirmation dialog precedes conversion; once legal, the conversion control is replaced by an explanatory lock note.
- Legacy rows without the field default to `individual` (`getAccountType`).

---

## 5. Profile Completion

- Computed from real business-logic fields via `computeProfileCompletion` (`src/lib/profile-completion.ts`) — 5 basic fields at 10% each (50%) + 4 extended fields at 12.5% each (50%) = 100%.
- Recalculated on every profile write inside `upsertProfile` → `recomputeProfile`; never hard-coded.
- Reaching 100% awards the `PROFILE_COMPLETED` reward (1000 points), idempotent via the ledger key `profile-completed:${userId}`.

---

## 6. Points as a Real Ledger

- `reward_ledger` is authoritative: **balance = SUM(points_delta)**. Balance is never stored separately, so it cannot drift from the transactions that produced it.
- `getPointsAccount(userId)` derives `{ balance, lifetimeEarned, lifetimeSpent, transactionCount }`.
- `canSpendPoints(userId, amount)` gates future redemption.
- **Soft floor**: `spendEnergy` refuses a spend that would cross below zero, writes no ledger row, and still lets the request proceed (the daily quota remains the primary gate).
- **Idempotency**: `grantReward` checks `idempotency_key` and per-event uniqueness keys; `spendEnergy` keys on `energy:${sourceType}:${sourceId}` so a retried request is never charged twice.

### Points Engine surface

| Function | Location | Purpose |
|----------|----------|---------|
| `getPointsAccount` | `src/lib/db.ts` | balance + lifetime aggregates |
| `getRewardBalance` | `src/lib/db.ts` | live balance (SUM) |
| `grantReward` | `src/lib/db.ts` | credit (idempotent) |
| `spendEnergy` | `src/lib/db.ts` | debit (soft floor, idempotent) |
| `canSpendPoints` | `src/lib/db.ts` | redemption gate |
| `readRewardLedger` | `src/lib/db.ts` | transaction history |

---

## 7. Registration → Points Account

- `createUser` creates the user record; the points account exists implicitly because the ledger is the account. A newly registered user has a usable zeroed account (`balance: 0`, `transactionCount: 0`).
- Covered by the `integration: registration → points account` unit test.

---

## 8. Subscription → Points Reward

- `claimPurchaseReward(userId, planCode, purchaseId)` maps the plan to its configured event and credits the configured amount (silver 850, gold 1000, diamond 1500; free grants nothing).
- Idempotent by `purchase:${purchaseId}` — the same purchase can never be rewarded twice.
- Covered by the `integration: subscription → reward` unit tests.

---

## 9. Usage → Points Deduction

- Every processed request costs 200 energy via `spendEnergy`, written to the same ledger as awards so the balance stays a single SUM.
- Covered by the `integration: usage → deduction` unit tests.

---

## 10. Source of Truth — Shared Across Surfaces

The header badge, the dashboard points card and the `/points` page all read the same backend source:

- Header badge (`src/components/app/top-bar.tsx`) → `useRewardsSummary()` → `GET /api/v1/rewards/summary`
- Dashboard card (`src/components/dashboard/points-summary-card.tsx`) → `useRewardsSummary()`
- `/points` page → `usePointsAccount()` → `GET /api/v1/points` (falls back to the summary balance)

No parallel fetch and no hard-coded value anywhere.

---

## 11. Settings — Hub + Dedicated Sub-Pages

`src/app/(app)/settings/page.tsx` is now **navigation-only**. Each card routes to a page that owns its own data source, so a card can no longer open the wrong section.

| Sub-route | Data source |
|-----------|-------------|
| `/settings/notifications` | `GET/PATCH /api/v1/settings/notifications` |
| `/settings/privacy` | `GET/PATCH /api/v1/settings/privacy` |
| `/settings/security` | `GET /api/v1/settings/sessions`, `DELETE /api/v1/settings/sessions[/:id]` |
| `/settings/usage` | `useSubscriptionHistory`, `useProfileUsage`, `useDailyQuota` |
| `/settings/memory` | `useMemories` / `useCreateMemory` / `useDeleteMemory` |
| `/settings/data` | export/delete-history (disabled, «به‌زودی») |
| `/settings/account` | `DELETE /api/v1/account` |

### Routing bugs fixed

- «قوانین استفاده» now points to `/terms` (was `/support`).
- «اعلان‌ها» and «حریم خصوصی» now open their own pages — they no longer open usage history.
- Usage history lives only on `/settings/usage`.

---

## 12. Sessions & Security — Real Data

- `GET /api/v1/settings/sessions` returns the caller's own sessions with real device/browser labels parsed from the stored user-agent (`parseUserAgent`), real `lastActiveAt`, real IP, and a `current` flag for the requesting session.
- `DELETE /api/v1/settings/sessions/:id` revokes one session; ownership is enforced in the DB layer — a foreign session id returns 404, never 403, so the endpoint does not leak existence.
- `DELETE /api/v1/settings/sessions` revokes every session except the current one.
- The page honestly states that login is OTP-only, so there is no password to change. No fake session data is generated.

---

## 13. Public Routes

- `/terms` and `/privacy-policy` implemented as real content pages with metadata and the AI disclaimer.
- `/about`, `/support`, `/blog`, `/terms`, `/privacy-policy` registered in `src/lib/routes.ts` and allowed through `src/middleware.ts` `PUBLIC_PREFIXES`.
- Footer legal links corrected to `/terms`, `/privacy-policy`, `/contact`.
- Register page privacy link corrected from `/privacy` to `/privacy-policy`.

---

## 14. Breadcrumbs

`src/components/shared/Breadcrumb.tsx` — RTL-correct trail; the last item is `aria-current="page"` and not a link; chevrons are decorative and flipped for RTL. Present on `/profile`, `/settings`, every `/settings/*` sub-page and `/points`.

---

## 15. Validation

- **Client**: register page validates mobile (normalized), password length bounds, confirmation match and terms acceptance, with per-field touched/error state.
- **Server**: register route re-validates mobile format, password length (6–128) and duplicate mobile; settings routes accept only known boolean keys; the profile route accepts only the allow-listed fields.

---

## 16. Authorization

- Every user-account endpoint requires authentication and resolves `userId` from the session cookie (`getUserIdFromRequest` / `getAuthFromRequest` in `src/lib/api/server-auth.ts`); unauthenticated calls return 401.
- Sessions are scoped per user; account deletion and conversion operate only on the session's own user.
- `DELETE /api/v1/account` clears the session cookie on success.

---

## 17. Tests

### Unit / integration — `src/lib/__tests__/points-account.test.ts` (20 tests)

- Points account aggregates (zeroed account, `balance = earned − spent`, per-user scoping)
- Idempotency (grant by key, spend by source)
- Soft floor (refused spend writes no row; `canSpendPoints` gate)
- Account-type transition (default individual, one-way conversion, `already_legal`, `not_found`, legacy rows)
- Mobile immutability (allow-list excludes mobile; identity stable across writes)
- Integration: registration → account, subscription → reward, usage → deduction

### E2E — `e2e/profile-settings-points.spec.ts` (18 tests)

- Profile: identity summary + immutable mobile + account type, collapsible details, breadcrumb
- Settings hub: lists every sub-route; each sub-route renders its own page with a breadcrumb
- Regression: notifications/privacy pages do NOT show usage history
- Points: balance + lifetime aggregates + ledger history, breadcrumb
- Navigation: profile settings cards route correctly; terms link → `/terms`; public legal pages reachable without a session

### Updated existing tests

- `src/app/__tests__/phase11-profile-settings.test.tsx` — rewritten for the hub + collapsible details
- `src/app/__tests__/public-navigation.test.tsx` — footer legal links updated

---

## 18. Migration / Backfill

- **Non-destructive.** No table was dropped or rewritten.
- `accountType` is optional on `DbUser`; `getAccountType` defaults missing values to `"individual"`, so existing users are preserved without a data migration.
- The points account requires no backfill: it is derived from `reward_ledger`, which already existed. Existing users simply have a zeroed account until they earn.
- `createUser` now writes `accountType: "individual"` for new rows; the demo seed does the same.

---

## Files Added / Changed

**Added**
- `src/app/(app)/settings/{notifications,privacy,security,usage,memory,data,account}/page.tsx`
- `src/components/settings/settings-shell.tsx`, `src/components/settings/settings-ui.tsx`
- `src/components/shared/Breadcrumb.tsx`
- `src/components/dashboard/points-summary-card.tsx`
- `src/app/(public)/terms/page.tsx`, `src/app/(public)/privacy-policy/page.tsx`
- `src/app/api/v1/points/route.ts`, `src/app/api/v1/points/transactions/route.ts`
- `src/app/api/v1/settings/{notifications,privacy,sessions}/route.ts`, `src/app/api/v1/settings/sessions/[id]/route.ts`
- `src/app/api/v1/account/route.ts`
- `src/app/api/v1/profile/convert-to-legal/route.ts`
- `src/lib/account-deletion.ts`, `src/lib/user-agent.ts`
- `src/lib/__tests__/points-account.test.ts`
- `e2e/profile-settings-points.spec.ts`

**Changed**
- `src/app/(app)/profile/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/points/page.tsx`
- `src/lib/db.ts` (accountType, points aggregates, soft-floor spend, session metadata)
- `src/lib/routes.ts`, `src/middleware.ts`, `src/components/public/Footer.tsx`
- `src/app/(auth)/auth/register/page.tsx`, `src/app/api/auth/register/route.ts`
- `src/lib/api/server-auth.ts`, `src/lib/api/v1.ts`, `src/hooks/useAccount.ts`
- `packages/types/src/index.ts` (PointsAccount, PointsTransactionsResponse, NotificationSettings, PrivacySettings, SessionInfo)
