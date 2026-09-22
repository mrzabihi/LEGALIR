// ============================================================
// LEGALIR — Onboarding Resolution (server-side)
// ============================================================
// Resolves the SERVER-DRIVEN onboarding decision for a user. The client
// never guesses the next step from a query string — it asks this module,
// which reads the persisted registration intent, the organization
// membership and the lawyer profile.
//
// Identity model:
//   User  ── personal identity (always)
//         ├── 0..N Organization memberships
//         └── optional Lawyer profile
//
// The registration intent is only the ENTRY POINT; it never grants a role
// or organization access.

import { findUserById, type DbUser } from "./db";
import { findActiveMembership } from "./rbac";
import { getOrganizationById } from "./org-db";
import { getLawyerProfileByUserId } from "./lawyer-db";
import type {
  OnboardingState,
  OnboardingType,
  OnboardingStatus,
  Organization,
  OrgMemberRole,
} from "@legalir/types";

/**
 * Resolve the onboarding state for a user. The `nextStep` is authoritative:
 * the client routes on it, not on a client-supplied intent.
 */
export function resolveOnboarding(userId: string): OnboardingState | null {
  const user = findUserById(userId);
  if (!user) return null;

  const membership = findActiveMembership(userId);
  const organization: Organization | null = membership
    ? getOrganizationById(membership.orgId) ?? null
    : null;
  const orgRole: OrgMemberRole | null = membership?.role ?? null;

  const type: OnboardingType = user.onboardingType ?? "PERSONAL";
  const status: OnboardingStatus = user.onboardingStatus ?? "NOT_STARTED";

  return {
    type,
    status,
    nextStep: nextStepFor(user, type, status, organization),
    organization,
    orgRole,
  };
}

function nextStepFor(
  user: DbUser,
  type: OnboardingType,
  status: OnboardingStatus,
  organization: Organization | null
): OnboardingState["nextStep"] {
  // An organization member has completed the organization track — even if
  // they registered as PERSONAL and created the org later.
  if (organization) return "DASHBOARD";

  if (status === "COMPLETED" || status === "SKIPPED") return "DASHBOARD";

  switch (type) {
    case "ORGANIZATION":
      return "ORGANIZATION";
    case "LAWYER": {
      // A submitted lawyer profile means the track is done (pending review).
      const profile = getLawyerProfileByUserId(user.id);
      return profile ? "DASHBOARD" : "LAWYER";
    }
    case "PERSONAL":
    default:
      return "PERSONAL_PROFILE";
  }
}
