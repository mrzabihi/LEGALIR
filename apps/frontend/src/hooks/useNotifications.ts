// ============================================================
// LEGALIR — Notification Center Hooks
// ============================================================
// One canonical query powers the header bell, the popover, the full
// center and the settings entry point. The unread count is read from
// that same cache entry — never fetched or computed separately.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/v1";
import type { NotificationsResponse } from "@legalir/types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications", "list"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Unread count derived from the shared feed — the single source of truth. */
export function useUnreadNotificationCount(): number {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}

/**
 * Mark one notification read. Optimistic: the dot clears in the same frame
 * as the tap, then the server response reconciles the whole feed.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationsResponse>(
        NOTIFICATIONS_QUERY_KEY
      );
      if (previous) {
        const items = previous.items.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_QUERY_KEY, {
          items,
          unreadCount: items.filter((n) => !n.read).length,
        });
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, data);
    },
  });
}

/** Mark every notification read. Optimistic for the same reason. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationsResponse>(
        NOTIFICATIONS_QUERY_KEY
      );
      if (previous) {
        queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_QUERY_KEY, {
          items: previous.items.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, data);
    },
  });
}
