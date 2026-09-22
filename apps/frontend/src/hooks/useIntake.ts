// ============================================================
// LEGALIR — Legal Intake Wizard React Query Hooks (PART 5)
// ============================================================
// The schema is cached per category (it is versioned and rarely changes).
// Draft mutations invalidate the drafts list so the resume list stays
// accurate without a manual refetch.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchIntakeSchema,
  fetchIntakeDrafts,
  createIntakeDraft,
  fetchIntakeDraft,
  updateIntakeDraft,
  deleteIntakeDraft,
} from "@/lib/api/v1";

export function useIntakeSchema(category: string | undefined) {
  return useQuery({
    queryKey: ["intake", "schema", category],
    queryFn: () => fetchIntakeSchema(category!),
    enabled: !!category,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useIntakeDrafts() {
  return useQuery({
    queryKey: ["intake", "drafts"],
    queryFn: fetchIntakeDrafts,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useIntakeDraft(id: string | undefined) {
  return useQuery({
    queryKey: ["intake", "draft", id],
    queryFn: () => fetchIntakeDraft(id!),
    enabled: !!id,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateIntakeDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (category: string) => createIntakeDraft(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake", "drafts"] });
    },
  });
}

export function useUpdateIntakeDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { currentStep?: number; answers?: Record<string, string>; savedAt?: string | null };
    }) => updateIntakeDraft(id, patch),
    onSuccess: (data) => {
      queryClient.setQueryData(["intake", "draft", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["intake", "drafts"] });
    },
  });
}

export function useDeleteIntakeDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIntakeDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake", "drafts"] });
    },
  });
}
