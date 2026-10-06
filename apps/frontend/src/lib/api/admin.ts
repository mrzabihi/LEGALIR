// ============================================================
// LEGALIR — Admin API client functions
// ============================================================
// Thin wrappers over apiClient for the platform admin surface. Every call
// targets the single dispatcher route (`/api/v1/admin/**`) except the two
// pre-existing concrete routes (lawyers, knowledge), which are more
// specific and therefore take precedence.
//
// The client carries NO authorization logic — it is a UX helper. The server
// re-checks the permission on every request (lib/rbac.ts).
// ============================================================

import { apiClient } from "./client";
import type {
  AdminOverview,
  AdminOrderListResponse,
  AdminOrder,
  AdminOrderReceipt,
  AdminReceiptKind,
  AdminReceiptUnavailableReason,
  OrderStatus,
  AdminAuditEntry,
  AuditLogListResponse,
  FeatureFlag,
  FeatureFlagStatus,
  CommissionRule,
  LawyerSettlement,
  SettlementStatus,
  AdjustmentKind,
  FinancialAdjustment,
  AiProviderConfig,
  AiProviderKind,
  AiTestResult,
  AiPromptVersion,
  AiUsageMetrics,
  RagSource,
  RagReviewState,
  SupportTicket,
  SupportTicketStatus,
  SupportTicketPriority,
  AdminKpi,
  AdminAttentionItem,
  AdminBreakdownItem,
  AdminDailyPoint,
  AdminOverviewComparison,
  AdminRecentRequest,
  StaffMember,
  RoleDescriptor,
  PlatformRole,
  SubscriptionPlan,
  PlanAuditEntry,
  LawyerVerificationStatus,
  LawyerDecisionBucket,
  LawyerStatusDecision,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// View models decoded from the dispatcher (kept local — server-owned shape)
// ---------------------------------------------------------------------------

export interface AdminUsersQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}

export interface AdminUserRow {
  id: string;
  displayName: string | null;
  mobileMasked: string;
  email: string | null;
  role: PlatformRole;
  accountType: string;
  hasActiveSubscription: boolean;
  createdAt: string;
}

export interface AdminUsersResponse {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetail extends AdminUserRow {
  orgId: string | null;
}

export interface AdminRequestsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: string;
}

