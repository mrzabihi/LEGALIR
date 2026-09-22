# LEGALIR — Registration Identity & Onboarding Architecture

> Scope: the **registration entry point only**. Login, forgot-password and
> OTP flows are unchanged.

## 1. The identity model

```
User  ── personal login identity (always)
      ├── 0..N Organization memberships ──► Organization
      └── optional Lawyer profile
```

A **company is never a User**. There is no `account_type = COMPANY`. Registering
a legal entity creates a `User` + an `Organization` + an `OrganizationMember`
with role `COMPANY_OWNER`. The user keeps their personal identity and may
represent several organizations over time.

A **signatory is never a member**. `OrganizationAuthorizedSignatory` is an
official record (name, national code, position, authority) and does not imply
login access.

## 2. Two-step registration

| Step | Route | Purpose |
|------|-------|---------|
| 1 | `/auth/register` | Choose the entry track (3 cards) |
| 2 | `/auth/register/account?type=…` | Create the account (existing form, reused) |

The chosen track travels as `?type=` and is **validated server-side** against
`ALLOWED_REGISTRATION_INTENTS`. An unknown/missing value bounces the user back
to step 1. Refresh preserves the track; the Back button returns to selection.

Post-registration profile completion is **not** part of the auth stepper.

## 3. Registration intent

`RegistrationIntent = "PERSONAL" | "ORGANIZATION" | "LAWYER"`

- Persisted on the user row as `registrationOrigin` + `onboardingType`.
- `normalizeRegistrationIntent(value)` is the trust boundary: anything outside
  the allow-list becomes `null` (the route falls back to `PERSONAL`).
- The intent **only seeds onboarding**. It never grants a role or org access —
  authorization always comes from membership + RBAC.

## 4. Server-driven routing

`GET /api/v1/onboarding` returns `OnboardingState`:

```ts
{ type, status, nextStep, organization, orgRole }
```

`nextStep` is authoritative. The client routes on it and never guesses:

| nextStep | Destination |
|----------|-------------|
| `PERSONAL_PROFILE` | `/auth/profile` |
| `ORGANIZATION` | `/onboarding/organization` |
| `LAWYER` | `/onboarding/lawyer` |
| `DASHBOARD` | `/dashboard` |

`resolveOnboarding(userId)` (server) computes the step from the persisted
intent, the active membership and the lawyer profile. An org member always
resolves to `DASHBOARD`, even if they registered as PERSONAL.

## 5. Data model additions

- `DbUser`: `registrationOrigin?`, `onboardingType?`, `onboardingStatus?`
- `Organization`: `tradeName`, `legalType`, `nationalId`, `registrationNumber`,
  `economicCode`, `registrationDate`, `address`, `postalCode`, `website`,
  `status`, `ownerUserId`, `createdByUserId`
- `OrganizationAuthorizedSignatory` (new table `org_signatories`)
- `LawyerProfile`: `activityType?`, `licenseAuthority?`

## 6. API surface

| Method | Route | Notes |
|--------|-------|-------|
| `POST` | `/api/auth/register` | accepts `registrationIntent` |
| `GET` | `/api/v1/onboarding` | server-driven decision |
| `GET`/`POST` | `/api/v1/organizations` | membership-scoped list / create |
| `GET`/`POST`/`DELETE` | `/api/v1/organizations/[id]/signatories` | member-guarded |
| `GET`/`POST` | `/api/v1/lawyer/onboarding` | submit → `PROFILE_SUBMITTED` |

## 7. Security

- The user id always comes from the session, never the request.
- Org routes return **404** (not 403) for non-members, so existence is not leaked.
- Duplicate organizations are rejected on national ID (`409 ORGANIZATION_EXISTS`).
- A submitted lawyer profile is **never** auto-verified.

## 8. Migration

Existing users have no onboarding fields. `resolveOnboarding` treats them as
`PERSONAL` / `NOT_STARTED`; `getRegistrationOrigin` returns `LEGACY`. No
destructive migration is performed.
