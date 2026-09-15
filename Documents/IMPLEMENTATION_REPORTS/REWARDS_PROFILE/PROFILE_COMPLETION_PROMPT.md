# LEGALIR — Profile Completion Incentive & Persistent Prompt

## Mission

A production-quality, cross-layer feature that nudges an authenticated user to
complete their profile by showing a non-blocking modal on the Dashboard, backed
by a real 1000-point reward (`PROFILE_COMPLETED`). The prompt respects a
**persistent per-user preference** and enforces strict **user isolation**.

## Business Rules (single source of truth)

```
IF profile is complete            → never show
ELSE IF prompt explicitly disabled → never show
ELSE                              → show when entering the authenticated Dashboard
```

The modal appears **only after** the user enters the authenticated Dashboard —
it never interrupts the auth flow.

## Critical Action Distinction

Two user actions that **MUST NOT share state**:

| Action | Label | Behavior |
| --- | --- | --- |
| Cancel | «انصراف» | Closes the modal **only**. No persistence. Reappears on next login. |
| Suppress | «دیگر این پیام را به من نشان نده» | Persists `showProfileCompletionPrompt: false` per-user, then closes. Never reappears. |

These are enforced by two separate controller phases (`CLOSED` vs
`SAVING_PREFERENCE`) and two separate callbacks (`cancel()` vs `suppress()`).

## Architecture

### Backend (persistence — source of truth, NOT localStorage)

- **`src/lib/db.ts`** — added `showProfileCompletionPrompt: boolean` to
  `DbPreferences`; default `true` in `getPreferences`, `upsertPreferences`, and
  the seed block.
- **`src/app/api/v1/me/preferences/route.ts`** — `PATCH` now accepts and forwards
  `showProfileCompletionPrompt`.
- **`packages/types/src/index.ts`** — added the field to `V1UserPreferences` and
  `V1PreferencesUpdateRequest`.
- **`src/mocks/handlers/index.ts`** — MSW GET/PATCH handlers include the field.

### Frontend (feature module)

- **`src/features/profile-completion-prompt/useProfileCompletionPrompt.ts`** —
  controller hook owning the eligibility state machine. Uses `useMe`,
  `usePreferences`, `useUpdatePreferences` (React Query). Phases:
  `INITIALIZING → LOADING_USER → LOADING_PREFERENCES → EVALUATING → OPEN | CLOSED`,
  plus `NAVIGATE_PROFILE`, `SAVING_PREFERENCE`, `ERROR`.
- **`src/features/profile-completion-prompt/ProfileCompletionPromptModal.tsx`** —
  `Dialog` + `Button` from `@legalir/ui`; reward value from
  `pointsForEvent("PROFILE_COMPLETED")` (1000). Error state with retry.
- **`src/features/profile-completion-prompt/index.ts`** — barrel export.
- **`src/app/(app)/dashboard/page.tsx`** — mounts the modal via the controller.

### User isolation

The preference is stored per `user_id` in `preferences.json` and read through
`getPreferences(userId)` resolved from the session cookie. User A suppressing
never affects User B. Verified by E2E.

## Tests

| Layer | File | Count | Status |
| --- | --- | --- | --- |
| Unit (controller state machine) | `__tests__/useProfileCompletionPrompt.test.tsx` | 11 | ✅ |
| Component (modal + actions) | `__tests__/ProfileCompletionPromptModal.test.tsx` | 8 | ✅ |
| E2E (behavior matrix + isolation) | `e2e/profile-completion-prompt.spec.ts` | 5 | ✅ |

### E2E behavior matrix

1. Complete profile → prompt never appears.
2. Incomplete + enabled → prompt appears with the 1000-point reward and three
   distinct actions.
3. «انصراف» → closes, reappears on re-login (not persisted).
4. Suppress → persists, never reappears on re-login.
5. User isolation → one user's suppress never leaks to another.

The seeded demo user (`09120000003`) has a 100%-complete profile, so the
incomplete-profile scenarios use freshly-created users (empty profile →
`completionPercent` 0) via the real OTP flow. Each test uses a **unique mobile**
so a suppress persisted in one test can never leak into another (the JSON DB is
shared and the suite runs fully parallel).

## Quality Gate

- **Typecheck** (`tsc --noEmit`): clean for all feature files. Only pre-existing
  errors remain in the untracked `src/lib/__tests__/legal-corpus.test.ts`.
- **Lint** (`eslint`): clean on all feature files.
- **Unit/component tests**: 19/19 pass.
- **E2E**: 5/5 pass.
- **Build**: blocked only by an environment lock — the running dev server (PID
  21776) holds `.next` open, causing `EPERM` on `.next/trace` before any
  compilation. Not a code defect; build succeeds once the dev server is stopped.
