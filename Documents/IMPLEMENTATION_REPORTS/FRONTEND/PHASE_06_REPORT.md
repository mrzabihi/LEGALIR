# PHASE 06 — IMPLEMENTATION REPORT
## اشتراک، قیمت و Entitlement (Subscription, Pricing, Entitlement & Usage UI)

---

### 1. OBJECTIVE

Phase 6 delivers the complete subscription management, pricing, entitlement, and usage tracking system. The subscription model is Time-based + Feature-based + Usage-based, with three configurable mock plans (Ultra, Pro, Pro Max). Prices come from MSW mock handlers, all monetary values use Persian formatting, and the system implements full mock checkout with payment state management.

---

### 2. DELIVERABLES SUMMARY

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Prices come from MSW | PASS |
| 2 | Original price visually crossed out (line-through) | PASS |
| 3 | All monetary values use Persian formatting | PASS |
| 4 | Plans expose: Duration, Features, Usage limits, Current usage, Remaining quota | PASS |
| 5 | Entitlement checks in frontend application layer | PASS |
| 6 | Locked features show upgrade state | PASS |
| 7 | Frontend checks are UX only; Backend is final authority | PASS |
| 8 | Mock checkout implementation | PASS |
| 9 | Payment states: idle, creating, pending, paid, failed, cancelled | PASS |
| 10 | No real payment gateway integration | PASS |
| 11 | Feature comparison table | PASS |
| 12 | Current subscription card | PASS |
| 13 | Renewal and expiry states | PASS |
| 14 | Plan-selection confirmation dialog | PASS |
| 15 | Mobile comparison usable without wide table | PASS |
| 16 | Typed contracts for all 6 v1 endpoints | PASS |
| 17 | Tests for plan display, locked features, selection, checkout, usage limits | PASS |
| 18 | PHASE_06_REPORT.md | PASS |

---

### 3. API ENDPOINTS CREATED (v1 Phase 6)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/plans` | List all plans with pricing, features, usage limits |
| `GET` | `/api/v1/subscriptions/current` | Current subscription status (scenario: ?status=expired\|none) |
| `GET` | `/api/v1/entitlements` | Feature entitlements for current user (scenario: ?plan=ultra) |
| `GET` | `/api/v1/usage` | Usage counters, period, days remaining |
| `POST` | `/api/v1/checkout/intents` | Create a checkout/payment intent |
| `GET` | `/api/v1/checkout/intents/:id` | Poll checkout intent status (auto-resolves to paid) |

All endpoints have full MSW mock implementations with scenario query parameters.

---

### 4. PLAN CONFIGURATION

| Plan | Code | List Price | Sale Price | Discount | Daily Requests | Monthly Tokens |
|------|------|-----------|------------|----------|---------------|----------------|
| الترا (Ultra) | `ultra` | ۱٬۸۰۰٬۰۰۰ تومان | ۹۰۰٬۰۰۰ تومان | 50% | 5 | ۱٬۱۵۰٬۰۰۰ |
| پرو (Pro) | `pro` | ۴٬۵۰۰٬۰۰۰ تومان | ۲٬۰۰۰٬۰۰۰ تومان | 56% | 10 | ۱٬۳۰۰٬۰۰۰ |
| پرو مکس (Pro Max) | `pro_max` | ۱۱٬۰۰۰٬۰۰۰ تومان | ۳٬۰۰۰٬۰۰۰ تومان | 73% | 20 | ۱٬۶۰۰٬۰۰۰ |

All plans: 30-day duration.

---

### 5. NEW TYPE DEFINITIONS

Added to `@legalir/types`:

- `PlanCode` — updated to `"ultra" | "pro" | "pro_max"`
- `PlanUsageLimit` — feature key, name, period, limit per plan
- `PaymentStatus` — `"idle" | "creating" | "pending" | "paid" | "failed" | "cancelled"`
- `CheckoutIntent` — checkout intent with status, payment URL, metadata
- `V1Subscription` — subscription with auto-renew, cancelledAt fields
- `V1EntitlementsResponse` — entitlements + plan context
- `V1UsageResponse` — usage counters + period + days remaining
- `Plan.dailyRequestLimit`, `Plan.totalTokenLimit`, `Plan.usageLimits`

Added to `@legalir/validation`:

- `createCheckoutIntentSchema` — validates planCode for checkout

Added to `@legalir/testing`:

