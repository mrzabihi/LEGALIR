// ============================================================
// LEGALIR — Account, Points & Settings React Query Hooks
// ============================================================
// Points balance is derived from the ledger on the backend. The points
// account hook shares the same `["rewards","summary"]` invalidation family
// so the header badge, dashboard card and /points page stay in sync.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPointsAccount,
  fetchPointsTransactions,
  convertToLegal,
  updateAccountType,
  fetchNotificationSettings,
  updateNotificationSettings,
  fetchPrivacySettings,
  updatePrivacySettings,
  fetchSessions,
  revokeSession,
  revokeOtherSessions,
  deleteAccount,
} from "@/lib/api/v1";
import type {
  NotificationSettings,
  PrivacySettings,
  MeResponse,
  PlatformAccountType,
} from "@legalir/types";

// --- Points account ---

export function usePointsAccount() {
  return useQuery({
    queryKey: ["points", "account"],
    queryFn: fetchPointsAccount,
    staleTime: 60_000,
    retry: 1,
  });
}

export function usePointsTransactions(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["points", "transactions", page, pageSize],
    queryFn: () => fetchPointsTransactions(page, pageSize),
    staleTime: 60_000,
    retry: 1,
  });
}

// --- Account type ---

export function useConvertToLegal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => convertToLegal(),
    onSuccess: () => {
      // The account type lives on the `me` payload — refresh it everywhere.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/**
 * Set the platform account type (PERSONAL | BUSINESS). Optimistic: the
 * selector reflects the new type in the same frame, then reconciles with
 * the server response.
 */
export function useUpdateAccountType() {
  const queryClient = useQueryClient();
  const key = ["me"] as const;
  return useMutation({
    mutationFn: (accountType: PlatformAccountType) => updateAccountType(accountType),
    onMutate: async (accountType) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MeResponse>(key);
      if (previous) {
        queryClient.setQueryData<MeResponse>(key, {
          ...previous,
          user: { ...previous.user, platformAccountType: accountType },
        });
      }
      return { previous };
    },
    onError: (_err, _type, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// --- Notification settings ---

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["settings", "notifications"],
    queryFn: fetchNotificationSettings,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  const key = ["settings", "notifications"] as const;
  return useMutation({
    mutationFn: (updates: Partial<NotificationSettings>) =>
      updateNotificationSettings(updates),
    // Optimistic: the switch flips in the same frame as the tap; the server
    // response then reconciles the cache with the authoritative record.
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationSettings>(key);
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(key, { ...previous, ...updates });
      }
      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
    },
  });
}

// --- Privacy settings ---

export function usePrivacySettings() {
  return useQuery({
    queryKey: ["settings", "privacy"],
    queryFn: fetchPrivacySettings,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdatePrivacySettings() {
  const queryClient = useQueryClient();
  const key = ["settings", "privacy"] as const;
  return useMutation({
    mutationFn: (updates: Partial<PrivacySettings>) => updatePrivacySettings(updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PrivacySettings>(key);
      if (previous) {
        queryClient.setQueryData<PrivacySettings>(key, { ...previous, ...updates });
      }
      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
    },
  });
}

// --- Sessions ---

export function useSessions() {
  return useQuery({
    queryKey: ["settings", "sessions"],
    queryFn: fetchSessions,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "sessions"] });
    },
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "sessions"] });
    },
  });
}

// --- Account deletion ---

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: () => {
      // The account is gone — drop every cached query so no stale data
      // survives the redirect to the public site.
      queryClient.clear();
    },
  });
}
