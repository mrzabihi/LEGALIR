// ============================================================
// LEGALIR — Admin panel React Query hooks
// ============================================================
// One hook per admin data dependency. All cache keys are namespaced under
// ["admin", ...] so a mutation can invalidate a precise slice. The hooks
// carry no authorization logic — the server enforces every permission.
// ============================================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PlatformRole,
  Permission,
  FeatureFlag,
  LawyerSettlement,
  AiProviderConfig,
  RagSource,
  SupportTicket,
  AdminSubscriptionActionInput,
  AdminEnergyActionInput,
  AdminLegalSource,
  UpsertLegalSourceInput,
  ContractStampActionRequest,
  JudicialDocumentType,
  JudicialReviewQueueFilters,
  JudicialAdminReviewActionInput,
  JudicialOrderQueueFilters,
  JudicialAdminOrderUpdateInput,
  UsageReportQuery,
  PlatformWorkCalendar,
  LawyerBankReview,
} from "@legalir/types";
import { roleHasPermission, canAccessAdminPanel } from "@legalir/types";
import { useMe } from "@/hooks/useDashboard";
import {
  fetchAdminOverview,
  fetchAdminReports,
  fetchAdminLiveReport,
  type AdminWindow,
  fetchAdminUsers,
  fetchAdminUser,
  fetchAdminUserSubscription,
  fetchAdminUserUsageReport,
  fetchAdminTariffHistory,
  adminSubscriptionAction,
  adminEnergyAction,
  fetchAdminRequests,
  fetchAdminRequest,
  fetchAdminDiscovery,
  assignRequestLawyer,
  changeRequestState,
  overrideRequestDeadline,
  reassignRequest,
  fetchAdminSla,
  saveAdminSlaPolicy,
  saveAdminWorkCalendar,
  fetchAdminUserRequests,
  reviewAdminLawyerBank,
  type AdminSlaPolicyInput,
  fetchAdminContracts,
  fetchAdminContract,
  reviewAdminContract,
  fetchAdminLegalReview,
  saveAdminLegalClause,
  saveAdminPreSignTip,
  deleteAdminLegalReviewItem,
  type SaveAdminLegalClauseInput,
  type SaveAdminPreSignTipInput,
  fetchAdminContractStamp,
  decideAdminContractStamp,
  recordAdminAttestation,
  type RecordAttestationInput,
  resendAdminInvitations,
  type ResendInvitationsInput,
  type AdminContractsQuery,
  fetchAdminFlags,
  updateAdminFlag,
  type UpdateFlagInput,
  fetchAdminJudicial,
  updateAdminJudicialService,
  createAdminJudicialQuestionnaireVersion,
  publishAdminJudicialQuestionnaire,
  fetchAdminJudicialReviews,
  fetchAdminJudicialReview,
  actOnAdminJudicialReview,
  fetchAdminJudicialOrders,
  fetchAdminJudicialOrder,
  updateAdminJudicialOrder,
  type JudicialServiceUpdateInput,
  fetchAdminOrders,
  fetchAdminOrder,
  fetchAdminOrderReceipt,
  createAdminRefund,
  decideAdminRefund,
  type CreateRefundInput,
  fetchCommissionRules,
  updateCommissionRule,
  type UpdateCommissionRuleInput,
  fetchAdminSettlements,
  fetchAdminSettlement,
  createAdminSettlement,
  type CreateSettlementInput,
  addAdminSettlementLine,
  type AddSettlementLineInput,
  transitionAdminSettlement,
  type SettlementTransitionInput,
  fetchAiProviders,
  saveAiProvider,
  type SaveAiProviderInput,
  testAiProvider,
  fetchAiPrompts,
  createAiPromptVersion,
  type CreatePromptVersionInput,
  activateAiPromptVersion,
  fetchAiUsageMetrics,
  fetchChatToolSettings,
  updateChatToolSetting,
  type UpdateChatToolSettingInput,
  fetchRagSources,
  updateRagReview,
  type UpdateRagReviewInput,
  fetchRagPipeline,
  fetchRagSourceDetail,
  testRagRetrieval,
  reingestRagCorpus,
  fetchAdminBlog,
  createBlogPost,
  updateBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
  generateBlogDraft,
  fetchAdminLegalLibrary,
  createLegalSource,
  updateLegalSource,
  setLegalSourceStatus,
  deleteLegalSource,
  fetchCalculatorsInventory,
  updateCalculatorSetting,
  type UpdateCalculatorSettingInput,
  fetchCalculatorRules,
  fetchCalculatorRuleBoard,
  fetchCalculatorRuleDetail,
  saveCalculatorRuleDraft,
  type SaveCalculatorRuleDraftInput,
  previewCalculatorRuleDraft,
  publishCalculatorRule,
  rollbackCalculatorRule,
  deleteCalculatorRuleDraft,
  fetchSupportTickets,
  fetchSupportTicket,
  createSupportTicket,
  type CreateTicketInput,
  addSupportMessage,
  updateSupportTicket,
  type UpdateTicketInput,
  fetchAdminContent,
  fetchAdminStaff,
  fetchAdminStaffMember,
  fetchAdminRoles,
  changeStaffRole,
  fetchAdminAudit,
  type AdminAuditQuery,
  fetchAdminSettings,
  fetchAdminLawyers,
  fetchAdminLawyer,
  decideLawyerVerification,
  sendLawyerMessage,
  updateAdminLawyer,
  setAdminLawyerStatus,
  setAdminLawyerRating,
  setAdminLawyerAvatar,
  setAdminLawyerFeatured,
  moderateAdminLawyerReview,
  type AdminLawyerPatchInput,
  fetchAdminPlans,
  fetchAdminPlan,
  updateAdminPlan,
  createAdminPlan,
  setAdminPlanStatus,
  type AdminPlanUpdate,
  type AdminPlanCreateInput,
  fetchCostProfiles,
  fetchCostProfile,
  saveCostProfile,
  type SaveCostProfileInput,
  saveCostRule,
  type SaveCostRuleInput,
  deleteCostRule,
  fetchUsageLedger,
  type AdminLedgerQuery,
  fetchUsageSummary,
  type AdminUsersQuery,
  type AdminRequestsQuery,
  type AdminDiscoveryQuery,
  type AdminOrdersQuery,
  fetchAdminAnnouncements,
  createAdminAnnouncement,
  setAdminAnnouncementStatus,
  fetchAdminCoupons,
  fetchAdminCoupon,
  createAdminCoupon,
  updateAdminCoupon,
  setAdminCouponStatus,
  type AdminCouponDraft,
  type AdminCouponRow,
} from "@/lib/api/admin";
import type {
  PlanStatus,
  SettlementStatus,
  SupportTicketStatus,
  SupportTicketPriority,
  RagReviewState,
  LawyerDecisionBucket,
  LawyerVerificationStatus,
  AdminLawyerStatus,
  LawyerAvatarType,
  ServiceCostProfile,
  ServiceCostRule,
  LegalRequestState,
  AnnouncementStatus,
  CreateAnnouncementInput,
  AdminAnnouncement,
  AdminContractReviewActionRequest,
  AdminBlogPost,
  UpsertBlogPostInput,
  GenerateBlogDraftInput,
  CouponStatus,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Identity gate (UX only)
// ---------------------------------------------------------------------------

/**
 * The current staff identity + a permission predicate. This is a UX
 * affordance: the same permission is re-checked server-side on every admin
 * API call, so hiding a control here is never the security boundary.
 */
export function useAdminMe() {
  const me = useMe();
  const role = me.data?.user.role as PlatformRole | undefined;
  const isStaff = role ? canAccessAdminPanel(role) : false;
  const can = (permission: Permission): boolean =>
    role ? roleHasPermission(role, permission) : false;
  return {
    ...me,
    role: role ?? null,
    isStaff,
    can,
  };
}

// ---------------------------------------------------------------------------
// Overview, reports, settings
// ---------------------------------------------------------------------------

export function useAdminOverview(rangeDays = 30, window?: AdminWindow | null) {
  return useQuery({
    queryKey: ["admin", "overview", rangeDays, window?.from ?? null, window?.to ?? null],
    queryFn: () => fetchAdminOverview(rangeDays, window),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminReports(
  rangeDays = 30,
  options: { enabled?: boolean; window?: AdminWindow | null } = {}
) {
  return useQuery({
    queryKey: ["admin", "reports", rangeDays, options.window?.from ?? null, options.window?.to ?? null],
    queryFn: () => fetchAdminReports(rangeDays, options.window),
    staleTime: 60_000,
    retry: 1,
    enabled: options.enabled ?? true,
  });
}

/** Default live cadence. A dashboard snapshot does not need sub-minute freshness. */
export const LIVE_REFRESH_MS = 30_000;
/** Back-off ceiling: after repeated failures a poll waits at most this long. */
export const LIVE_MAX_BACKOFF_MS = 120_000;

/**
 * The polling policy for the live report, as a PURE function so it can be
 * proven without timers. Returns the next interval in ms, or `false` to stop.
 *  • paused  → stop (keep the last data);
 *  • hidden  → stop (a background tab makes no requests);
 *  • failed  → back off monotonically (base × (failures + 1)), capped;
 *  • ok      → the base cadence.
 */
export function liveRefetchInterval(opts: {
  paused: boolean;
  hidden: boolean;
  failures: number;
  base?: number;
}): number | false {
  if (opts.paused) return false;
  if (opts.hidden) return false;
  const base = opts.base ?? LIVE_REFRESH_MS;
  const failures = Math.max(0, opts.failures);
  if (failures > 0) return Math.min(base * (failures + 1), LIVE_MAX_BACKOFF_MS);
  return base;
}

/**
 * The «گزارش زنده» live snapshot with ADAPTIVE polling. It is the project's
 * first admin live mechanism, so it is deliberately conservative:
 *
 *   • ONE shared query key (`["admin","live",…]`) — a single request per tick,
 *     never one per consumer, and never any parallel fan-out;
 *   • the interval is `false` while PAUSED and while the TAB IS HIDDEN, so a
 *     background or paused tab makes no requests at all;
 *   • after a failed fetch the cadence grows (2×, 3×, 4× … capped) so a flapping
 *     endpoint is never hammered; a success resets it to the base interval;
 *   • `enabled` is tied only to the caller's permission gate — pausing does NOT
 *     disable the query, so the last successful data stays in cache and can be
 *     shown labelled as stale instead of disappearing.
 *
 * The server is the source of truth for every number; this hook only decides HOW
 * OFTEN to ask, never WHAT to show.
 */
export function useAdminLiveReport(
  rangeDays = 30,
  options: {
    enabled?: boolean;
    window?: AdminWindow | null;
    /** Operator pressed «توقف» — stop polling but keep the last data. */
    paused?: boolean;
    intervalMs?: number;
  } = {}
) {
  const paused = options.paused ?? false;
  const base = options.intervalMs ?? LIVE_REFRESH_MS;

  return useQuery({
    queryKey: ["admin", "live", rangeDays, options.window?.from ?? null, options.window?.to ?? null],
    queryFn: () => fetchAdminLiveReport(rangeDays, options.window),
    enabled: options.enabled ?? true,
    staleTime: base / 2,
    retry: 1,
    refetchIntervalInBackground: false,
    refetchInterval: (query) =>
      liveRefetchInterval({
        paused,
        hidden: typeof document !== "undefined" && document.hidden,
        // `errorUpdateCount` is the number of failed fetches for this observer;
        // the policy backs off monotonically and caps so a broken endpoint is
        // retried gently rather than hammered.
        failures: query.state.errorUpdateCount ?? 0,
        base,
      }),
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: fetchAdminSettings,
    staleTime: 60_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Users & requests
// ---------------------------------------------------------------------------

export function useAdminUsers(query: AdminUsersQuery = {}) {
  return useQuery({
    queryKey: ["admin", "users", query],
    queryFn: () => fetchAdminUsers(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: ["admin", "users", "detail", id],
    queryFn: () => fetchAdminUser(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * One user's full billing dossier: current plan, energy summary, subscription
 * history, payments and the unified ledger.
 */
export function useAdminUserSubscription(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "users", "subscription", userId],
    queryFn: () => fetchAdminUserSubscription(userId as string),
    enabled: Boolean(userId),
    staleTime: 15_000,
    retry: 1,
  });
}

/**
 * One user's «مصرف انرژی و توکن» report. Reads the SAME projection as the
 * user's own usage page — the operator can never see a different total.
 */
export function useAdminUserUsageReport(
  userId: string | null,
  query: UsageReportQuery = {}
) {
  return useQuery({
    queryKey: ["admin", "users", "usage", userId, query],
    queryFn: () => fetchAdminUserUsageReport(userId as string, query),
    enabled: Boolean(userId),
    staleTime: 15_000,
    retry: 1,
  });
}

/** The append-only tariff change log (who changed what, and when). */
export function useAdminTariffHistory(entityId?: string) {
  return useQuery({
    queryKey: ["admin", "energy", "history", entityId ?? "all"],
    queryFn: () => fetchAdminTariffHistory(entityId),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Apply an audited admin subscription action (activate/extend/deactivate/change_plan). */
export function useAdminSubscriptionAction(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminSubscriptionActionInput) =>
      adminSubscriptionAction(userId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users", "subscription", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

/** Grant or adjust a user's reward energy (audited). */
export function useAdminEnergyAction(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminEnergyActionInput) => adminEnergyAction(userId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users", "subscription", userId] });
    },
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: fetchAdminPlans,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/**
 * Refresh the PUBLIC plan catalog after an admin plan write. `/subscription`
 * and `/pricing` read the SAME catalog (queryKey `["v1","plans"]`, 10-min
 * staleTime) the admin edits — so without this a freshly created or published
 * plan would not appear there until that cache expired. `["plans"]` covers the
 * legacy `usePlans` key too. One helper, shared by every plan mutation.
 */
function invalidatePublicPlans(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ["v1", "plans"] });
  void qc.invalidateQueries({ queryKey: ["plans"] });
}

export function useAdminPlan(code: string | null) {
  return useQuery({
    queryKey: ["admin", "plans", "detail", code],
    queryFn: () => fetchAdminPlan(code as string),
    enabled: Boolean(code),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUpdateAdminPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, input }: { code: string; input: AdminPlanUpdate }) =>
      updateAdminPlan(code, input),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "plans", "detail", updated.code], (old: unknown) =>
        old && typeof old === "object" ? { ...(old as object), plan: updated } : old
      );
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      invalidatePublicPlans(qc);
    },
  });
}

export function useCreateAdminPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminPlanCreateInput) => createAdminPlan(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      invalidatePublicPlans(qc);
    },
  });
}

export function useSetAdminPlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, status }: { code: string; status: PlanStatus }) =>
      setAdminPlanStatus(code, status),
    onSuccess: (updated) => {
      qc.setQueryData(["admin", "plans", "detail", updated.code], (old: unknown) =>
        old && typeof old === "object" ? { ...(old as object), plan: updated } : old
      );
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
      invalidatePublicPlans(qc);
    },
  });
}