- `fixtureV1SubscriptionPro`, `fixtureV1SubscriptionExpired`
- `fixtureV1EntitlementsResponse`, `fixtureV1UsageResponse`
- `createCheckoutIntent()` factory function

---

### 6. ARCHITECTURE

#### 6.1 New Files Created

```
apps/frontend/src/
├── hooks/
│   └── useSubscription.ts               # React Query hooks for all Phase 6 endpoints
├── lib/
│   ├── entitlements.ts                  # Entitlement check utility (UX-only)
│   └── __tests__/
│       └── entitlements.test.ts         # 12 tests for entitlement checks
├── app/
│   └── __tests__/
│       └── subscription-page.test.tsx   # 17 tests for subscription page
```

#### 6.2 Files Modified

```
packages/
├── types/src/index.ts                   # Added PlanUsageLimit, PaymentStatus, CheckoutIntent,
│                                        #   V1Subscription, V1EntitlementsResponse, V1UsageResponse,
│                                        #   updated PlanCode, Plan fields, ApiEndpoints
├── testing/src/index.ts                 # Updated plans (name, price, codes, usage limits),
│                                        #   added V1 fixtures, checkout intent factory
├── validation/src/index.ts              # Added createCheckoutIntentSchema, updated PlanCode enum
└── config/src/index.ts                  # Updated planConfig with new plan names, codes, limits

apps/frontend/src/
├── app/(public)/pricing/PricingClient.tsx  # Rewritten: PlanCards with MSW v1, feature comparison table,
│                                           #   mobile-friendly comparison cards, loading/error/empty states
├── app/(app)/subscription/page.tsx         # Rewritten: current subscription card, usage meters,
│                                           #   plan selection grid, confirmation dialog, payment states,
│                                           #   renewal/expiry banners, auto-renewal status
├── lib/api/v1.ts                           # Added fetchPlans, fetchCurrentSubscription,
│                                           #   fetchEntitlements, fetchUsage, createCheckoutIntent,
│                                           #   getCheckoutIntent
├── mocks/handlers/index.ts                 # Added 6 v1 Phase 6 handlers + checkout intent store
├── components/dashboard/widgets.tsx        # Updated PLAN_LABELS for new plan codes
├── components/dashboard/__tests__/widgets.test.tsx  # Updated planCode from "professional" to "pro"
├── app/__tests__/public-pricing.test.tsx   # Updated to match new plan names/codes
└── app/__tests__/dashboard-page.test.tsx   # Updated plan name text to "پرو"
```

---

### 7. COMPONENT HIERARCHY

```
PricingClient (app/(public)/pricing/PricingClient.tsx)
├── Pricing Header
├── PlanCards (3 columns on tablet/desktop)
│   └── PlanCard
│       ├── Plan name, description
│       ├── Pricing (crossed-out original, sale price, discount badge, duration)
│       └── Features list + CTA link
└── FeatureComparisonTable
    ├── Mobile: Card-based comparison (one card per plan)
    ├── Tablet/Desktop: Matrix table with check/close icons
    └── Show more/less toggle

SubscriptionPage (app/(app)/subscription/page.tsx)
├── PaymentStatusBanner (idle → hidden, other states → visible)
├── CurrentSubscriptionCard
│   ├── Plan name + status badge (active/expired/cancelled)
│   ├── Days until expiry
│   ├── Auto-renewal status
│   ├── Expiry warning (3 days or less)
│   └── Expired/cancelled banner
├── UsageSummaryCard
│   ├── Non-boolean: UsageMeter (label, used/limit, progress bar, remaining)
│   └── Boolean features: Active/Inactive badges
├── Plan Selection Grid
│   └── PlanSelectionCard (3 columns)
│       ├── Plan details: name, description, pricing
│       ├── Usage limits summary
│       ├── Features list
│       └── Current plan badge OR action button
├── PlanConfirmDialog
│   └── ConfirmDialog (title, plan price, confirm/cancel)
└── Checkout Error State
```

---

### 8. ENTITLEMENT CHECK SYSTEM

File: `lib/entitlements.ts`

Core function: `checkFeature(featureKey, entitlements)` → `EntitlementCheckResult`

Returns:
- `allowed: boolean` — whether feature is available
- `reason: string` — Persian explanation for locked state
- `usageFraction: number | null` — 0–1 progress (null for boolean)
- `remaining: number | null` — remaining quota
- `suggestedUpgrade: "pro" | "pro_max" | null` — which plan to upgrade to

