// ============================================================
// LEGALIR — Judicial flag context (server-only)
// ============================================================
// Every judicial route must evaluate the feature flags for the CALLER, not for
// "the deployment": a service can be rolled out to one plan or one org. This
// module assembles the same context the /api/v1/capabilities route builds, so
// the entry surfaces and the mutating routes can never disagree about whether
// a service is offered.
// ============================================================

import { currentEnvironment, type FlagContext } from "@/lib/admin/flags";
import { getUsageSummary } from "@/lib/usage/engine";

/**
 * A stable 0–99 bucket for the caller. Identical algorithm to the one in
 * `app/api/v1/capabilities/route.ts`, so a limited rollout puts the same user
 * in the same bucket on every surface. No storage, no secret.
 */
export function rolloutBucket(userId: string): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

export function judicialFlagContext(auth: {
  userId: string;
  orgId: string | null;
}): FlagContext {
  const summary = getUsageSummary(auth.userId);
  return {
    env: currentEnvironment(),
    planCode: summary.planCode ?? "free",
    orgId: auth.orgId,
    bucket: rolloutBucket(auth.userId),
  };
}