export function useAdminRequests(query: AdminRequestsQuery = {}) {
  return useQuery({
    queryKey: ["admin", "requests", query],
    queryFn: () => fetchAdminRequests(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAdminRequest(id: string | null) {
  return useQuery({
    queryKey: ["admin", "requests", "detail", id],
    queryFn: () => fetchAdminRequest(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminDiscovery(query: AdminDiscoveryQuery = {}) {
  return useQuery({
    queryKey: ["admin", "discovery", query],
    queryFn: () => fetchAdminDiscovery(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAssignRequestLawyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lawyerId }: { id: string; lawyerId: string | null }) =>
      assignRequestLawyer(id, lawyerId),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "requests", "detail", id] });
      qc.invalidateQueries({ queryKey: ["admin", "requests"] });
    },
  });
}

export function useChangeRequestState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state, note }: { id: string; state: LegalRequestState; note?: string }) =>
      changeRequestState(id, state, note),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "requests", "detail", id] });
      qc.invalidateQueries({ queryKey: ["admin", "requests"] });
    },
  });
}

/**
 * §5 — shift one SLA deadline. The server refuses a missing reason and records
 * the previous/next instants itself, so the client only carries the input.
 */
export function useOverrideRequestDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      phase,
      nextDueAt,
      reason,
    }: {
      id: string;
      phase: "RESPONSE" | "COMPLETION";
      nextDueAt: string | null;
      reason: string;
    }) => overrideRequestDeadline(id, { phase, nextDueAt, reason }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "requests", "detail", id] });
      qc.invalidateQueries({ queryKey: ["admin", "requests"] });
    },
  });
}

