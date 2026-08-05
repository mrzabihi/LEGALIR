// ============================================================
// LEGALIR — Phase 11 React Query Hooks
// History, Memory, Profile, Preferences, Subscription History
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchHistory,
  fetchMemories,
  updateMemory,
  deleteMemory,
  fetchPreferences,
  updatePreferences,
  fetchSubscriptionHistory,
  fetchProfileUsage,
} from "@/lib/api/v1";
import type { V1MemoryUpdateRequest } from "@legalir/types";

// ============================================================
// useHistory
// ============================================================

export function useHistory(params: {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  sort?: string;
  type?: string;
} = {}) {
  return useQuery({
    queryKey: ["history", params],
    queryFn: () => fetchHistory(params),
    staleTime: 30_000,
    retry: 1,
  });
}

// ============================================================
// useMemories
// ============================================================

export function useMemories() {
  return useQuery({
    queryKey: ["memories"],
    queryFn: fetchMemories,
    staleTime: 60_000,
    retry: 1,
  });
}

// ============================================================
// useUpdateMemory
// ============================================================

export function useUpdateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & V1MemoryUpdateRequest) =>
      updateMemory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });
}

// ============================================================
// useDeleteMemory
// ============================================================

export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });
}

// ============================================================
// usePreferences
// ============================================================

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

// ============================================================
// useUpdatePreferences
// ============================================================

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data);
    },
  });
}

// ============================================================
// useSubscriptionHistory
// ============================================================

export function useSubscriptionHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["subscription-history", page, pageSize],
    queryFn: () => fetchSubscriptionHistory(page, pageSize),
    staleTime: 60_000,
    retry: 1,
  });
}

// ============================================================
// useProfileUsage
// ============================================================

export function useProfileUsage() {
  return useQuery({
    queryKey: ["profile", "usage"],
    queryFn: fetchProfileUsage,
    staleTime: 60_000,
    retry: 1,
  });
}