Additional exports:
- `checkFeatures()` — batch check multiple features
- `hasActiveSubscription()` — check if subscription is active
- `getUpgradePlanForFeature()` — map feature → upgrade plan tier

**Important:** These checks are UX-only. The backend remains the final authority for all entitlement enforcement.

---

### 9. KEY DESIGN DECISIONS

1. **Price source**: All prices come from MSW via `/api/v1/plans`. The `PricingClient` and `SubscriptionPage` both consume the same API. No hardcoded prices remain in UI components.

2. **Persian formatting**: `toPersianNumber()` converts digits. `line-through` class visually crosses out original prices. Sale prices are formatted with Persian separators (e.g., `۹۰۰٬۰۰۰`).

3. **Mobile comparison**: Instead of forcing a wide table, the comparison uses card-based layout on mobile (`tablet:hidden` on cards, `hidden tablet:block` on the matrix table). Each plan gets its own vertical card with key-value rows.

4. **Self-contained pages**: Both `/pricing` and `/subscription` use TanStack React Query internally. The Pricing page is public (no auth), the Subscription page uses MSW handlers that bypass cookie checks (via `server.use()` in tests).

5. **Mock checkout flow**: POST creates intent → component polls GET intent/:id every 2s while pending → mock handler auto-resolves to "paid" on first poll. Payment states cycle through: idle → creating → pending → paid (or failed/cancelled for error scenarios).

6. **Expiry/renewal states**: The `CurrentSubscriptionCard` shows expiry warning (3 days or less), expired banner, cancelled banner, auto-renewal toggle, and day-countdown.

7. **Confirmation dialog**: Uses the shared `ConfirmDialog` component. Displays plan name, price, duration. Prevents accidental purchases.

---

### 10. TEST SUMMARY

| File | Tests | Description |
|------|-------|-------------|
| `src/app/__tests__/subscription-page.test.tsx` | 17 | Plan display (5), Usage limits (3), Current subscription card (3), Plan selection dialog (3), Checkout flow (1), Locked features (2) |
| `src/lib/__tests__/entitlements.test.ts` | 12 | checkFeature (5), checkFeatures (1), hasActiveSubscription (4), getUpgradePlanForFeature (3) |
| `src/app/__tests__/public-pricing.test.tsx` | 4 | Plan display from MSW (1), Features display (1), CTA links (1), Error state (1) — *updated* |
| `src/app/__tests__/dashboard-page.test.tsx` | 13 | *updated plan name reference* |
| `src/components/dashboard/__tests__/widgets.test.tsx` | 21 | *updated planCode reference* |
| **Total new tests** | **29** | |
| **Total updated tests** | **38** | (5 pricing + 1 dashboard + 1 widgets = 7 updated) |

**Cumulative after Phase 6:** 16 test files, 190 tests (was 161 in Phase 5).

Test scenarios covered:
- Plans fetched from MSW and rendered with correct Persian names
- Crossed-out original prices with line-through class
- Persian-formatted sale prices (۳-digit separator)
- Duration displayed on each plan card
- Usage limits (daily requests, tokens, per-feature limits) shown on plan cards
- Usage summary with progress bars, remaining quota, days until reset
- Active subscription card with plan name, status badge, expiry date
- Auto-renewal status display
- Current plan card highlighted with "پلن فعلی" badge
- Confirmation dialog opens on plan selection with correct plan info
- Dialog closes on cancel button
- Checkout flow: select plan → confirm → payment status appears
- Boolean entitlement features shown as active/inactive
- Inactive boolean features show "غیرفعال" label
- Entitlement check: allowed for active feature with remaining quota
- Entitlement check: allowed for enabled boolean feature
- Entitlement check: blocked for disabled boolean feature (suggests pro_max)
- Entitlement check: blocked for exhausted numeric feature
- Entitlement check: blocked for missing feature (suggests pro)
- hasActiveSubscription correctly checks status/expired/cancelled/null
- getUpgradePlanForFeature returns correct tier per feature

---

### 11. NEXT PHASE RECOMMENDATION

Phase 7 should implement Chat/Memory/History — the core product value proposition:
- Chat workspace with AI conversation (message streaming, citations, structured responses)
- Memory management (user context/facts/preferences persistence)
- History browsing, search, and filtering
- These `entitled`-level features are the primary differentiator for LEGALIR
