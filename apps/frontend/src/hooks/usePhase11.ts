// ============================================================
// LEGALIR — Phase 11 React Query Hooks
// History, Memory, Profile, Preferences, Subscription History
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchHistory,
  archiveHistoryItem,
  deleteHistoryItem,
  editHistoryItem,
  fetchMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  fetchPreferences,
  updatePreferences,
  fetchSubscriptionHistory,
  fetchProfileUsage,
} from "@/lib/api/v1";
import type { V1MemoryListResponse, V1MemoryUpdateRequest } from "@legalir/types";

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
  archived?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["history", params],
    queryFn: () => fetchHistory(params),
    staleTime: 30_000,
    retry: 1,
  });
}

// ============================================================
// useArchiveHistoryItem — persist the archived flag
// ============================================================

export function useArchiveHistoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archiveHistoryItem(id, archived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

// ============================================================
// useDeleteHistoryItem — permanent delete (no undo)
// ============================================================

export function useDeleteHistoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHistoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

// ============================================================
// useEditHistoryItem — fork a completed item into a new process
// ============================================================

export function useEditHistoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => editHistoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
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
// useCreateMemory
// ============================================================

export function useCreateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      key: string;
      value: string;
      category?: "profile" | "preference" | "legal_context";
    }) => createMemory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
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
    // Optimistic: the switch flips in the same frame as the tap. The server
    // response then reconciles the whole list with the authoritative record.
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: ["memories"] });
      const previous = queryClient.getQueryData<V1MemoryListResponse>(["memories"]);
      if (previous) {
        queryClient.setQueryData<V1MemoryListResponse>(["memories"], {
          ...previous,
          items: previous.items.map((item) =>
            item.id === id ? { ...item, ...data } : item
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Failure → snap the row back to the last server truth.
      if (context?.previous) queryClient.setQueryData(["memories"], context.previous);
    },
    onSettled: () => {
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
      queryClient.setQueryData(["settings", "privacy"], data.privacy);
    },
  });
}

// ============================================================
// useUpdateMemoryEnabled — the global "حافظه" switch
// ============================================================
// `GET /api/v1/memories` reports `memoryEnabled` as a DERIVED value:
// `prefs.privacy.storeConversationHistory`. The switch therefore writes
// that privacy key — never a parallel field.
//
// The optimistic patch touches every cache that mirrors the flag
// (`["memories"]`, `["settings","privacy"]`, `["preferences"]`) so the
// memory page, the privacy page and anything else reading the same data
// flip in the same frame. On failure all of them snap back.

type PrivacyCache = { storeConversationHistory?: boolean } & Record<string, unknown>;

export function useUpdateMemoryEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) =>
      updatePreferences({ privacy: { storeConversationHistory: enabled } }),
    onMutate: async (enabled) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["memories"] }),
        queryClient.cancelQueries({ queryKey: ["settings", "privacy"] }),
        queryClient.cancelQueries({ queryKey: ["preferences"] }),
      ]);
      const previous = {
        memories: queryClient.getQueryData<V1MemoryListResponse>(["memories"]),
        privacy: queryClient.getQueryData<PrivacyCache>(["settings", "privacy"]),
        preferences: queryClient.getQueryData(["preferences"]),
      };
      queryClient.setQueryData<V1MemoryListResponse | undefined>(
        ["memories"],
        (old) => (old ? { ...old, memoryEnabled: enabled } : old)
      );
      queryClient.setQueryData<PrivacyCache | undefined>(
        ["settings", "privacy"],
        (old) => (old ? { ...old, storeConversationHistory: enabled } : old)
      );
      return previous;
    },
    onError: (_err, _enabled, context) => {
      if (context?.memories) queryClient.setQueryData(["memories"], context.memories);
      if (context?.privacy)
        queryClient.setQueryData(["settings", "privacy"], context.privacy);
      if (context?.preferences)
        queryClient.setQueryData(["preferences"], context.preferences);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["preferences"], data);
      queryClient.setQueryData(["settings", "privacy"], data.privacy);
      queryClient.invalidateQueries({ queryKey: ["memories"] });
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