/** §8 — re-refer a request to another approved lawyer, with a reason. */
export function useReassignRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lawyerId, reason }: { id: string; lawyerId: string; reason: string }) =>
      reassignRequest(id, { lawyerId, reason }),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "requests", "detail", id] });
      qc.invalidateQueries({ queryKey: ["admin", "requests"] });
    },
  });
}

// ---------------------------------------------------------------------------
// §5 — SLA configuration
// ---------------------------------------------------------------------------

export function useAdminSla() {
  return useQuery({
    queryKey: ["admin", "sla"],
    queryFn: fetchAdminSla,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSaveAdminSlaPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceKey, input }: { serviceKey: string; input: AdminSlaPolicyInput }) =>
      saveAdminSlaPolicy(serviceKey, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sla"] });
    },
  });
}

export function useSaveAdminWorkCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PlatformWorkCalendar, "updatedAt" | "updatedBy">) =>
      saveAdminWorkCalendar(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sla"] });
    },
  });
}

// ---------------------------------------------------------------------------
// §8 — one user's requests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §7 — settlement-account review
// ---------------------------------------------------------------------------

export function useReviewLawyerBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lawyerId, review }: { lawyerId: string; review: LawyerBankReview }) =>
      reviewAdminLawyerBank(lawyerId, review),
    onSuccess: (_res, { lawyerId }) => {
      void qc.invalidateQueries({ queryKey: ["admin", "lawyers", "detail", lawyerId] });
    },
  });
}

// ---------------------------------------------------------------------------
// §8 — one user's requests
// ---------------------------------------------------------------------------

