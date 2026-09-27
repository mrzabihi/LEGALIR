// ============================================================
// LEGALIR — Consultation React Query Hooks (PART 25)
// ============================================================
// A consultation is a LegalRequest, so the list reuses the legal-requests
// query key (one source of truth — never a parallel fetch). The detail
// and message mutations invalidate the list and the detail together so
// the status badge, timeline and room stay in step.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLegalRequests,
  createLegalRequest,
  fetchConsultation,
  respondToConsultation,
  sendConsultationMessage,
} from "@/lib/api/v1";

/** The caller's consultations (their legal requests), newest first. */
export function useConsultations() {
  return useQuery({
    queryKey: ["legal-requests", "list"],
    queryFn: fetchLegalRequests,
    staleTime: 30_000,
    retry: 1,
  });
}

/** One consultation's full case room. */
export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ["legal-requests", "detail", id],
    queryFn: () => fetchConsultation(id!),
    enabled: !!id,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateConsultation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      category: string;
      intakeAnswers?: Record<string, string>;
      selectedLawyerId?: string | null;
      attachmentDocumentIds?: string[];
    }) => createLegalRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "list"] });
    },
  });
}

/** The lawyer's accept/decline decision. */
export function useRespondToConsultation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, note }: { action: "accept" | "decline"; note?: string }) =>
      respondToConsultation(id, action, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["lawyer", "workspace"] });
    },
  });
}

/** Send a message in the case room. */
export function useSendConsultationMessage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendConsultationMessage(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-requests", "detail", id] });
    },
  });
}
