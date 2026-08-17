# LEGALIR — Rewards & Profile E2E Results

## Scope

Browser E2E (Playwright + installed Chrome channel) covering the Favicon set,
the header Points Card, and the "My Points" experience. The spec is
`apps/frontend/e2e/rewards-profile.spec.ts`.

## Run

```
npx playwright test e2e/rewards-profile.spec.ts
```

Result: **10 passed, 0 failed** (6 workers, ~25s).

| Test | Result |
| --- | --- |
| favicon link present on `/` | ✅ |
| favicon link present on `/dashboard` | ✅ |
| favicon link present on `/profile` | ✅ |
| favicon link present on `/points` | ✅ |
| favicon link present on `/nonexistent-404` | ✅ |
| `favicon.ico` returns 200 (no 404) | ✅ |
| `apple-touch-icon.png` returns 200 | ✅ |
| `manifest.json` returns 200 | ✅ |
| header Points Card links to `/points` | ✅ |
| My Points renders balance, earn rules, redemption teaser | ✅ |

## Auth setup

Two facts are required to render the authenticated app shell in the browser:

1. **`legalir-session` cookie** — satisfies Next.js middleware and lets the
   rewards/`me` API routes resolve the user (`findSessionById`).
2. **`legalir-auth` localStorage** — satisfies the Zustand `isAuthenticated()`
   check in `AppLayout` so the `TopBar` (and its Points Card) actually renders.

The test creates a **real** session through the OTP API
(`POST /api/auth/otp/request` → `POST /api/auth/otp/verify` with the dev code
`405405`), then seeds the cookie + localStorage before `page.goto`.

Two implementation notes that caused earlier failures and are now fixed:

- `page.addInitScript(fn, arg)` serializes `fn` but **not** its outer closure
  variables. The `legalir-auth` key must be inlined in the function body.
- The `AppSplashGate` shows a ~4.5s splash on every full page load. Assertions
  wait directly on the target content (with a 15s timeout) instead of racing a
  `toBeHidden` check that can pass before React mounts the splash overlay.

## Coverage vs. spec tasks

- **Task 42 (Favicon)** — all routes verified, no favicon/app-icon/manifest 404.
- **Task 50 (Header)** — Points Card discoverable and links to `/points`.
- **Tasks 28–29, 31 (My Points)** — balance hero, earn rules, and the
  «استفاده از امتیاز» future-redemption teaser render.

Purchase-reward idempotency (Tasks 47–49), daily-visit idempotency (Task 46),
and the full 0→50→100 profile progression (Tasks 43–45) are covered at the
domain layer by the unit suites (`src/lib/__tests__/profile-completion.test.ts`,
`src/lib/__tests__/rewards.test.ts`) and the existing dashboard/profile test
suites; they exercise the same `grantReward` / `computeProfileCompletion` code
paths the UI renders.
