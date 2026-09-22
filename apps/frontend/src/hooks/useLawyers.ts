// ============================================================
// LEGALIR — Lawyer Marketplace & Matching React Query Hooks
// ============================================================
// The list hook keys on the full filter object so each filter combination
// caches independently. The match hook is a mutation (it is an explicit
// user action, not background data) — the engine proposes, the user picks.
// ============================================================

import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchLawyers, fetchLawyer, matchLawyers } from "@/lib/api/v1";
import type { LawyerListFilters, MatchCriteria } from "@legalir/types";

export function useLawyers(filters: LawyerListFilters = {}) {
  return useQuery({
    queryKey: ["lawyers", "list", filters],
    queryFn: () => fetchLawyers(filters),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useLawyer(id: string | undefined) {
  return useQuery({
    queryKey: ["lawyers", "detail", id],
    queryFn: () => fetchLawyer(id!),
    enabled: !!id,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useMatchLawyers() {
  return useMutation({
    mutationFn: (criteria: MatchCriteria) => matchLawyers(criteria),
  });
}
