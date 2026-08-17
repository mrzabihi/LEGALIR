# LEGALIR — Profile Completion Architecture

## Root Cause of the 25% Bug (Spec Task 7)

The dashboard persistently showed «تکمیل پروفایل ۲۵٪» even after the user completed
the existing profile fields. The root cause was **denormalized, never-recomputed state**:

1. `completionPercent` was persisted once in `profiles.json`, computed **only** in the
   PATCH handler using a hard-coded 25% weight per field.
2. The old calculation incorrectly included `avatarUrl` as a completion field and
   omitted `birthDate`, so the math was both wrong *and* frozen.
3. Reads (`getProfile`) returned the stored value verbatim — nothing ever recomputed it,
   so once written, the value could never change no matter what the user edited.

This was a data/derivation bug, not a React Query or cache bug. The fix is at the
domain layer, not a UI patch.

## Fix: Single Source of Truth

All completion logic lives in exactly one module:

- **`src/lib/profile-completion.ts`** — `computeProfileCompletion(input)`.

`src/lib/db.ts` calls it on **every read** via `recomputeProfile()`, so the value
returned by the API is always derived from the current field values. The persisted
`completionPercent` is now only a cache; the authoritative value is recomputed.

## Two-Stage Model (Spec Tasks 9–11)

| Stage | Fields | Weight each | Contribution |
| --- | --- | --- | --- |
| Basic Profile (اطلاعات پایه) | displayName, city, occupation, email, birthDate | 10% | 50% |
| Extended Profile (پروفایل حقوقی من) | userType, province, legalInterests, primaryUseCase | 12.5% | 50% |

Total = 100%. Extended percentages produce 50 → 62.5 → 75 → 87.5 → 100.
`rounded` is exposed for display; `percentage` is kept exact for logic.

### Required fields
- **Basic:** name (`displayName`), city, occupation, email, birth date.
- **Extended:** user type (شخصی / کسب‌وکار), province, legal interests (≥1),
  primary use case.

No sensitive fields (national ID, court credentials, etc.) are required or collected.

## Cache Invalidation (Spec Task 14)

After a profile save (`PATCH /api/v1/me/profile`):

1. `upsertProfile` recomputes `completionPercent` and persists.
2. The response returns the fresh profile.
3. `useUpdateProfile.onSuccess` sets the `["me"]` cache and invalidates
   `["dashboard", "summary"]`, so the dashboard card updates without a refresh.

## Dashboard Card States (Spec Task 13)

| completionPercent | Behavior |
| --- | --- |
| 0–49% | «پروفایل خود را تکمیل کنید» |
| 50% (exactly) | «اطلاعات پایه تکمیل شد» + «ادامه تکمیل پروفایل» |
| 51–99% | current progress shown |
| 100% | card removed entirely (`return null`) |
