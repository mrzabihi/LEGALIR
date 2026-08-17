# BASELINE — Favicon + Profile Completion + Rewards & Loyalty System

**Section:** §1 (Task 1)
**Branch:** `feature/legalir-v0.3-rewards-profile` (created from `feature/legalir-v0.2-ui-ai-upgrade`)
**Parent commit:** `440f4b3` — "feat: AI Legal Intelligence Assistant + Legal Library & Blog polish"

This document records the state of the product *before* any Rewards/Profile work began, so every change can be traced against a known baseline.

---

## 1. Current Favicon / Web App Icon State

| Asset | Present? | Notes |
| --- | --- | --- |
| `favicon.ico` | ❌ | Missing entirely — browsers request `/favicon.ico` and get a 404. |
| `icon.svg` | ❌ | Missing. |
| `apple-touch-icon.png` | ❌ | Missing. |
| `icon-192.png` / `icon-512.png` | ❌ | Missing. |
| `maskable` icon | ❌ | Missing. |
| `manifest.json` | ✅ | Present at `apps/frontend/public/manifest.json`, but `icons: []` is empty. |
| Brand asset | ✅ | `apps/frontend/public/legalir-logo.png` — 1024×1024 RGBA (transparent) PNG, 1.35 MB. |

Root layout metadata (`src/app/layout.tsx`):
- `manifest: "/manifest.json"` is declared, but the manifest has no icons and no `theme_color` alignment issue.
- `viewport.themeColor` is set to `#102E4A` (light) / `#0E141B` (dark) — these are close to, but **not** the exact brand primaries (see §7).

**Conclusion:** Favicon support is effectively absent. Browsers fall back to a generic document icon.

---

## 2. Current Profile Fields

Backend model `DbProfile` (`src/lib/db.ts`):

```
user_id, displayName, city, occupation, avatarUrl,
email, birthDate, gender, completionPercent
```

Frontend type `Profile` (`packages/types/src/index.ts:62`):

```ts
export interface Profile {
  userId: string;
  displayName: string | null;
  email: string | null;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
  city: string | null;
  occupation: string | null;
  completionPercent: number;
  avatarUrl: string | null;
}
```

The `/profile` page renders these fields: نام، نام خانوادگی، ایمیل، جنسیت، تاریخ تولد، شهر، شغل، موبایل (read-only). There is **no** Extended Profile (no user_type, province, legal_interests, primary_use_case).

---

## 3. Current Completion Calculation (Root Cause of the 25% Bug)

The only place completion is computed is the **PATCH handler** in `src/app/api/v1/me/profile/route.ts`:

```ts
let completionPercent = 0;
if (merged.displayName || displayName) completionPercent += 25;
if (merged.city) completionPercent += 25;
if (merged.occupation) completionPercent += 25;
if (merged.avatarUrl) completionPercent += 25;
```

Problems (this is the actual bug — not a UI issue):

1. **Denormalized persisted value never recomputed on read.** `completionPercent` is stored in `profiles.json`. `GET /api/v1/me` and `GET /api/v1/dashboard/summary` both return the *stored* `profile.completionPercent` verbatim. If the stored value is stale, every consumer shows the stale number.

2. **`avatarUrl` is wrongly a 25% field.** Avatar is optional and cosmetic. A user who fills every real field but does not upload an avatar is capped at 75% (`25+25+25+0`). Worse, the demo user `d404f2ca…` has a persisted `completionPercent: 25` even though their profile record already contains `displayName`, `email`, `gender`, `birthDate`, `city`, `occupation` — because the value was written once (when only `displayName` was set) and never recomputed afterwards.

3. **No single source of truth.** The Dashboard, Profile hub, and (would-be) header each read the same stale stored number. There are no shared domain rules; percentages are scattered as magic numbers (`25`) in the route.

4. **`completionPercent` is not recomputed on read of an existing profile.** `getProfile()` returns the stored row as-is; `seedDevData()` even hard-codes `85` for the demo user.

**Result:** A user completes every Basic field, but the Dashboard continues to show `تکمیل پروفایل ۲۵٪`.