export function useAdminUserRequests(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "users", "requests", userId],
    queryFn: () => fetchAdminUserRequests(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Contracts — the admin review queue (§6/§7)
// ---------------------------------------------------------------------------

export function useAdminContracts(query: AdminContractsQuery = {}) {
  return useQuery({
    queryKey: ["admin", "contracts", query],
    queryFn: () => fetchAdminContracts(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAdminContract(id: string | null) {
  return useQuery({
    queryKey: ["admin", "contracts", "detail", id],
    queryFn: () => fetchAdminContract(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

/**
 * Record a review decision (approve / reject / request_info / cancel). A
 * decision moves the contract's state, so both the queue slice and the
 * detail must refetch — the row's approval badge and the decision panel both
 * change. On an approve we also refresh the public verification surfaces the
 * owner reads.
 */
export function useAdminContractReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminContractReviewActionRequest }) =>
      reviewAdminContract(id, input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
      qc.invalidateQueries({ queryKey: ["admin", "contracts", "detail", id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Legal review (§7) — per-type clause sources and pre-sign tips
// ---------------------------------------------------------------------------

/**
 * The legal-review report for every contract type. One query, because the
 * page compares types side by side and a save must move the counts AND the
 * rows together.
 */
export function useAdminLegalReview() {
  return useQuery({
    queryKey: ["admin", "legal-review"],
    queryFn: () => fetchAdminLegalReview(),
    staleTime: 15_000,
    retry: 1,
  });
}

/**
 * Saving legal content changes what the printed annex says on every
 * contract of that type, so invalidate the legal-review slice AND the
 * contract slices (both admin and owner-facing) — a reviewer's correction
 * must never be visible only after a manual refresh.
 */
function useInvalidateLegalReview() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin", "legal-review"] });
    qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };
}

export function useSaveAdminLegalClause() {
  const invalidate = useInvalidateLegalReview();
  return useMutation({
    mutationFn: (input: SaveAdminLegalClauseInput) => saveAdminLegalClause(input),
    onSuccess: invalidate,
  });
}

export function useSaveAdminPreSignTip() {
  const invalidate = useInvalidateLegalReview();
  return useMutation({
    mutationFn: (input: SaveAdminPreSignTipInput) => saveAdminPreSignTip(input),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminLegalReviewItem() {
  const invalidate = useInvalidateLegalReview();
  return useMutation({
    mutationFn: ({
      kind,
      id,
      reason,
    }: {
      kind: "clause" | "tip";
      id: string;
      reason?: string;
    }) => deleteAdminLegalReviewItem(kind, id, reason),
    onSuccess: invalidate,
  });
}

/**
 * The stamp context for one contract (Super Admin). Keyed separately from
 * the review detail so the stamp panel refetches ONLY itself after a stamp
 * decision — the stamp trail never depends on the review query.
 */
export function useAdminContractStamp(id: string | null) {
  return useQuery({
    queryKey: ["admin", "contracts", "stamp", id],
    queryFn: () => fetchAdminContractStamp(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

/**
 * Record a stamp decision. An applied stamp changes the contract's state,
 * its audit trail AND the PDF the owner downloads, so every slice that
 * reads the contract is invalidated — and a `notify` failure appended by
 * the server must show up in the stamp trail without a manual refresh.
 */
export function useAdminContractStampDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContractStampActionRequest }) =>
      decideAdminContractStamp(id, input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
      qc.invalidateQueries({ queryKey: ["admin", "contracts", "stamp", id] });
      qc.invalidateQueries({ queryKey: ["admin", "contracts", "detail", id] });
    },
  });
}

/**
 * Record an admin verification of a party's signature. Neither the party's
 * status nor the contract state changes, so the queue slice is left alone;
 * the detail is refreshed because the attestation list and the signature
 * trail both gain a row.
 */
export function useAdminContractAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordAttestationInput }) =>
      recordAdminAttestation(id, input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "contracts", "detail", id] });
    },
  });
}

/**
 * Send or resend signature links from the admin panel. The invitation and
 * its per-recipient event trail both change, so the detail is refreshed; the
 * queue slice is untouched because no contract state moves.
 */
export function useAdminResendInvitations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResendInvitationsInput }) =>
      resendAdminInvitations(id, input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "contracts", "detail", id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export function useAdminFlags() {
  return useQuery({
    queryKey: ["admin", "flags"],
    queryFn: fetchAdminFlags,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUpdateAdminFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: UpdateFlagInput }) =>
      updateAdminFlag(key, input),
    onSuccess: (updated: FeatureFlag) => {
      qc.setQueryData<{ items: FeatureFlag[] }>(["admin", "flags"], (old) =>
        old ? { items: old.items.map((f) => (f.key === updated.key ? updated : f)) } : old
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Judicial services
// ---------------------------------------------------------------------------

export function useAdminJudicial() {
  return useQuery({
    queryKey: ["admin", "judicial"],
    queryFn: fetchAdminJudicial,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUpdateAdminJudicialService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: JudicialServiceUpdateInput }) =>
      updateAdminJudicialService(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "judicial"] });
    },
  });
}

export function useCreateJudicialQuestionnaireVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      documentType: JudicialDocumentType;
      titleFa?: string;
      descriptionFa?: string;
      disclaimerFa?: string;
    }) => createAdminJudicialQuestionnaireVersion(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "judicial"] });
    },
  });
}

export function usePublishJudicialQuestionnaire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishAdminJudicialQuestionnaire(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "judicial"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Judicial review queue & tracked orders (§7)
// ---------------------------------------------------------------------------
// The queue is keyed by its filters so switching a tab reads that tab's slice
// and the server-computed counts. The detail is keyed separately: an action on
// one review refetches THAT review and the queue (its status moved), never
// every open drawer.

export function useAdminJudicialReviews(query: JudicialReviewQueueFilters = {}) {
  return useQuery({
    queryKey: ["admin", "judicial", "reviews", query],
    queryFn: () => fetchAdminJudicialReviews(query),
    staleTime: 15_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAdminJudicialReview(reviewId: string | null) {
  return useQuery({
    queryKey: ["admin", "judicial", "reviews", "detail", reviewId],
    queryFn: () => fetchAdminJudicialReview(reviewId as string),
    enabled: Boolean(reviewId),
    staleTime: 10_000,
    retry: 1,
  });
}

/**
 * Record ONE review action. An `approve` also issues the final artifact, so
 * the queue, the detail AND the owner's own request view all change: the
 * owner-facing slice is invalidated too, never left showing "pending".
 */
export function useAdminJudicialReviewAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      input,
    }: {
      reviewId: string;
      input: JudicialAdminReviewActionInput;
    }) => actOnAdminJudicialReview(reviewId, input),
    onSuccess: (_res, { reviewId }) => {
      qc.invalidateQueries({ queryKey: ["admin", "judicial", "reviews"] });
      qc.invalidateQueries({
        queryKey: ["admin", "judicial", "reviews", "detail", reviewId],
      });
      // The owner's request detail carries the review + the issued document.
      qc.invalidateQueries({ queryKey: ["judicial"] });
    },
  });
}

