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
