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
} from "@legalir/types";
import { roleHasPermission, canAccessAdminPanel } from "@legalir/types";
import { useMe } from "@/hooks/useDashboard";
import {
  fetchAdminOverview,
  fetchAdminReports,
  type AdminWindow,
  fetchAdminUsers,
  fetchAdminUser,
  fetchAdminUserSubscription,
  adminSubscriptionAction,
  adminEnergyAction,
  fetchAdminRequests,
  fetchAdminRequest,
  assignRequestLawyer,
  changeRequestState,
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
  fetchCalculatorsInventory,
  updateCalculatorSetting,
  type UpdateCalculatorSettingInput,
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
  type AdminOrdersQuery,
  fetchAdminAnnouncements,
  createAdminAnnouncement,
  setAdminAnnouncementStatus,
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
  AdminBlogPost,
  UpsertBlogPostInput,
  GenerateBlogDraftInput,
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

export function useAdminAudit(query: AdminAuditQuery = {}) {
  return useQuery({
    queryKey: ["admin", "audit", query],
    queryFn: () => fetchAdminAudit(query),
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
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

/** Moderate a single review (hide / restore / delete). */
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
      action: "hide" | "restore" | "delete";
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