export function useAdminJudicialOrders(query: JudicialOrderQueueFilters = {}) {
  return useQuery({
    queryKey: ["admin", "judicial", "orders", query],
    queryFn: () => fetchAdminJudicialOrders(query),
    staleTime: 15_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAdminJudicialOrder(orderId: string | null) {
  return useQuery({
    queryKey: ["admin", "judicial", "orders", "detail", orderId],
    queryFn: () => fetchAdminJudicialOrder(orderId as string),
    enabled: Boolean(orderId),
    staleTime: 10_000,
    retry: 1,
  });
}

export function useUpdateAdminJudicialOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: JudicialAdminOrderUpdateInput;
    }) => updateAdminJudicialOrder(orderId, input),
    onSuccess: (_res, { orderId }) => {
      qc.invalidateQueries({ queryKey: ["admin", "judicial", "orders"] });
      qc.invalidateQueries({
        queryKey: ["admin", "judicial", "orders", "detail", orderId],
      });
      qc.invalidateQueries({ queryKey: ["judicial"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Orders & refunds
// ---------------------------------------------------------------------------

export function useAdminOrders(query: AdminOrdersQuery = {}) {
  return useQuery({
    queryKey: ["admin", "orders", query],
    queryFn: () => fetchAdminOrders(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

export function useAdminOrder(id: string | null) {
  return useQuery({
    queryKey: ["admin", "orders", "detail", id],
    queryFn: () => fetchAdminOrder(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Receipt descriptor for one order. Fetched on demand (when a viewer opens). */
export function useAdminOrderReceipt(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["admin", "orders", "receipt", id],
    queryFn: () => fetchAdminOrderReceipt(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateAdminRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CreateRefundInput }) =>
      createAdminRefund(orderId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

export function useDecideAdminRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      decideAdminRefund(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Finance & settlements
// ---------------------------------------------------------------------------

export function useCommissionRules() {
  return useQuery({
    queryKey: ["admin", "finance", "rules"],
    queryFn: fetchCommissionRules,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateCommissionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCommissionRuleInput) => updateCommissionRule(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "finance", "rules"] });
    },
  });
}

export function useAdminSettlements(filter: { lawyerId?: string; status?: SettlementStatus } = {}) {
  return useQuery({
    queryKey: ["admin", "settlements", filter],
    queryFn: () => fetchAdminSettlements(filter),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminSettlement(id: string | null) {
  return useQuery({
    queryKey: ["admin", "settlements", "detail", id],
    queryFn: () => fetchAdminSettlement(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateAdminSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSettlementInput) => createAdminSettlement(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settlements"] }),
  });
}

export function useAddSettlementLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddSettlementLineInput }) =>
      addAdminSettlementLine(id, input),
    onSuccess: (updated: LawyerSettlement) => {
      qc.setQueryData(["admin", "settlements", "detail", updated.id], updated);
      qc.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
  });
}

export function useTransitionSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SettlementTransitionInput }) =>
      transitionAdminSettlement(id, input),
    onSuccess: (updated: LawyerSettlement) => {
      qc.setQueryData(["admin", "settlements", "detail", updated.id], updated);
      qc.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
  });
}

// ---------------------------------------------------------------------------
// AI providers, prompts & metrics
// ---------------------------------------------------------------------------

export function useAiProviders() {
  return useQuery({
    queryKey: ["admin", "ai", "providers"],
    queryFn: fetchAiProviders,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useSaveAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveAiProviderInput) => saveAiProvider(input),
    onSuccess: (saved: AiProviderConfig) => {
      qc.setQueryData<{ items: AiProviderConfig[]; secretStorageConfigured: boolean }>(
        ["admin", "ai", "providers"],
        (old) => {
          if (!old) return old;
          const exists = old.items.some((p) => p.id === saved.id);
          return {
            ...old,
            items: exists
              ? old.items.map((p) => (p.id === saved.id ? saved : p))
              : [...old.items, saved],
          };
        }
      );
    },
  });
}

export function useTestAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testAiProvider(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "ai", "providers"] }),
  });
}

export function useAiPrompts(key?: string) {
  return useQuery({
    queryKey: ["admin", "ai", "prompts", key ?? null],
    queryFn: () => fetchAiPrompts(key),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateAiPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePromptVersionInput) => createAiPromptVersion(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "ai", "prompts"] }),
  });
}

export function useActivateAiPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateAiPromptVersion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "ai", "prompts"] }),
  });
}

export function useAiMetrics(rangeDays = 30) {
  return useQuery({
    queryKey: ["admin", "ai", "metrics", rangeDays],
    queryFn: () => fetchAiUsageMetrics(rangeDays),
    staleTime: 60_000,
    retry: 1,
  });
}

// --- Contextual chat tools ------------------------------------------------
// `available` is the server's capability verdict and is NOT editable here;
// the toggle only changes `enabled`, which the backend enforces.

export function useChatToolSettings() {
  return useQuery({
    queryKey: ["admin", "ai", "tools"],
    queryFn: fetchChatToolSettings,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUpdateChatToolSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ toolId, input }: { toolId: string; input: UpdateChatToolSettingInput }) =>
      updateChatToolSetting(toolId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "ai", "tools"] });
      // The chat surface reads its projection from this key — a settings
      // change should be reflected there on the next visit.
      qc.invalidateQueries({ queryKey: ["chat-tools"] });
    },
  });
}

// ---------------------------------------------------------------------------
// RAG
// ---------------------------------------------------------------------------

