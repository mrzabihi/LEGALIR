# LEGALIR — Lawyer Onboarding

## Principle

**Completing the form never verifies the lawyer.** A submitted profile moves
to `PROFILE_SUBMITTED` (pending review). No lawyer permissions are granted,
and the profile is not visible in the marketplace until an admin verifies it.

## Flow

1. User picks **وکیل** at `/auth/register`.
2. Creates the account at `/auth/register/account?type=LAWYER`.
3. `resolveOnboarding` returns `nextStep = "LAWYER"` (no profile yet).
4. `/onboarding/lawyer` collects the professional profile and calls
   `POST /api/v1/lawyer/onboarding`.
5. The route writes a `LawyerProfile` with:
   - `verificationStatus: "PROFILE_SUBMITTED"`
   - `availabilityStatus: "INACTIVE"`
   - `acceptingRequests: false`
6. `setOnboardingStatus(userId, "COMPLETED")` → dashboard.
7. The user sees **«بخش وکلا بهزودی فعال میشود»**.

Once a profile exists, `resolveOnboarding` returns `DASHBOARD` for that user.

## Collected fields

`fullName` (required), `professionalTitle`, `activityType` (whitelisted
against `LawyerActivityType`), `licenseNumber`, `licenseAuthority`,
`licenseYear`, `province`, `city`, `yearsExperience`, `bio`, `specializations`.

`specializations` are stored as `LawyerSpecialty[]` with the declared
`yearsExperience` applied to each.

## Verification states

`LawyerVerificationStatus` includes `PROFILE_SUBMITTED`. The helper
`isLawyerPendingVerification(status)` returns true for it. Only an admin
decision (`setVerificationStatus`) can move a profile to `VERIFIED`.

## Marketplace visibility

`queryLawyers` filters to `verificationStatus === "VERIFIED"` by default, so a
pending lawyer never appears as a bookable option.

## What is NOT granted

- No `LAWYER` RBAC role.
- No marketplace listing.
- No request intake.
- No client access.
