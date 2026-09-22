// ============================================================
// LEGALIR — Onboarding, Organization & Lawyer React Query Hooks
// ============================================================
// The onboarding decision is SERVER-DRIVEN: the client reads `nextStep`
// from /api/v1/onboarding and routes on it. It never guesses from a query
// string. Creating an organization or submitting a lawyer profile
// invalidates the onboarding + me families so the routing updates at once.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOnboarding,
  fetchOrganizations,
  createOrganization,
  fetchSignatories,
  addSignatory,
  removeSignatory,
  fetchLawyerOnboarding,
  submitLawyerOnboarding,
  type CreateOrganizationInput,
  type AddSignatoryInput,
} from "@/lib/api/v1";
import type { LawyerOnboardingInput } from "@legalir/types";

// --- Onboarding decision ---

export function useOnboarding() {
  return useQuery({
    queryKey: ["onboarding"],
    queryFn: fetchOnboarding,
    staleTime: 30_000,
    retry: 1,
  });
}

// --- Organizations ---

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => createOrganization(input),
    onSuccess: () => {
      // The user is now an org member — the onboarding decision changes.
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// --- Authorized signatories ---

export function useSignatories(orgId: string | null) {
  return useQuery({
    queryKey: ["organizations", orgId, "signatories"],
    queryFn: () => fetchSignatories(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAddSignatory(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddSignatoryInput) => addSignatory(orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "signatories"] });
    },
  });
}

export function useRemoveSignatory(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signatoryId: string) => removeSignatory(orgId, signatoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "signatories"] });
    },
  });
}

// --- Lawyer onboarding ---

export function useLawyerOnboarding() {
  return useQuery({
    queryKey: ["lawyer", "onboarding"],
    queryFn: fetchLawyerOnboarding,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSubmitLawyerOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LawyerOnboardingInput) => submitLawyerOnboarding(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyer", "onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