---

## 4. Current Dashboard Behavior

- `src/app/(app)/dashboard/page.tsx` renders `<ProfileCompletionCard profile={me.data?.profile} isLoading={me.isLoading} />`.
- `ProfileCompletionCard` (`src/components/dashboard/widgets.tsx:316`) returns `null` when `completionPercent >= 100`; otherwise shows a warning card with a progress bar and a single CTA «تکمیل پروفایل» → `/profile`.
- There are **no** distinct states for 0–49% / 50% / 51–99% / 100% — it's a single generic card driven by the stored number.

---

## 5. Current Header / Avatar Component

`src/components/app/top-bar.tsx` (`TopBar`):
- Mobile logo (`legalir-logo.png`), a spacer, `ThemeToggleButton`, support link, and a user menu button.
- The "avatar" is an initials circle (`avatarInitial = (displayName ?? mobileFallback)?.[0] ?? "ک"`).
- There is **no** points/score card next to the avatar.

---

## 6. Current Subscription / Payment Events

- Canonical purchase flow: `POST /api/v1/checkout/intents` (`src/app/api/v1/checkout/intents/route.ts`).
  - Validates `planCode ∈ {silver, gold, diamond}`.
  - Calls `createSubscription({... status: "active" ...})` — **this is the "confirmed successful purchase" event** in the DEV/mock flow.
  - Returns a `CheckoutIntent` (in-memory `Map`, not persisted).
- `createSubscription` (`src/lib/db.ts:440`) writes a `StoredSubscription` row with `crypto.randomUUID()` id and `purchased_at`.
- A legacy route `POST /api/checkout` does the same for a parallel intent store.
- There is **no** reward/points hook on any purchase path. No idempotency protection on purchase reward (currently no reward at all).
- Plan codes from `fixturePlans` (`packages/testing/src/index.ts:143`): `silver`, `gold`, `diamond`.

---

## 7. Brand Colors (for favicon / theme / points UI)

From `globals.css` design tokens:

| Token | Hex |
| --- | --- |
| `--color-primary-600` | `#1E2A40` |
| `--color-primary-700` | `#162033` |
| `--color-primary-800` | `#0F172A` |
| `--color-primary-900` | `#0B1220` |
| `--color-secondary-500` | `#B08D57` (gold/bronze — natural fit for points) |
| `--color-secondary-600` | `#A37C3C` |

Current manifest `theme_color` is `#102E4A` (slightly off-brand); dark viewport color `#0E141B`.

---

## 8. Current Database Models

JSON-file DB (`src/lib/db.ts`, `.data/*.json`):

- `users` — `DbUser`
- `sessions` — `DbSession`
- `profiles` — `DbProfile` (includes `completionPercent`)
- `preferences` — `DbPreferences`
- `activities` — `ActivityRow`
- `subscriptions` — `StoredSubscription`
- `usage_stats` — `UsageStatsRow`

Additional JSON-file stores in separate modules: `legal-library.json`, `blog.json`, `conversations.json`, `conversation-messages.json`, `legal-bookmarks.json`.

**No** rewards/points tables exist. **No** ledger, reward rules, daily claims, or redemptions.

---

## 9. Current User-Session Model

- Auth cookie: `legalir-session` → `findSessionById(sessionId)`.
- `DbSession`: `id`, `userId`, `createdAt`, `expiresAt` (7-day max age).
- Every `api/v1/*` route resolves the user via `getUserFromCookie(request)` (regex on the cookie header).
- React Query caches: `["me"]`, `["dashboard","summary"]`, `["usage","summary"]`, `["activities","recent",…]`.
- `useUpdateProfile` (`src/hooks/useDashboard.ts:34`) only patches `["me"]` cache on success — it does **not** invalidate `["dashboard","summary"]`, which is a contributing factor to the stale 25% being seen immediately after save.

---

## 10. Verified Commands (pre-change)

- `npx tsc --noEmit` — clean
- `npx next lint` — errors only (accepted `<img>` warnings)
- `npx vitest run` — 24 files, 454 tests passing
- `npx next build` — succeeds
