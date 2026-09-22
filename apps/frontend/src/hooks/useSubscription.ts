// ============================================================
// LEGALIR — Subscription & Checkout React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlanCode } from "@legalir/types";
import {
  fetchPlans,
  fetchCurrentSubscription,
  fetchEntitlements,
  fetchUsage,
  fetchSubscriptionUsage,
  fetchSubscriptionUsageHistory,
  createCheckoutIntent,
  getCheckoutIntent,
} from "@/lib/api/v1";

// ============================================================
// usePlansV1 — Fetch all plans from v1 API
// ============================================================

export function usePlansV1() {
  return useQuery({
    queryKey: ["v1", "plans"],
    queryFn: fetchPlans,
    staleTime: 10 * 60_000, // 10 min
    retry: 1,
  });
}

// ============================================================
// useCurrentSubscription — Fetch current subscription status
// ============================================================

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ["v1", "subscriptions", "current"],
    queryFn: fetchCurrentSubscription,
    staleTime: 5 * 60_000, // 5 min
    retry: 1,
  });
}

// ============================================================
// useEntitlements — Fetch entitlements for current user
// ============================================================

export function useEntitlements() {
  return useQuery({
    queryKey: ["v1", "entitlements"],
    queryFn: fetchEntitlements,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

// ============================================================
// useUsage — Fetch current usage counters
// ============================================================

export function useUsage() {
  return useQuery({
    queryKey: ["v1", "usage"],
    queryFn: fetchUsage,
    staleTime: 60_000, // 1 min — usage changes frequently
    retry: 1,
  });
}

// ============================================================
// useSubscriptionUsage — the live usage engine summary
// ============================================================
// Today's subscription credit (resets at Tehran midnight), the
// period-scoped service quotas and the persistent reward-points balance.
// The dashboard and the pricing page both read this same source.

export function useSubscriptionUsage() {
  return useQuery({
    queryKey: ["v1", "subscription", "usage"],
    queryFn: fetchSubscriptionUsage,
    staleTime: 30_000, // 30s — credit changes as the user acts
    retry: 1,
  });
}

export function useSubscriptionUsageHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["v1", "subscription", "usage", "history", page, pageSize],
    queryFn: () => fetchSubscriptionUsageHistory(page, pageSize),
    staleTime: 60_000,
    retry: 1,
  });
}

// ============================================================
// useCheckoutIntent — Create a checkout intent
// ============================================================

export function useCheckoutIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planCode: PlanCode) => createCheckoutIntent(planCode),
    onSuccess: () => {
      // Invalidate subscription data after successful checkout
      queryClient.invalidateQueries({ queryKey: ["v1", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["v1", "entitlements"] });
    },
  });
}

// ============================================================
// useCheckoutIntentPoll — Poll checkout intent status
// ============================================================

export function useCheckoutIntentPoll(intentId: string | null) {
  return useQuery({
    queryKey: ["v1", "checkout", "intents", intentId],
    queryFn: () => getCheckoutIntent(intentId!),
    enabled: !!intentId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 2s while pending/creating, stop once paid/failed/cancelled
      if (data && (data.status === "pending" || data.status === "creating")) {
        return 2000;
      }
      return false;
    },
    staleTime: 1000,
  });
}
