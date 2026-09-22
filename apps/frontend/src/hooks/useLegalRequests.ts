// ============================================================
// LEGALIR — Legal Request React Query Hooks (PART 7)
// ============================================================
// The transition mutation invalidates both the list and the detail so the
// state badge and the timeline update together after a legal move.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLegalRequests,
  createLegalRequest,
  fetchLegalRequest,
  transitionLegalRequest,
} from "@/lib/api/v1";
import type { LegalRequestState } from "@legalir/types";

export function useLegalRequests() {
  return useQuery({
    queryKey: ["legal-requests", "list"],
    queryFn: fetchLegalRequests,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useLegalRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["legal-requests", "detail", id],
    queryFn: () => fetchLegalRequest(id!),
    enabled: !!id,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateLegalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; category: string; intakeAnswers?: Record<string, string> }) =>
      createLegalRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "list"] });
    },
  });
}

export function useTransitionLegalRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ to, note }: { to: LegalRequestState; note?: string }) =>
      transitionLegalRequest(id, to, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "list"] });
    },
  });
}
