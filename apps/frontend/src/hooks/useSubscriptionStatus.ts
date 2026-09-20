// ============================================================
// LEGALIR — useSubscriptionStatus
// ============================================================
// The ONE hook every subscription surface consumes. Wraps the existing
// useCurrentSubscription query (same query key → shared cache, no
// duplicate fetch) and derives the canonical display state once.
// ============================================================

import { useCurrentSubscription } from "./useSubscription";
import {
  deriveSubscriptionStatus,
  type SubscriptionStatusView,
} from "@/lib/subscription";

export interface UseSubscriptionStatusResult {
  status: SubscriptionStatusView;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useSubscriptionStatus(): UseSubscriptionStatusResult {
  const query = useCurrentSubscription();

  return {
    status: deriveSubscriptionStatus(
      query.isLoading ? undefined : query.data ?? null
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
