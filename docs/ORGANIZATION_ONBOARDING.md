# LEGALIR — Organization Onboarding

## Principle

**A company is not a user.** Registering a legal entity adds an
`Organization` + an `OrganizationMember` (role `COMPANY_OWNER`) to the
existing personal account. The user is never converted.

## Flow

1. User picks **شرکت / شخصیت حقوقی** at `/auth/register`.
2. Creates the account at `/auth/register/account?type=ORGANIZATION`.
3. `resolveOnboarding` returns `nextStep = "ORGANIZATION"`.
4. `/onboarding/organization` collects the entity profile and calls
   `POST /api/v1/organizations`.
5. On success the user may record **authorized signatories** (optional).
6. `setOnboardingStatus(userId, "COMPLETED")` → dashboard.

## Entity fields

Base info (`name` required, `tradeName`, `legalType`), registration
(`nationalId`, `registrationNumber`, `economicCode`, `registrationDate`),
address (`province`, `city`, `address`, `postalCode`), contact (`phone`,
`email`, `website`), and the representative title.

`legalType` is whitelisted against `OrganizationLegalType`. Status starts at
`PROFILE_COMPLETE`.

## Duplicate guard

`POST /api/v1/organizations` rejects a national ID that already exists with
`409 ORGANIZATION_EXISTS` — no silent duplicate.

## Authorized signatories

`OrganizationAuthorizedSignatory` is an **official record**, deliberately
separate from `OrgMember`:

- Not necessarily a platform user.
- Never implies login access.
- Fields: `fullName` (required), `nationalCode`, `position`, `authorityType`,
  `phone`.

Routes are member-guarded: a non-member receives **404**, never 403.

## Profile CTA (case B)

An organization member sees, in the profile account section:

- The organization name + legal type + status.
- Their role (`ORG_MEMBER_ROLE_FA`).
- A link to **اطلاعات شرکت**.

They do **not** see "تبدیل به کسبوکار / سازمان".

## Profile CTA (case A)

A personal user with no organization sees the account-type selector plus a
**ثبت یا افزودن شرکت** action linking to `/onboarding/organization`. The copy
is "add", never "convert".
