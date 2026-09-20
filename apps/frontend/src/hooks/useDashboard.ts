// ============================================================
// LEGALIR — Dashboard & User React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@legalir/types";
import {
  fetchMe,
  fetchDashboardSummary,
  fetchUsageSummary,
  fetchRecentActivities,
  updateProfile,
  fetchBlogPosts,
  fetchBlogPost,
  fetchDailyQuota,
} from "@/lib/api/v1";

// ============================================================
// useMe — Current user profile + preferences
// ============================================================

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000, // 5 min
    retry: 1,
  });
}

// ============================================================
// useUpdateProfile — Update user profile
// ============================================================

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Profile>) => updateProfile(data),
    onSuccess: (updated) => {
      // Update the me cache
      queryClient.setQueryData(["me"], (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const me = old as Record<string, unknown>;
        return { ...me, profile: updated };
      });
      // Invalidate the dashboard summary so the completion card reflects the
      // new value immediately (no stale 25%).
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });

      // Reaching 100% completion grants the once-per-account PROFILE_COMPLETED
      // reward server-side (see app/api/v1/me/profile/route.ts). The PATCH
      // response only carries the Profile, so the new balance is unknown here —
      // refetch the rewards/points families so the header badge, dashboard card
      // and /points page update without a manual refresh. The ledger key is
      // idempotent, so this is safe to fire on every profile save.
      queryClient.invalidateQueries({ queryKey: ["rewards", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["points", "account"] });
      queryClient.invalidateQueries({ queryKey: ["rewards", "history"] });
      queryClient.invalidateQueries({ queryKey: ["points", "transactions"] });
    },
  });
}

// ============================================================
// useDashboardSummary
// ============================================================

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    staleTime: 60_000, // 1 min
    retry: 1,
  });
}

// ============================================================
// useDailyQuota — live daily-request allowance (plan-derived)
// ============================================================

export function useDailyQuota() {
  return useQuery({
    queryKey: ["quota", "daily"],
    queryFn: fetchDailyQuota,
    staleTime: 30_000, // 30s — quota changes as the user acts
    retry: 1,
  });
}

// ============================================================
// useUsageSummary
// ============================================================

export function useUsageSummary() {
  return useQuery({
    queryKey: ["usage", "summary"],
    queryFn: fetchUsageSummary,
    staleTime: 5 * 60_000, // 5 min
    retry: 1,
  });
}

// ============================================================
// useRecentActivities
// ============================================================

export function useRecentActivities(page = 1, pageSize = 5) {
  return useQuery({
    queryKey: ["activities", "recent", page, pageSize],
    queryFn: () => fetchRecentActivities(page, pageSize),
    staleTime: 60_000, // 1 min
    retry: 1,
  });
}

// ============================================================
// useBlogPosts — legal education / blog content (dashboard card)
// ============================================================

export function useBlogPosts(page = 1, pageSize = 4) {
  return useQuery({
    queryKey: ["blog", "posts", page, pageSize],
    queryFn: () => fetchBlogPosts(page, pageSize),
    staleTime: 5 * 60_000, // 5 min
    retry: 1,
  });
}

export function useBlogPost(slug: string | undefined) {
  return useQuery({
    queryKey: ["blog", "post", slug],
    queryFn: () => fetchBlogPost(slug as string),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000, // 5 min
    retry: 1,
  });
}
