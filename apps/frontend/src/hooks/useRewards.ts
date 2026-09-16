// ============================================================
// LEGALIR — Rewards & Loyalty React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RewardsSummary, PointsAccount } from "@legalir/types";
import {
  fetchRewardsSummary,
  fetchRewardsHistory,
  claimDailyVisitReward,
} from "@/lib/api/v1";

const REWARDS_SUMMARY_KEY = ["rewards", "summary"] as const;
const POINTS_ACCOUNT_KEY = ["points", "account"] as const;

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
    onSuccess: (res) => {
      // Nothing was awarded (already claimed today) — the cached balance is
      // still correct, so skip the refetch entirely. This is what kept the
      // dashboard firing a second /rewards/summary on every single load.
      if (!res.awarded) return;

      // Awarded: write the new balance straight into the cache so the header
      // badge, dashboard card and /points page update in the same frame —
      // no round-trip, no flash of the old value.
      queryClient.setQueryData<RewardsSummary>(REWARDS_SUMMARY_KEY, (old) =>
        old
          ? {
              ...old,
              balance: res.balance,
              today: { visitRewardClaimed: true, pointsAwarded: res.points },
            }
          : old
      );
      queryClient.setQueryData<PointsAccount>(POINTS_ACCOUNT_KEY, (old) =>
        old
          ? {
              ...old,
              balance: res.balance,
              lifetimeEarned: old.lifetimeEarned + res.points,
              transactionCount: old.transactionCount + 1,
            }
          : old
      );

      // The ledger history gained a row — refetch it in the background.
      queryClient.invalidateQueries({ queryKey: ["rewards", "history"] });
      queryClient.invalidateQueries({ queryKey: ["points", "transactions"] });
    },
  });
}
