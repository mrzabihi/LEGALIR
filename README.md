# LEGALIR

## Admin panel (operator console)

The platform admin panel lives under the `(admin)` route group and is reached
three ways — all serve the same `/admin` tree:

| Entry point | Command / URL |
| --- | --- |
| Main host | `http://localhost:3000/admin` |
| Subdomain (no host-file edit) | `http://admin.localhost:3000` |
| Dedicated port | `npm run dev:admin` → `http://localhost:3100` |

The subdomain is handled in `apps/frontend/src/middleware.ts`: the host is
rewritten onto `/admin`, and unauthenticated requests are redirected to the
main-host login (`/auth/mobile`) with the intended path preserved as
`?intent=`.

### Signing in (development)

A fresh dev database has no staff, so `instrumentation.ts` seeds exactly one
`SUPER_ADMIN` on boot (dev-only, idempotent — see
`apps/frontend/src/lib/admin/staff-seed.ts`):

- **Mobile:** `+989120000000` (override with `LEGALIR_DEV_ADMIN_MOBILE`)
- **OTP:** `405405` (the fixed development code)
- **Password (optional):** none by default — the account is OTP-only. Set
  `LEGALIR_DEV_ADMIN_PASSWORD` in `.env.local` (gitignored) to also enable the
  password tab on `/auth/mobile`.

No seed runs in staging or production, and it never overwrites a real
operator. The seed is a no-op once any super-admin exists, so it will NOT
re-apply an override to an already-seeded dev database — sign in once and
change the role from the panel, or clear `apps/frontend/.data/users.json` to
re-seed. Authorization is enforced server-side on every
`/api/v1/admin/**` request (`lib/rbac.ts` + the permission matrix in
`@legalir/types`); the UI only hides affordances.

### Configuration

- `LEGALIR_ADMIN_SECRET_KEY` — 16+ chars; enables AES-256-GCM storage of AI
  provider keys. Without it the panel refuses to save keys (503) rather than
  falling back to plaintext, and shows the honest "unconfigured" state.
- `LEGALIR_OTP_PROVIDER` — `mock` (or unset) uses the dev OTP; the settings
  page then reports SMS as unconfigured.