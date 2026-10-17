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
  adminSubscriptionAction,
  adminEnergyAction,
  fetchAdminRequests,
  fetchAdminRequest,
  fetchAdminDiscovery,
  assignRequestLawyer,
  changeRequestState,
  fetchAdminContracts,
  fetchAdminContract,
  reviewAdminContract,
  fetchAdminContractStamp,
  decideAdminContractStamp,
  type AdminContractsQuery,
  fetchAdminFlags,
  updateAdminFlag,
  type UpdateFlagInput,
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