export function useRagSources(filter: { reviewState?: RagReviewState; search?: string } = {}) {
  return useQuery({
    queryKey: ["admin", "rag", "sources", filter],
    queryFn: () => fetchRagSources(filter),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUpdateRagReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRagReviewInput }) =>
      updateRagReview(id, input),
    onSuccess: (updated: RagSource) => {
      qc.invalidateQueries({ queryKey: ["admin", "rag", "sources"] });
      qc.invalidateQueries({ queryKey: ["admin", "rag", "pipeline"] });
      void updated;
    },
  });
}

/** §1 — the pipeline status card (corpus stats + catalog coverage). */
export function useRagPipeline() {
  return useQuery({
    queryKey: ["admin", "rag", "pipeline"],
    queryFn: fetchRagPipeline,
    staleTime: 30_000,
    retry: 1,
  });
}

/** §1 — per-source detail (the searchable chunks). */
export function useRagSourceDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "rag", "source", id],
    queryFn: () => fetchRagSourceDetail(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: 1,
  });
}

/** §1 — live retrieval test through the existing pipeline (mutation, not cached). */
export function useTestRagRetrieval() {
  return useMutation({
    mutationFn: ({ query, maxResults }: { query: string; maxResults?: number }) =>
      testRagRetrieval(query, maxResults),
  });
}

/** §1 — re-run ingestion; refreshes sources + counts + pipeline afterwards. */
export function useReingestRagCorpus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reingestRagCorpus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "rag"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Blog management + AI content generation (§2)
// ---------------------------------------------------------------------------

const BLOG_KEY = ["admin", "blog"] as const;

/** The admin blog list + categories (the SAME store the public site reads). */
export function useAdminBlog() {
  return useQuery({
    queryKey: BLOG_KEY,
    queryFn: fetchAdminBlog,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Create a post (created as a draft unless a status is supplied). */
export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertBlogPostInput) => createBlogPost(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "content"] });
    },
  });
}

/** Update a post's fields (leaves status untouched unless passed). */
export function useUpdateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertBlogPostInput }) =>
      updateBlogPost(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "content"] });
    },
  });
}

/** Publish / unpublish / schedule — a status-only transition. */
export function useSetBlogPostStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminBlogPost["status"] }) =>
      setBlogPostStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "content"] });
    },
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBlogPost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "content"] });
    },
  });
}

/** §2 — generate an AI draft (never auto-published). */
export function useGenerateBlogDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateBlogDraftInput) => generateBlogDraft(input),
    onSuccess: (res) => {
      // Only a saved draft changes the list.
      if (res.savedPostId) {
        qc.invalidateQueries({ queryKey: BLOG_KEY });
        qc.invalidateQueries({ queryKey: ["admin", "content"] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Legal-library management (کتابخانه لیگالیر)
// ---------------------------------------------------------------------------
// Its own cache namespace — never shared with the blog slice, so a library
// mutation can never accidentally refresh the blog list (or vice-versa).

const LIBRARY_KEY = ["admin", "legal-library"] as const;

/** The admin library list + topics (the SAME store the public library reads). */
export function useAdminLegalLibrary() {
  return useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: fetchAdminLegalLibrary,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Create a source (created as a draft unless a status is supplied). */
export function useCreateLegalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertLegalSourceInput) => createLegalSource(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });
}

/** Update a source's fields (leaves status untouched unless passed). */
export function useUpdateLegalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertLegalSourceInput }) =>
      updateLegalSource(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });
}

/** Publish / unpublish / archive — a status-only transition. */
export function useSetLegalSourceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminLegalSource["status"] }) =>
      setLegalSourceStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });
}

export function useDeleteLegalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLegalSource(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Calculators
// ---------------------------------------------------------------------------

export function useCalculatorsInventory() {
  return useQuery({
    queryKey: ["admin", "calculators"],
    queryFn: fetchCalculatorsInventory,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** §5 — save one calculator's operational policy (enabled / tier / energy). */
export function useUpdateCalculatorSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: UpdateCalculatorSettingInput }) =>
      updateCalculatorSetting(slug, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "calculators"] });
    },
  });
}

// §5-rules — the DB-backed, versioned rate-override layer. A draft never
// affects users; publishing a valid version is what changes real results.

/** Every dataset's rule-layer status (seed, active version, open draft). */
export function useCalculatorRules(enabled = true) {
  return useQuery({
    queryKey: ["admin", "calculators", "rules"],
    queryFn: fetchCalculatorRules,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * The calculator-centric rule board (every calculator: service status, in-force
 * version, open draft, last change, legal source). Backs «مدیریت فرمول‌ها».
 * Super-Admin-only — callers gate it on `admin:calculators:rules:read`.
 */
export function useCalculatorRuleBoard(enabled = true) {
  return useQuery({
    queryKey: ["admin", "calculators", "rules", "board"],
    queryFn: fetchCalculatorRuleBoard,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

/** One dataset's full rule view: seed, effective rates, schema, history. */
export function useCalculatorRuleDetail(datasetId: string | null) {
  return useQuery({
    queryKey: ["admin", "calculators", "rules", datasetId],
    queryFn: () => fetchCalculatorRuleDetail(datasetId as string),
    enabled: Boolean(datasetId),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Invalidate both the rule list and one dataset's detail. */
function invalidateRule(qc: ReturnType<typeof useQueryClient>, datasetId: string): void {
  qc.invalidateQueries({ queryKey: ["admin", "calculators", "rules"] });
  qc.invalidateQueries({ queryKey: ["admin", "calculators", "rules", datasetId] });
}

/** Save (create or update) the single open draft of one dataset. */
export function useSaveCalculatorRuleDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, input }: { datasetId: string; input: SaveCalculatorRuleDraftInput }) =>
      saveCalculatorRuleDraft(datasetId, input),
    onSuccess: (res) => invalidateRule(qc, res.datasetId),
  });
}

/** Validate + test a draft against sample inputs before publishing. */
export function usePreviewCalculatorRuleDraft() {
  return useMutation({
    mutationFn: ({ datasetId, rates }: { datasetId: string; rates: Record<string, unknown> }) =>
      previewCalculatorRuleDraft(datasetId, rates),
  });
}

/** Publish a draft; archives the previously-active version. */
export function usePublishCalculatorRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, versionId }: { datasetId: string; versionId: string }) =>
      publishCalculatorRule(datasetId, versionId),
    onSuccess: (res) => invalidateRule(qc, res.datasetId),
  });
}

