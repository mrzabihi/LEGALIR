// ============================================================
// LEGALIR — Lawyer Marketplace & Matching React Query Hooks
// ============================================================
// The list hook keys on the full filter object so each filter combination
// caches independently. The match hook is a mutation (it is an explicit
// user action, not background data) — the engine proposes, the user picks.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLawyers,
  fetchLawyer,
  matchLawyers,
  fetchLawyerReviewEligibility,
  submitLawyerReview,
  reportLawyerReview,
} from "@/lib/api/v1";
import type { LawyerSearchFilters, LawyerReviewSubmitInput, MatchCriteria } from "@legalir/types";

export function useLawyers(
  filters: LawyerSearchFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["lawyers", "list", filters],
    queryFn: () => fetchLawyers(filters),
    staleTime: 60_000,
    retry: 1,
    enabled: options.enabled ?? true,
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

/** The signed-in viewer's review eligibility for a lawyer (any status). */
export function useLawyerReviewEligibility(id: string | undefined) {
  return useQuery({
    queryKey: ["lawyers", "review-eligibility", id],
    queryFn: () => fetchLawyerReviewEligibility(id!),
    enabled: !!id,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Submit or edit the viewer's review; refreshes the profile + eligibility. */
export function useSubmitLawyerReview(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LawyerReviewSubmitInput) => submitLawyerReview(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyers", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["lawyers", "review-eligibility", id] });
    },
  });
}

/** Report an inappropriate review. */
export function useReportLawyerReview(id: string) {
  return useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason: string }) =>
      reportLawyerReview(id, reviewId, reason),
  });
}