export interface AdminRequestRow {
  id: string;
  title: string;
  category: string;
  state: string;
  userDisplayName: string | null;
  selectedLawyerId: string | null;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRequestsResponse {
  items: AdminRequestRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminReportsResponse {
  rangeDays: number;
  byPlan: { planCode: string; planNameFa: string; count: number; amount: number }[];
  daily: { date: string; count: number; amount: number }[];
}

export interface AdminSettingsResponse {
  environment: string;
  timezone: string;
  currency: string;
  secretStorageConfigured: boolean;
  aiProviders: { id: string; nameFa: string; status: string; hasKey: boolean; isDefault: boolean }[];
  integrations: { key: string; labelFa: string; configured: boolean; noteFa: string }[];
  organizations: { total: number };
  lawyers: { total: number };
}

export interface AdminContentResponse {
  blog: {
    total: number;
    published: number;
    items: { id: string; title: string; slug: string; publishedAt: string | null; updatedAt?: string }[];
  };
}

export interface AdminCalculatorRow {
  id: string;
  slug: string;
  titleFa: string;
  category: string;
  legalBasisFa: string;
  confidence: string;
  available: boolean;
  datasetIds: string[];
  warningsFa: string[];
}

export interface AdminDatasetRow {
  id: string;
  titleFa: string;
  calculationYear: number;
  version: string;
  sourceAuthority: string;
  sourceTitle: string;
  sourceUrl: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  verifiedAt: string;
  jurisdiction: string;
  needsAnnualUpdate: boolean;
  isCurrentYear: boolean;
  notes: string | null;
}

export interface AdminCalculatorsInventory {
  calculators: AdminCalculatorRow[];
  datasets: AdminDatasetRow[];
  currentYear: number;
  totalCalculators: number;
  availableCalculators: number;
  staleDatasets: string[];
}

export interface AdminSupportResponse {
  items: SupportTicket[];
  counts: { byStatus: Record<string, number>; overdue: number };
}

export interface AdminLawyerRow {
  id: string;
  userId: string;
  fullName: string;
  licenseNumber: string | null;
  licenseYear: number | null;
  licenseAuthority: string | null;
  verificationStatus: LawyerVerificationStatus;
  verificationNote: string | null;
  verifiedAt: string | null;
  isDemo: boolean;
  specializations: { category: string; yearsExperience: number }[];
  locations: { province: string; city: string }[];
  activityType: string | null;
  mobileMasked: string;
  bucket: LawyerDecisionBucket;
  lastDecision: AdminLawyerDecision | null;
  createdAt: string;
  updatedAt: string;
}

/** A single recorded admin decision (previous → new, actor, reason, time). */
export interface AdminLawyerDecision {
  newStatus: LawyerVerificationStatus;
  actorName: string;
  reason: string;
  createdAt: string;
}

/** A platform → lawyer direct message (delivered via the notification feed). */
export interface AdminLawyerMessageRow {
  id: string;
  lawyerId: string;
  lawyerUserId: string;
  subject: string;
  body: string;
  actorUserId: string;
  actorName: string;
  createdAt: string;
}

/** The full registration dossier returned by GET /admin/lawyers/[id]. */
export interface AdminLawyerDetail {
  profile: {
    id: string;
    userId: string;
    fullName: string;
    bio: string;
    professionalTitle: string | null;
    avatarUrl: string | null;
    licenseNumber: string | null;
    licenseYear: number | null;
    licenseAuthority: string | null;
    activityType: string | null;
    verificationStatus: LawyerVerificationStatus;
    verificationNote: string | null;
    verifiedAt: string | null;
    availabilityStatus: string;
    isDemo: boolean;
    specializations: { category: string; yearsExperience: number }[];
    locations: { province: string; city: string; remote: boolean }[];
    languages: { code: string; labelFa: string; proficiency: string }[];
    performance: unknown;
    createdAt: string;
    updatedAt: string;
  };
  contact: { mobileMasked: string; email: string | null };
  user: {
    id: string;
    displayName: string | null;
    role: string;
    accountType: string;
    createdAt: string;
  };
  bucket: LawyerDecisionBucket;
  history: (LawyerStatusDecision & { id: string })[];
  lastDecision: (LawyerStatusDecision & { id: string }) | null;
  messages: AdminLawyerMessageRow[];
  stats: { messagesSent: number; decisions: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const A = "/api/v1/admin";

// ---------------------------------------------------------------------------
// Overview & reports
// ---------------------------------------------------------------------------

/** An explicit calendar window (both bounds ISO dates). Overrides `rangeDays`. */
export interface AdminWindow {
  from: string;
  to: string;
}

/** Query fields shared by the overview and reports endpoints. */
function windowParams(rangeDays: number, window?: AdminWindow | null) {
  return qs({ rangeDays, from: window?.from, to: window?.to });
}

export function fetchAdminOverview(
  rangeDays = 30,
  window?: AdminWindow | null
): Promise<AdminOverview> {
  return apiClient.get<AdminOverview>(`${A}/overview${windowParams(rangeDays, window)}`);
}

export function fetchAdminReports(
  rangeDays = 30,
  window?: AdminWindow | null
): Promise<AdminReportsResponse> {
  return apiClient.get<AdminReportsResponse>(`${A}/reports${windowParams(rangeDays, window)}`);
}

// ---------------------------------------------------------------------------
// Users & requests
// ---------------------------------------------------------------------------

export function fetchAdminUsers(query: AdminUsersQuery = {}): Promise<AdminUsersResponse> {
  return apiClient.get<AdminUsersResponse>(
    `${A}/users${qs({ page: query.page, pageSize: query.pageSize, search: query.search, role: query.role })}`
  );
}

export function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  return apiClient.get<AdminUserDetail>(`${A}/users/${encodeURIComponent(id)}`);
}

export function fetchAdminRequests(query: AdminRequestsQuery = {}): Promise<AdminRequestsResponse> {
  return apiClient.get<AdminRequestsResponse>(
    `${A}/requests${qs({ page: query.page, pageSize: query.pageSize, search: query.search, state: query.state })}`
  );
}

export function fetchAdminRequest(id: string): Promise<AdminRequestRow> {
  return apiClient.get<AdminRequestRow>(`${A}/requests/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Feature flags, plans, orders & refunds
// ---------------------------------------------------------------------------

export function fetchAdminFlags(): Promise<{ items: FeatureFlag[] }> {
  return apiClient.get<{ items: FeatureFlag[] }>(`${A}/flags`);
}

export interface UpdateFlagInput {
  status?: FeatureFlagStatus;
  rolloutPercent?: number;
  allowedPlans?: string[];
  allowedOrgIds?: string[];
}

export function updateAdminFlag(key: string, input: UpdateFlagInput): Promise<FeatureFlag> {
  return apiClient.patch<FeatureFlag>(`${A}/flags/${encodeURIComponent(key)}`, input);
}

export function fetchAdminPlans(): Promise<{ items: SubscriptionPlan[] }> {
  return apiClient.get<{ items: SubscriptionPlan[] }>(`${A}/plans`);
}

export interface AdminPlanDetail {
  plan: SubscriptionPlan;
  audit: PlanAuditEntry[];
}

/** A plan template plus its edit history (frozen — live subscriptions keep their snapshot). */
export function fetchAdminPlan(code: string): Promise<AdminPlanDetail> {
  return apiClient.get<AdminPlanDetail>(`${A}/plans/${encodeURIComponent(code)}`);
}

export type AdminPlanUpdate = Partial<Omit<SubscriptionPlan, "id" | "code" | "createdAt">>;

export function updateAdminPlan(code: string, input: AdminPlanUpdate): Promise<SubscriptionPlan> {
  return apiClient.patch<SubscriptionPlan>(`${A}/plans/${encodeURIComponent(code)}`, input);
}

export interface AdminOrdersQuery {
  search?: string;
  status?: string;
  planCode?: string;
  page?: number;
  pageSize?: number;
}

export function fetchAdminOrders(query: AdminOrdersQuery = {}): Promise<AdminOrderListResponse> {
  return apiClient.get<AdminOrderListResponse>(
    `${A}/orders${qs({ search: query.search, status: query.status, planCode: query.planCode, page: query.page, pageSize: query.pageSize })}`
  );
}

export function fetchAdminOrder(
  id: string
): Promise<{ order: AdminOrder; refunds: FinancialAdjustment[] }> {
  return apiClient.get<{ order: AdminOrder; refunds: FinancialAdjustment[] }>(
    `${A}/orders/${encodeURIComponent(id)}`
  );
}

/**
 * The receipt descriptor for an order: what a «رسید» is here and whether one
 * can be opened. When `available` is false, `reason` says why and no field is
 * invented. When it is true, `fileUrl` is a permission-checked same-origin
 * URL that streams the receipt PDF.
 */
export function fetchAdminOrderReceipt(id: string): Promise<AdminOrderReceipt> {
  return apiClient.get<AdminOrderReceipt>(`${A}/orders/${encodeURIComponent(id)}/receipt`);
}

/**
 * The same-origin URL that streams the receipt PDF. Opened in a new tab it is
 * rendered by the browser's own secure PDF viewer; used as a download link it
 * carries `Content-Disposition: attachment`. It is not a public/permanent URL
 * — the server re-checks `admin:billing:read` and sends `no-store`.
 */
export function adminOrderReceiptPdfUrl(id: string): string {
  return `${A}/orders/${encodeURIComponent(id)}/receipt.pdf`;
}

export interface CreateRefundInput {
  kind: AdjustmentKind;
  amount: number;
  reason: string;
}

/** Request a refund/adjustment. A second approver must decide it. */
export function createAdminRefund(
  orderId: string,
  input: CreateRefundInput
): Promise<FinancialAdjustment> {
  return apiClient.post<FinancialAdjustment>(
    `${A}/orders/${encodeURIComponent(orderId)}/refunds`,
    input
  );
}

export function decideAdminRefund(
  id: string,
  decision: "approved" | "rejected"
): Promise<FinancialAdjustment> {
  return apiClient.post<FinancialAdjustment>(`${A}/refunds/${encodeURIComponent(id)}/decide`, {
    decision,
  });
}

// ---------------------------------------------------------------------------
// Finance & settlements
// ---------------------------------------------------------------------------

export function fetchCommissionRules(): Promise<{ rules: CommissionRule[] }> {
  return apiClient.get<{ rules: CommissionRule[] }>(`${A}/finance`);
}

export interface UpdateCommissionRuleInput {
  serviceType: string;
  platformPercent: number;
  platformFixedToman: number;
  allowedDeductions: string[];
}

export function updateCommissionRule(input: UpdateCommissionRuleInput): Promise<CommissionRule> {
  return apiClient.post<CommissionRule>(`${A}/finance/commission-rules`, input);
}

export function fetchAdminSettlements(filter: {
  lawyerId?: string;
  status?: SettlementStatus;
} = {}): Promise<{ items: LawyerSettlement[] }> {
  return apiClient.get<{ items: LawyerSettlement[] }>(
    `${A}/settlements${qs({ lawyerId: filter.lawyerId, status: filter.status })}`
  );
}

export function fetchAdminSettlement(id: string): Promise<LawyerSettlement> {
  return apiClient.get<LawyerSettlement>(`${A}/settlements/${encodeURIComponent(id)}`);
}

export interface CreateSettlementInput {
  lawyerId: string;
  lawyerName: string;
  periodStart: string;
  periodEnd: string;
}

export function createAdminSettlement(input: CreateSettlementInput): Promise<LawyerSettlement> {
  return apiClient.post<LawyerSettlement>(`${A}/settlements`, input);
}

export interface AddSettlementLineInput {
  sourceType: string;
  sourceId: string;
  grossAmount: number;
  serviceType: string;
}

export function addAdminSettlementLine(
  settlementId: string,
  input: AddSettlementLineInput
): Promise<LawyerSettlement> {
  return apiClient.post<LawyerSettlement>(
    `${A}/settlements/${encodeURIComponent(settlementId)}/lines`,
    input
  );
}

export interface SettlementTransitionInput {
  to: SettlementStatus;
  reason?: string;
  payoutDestination?: string;
  payoutReference?: string;
}

export function transitionAdminSettlement(
  settlementId: string,
  input: SettlementTransitionInput
): Promise<LawyerSettlement> {
  return apiClient.post<LawyerSettlement>(
    `${A}/settlements/${encodeURIComponent(settlementId)}/transition`,
    input
  );
}

// ---------------------------------------------------------------------------
// AI providers, prompts & metrics
// ---------------------------------------------------------------------------

export function fetchAiProviders(): Promise<{
  items: AiProviderConfig[];
  secretStorageConfigured: boolean;
}> {
  return apiClient.get<{ items: AiProviderConfig[]; secretStorageConfigured: boolean }>(
    `${A}/ai/providers`
  );
}

export interface SaveAiProviderInput {
  id?: string;
  nameFa: string;
  kind: AiProviderKind;
  baseUrl?: string | null;
  model?: string | null;
  embeddingModel?: string | null;
  timeoutMs?: number;
  maxOutputTokens?: number;
  isDefault?: boolean;
  apiKey?: string;
  clearKey?: boolean;
}

export function saveAiProvider(input: SaveAiProviderInput): Promise<AiProviderConfig> {
  return apiClient.post<AiProviderConfig>(`${A}/ai/providers`, input);
}

export function testAiProvider(id: string): Promise<AiTestResult> {
  return apiClient.post<AiTestResult>(`${A}/ai/providers/${encodeURIComponent(id)}/test`);
}

export function fetchAiPrompts(key?: string): Promise<{ items: AiPromptVersion[] }> {
  return apiClient.get<{ items: AiPromptVersion[] }>(`${A}/ai/prompts${qs({ key })}`);
}

export interface CreatePromptVersionInput {
  key: string;
  labelFa: string;
  content: string;
  changelog?: string | null;
}

export function createAiPromptVersion(input: CreatePromptVersionInput): Promise<AiPromptVersion> {
  return apiClient.post<AiPromptVersion>(`${A}/ai/prompts`, input);
}

export function activateAiPromptVersion(id: string): Promise<AiPromptVersion> {
  return apiClient.post<AiPromptVersion>(`${A}/ai/prompts/${encodeURIComponent(id)}/activate`);
}

export function fetchAiUsageMetrics(rangeDays = 30): Promise<AiUsageMetrics> {
  return apiClient.get<AiUsageMetrics>(`${A}/ai/metrics${qs({ rangeDays })}`);
}

// ---------------------------------------------------------------------------
// RAG sources
// ---------------------------------------------------------------------------

export function fetchRagSources(filter: {
  reviewState?: RagReviewState;
  search?: string;
} = {}): Promise<{ items: RagSource[]; counts: Record<string, number> }> {
  return apiClient.get<{ items: RagSource[]; counts: Record<string, number> }>(
    `${A}/rag/sources${qs({ reviewState: filter.reviewState, search: filter.search })}`
  );
}

export interface UpdateRagReviewInput {
  reviewState: RagReviewState;
  publishedInLibrary?: boolean;
  notes?: string;
  evalScore?: number | null;
}

export function updateRagReview(id: string, input: UpdateRagReviewInput): Promise<RagSource> {
  return apiClient.patch<RagSource>(`${A}/rag/sources/${encodeURIComponent(id)}`, input);
}

// ---------------------------------------------------------------------------
// Calculators inventory (read-only)
// ---------------------------------------------------------------------------

export function fetchCalculatorsInventory(): Promise<AdminCalculatorsInventory> {
  return apiClient.get<AdminCalculatorsInventory>(`${A}/calculators`);
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export function fetchSupportTickets(filter: {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
} = {}): Promise<AdminSupportResponse> {
  return apiClient.get<AdminSupportResponse>(
    `${A}/support${qs({ status: filter.status, priority: filter.priority })}`
  );
}

export function fetchSupportTicket(id: string): Promise<{ ticket: SupportTicket; overdue: boolean }> {
  return apiClient.get<{ ticket: SupportTicket; overdue: boolean }>(
    `${A}/support/${encodeURIComponent(id)}`
  );
}

export interface CreateTicketInput {
  subject: string;
  category: string;
  priority?: SupportTicketPriority;
  requesterUserId?: string | null;
  requesterName?: string;
  body: string;
}

export function createSupportTicket(input: CreateTicketInput): Promise<SupportTicket> {
  return apiClient.post<SupportTicket>(`${A}/support`, input);
}

export function addSupportMessage(
  ticketId: string,
  body: string,
  isInternal = false
): Promise<SupportTicket> {
  return apiClient.post<SupportTicket>(
    `${A}/support/${encodeURIComponent(ticketId)}/messages`,
    { body, isInternal }
  );
}

export interface UpdateTicketInput {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assigneeUserId?: string | null;
}

export function updateSupportTicket(id: string, input: UpdateTicketInput): Promise<SupportTicket> {
  return apiClient.patch<SupportTicket>(`${A}/support/${encodeURIComponent(id)}`, input);
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export function fetchAdminContent(): Promise<AdminContentResponse> {
  return apiClient.get<AdminContentResponse>(`${A}/content`);
}

// ---------------------------------------------------------------------------
// Staff, roles & audit
// ---------------------------------------------------------------------------

export function fetchAdminStaff(): Promise<{ items: StaffMember[] }> {
  return apiClient.get<{ items: StaffMember[] }>(`${A}/staff`);
}

export function fetchAdminRoles(): Promise<{ items: RoleDescriptor[] }> {
  return apiClient.get<{ items: RoleDescriptor[] }>(`${A}/roles`);
}

export function changeStaffRole(userId: string, role: PlatformRole): Promise<StaffMember> {
  return apiClient.patch<StaffMember>(`${A}/users/${encodeURIComponent(userId)}`, { role });
}

export interface AdminAuditQuery {
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  result?: "success" | "failure" | "denied";
  search?: string;
  page?: number;
  pageSize?: number;
}

export function fetchAdminAudit(query: AdminAuditQuery = {}): Promise<AuditLogListResponse> {
  return apiClient.get<AuditLogListResponse>(
    `${A}/audit${qs({
      actorUserId: query.actorUserId,
      action: query.action,
      resourceType: query.resourceType,
      result: query.result,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    })}`
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function fetchAdminSettings(): Promise<AdminSettingsResponse> {
  return apiClient.get<AdminSettingsResponse>(`${A}/settings`);
}

// ---------------------------------------------------------------------------
// Lawyers (verification queue)
// ---------------------------------------------------------------------------

/** List the review queue. `bucket` is the 4-way admin filter; `search`
 *  matches name / licence / city / masked mobile. Pass no args for "همه". */
export function fetchAdminLawyers(params: {
  bucket?: LawyerDecisionBucket;
  status?: LawyerVerificationStatus;
  search?: string;
} = {}): Promise<{ items: AdminLawyerRow[]; total: number }> {
  return apiClient.get<{ items: AdminLawyerRow[]; total: number }>(
    `${A}/lawyers${qs({ bucket: params.bucket, status: params.status, search: params.search })}`
  );
}

/** Full registration dossier for one lawyer (detail drawer). */
export function fetchAdminLawyer(id: string): Promise<AdminLawyerDetail> {
  return apiClient.get<AdminLawyerDetail>(`${A}/lawyers/${encodeURIComponent(id)}`);
}

/**
 * Record a verification decision. A non-empty `reason` is mandatory for every
 * transition — the server refuses the request without it.
 */
export function decideLawyerVerification(
  id: string,
  status: LawyerVerificationStatus,
  reason: string
): Promise<unknown> {
  return apiClient.post(`${A}/lawyers/${encodeURIComponent(id)}/verification`, {
    status,
    reason,
  });
}

/** Send a direct message from the platform to a lawyer. */
export function sendLawyerMessage(
  id: string,
  input: { subject: string; body: string }
): Promise<AdminLawyerMessageRow> {
  return apiClient.post<AdminLawyerMessageRow>(
    `${A}/lawyers/${encodeURIComponent(id)}/messages`,
    input
  );
}

// ---------------------------------------------------------------------------
// Knowledge (pre-existing concrete route)
// ---------------------------------------------------------------------------

export function fetchAdminKnowledge(params?: {
  verificationStatus?: string;
  sourceType?: string;
  tier?: string;
}): Promise<{
  items: unknown[];
  total: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  return apiClient.get(
    `${A}/knowledge${qs({
      verificationStatus: params?.verificationStatus,
      sourceType: params?.sourceType,
      tier: params?.tier,
    })}`
  );
}

// Re-export the domain types the pages need, so a page imports from one place.
export type {
  AdminOverview,
  AdminKpi,
  AdminAttentionItem,
  AdminBreakdownItem,
  AdminDailyPoint,
  AdminOverviewComparison,
  AdminRecentRequest,
  AdminOrder,
  AdminOrderListResponse,
  AdminOrderReceipt,
  AdminReceiptKind,
  AdminReceiptUnavailableReason,
  OrderStatus,
  AdminAuditEntry,
  AuditLogListResponse,
  FeatureFlag,
  FeatureFlagStatus,
  CommissionRule,
  LawyerSettlement,
  SettlementStatus,
  FinancialAdjustment,
  AdjustmentKind,
  AiProviderConfig,
  AiProviderKind,
  AiTestResult,
  AiPromptVersion,
  AiUsageMetrics,
  RagSource,
  RagReviewState,
  SupportTicket,
  SupportTicketStatus,
  SupportTicketPriority,
  StaffMember,
  RoleDescriptor,
  PlatformRole,
};