/** Create a new draft copying a prior version's figures (rollback). */
export function useRollbackCalculatorRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, versionId }: { datasetId: string; versionId: string }) =>
      rollbackCalculatorRule(datasetId, versionId),
    onSuccess: (res) => invalidateRule(qc, res.datasetId),
  });
}

/** Discard the open draft of one dataset (published history is untouched). */
export function useDeleteCalculatorRuleDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datasetId, versionId }: { datasetId: string; versionId: string }) =>
      deleteCalculatorRuleDraft(datasetId, versionId),
    onSuccess: (_res, v) => invalidateRule(qc, v.datasetId),
  });
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export function useSupportTickets(filter: {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
} = {}) {
  return useQuery({
    queryKey: ["admin", "support", filter],
    queryFn: () => fetchSupportTickets(filter),
    staleTime: 20_000,
    retry: 1,
  });
}

export function useSupportTicket(id: string | null) {
  return useQuery({
    queryKey: ["admin", "support", "detail", id],
    queryFn: () => fetchSupportTicket(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => createSupportTicket(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "support"] }),
  });
}

export function useAddSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, isInternal }: { id: string; body: string; isInternal?: boolean }) =>
      addSupportMessage(id, body, isInternal),
    onSuccess: (updated: SupportTicket) => {
      qc.setQueryData(["admin", "support", "detail", updated.id], (old: unknown) =>
        old && typeof old === "object" ? { ...(old as object), ticket: updated } : old
      );
      qc.invalidateQueries({ queryKey: ["admin", "support"] });
    },
  });
}

export function useUpdateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTicketInput }) =>
      updateSupportTicket(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "support"] }),
  });
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export function useAdminContent() {
  return useQuery({
    queryKey: ["admin", "content"],
    queryFn: fetchAdminContent,
    staleTime: 60_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Platform announcements
// ---------------------------------------------------------------------------

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: fetchAdminAnnouncements,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateAdminAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => createAdminAnnouncement(input),
    onSuccess: (created: AdminAnnouncement) => {
      // Prepend the new row so the composer's list updates in the same frame.
      qc.setQueryData<{ items: AdminAnnouncement[] }>(["admin", "announcements"], (old) =>
        old ? { items: [created, ...old.items] } : { items: [created] }
      );
    },
  });
}

export function useSetAdminAnnouncementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AnnouncementStatus }) =>
      setAdminAnnouncementStatus(id, status),
    onSuccess: (updated: AdminAnnouncement) => {
      qc.setQueryData<{ items: AdminAnnouncement[] }>(["admin", "announcements"], (old) =>
        old ? { items: old.items.map((a) => (a.id === updated.id ? updated : a)) } : old
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Staff, roles & audit
// ---------------------------------------------------------------------------

export function useAdminStaff(params: { search?: string; role?: string } = {}) {
  return useQuery({
    queryKey: ["admin", "staff", params.search ?? null, params.role ?? null],
    queryFn: () => fetchAdminStaff(params),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

/** One staff member's dossier for the detail drawer. */
export function useAdminStaffMember(id: string | null) {
  return useQuery({
    queryKey: ["admin", "staff", "detail", id],
    queryFn: () => fetchAdminStaffMember(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ["admin", "roles"],
    queryFn: fetchAdminRoles,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useChangeStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: PlatformRole }) =>
      changeStaffRole(userId, role),
    // A role change moves a user into or out of the staff set, so the whole
    // staff slice (list under any filter + the detail query) and the users
    // directory must refetch — a targeted setQueryData cannot cover the
    // now-parameterised list keys.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "staff"] });
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminAudit(
  query: AdminAuditQuery = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ["admin", "audit", query],
    queryFn: () => fetchAdminAudit(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
    // The endpoint requires `admin:audit:read`; when the viewer lacks it the
    // section is hidden and the request must not fire (no 403 in the console).
    enabled: options.enabled ?? true,
  });
}

// ---------------------------------------------------------------------------
// Lawyers (verification queue)
// ---------------------------------------------------------------------------

export function useAdminLawyers(
  params: {
    bucket?: LawyerDecisionBucket;
    status?: LawyerVerificationStatus;
    lifecycle?: AdminLawyerStatus;
    featured?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  return useQuery({
    queryKey: [
      "admin",
      "lawyers",
      params.bucket ?? null,
      params.status ?? null,
      params.lifecycle ?? null,
      params.featured ?? null,
      params.search ?? null,
      params.page ?? null,
      params.pageSize ?? null,
    ],
    queryFn: () => fetchAdminLawyers(params),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}

/** Full registration dossier for the detail drawer. */
export function useAdminLawyer(id: string | null) {
  return useQuery({
    queryKey: ["admin", "lawyers", "detail", id],
    queryFn: () => fetchAdminLawyer(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useDecideLawyerVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: LawyerVerificationStatus;
      reason: string;
    }) => decideLawyerVerification(id, status, reason),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "lawyers"] });
      qc.invalidateQueries({ queryKey: ["admin", "lawyers", "detail", id] });
    },
  });
}

/** Send a direct message to a lawyer; refreshes the detail + queue. */
export function useSendLawyerMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { subject: string; body: string } }) =>
      sendLawyerMessage(id, input),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "lawyers", "detail", id] });
    },
  });
}

/**
 * Invalidate the lawyer queue, the affected dossier AND the public surfaces.
 * Every lawyer mutation funnels through here. The public marketplace list and
 * the public profile read the SAME profile row the admin panel edits, so they
 * must be refreshed too — otherwise a same-origin view (e.g. the operator
 * opening /lawyers) keeps serving the cached portrait until its own
 * staleTime (up to 60s) lapses. `["lawyers"]` is a prefix of both
 * `["lawyers","list",*]` and `["lawyers","detail",*]`.
 */
function invalidateLawyer(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: ["admin", "lawyers"] });
  if (id) void qc.invalidateQueries({ queryKey: ["admin", "lawyers", "detail", id] });
  void qc.invalidateQueries({ queryKey: ["lawyers"] });
}

