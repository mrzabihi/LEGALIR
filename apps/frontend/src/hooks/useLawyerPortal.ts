// ============================================================
// LEGALIR — Lawyer portal React Query hooks
// ============================================================
// One key family (`["lawyer-portal", …]`) so an action can invalidate exactly
// what it changed: the referral itself, the list it appears in, and the
// dashboard counters derived from it.
// ============================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LawyerCaseFilters, LawyerReferralFilters } from "@legalir/types";
import {
  clearLawyerRate,
  fetchLawyerBank,
  fetchLawyerCase,
  fetchLawyerCases,
  fetchLawyerDashboard,
  fetchLawyerProfile,
  fetchLawyerRates,
  fetchLawyerReferral,
  fetchLawyerReferrals,
  fetchLawyerServices,
  runLawyerReferralAction,
  setLawyerRate,
  submitLawyerBank,
  updateLawyerAvatar,
  updateLawyerCaseTask,
  updateLawyerProfile,
  type LawyerAvatarPatch,
  type LawyerProfilePatch,
  type LawyerReferralActionPayload,
  type LawyerTaskStatus,
} from "@/lib/api/lawyer-portal";
import { queryKeys } from "@/lib/api/query-keys";

const root = ["lawyer-portal"] as const;

export const lawyerPortalKeys = {
  all: root,
  dashboard: [...root, "dashboard"] as const,
  referrals: (filters: LawyerReferralFilters) => [...root, "referrals", filters] as const,
  referralsAll: [...root, "referrals"] as const,
  referral: (id: string | undefined) => [...root, "referral", id] as const,
  profile: [...root, "profile"] as const,
  services: [...root, "services"] as const,
  rates: [...root, "rates"] as const,
  bank: [...root, "bank"] as const,
  cases: (filters: LawyerCaseFilters) => [...root, "cases", filters] as const,
  casesAll: [...root, "cases"] as const,
  case: (id: string | undefined) => [...root, "case", id] as const,
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useLawyerDashboard() {
  return useQuery({
    queryKey: lawyerPortalKeys.dashboard,
    queryFn: fetchLawyerDashboard,
    staleTime: 30_000,
    retry: false,
  });
}

export function useLawyerReferrals(filters: LawyerReferralFilters) {
  return useQuery({
    queryKey: lawyerPortalKeys.referrals(filters),
    queryFn: () => fetchLawyerReferrals(filters),
    staleTime: 15_000,
    retry: false,
    // Keep the previous page on screen while the next one loads — pagination
    // should never flash an empty table.
    placeholderData: (prev) => prev,
  });
}

export function useLawyerReferral(id: string | undefined) {
  return useQuery({
    queryKey: lawyerPortalKeys.referral(id),
    queryFn: () => fetchLawyerReferral(id as string),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: false,
  });
}

export function useLawyerProfile() {
  return useQuery({
    queryKey: lawyerPortalKeys.profile,
    queryFn: fetchLawyerProfile,
    staleTime: 30_000,
    retry: false,
  });
}

export function useLawyerServices() {
  return useQuery({
    queryKey: lawyerPortalKeys.services,
    queryFn: fetchLawyerServices,
    staleTime: 60_000,
    retry: false,
  });
}

export function useLawyerRates() {
  return useQuery({
    queryKey: lawyerPortalKeys.rates,
    queryFn: fetchLawyerRates,
    staleTime: 30_000,
    retry: false,
  });
}

export function useLawyerBank() {
  return useQuery({
    queryKey: lawyerPortalKeys.bank,
    queryFn: fetchLawyerBank,
    staleTime: 30_000,
    retry: false,
  });
}

export function useLawyerCases(filters: LawyerCaseFilters = {}) {
  return useQuery({
    queryKey: lawyerPortalKeys.cases(filters),
    queryFn: () => fetchLawyerCases(filters),
    staleTime: 15_000,
    retry: false,
    // Same reasoning as the referral list: paging must not blank the table.
    placeholderData: (prev) => prev,
  });
}

export function useLawyerCase(id: string | undefined) {
  return useQuery({
    queryKey: lawyerPortalKeys.case(id),
    queryFn: () => fetchLawyerCase(id as string),
    enabled: Boolean(id),
    staleTime: 10_000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Workflow mutation
// ---------------------------------------------------------------------------

/**
 * Every workflow verb funnels through one mutation so the cache invalidation
 * is written once: the detail, every referral list page and the dashboard all
 * describe the same request and must agree afterwards.
 */
export function useLawyerReferralAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LawyerReferralActionPayload) => runLawyerReferralAction(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.referral(id) });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.referralsAll });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.dashboard });
      // The client's own view is a different surface; its request query must
      // also pick up the new state/messages.
      void qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Profile / rates / bank mutations
// ---------------------------------------------------------------------------

export function useUpdateLawyerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LawyerProfilePatch) => updateLawyerProfile(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.profile });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.dashboard });
    },
  });
}

export function useUpdateLawyerAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LawyerAvatarPatch) => updateLawyerAvatar(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.profile });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.dashboard });
      // The shell's identity card reads the session `me` payload.
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useSetLawyerRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setLawyerRate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.rates });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.services });
    },
  });
}

export function useClearLawyerRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearLawyerRate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.rates });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.services });
    },
  });
}

export function useSubmitLawyerBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitLawyerBank,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.bank });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.dashboard });
    },
  });
}

/**
 * A task write changes three things at once: the case detail, the caseload row
 * (its open/blocked counters and the nearest deadline) and the dashboard tiles
 * built from those counters. Invalidate all three so no surface keeps a stale
 * number.
 */
export function useUpdateLawyerCaseTask(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; status: LawyerTaskStatus }) =>
      updateLawyerCaseTask(caseId as string, input.taskId, input.status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.case(caseId) });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.casesAll });
      void qc.invalidateQueries({ queryKey: lawyerPortalKeys.dashboard });
    },
  });
}
