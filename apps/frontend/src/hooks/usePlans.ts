// ============================================================
// LEGALIR — Plans Hook
// ============================================================
// Uses the centralized v1 API client (no raw fetch).
// For V1 plans, prefer usePlansV1() from useSubscription.ts.
// This hook targets the legacy /api/plans endpoint.
// ============================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import type { Plan } from "@legalir/types";
import { fetchPlans } from "@/lib/api/v1";

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: fetchPlans,
    staleTime: 5 * 60_000,
    retry: 2,
  });
}