/** Apply a partial profile edit; refreshes the queue + dossier. */
export function useUpdateAdminLawyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AdminLawyerPatchInput }) =>
      updateAdminLawyer(id, patch),
    onSuccess: (_result, { id }) => invalidateLawyer(qc, id),
  });
}

/** Set the operator lifecycle status (فعال/غیرفعال/معلق/حذف‌شده). */
export function useSetAdminLawyerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AdminLawyerStatus;
      reason?: string;
    }) => setAdminLawyerStatus(id, { status, reason }),
    onSuccess: (_result, { id }) => invalidateLawyer(qc, id),
  });
}

/** Set (or clear) the display rating / review count / fee. */
export function useSetAdminLawyerRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: {
        ratingOverride: number | null;
        reviewCountOverride: number | null;
        consultationFeeOverrideToman?: number | null;
        badgeFa?: string | null;
        reason?: string;
      };
    }) => setAdminLawyerRating(id, input),
    onSuccess: (_result, { id }) => invalidateLawyer(qc, id),
  });
}

/** Change a lawyer's avatar (URL or demo regeneration). */
export function useSetAdminLawyerAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: {
        avatarUrl?: string | null;
        avatarType?: LawyerAvatarType;
        regenerate?: boolean;
        reason?: string;
        avatarData?: string;
        avatarFileName?: string;
        avatarFormat?: string;
      };
    }) => setAdminLawyerAvatar(id, input),
    onSuccess: (_result, { id }) => invalidateLawyer(qc, id),
  });
}

/** Toggle the marketplace "featured" flag. */
export function useSetAdminLawyerFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      setAdminLawyerFeatured(id, featured),
    onSuccess: (_result, { id }) => invalidateLawyer(qc, id),
  });
}

/** Moderate a single review (publish / hide / restore / reject / delete). */
export function useModerateAdminLawyerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reviewId,
      action,
      reason,
    }: {
      id: string;
      reviewId: string;
      action: "publish" | "hide" | "restore" | "reject" | "delete";
      reason?: string;
    }) => moderateAdminLawyerReview(id, reviewId, { action, reason }),
    onSuccess: (_result, { id }) => invalidateLawyer(qc, id),
  });
}

// ---------------------------------------------------------------------------
// Energy & service-cost model (§6)
// ---------------------------------------------------------------------------

export function useCostProfiles() {
  return useQuery({
    queryKey: ["admin", "energy", "profiles"],
    queryFn: fetchCostProfiles,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCostProfile(id: string | null) {
  return useQuery({
    queryKey: ["admin", "energy", "profiles", "detail", id],
    queryFn: () => fetchCostProfile(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useSaveCostProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCostProfileInput) => saveCostProfile(input),
    onSuccess: (saved: ServiceCostProfile) => {
      qc.setQueryData<{ items: ServiceCostProfile[] }>(["admin", "energy", "profiles"], (old) =>
        old
          ? {
              items: old.items.some((p) => p.id === saved.id)
                ? old.items.map((p) => (p.id === saved.id ? saved : p))
                : [...old.items, saved],
            }
          : old
      );
      qc.invalidateQueries({ queryKey: ["admin", "energy", "profiles", "detail", saved.id] });
    },
  });
}

export function useSaveCostRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCostRuleInput) => saveCostRule(input),
    onSuccess: (saved: ServiceCostRule) => {
      qc.invalidateQueries({
        queryKey: ["admin", "energy", "profiles", "detail", saved.profileId],
      });
    },
  });
}

export function useDeleteCostRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; profileId: string }) => deleteCostRule(id),
    onSuccess: (_res, { profileId }) => {
      qc.invalidateQueries({ queryKey: ["admin", "energy", "profiles", "detail", profileId] });
    },
  });
}

export function useUsageLedger(query: AdminLedgerQuery = {}) {
  return useQuery({
    queryKey: ["admin", "energy", "ledger", query],
    queryFn: () => fetchUsageLedger(query),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useUsageSummary(rangeDays = 30) {
  return useQuery({
    queryKey: ["admin", "energy", "summary", rangeDays],
    queryFn: () => fetchUsageSummary(rangeDays),
    staleTime: 60_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Discount coupons (billing)
// ---------------------------------------------------------------------------

const COUPON_KEY = ["admin", "coupons"] as const;

/** The coupon catalog with live usage counts. */
export function useAdminCoupons() {
  return useQuery({
    queryKey: COUPON_KEY,
    queryFn: fetchAdminCoupons,
    staleTime: 30_000,
    retry: 1,
  });
}

/** One coupon's detail (used when a row opens for editing). */
export function useAdminCoupon(id: string | null) {
  return useQuery({
    queryKey: ["admin", "coupons", "detail", id],
    queryFn: () => fetchAdminCoupon(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: 1,
  });
}

export function useCreateAdminCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCouponDraft) => createAdminCoupon(input),
    onSuccess: (created: AdminCouponRow) => {
      // Prepend so the list reflects the new coupon in the same frame.
      qc.setQueryData<{ items: AdminCouponRow[] }>(COUPON_KEY, (old) =>
        old ? { items: [created, ...old.items] } : { items: [created] }
      );
    },
  });
}

export function useUpdateAdminCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminCouponDraft }) =>
      updateAdminCoupon(id, input),
    onSuccess: (updated: AdminCouponRow) => {
      qc.setQueryData<{ items: AdminCouponRow[] }>(COUPON_KEY, (old) =>
        old ? { items: old.items.map((c) => (c.id === updated.id ? updated : c)) } : old
      );
      qc.invalidateQueries({ queryKey: ["admin", "coupons", "detail", updated.id] });
    },
  });
}

/** Enable / disable / archive — a status-only transition (never a delete). */
export function useSetAdminCouponStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CouponStatus }) =>
      setAdminCouponStatus(id, status),
    onSuccess: (updated: AdminCouponRow) => {
      qc.setQueryData<{ items: AdminCouponRow[] }>(COUPON_KEY, (old) =>
        old ? { items: old.items.map((c) => (c.id === updated.id ? updated : c)) } : old
      );
      qc.invalidateQueries({ queryKey: ["admin", "coupons", "detail", updated.id] });
    },
  });
}
