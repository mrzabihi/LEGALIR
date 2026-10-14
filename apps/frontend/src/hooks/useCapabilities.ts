// ============================================================
// LEGALIR — useCapabilities
// ============================================================
// The consumer view of the admin-managed feature flags, evaluated for the
// current user's plan. This is the single source of truth for "is this
// service offered right now?" — the smart intake and the /Suggest_law page
// both gate their suggestions on it, so a flag switched off in /admin/services
// is never presented as an available route.
//
// It never substitutes a hard-coded default: while the query is loading the
// caller shows a loading state, and on error it shows a retry — it does NOT
// pretend a capability is available.

import { useQuery } from "@tanstack/react-query";
import { fetchCapabilities } from "@/lib/api/v1";
import type { V1CapabilitiesResponse } from "@legalir/types";

export function useCapabilities() {
  return useQuery({
    queryKey: ["v1", "capabilities"],
    queryFn: fetchCapabilities,
    staleTime: 5 * 60_000, // 5 min — flags change rarely
    retry: 1,
  });
}

/**
 * Whether a capability is enabled in a fetched capabilities payload.
 * `undefined` (still loading / not fetched) resolves to `false`, so the UI
 * fails closed and never offers an unverified service.
 */
export function capabilityEnabled(
  data: V1CapabilitiesResponse | undefined,
  key: string
): boolean {
  if (!data) return false;
  return data.capabilities.find((c) => c.key === key)?.enabled ?? false;
}
