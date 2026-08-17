// ============================================================
// LEGALIR — Rewards & Loyalty React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRewardsSummary,
  fetchRewardsHistory,
  claimDailyVisitReward,
} from "@/lib/api/v1";

const REWARDS_SUMMARY_KEY = ["rewards", "summary"] as const;

export function useRewardsSummary() {
  return useQuery({
    queryKey: REWARDS_SUMMARY_KEY,
    queryFn: fetchRewardsSummary,
    staleTime: 60_000, // 1 min
    retry: 1,
  });
}

export function useRewardsHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["rewards", "history", page, pageSize],
    queryFn: () => fetchRewardsHistory(page, pageSize),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useClaimDailyVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => claimDailyVisitReward(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REWARDS_SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: ["rewards", "history"] });
    },
  });
}
