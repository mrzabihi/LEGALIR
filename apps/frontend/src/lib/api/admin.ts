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
import type { RenderedBlock } from "@/lib/contracts/template";
import type {
  AdminOverview,
  AdminLiveReport,
  AdminSalesSplit,
  AdminLivePoint,
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
  ChatToolAdminView,
  RagSource,
  RagReviewState,
  RagPipelineStatus,
  RagRetrievalTestResult,
  RagIngestReport,
  AdminBlogPost,
  AdminBlogCategory,
  UpsertBlogPostInput,
  GenerateBlogDraftInput,
  GeneratedBlogDraft,
  AdminLegalSource,
  AdminLegalTopic,
  UpsertLegalSourceInput,
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
  StaffDetail,
  RoleDescriptor,
  PlatformRole,
  SubscriptionPlan,
  PlanAuditEntry,
  PlanStatus,
  LawyerVerificationStatus,
  LawyerDecisionBucket,
  LawyerStatusDecision,
  AdminExportKind,
  ServiceCostProfile,
  ServiceCostRule,
  ServiceCostUnit,
  ServiceCostRuleCondition,
  ServiceBillingMode,
  ServiceChargeBasis,
  UsageLedgerEntry,
  UsageLedgerSummary,
  ActivityType,
  LegalRequest,
  LegalRequestEvent,
  LegalRequestState,
  LegalRequestDiscovery,
  DiscoveryIntent,
  AdminContractListResponse,
  AdminContractReviewActionRequest,
  ContractAdminReviewDetail,
  ContractAdminReviewStatus,
  ContractStampActionRequest,
  ContractStampContextResponse,
  ContractStampDecisionResponse,
  ContractCompleteness,
  ContractLegalBasisReport,
  ContractLegalCitationStatus,
  ContractLegalClauseRecord,
  ContractPreSignTip,
  ContractReviewComment,
  ContractTypeId,
  PropertyContract,
  PropertyContractState,
  SignatureAttestation,
  SignatureAttestationChannel,
  SignatureParticipant,
  SignatureRequestDetail,
  AdminAnnouncement,
  AnnouncementStatus,
  CreateAnnouncementInput,
  CalculatorSetting,
  CalculatorAccessTier,
  CalculatorRuleSummary,
  CalculatorRuleDetail,
  CalculatorRuleBoardRow,
  CalculatorRuleVersion,
  CalculatorRuleSourceOverride,
  RulePublishPreview,
  AdminUserSubscriptionView,
  AdminSubscriptionActionInput,
  AdminEnergyActionInput,
  AdminLawyerListItem,
  AdminLawyerStatus,
  LawyerProfile,
  LawyerReviewRecord,
  LawyerReviewReportRecord,
  LawyerExpertise,
  LawyerLocation,
  LawyerPricing,
  LawyerMarketplaceVisibility,
  LawyerProfessionalRank,
  LawyerOrganizationType,
  LawyerLicenseStatus,
  LawyerGender,
  LawyerAvatarType,
  Coupon,
  CouponStatus,
  JudicialServiceView,
  JudicialServiceConfig,
  JudicialQuestionnaire,
  JudicialDocumentType,
  JudicialServiceStatus,
  JudicialServiceSurfaces,
  JudicialReviewQueueFilters,
  JudicialReviewQueuePage,
  JudicialReviewDetailView,
  JudicialAdminReviewActionInput,
  JudicialAdminReviewActionResponse,
  JudicialOrderQueueFilters,
  JudicialOrderQueuePage,
  JudicialOrderQueueRow,
  JudicialAdminOrderUpdateInput,
  UsageReportQuery,
  UsageReportResponse,
  TariffVersionEntry,
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
  /** Readable, server-generated system id (`LG-…`), or null. */
  publicId: string | null;
  displayName: string | null;
  /** Full canonical mobile (`+989xxxxxxxxx`); display LTR within the RTL panel. */
  mobile: string;
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
  /** Total pages matching the query (server-clamped page lives within 1..totalPages). */
  totalPages: number;
}

export interface AdminUserDetail extends AdminUserRow {
  orgId: string | null;
}

export interface AdminRequestsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: string;
  /** Tri-state discovery filter: `"yes"` keeps only discovery requests. */
  discovery?: "yes" | "no";
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
  /** True when the request came through the path-discovery intake. */
  hasDiscovery: boolean;
  /** How the recorded analysis was produced, or null when there is none. */
  discoverySource: "ai" | "rules" | null;
  /** The legal area the engine inferred, or null. */
  inferredCategory: string | null;
}

export interface AdminRequestsResponse {
  items: AdminRequestRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Total pages matching the query. */
  totalPages: number;
}

export interface AdminReportsResponse {
  rangeDays: number;
  byPlan: { planCode: string; planNameFa: string; count: number; amount: number }[];
  daily: { date: string; count: number; amount: number }[];
  /**
   * Selling orders stacked by plan over the window (one row per day, values
   * aligned to `plans` by index) — the data behind the plan-mix stacked bar.
   */
  planMix: {
    plans: { planCode: string; planNameFa: string }[];
    days: { date: string; values: number[] }[];
  };
}

export interface AdminSettingsResponse {
  environment: string;
  timezone: string;
  currency: string;
  secretStorageConfigured: boolean;
  aiProviders: {
    id: string;
    nameFa: string;
    status: string;
    hasKey: boolean;
    isDefault: boolean;
  }[];
  integrations: { key: string; labelFa: string; configured: boolean; noteFa: string }[];
  organizations: { total: number };
  lawyers: { total: number };
}

export interface AdminContentResponse {
  blog: {
    total: number;
    published: number;
    items: {
      id: string;
      title: string;
      slug: string;
      publishedAt: string | null;
      updatedAt?: string;
    }[];
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
  /** §5 — admin operational policy. */
  enabled: boolean;
  accessTier: CalculatorAccessTier;
  energyCost: number;
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
  /** §5 — calculators switched off / charging energy. */
  disabledCalculators: number;
  chargedCalculators: number;
  staleDatasets: string[];
  /** §5 — the editable per-calculator policy rows. */
  settings: CalculatorSetting[];
}

export interface AdminSupportResponse {
  items: SupportTicket[];
  counts: { byStatus: Record<string, number>; overdue: number };
}

/**
 * The admin lawyer table row. This is the canonical `AdminLawyerListItem`
 * from @legalir/types (the exact shape the API route emits) — the alias is
 * kept so existing page imports keep working.
 */
export type AdminLawyerRow = AdminLawyerListItem;

export interface AdminLawyersResponse {
  items: AdminLawyerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

/**
 * The full registration dossier returned by GET /admin/lawyers/[id]. The
 * profile is the WHOLE LawyerProfile (the same editable record the public
 * site reads), so the drawer can render and edit every field.
 */
export interface AdminLawyerDetail {
  profile: LawyerProfile;
  contact: { mobileMasked: string; email: string | null };
  user: {
    id: string;
    displayName: string | null;
    role: string;
    accountType: string;
    createdAt: string;
  };
  bucket: LawyerDecisionBucket;
  /** The operator-facing lifecycle (فعال/غیرفعال/معلق/حذف‌شده). */
  lifecycle: AdminLawyerStatus;
  history: (LawyerStatusDecision & { id: string })[];
  lastDecision: (LawyerStatusDecision & { id: string }) | null;
  messages: AdminLawyerMessageRow[];
  /** Every review row (including hidden) for in-drawer moderation. */
  reviews: LawyerReviewRecord[];
  /** Per-review moderation history + reports, keyed by review id. */
  moderation: Record<
    string,
    {
      events: {
        id: string;
        fromStatus: string | null;
        toStatus: string;
        reason: string | null;
        actorUserId: string;
        actorRole: string;
        createdAt: string;
      }[];
      reports: LawyerReviewReportRecord[];
    }
  >;
  stats: { messagesSent: number; decisions: number; reviews: number; openReports: number };
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
// Excel export (§7)
// ---------------------------------------------------------------------------

/**
 * The admin surfaces that can be exported to Excel. Re-exported from
 * `@legalir/types`, which both the server adapters and the endpoint's
 * authorization read — the three can never drift.
 */
export type { AdminExportKind };

/**
 * Download the complete Excel export for one admin surface. Fetches the raw
 * bytes from the server (never the current UI page) and triggers a browser
 * save with the server-supplied filename. Throws when the response is not a
 * workbook (e.g. a 403), so callers can surface an error toast.
 */
export async function downloadAdminExport(kind: AdminExportKind): Promise<void> {
  const res = await fetch(`${A}/exports/${kind}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
  if (!res.ok) {
    let message = "خروجی گرفتن ناموفق بود";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : `export-${kind}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

/**
 * A compact live snapshot of the SAME ledger the overview reads. Same range
 * parameters (`rangeDays` + an explicit window), so a KPI card and the live
 * block beside it always describe the identical window.
 */
export function fetchAdminLiveReport(
  rangeDays = 30,
  window?: AdminWindow | null
): Promise<AdminLiveReport> {
  return apiClient.get<AdminLiveReport>(`${A}/live${windowParams(rangeDays, window)}`);
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

// ---------------------------------------------------------------------------
// Per-user subscription & energy (billing dossier + audited actions)
// ---------------------------------------------------------------------------

/** One user's full billing dossier: plan, energy, history, payments, ledger. */
export function fetchAdminUserSubscription(userId: string): Promise<AdminUserSubscriptionView> {
  return apiClient.get<AdminUserSubscriptionView>(
    `${A}/users/${encodeURIComponent(userId)}/subscription`
  );
}

export interface AdminSubscriptionActionResponse {
  subscriptionId: string | null;
  supersededIds: string[];
}

/** Apply an admin subscription action (activate / extend / deactivate / change_plan). */
export function adminSubscriptionAction(
  userId: string,
  input: AdminSubscriptionActionInput
): Promise<AdminSubscriptionActionResponse> {
  return apiClient.post<AdminSubscriptionActionResponse>(
    `${A}/users/${encodeURIComponent(userId)}/subscription`,
    input
  );
}

export interface AdminEnergyActionResponse {
  balance: number;
  delta: number;
}

/** Grant or adjust a user's reward energy (audited). */
export function adminEnergyAction(
  userId: string,
  input: AdminEnergyActionInput
): Promise<AdminEnergyActionResponse> {
  return apiClient.post<AdminEnergyActionResponse>(
    `${A}/users/${encodeURIComponent(userId)}/energy`,
    input
  );
}

/** One user's «مصرف انرژی و توکن» report — the exact same projection the
 *  user's own usage page renders, gated server-side by `admin:energy:read`. */
export function fetchAdminUserUsageReport(
  userId: string,
  query: UsageReportQuery = {}
): Promise<{
  report: UsageReportResponse;
  services: { serviceKey: string; serviceNameFa: string }[];
}> {
  return apiClient.get<{
    report: UsageReportResponse;
    services: { serviceKey: string; serviceNameFa: string }[];
  }>(
    `${A}/users/${encodeURIComponent(userId)}/usage${qs({
      from: query.from,
      to: query.to,
      serviceKey: query.serviceKey,
      activityType: query.activityType,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })}`
  );
}

/** The append-only tariff change log (who changed what, and when). */
export function fetchAdminTariffHistory(entityId?: string): Promise<TariffVersionEntry[]> {
  return apiClient
    .get<{ items: TariffVersionEntry[] }>(`${A}/energy/history${qs({ entityId })}`)
    .then((r) => r.items);
}

export function fetchAdminRequests(query: AdminRequestsQuery = {}): Promise<AdminRequestsResponse> {
  return apiClient.get<AdminRequestsResponse>(
    `${A}/requests${qs({ page: query.page, pageSize: query.pageSize, search: query.search, state: query.state, discovery: query.discovery })}`
  );
}

// ---------------------------------------------------------------------------
// Path-discovery intake (§ dedicated panel)
// ---------------------------------------------------------------------------

export interface AdminDiscoveryQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Filter by how the analysis was produced. */
  source?: "ai" | "rules";
}

/** One request as it appears in the discovery panel's list. */
export interface AdminDiscoveryRow {
  id: string;
  title: string;
  state: string;
  userDisplayName: string | null;
  inferredCategory: string | null;
  /** The help-type the user picked, or null when they let us infer. */
  explicitIntent: DiscoveryIntent | null;
  /** The one-line restatement the engine produced. */
  summaryFa: string;
  confidence: number | null;
  needsLawyer: boolean;
  source: "ai" | "rules";
  /** The engine's top-ranked path. */
  topIntent: DiscoveryIntent | null;
  /** The path the user actually chose, or null if not yet chosen. */
  selectedIntent: DiscoveryIntent | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDiscoveryIntentStat {
  intent: DiscoveryIntent;
  recommended: number;
  primary: number;
  chosen: number;
}

export interface AdminDiscoveryStats {
  total: number;
  bySource: { ai: number; rules: number };
  avgConfidence: number | null;
  needsLawyer: number;
  withDocument: number;
  explicitIntent: number;
  byIntent: AdminDiscoveryIntentStat[];
  byCategory: { key: string; count: number }[];
  byState: { key: string; count: number }[];
}

export interface AdminDiscoveryResponse {
  stats: AdminDiscoveryStats;
  items: AdminDiscoveryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function fetchAdminDiscovery(
  query: AdminDiscoveryQuery = {}
): Promise<AdminDiscoveryResponse> {
  return apiClient.get<AdminDiscoveryResponse>(
    `${A}/discovery${qs({ page: query.page, pageSize: query.pageSize, search: query.search, source: query.source })}`
  );
}

/** A lawyer eligible for assignment (only APPROVED profiles are offered). */
export interface AdminAssignableLawyer {
  id: string;
  fullName: string;
  professionalTitle: string | null;
}

/** The full editable view of one request: state, history and assignable lawyers. */
export interface AdminRequestDetail {
  request: {
    id: string;
    title: string;
    category: string;
    state: LegalRequestState;
    userId: string;
    userDisplayName: string | null;
    selectedLawyerId: string | null;
    selectedLawyerName: string | null;
    orgId: string | null;
    caseId: string | null;
    conversationId: string | null;
    /** The path-discovery record, or null when the request skipped the intake. */
    discovery: LegalRequestDiscovery | null;
    createdAt: string;
    updatedAt: string;
  };
  /** Legal next states for the current state — from the server state machine. */
  allowedTransitions: LegalRequestState[];
  events: LegalRequestEvent[];
  assignableLawyers: AdminAssignableLawyer[];
}

export function fetchAdminRequest(id: string): Promise<AdminRequestDetail> {
  return apiClient.get<AdminRequestDetail>(`${A}/requests/${encodeURIComponent(id)}`);
}

/** Assign or replace the lawyer on a request (PATCH). */
export function assignRequestLawyer(id: string, lawyerId: string | null): Promise<LegalRequest> {
  return apiClient.patch<LegalRequest>(`${A}/requests/${encodeURIComponent(id)}`, {
    selectedLawyerId: lawyerId,
  });
}

/** Change the request's state through the authoritative state machine (PATCH). */
export function changeRequestState(
  id: string,
  state: LegalRequestState,
  note?: string
): Promise<LegalRequest> {
  return apiClient.patch<LegalRequest>(`${A}/requests/${encodeURIComponent(id)}`, {
    state,
    note,
  });
}

// ---------------------------------------------------------------------------
// Contracts — the admin review queue (§6/§7)
// ---------------------------------------------------------------------------
// The operator surface over the contract lifecycle: list every contract,
// open one to judge the rendered document, and record the ONE decision the
// backend allows (approve / reject / request_info / cancel). The decision is
// enforced server-side against the review's bound version hash — the client
// carries no approval logic.

export interface AdminContractsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** The admin-review status filter. */
  status?: ContractAdminReviewStatus;
  /** The contract type filter. */
  type?: ContractTypeId;
}

export function fetchAdminContracts(
  query: AdminContractsQuery = {}
): Promise<AdminContractListResponse> {
  return apiClient.get<AdminContractListResponse>(
    `${A}/contracts${qs({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      type: query.type,
    })}`
  );
}

/** One clause of the rendered document the admin is asked to judge. */
export interface AdminContractClause {
  id: string;
  headingFa: string;
  /** The plain-text projection, kept for search and compact rendering. */
  paragraphs: string[];
  /** The block model (paragraphs + tables) exactly as the document prints. */
  blocks?: RenderedBlock[];
  conditional: boolean;
}

// ---------------------------------------------------------------------------
// Legal review (§7) — per-type clause sources, content versions, pre-sign tips
// ---------------------------------------------------------------------------

/** One catalogued clause: stored records win over the seeded fallback. */
export interface AdminLegalReviewClauseRow {
  clauseId: string;
  /** The printed heading, e.g. «ماده ۵ — ثمن معامله». */
  clauseHeadingFa: string;
  records: ContractLegalClauseRecord[];
  seeded: {
    articleFa: string;
    sourceNameFa: string;
    status: ContractLegalCitationStatus;
  }[];
  overridden: boolean;
}

/** The legal-review picture for one contract TYPE. */
export interface AdminLegalReviewReport {
  typeId: ContractTypeId;
  clauses: AdminLegalReviewClauseRow[];
  /** Every clause the type emits, including ones with no source at all. */
  knownClauses: { clauseId: string; clauseHeadingFa: string }[];
  tips: ContractPreSignTip[];
  reviewedClauseCount: number;
  pendingClauseCount: number;
  needsRevisionCount: number;
  unflaggedCount: number;
}

/** The full review context for one contract — the SAME render the preview/PDF use. */
export interface AdminContractDetail {
  contract: {
    id: string;
    referenceCode: string;
    type: ContractTypeId;
    typeFa: string;
    title: string;
    state: PropertyContractState;
    stateFa: string;
    progress: number;
    ownerLabelFa: string;
    partySummaryFa: string;
    createdAt: string;
    updatedAt: string;
    /** §2.7 — true for the dev-only sample contract. */
    isSample: boolean;
  };
  completeness: ContractCompleteness;
  parties: { id: string; role: string; roleFa: string; nameFa: string; isInitiator: boolean }[];
  currentVersion: {
    id: string;
    versionNumber: number;
    documentHash: string;
    createdAt: string;
  } | null;
  /** Every version ever frozen, newest first — never collapsed. */
  versions: {
    id: string;
    versionNumber: number;
    documentHash: string;
    templateVersion: string;
    createdAt: string;
    isCurrent: boolean;
    isFinal: boolean;
  }[];
  rendered: {
    titleFa: string;
    preambleFa: string;
    clauses: AdminContractClause[];
    footerFa: string;
  };
  /** §2 — the non-binding legal-basis annex for the clauses above. */
  legalBasis: ContractLegalBasisReport;
  /**
   * §7 — the retained legal-review report for this contract TYPE: each
   * clause with its stored source, content version and review state. It is
   * what tells the operator which clauses still need a legal revision.
   */
  legalReview: AdminLegalReviewReport;
  /**
   * The review thread, including `internal` notes. An operator reviewing
   * the contract must see everything the owner wrote about it; comments are
   * bound to a version, so the reviewer can tell which remarks still apply
   * to the content on screen.
   */
  comments: ContractReviewComment[];
  adminReview: ContractAdminReviewDetail | null;
  approved: boolean;
  stamp: { applied: boolean; text: string; disclaimerFa: string };
  /** §2.2 — the note that prints at the document's end, and its confirmation time. */
  supplementary: {
    notes: string;
    noteConfirmedAt: string | null;
    /** §2.5 — files the owner registered as part of the agreement. */
    attachments: {
      documentId: string;
      titleFa: string;
      fileName: string;
      mime: string;
      sizeBytes: number;
      hash: string;
      addedAt: string;
    }[];
    attachmentsConfirmedAt: string | null;
    confirmedAt: string | null;
  };
  /** §2.1 — clauses the owner added and the changes they requested. */
  customClauses: {
    id: string;
    kind: "agreement" | "change_request";
    title: string;
    body: string;
    sectionRef: string | null;
    sectionTitleFa: string | null;
    createdAt: string;
  }[];
  /** Party approvals of a version, with their exact times. */
  approvals: {
    id: string;
    contractVersionId: string;
    partyId: string;
    partyRoleFa: string;
    partyNameFa: string;
    status: "pending" | "approved" | "changes_requested" | "rejected";
    comment: string;
    method: "otp" | "explicit_consent" | "physical";
    approvedAt: string | null;
    createdAt: string;
  }[];
  /**
   * The newest signature request — kept even when COMPLETED, because the
   * participant rows ARE the record of who signed and when.
   */
  signatureRequest:
    | (Omit<SignatureRequestDetail, "participants"> & {
        statusFa: string;
        participants: (SignatureParticipant & { statusFa: string })[];
        invitations: {
          id: string;
          participantId: string;
          recipientMasked: string;
          status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED";
          deliveryChannel: "sms" | "dev-console" | "none" | null;
          deliveryStatus: "SENT" | "FAILED" | null;
          lastSentAt: string | null;
          expiresAt: string;
          usedAt: string | null;
          revokedAt: string | null;
        }[];
      })
    | null;
  /** Every request ever issued, so a superseded one stays on record. */
  signatureRequests: {
    id: string;
    contractVersionId: string;
    status: string;
    statusFa: string;
    createdAt: string;
    completedAt: string | null;
  }[];
  /**
   * Admin verifications recorded ABOUT a party's signature — evidence,
   * never a signature. Kept distinct from `signatureRequest` so the ORIGIN
   * of each confirmation (the party's own link vs. an admin's check) is
   * never blurred.
   */
  attestations: SignatureAttestation[];
  /**
   * The STORED final artifact (the printable PDF with the official seal and
   * hologram on every page). `null` until the contract is finalized.
   * `sealed` is false when the artifact exists but its stamp is no longer
   * validly bound to the final version's hash.
   */
  finalDocument: {
    documentId: string;
    fileName: string;
    sizeBytes: number;
    hash: string;
    uploadedAt: string;
    sealed: boolean;
    sealAssetVersion: string | null;
    sealedAt: string | null;
    url: string;
    downloadUrl: string;
  } | null;
}

export function fetchAdminContract(id: string): Promise<AdminContractDetail> {
  return apiClient.get<AdminContractDetail>(`${A}/contracts/${encodeURIComponent(id)}`);
}

/** The response of a review decision: the updated contract, review and approval flag. */
export interface AdminContractReviewResponse {
  contract: PropertyContract;
  review: ContractAdminReviewDetail;
  approved: boolean;
}

/** Record the review decision for the ONE open review (POST). */
export function reviewAdminContract(
  id: string,
  input: AdminContractReviewActionRequest
): Promise<AdminContractReviewResponse> {
  return apiClient.post<AdminContractReviewResponse>(
    `${A}/contracts/${encodeURIComponent(id)}`,
    input
  );
}

// ---------------------------------------------------------------------------
// Legal review (§7) — the authorised revision path
// ---------------------------------------------------------------------------
// The per-type legal content lives in the DB, versioned: each save bumps
// `contentVersion` and stamps `reviewedAt`. The seed is only the fallback,
// so a reviewer's correction reaches every contract of that type at once.

export interface AdminLegalReviewTypeRow {
  typeId: ContractTypeId;
  typeFa: string;
  implemented: boolean;
  report: AdminLegalReviewReport;
}

/** Every type's legal-review report, or one type's (`?type=`). */
export function fetchAdminLegalReview(
  type?: ContractTypeId
): Promise<{ types: AdminLegalReviewTypeRow[] }> {
  return apiClient.get<{ types: AdminLegalReviewTypeRow[] }>(
    `${A}/legal-review${type ? `?type=${encodeURIComponent(type)}` : ""}`
  );
}

export interface SaveAdminLegalClauseInput {
  contractType: ContractTypeId;
  clauseId: string;
  sourceNameFa: string;
  lawSourceId?: string | null;
  articleFa: string;
  noteFa: string;
  status: ContractLegalCitationStatus;
  /** Optional operator note recorded in the audit trail, not the record. */
  reason?: string;
}

export interface AdminLegalClauseSaveResponse {
  kind: "clause";
  record: ContractLegalClauseRecord;
  previous: ContractLegalClauseRecord | null;
  report: AdminLegalReviewReport;
}

/** Save (create or revise) one clause citation record. */
export function saveAdminLegalClause(
  input: SaveAdminLegalClauseInput
): Promise<AdminLegalClauseSaveResponse> {
  return apiClient.post<AdminLegalClauseSaveResponse>(`${A}/legal-review`, {
    kind: "clause",
    ...input,
    lawSourceId: input.lawSourceId ?? null,
  });
}

export interface SaveAdminPreSignTipInput {
  /** When set, revise this stored tip; otherwise create a new one. */
  id?: string | null;
  contractType: ContractTypeId;
  titleFa: string;
  bodyFa: string;
  sourceNameFa: string;
  order: number;
  status: ContractLegalCitationStatus;
  reason?: string;
}

export interface AdminPreSignTipSaveResponse {
  kind: "tip";
  tip: ContractPreSignTip;
  previous: ContractPreSignTip | null;
  report: AdminLegalReviewReport;
}

/** Save (create or revise) one «قبل از امضا» tip. */
export function saveAdminPreSignTip(
  input: SaveAdminPreSignTipInput
): Promise<AdminPreSignTipSaveResponse> {
  return apiClient.post<AdminPreSignTipSaveResponse>(`${A}/legal-review`, {
    kind: "tip",
    ...input,
    id: input.id ?? null,
  });
}

export interface AdminLegalReviewDeleteResponse {
  kind: "clause" | "tip";
  removed: ContractLegalClauseRecord | ContractPreSignTip;
  report: AdminLegalReviewReport;
}

/** Remove a stored clause record or tip; the seed then applies again. */
export function deleteAdminLegalReviewItem(
  kind: "clause" | "tip",
  id: string,
  reason?: string
): Promise<AdminLegalReviewDeleteResponse> {
  return apiClient.delete<AdminLegalReviewDeleteResponse>(
    `${A}/legal-review?${qs({ kind, id, reason })}`
  );
}

// ---------------------------------------------------------------------------
// Contract stamp — the official Super-Admin mark (§5)
// ---------------------------------------------------------------------------

/**
 * The stamp context for one contract: whether the stamp master is
 * available, whether the CURRENT version already carries a valid stamp,
 * and the full request history. Permission-gated to Super Admin.
 */
export function fetchAdminContractStamp(id: string): Promise<ContractStampContextResponse> {
  return apiClient.get<ContractStampContextResponse>(
    `${A}/contracts/${encodeURIComponent(id)}/stamp`
  );
}

/** Record a stamp decision (request / apply / reject / cancel). */
export function decideAdminContractStamp(
  id: string,
  input: ContractStampActionRequest
): Promise<ContractStampDecisionResponse> {
  return apiClient.post<ContractStampDecisionResponse>(
    `${A}/contracts/${encodeURIComponent(id)}/stamp`,
    input
  );
}

// ---------------------------------------------------------------------------
// Signature attestations — admin VERIFICATION of a party's signature (§3/§5)
// ---------------------------------------------------------------------------
// An attestation records HOW an admin checked a signature a party already
// gave (watched OTP, wet-ink scan, call). It is evidence ABOUT a signature:
// the server never changes the party's status or the contract state, and
// refuses to record one for a party who has not signed.

/** The origin of an admin confirmation — always stated, never implied. */
export type AttestationChannel = SignatureAttestationChannel;

export interface RecordAttestationInput {
  participantId: string;
  channel: AttestationChannel;
  /** Mandatory: what the admin actually checked. */
  noteFa: string;
}

export interface RecordAttestationResponse {
  attestation: SignatureAttestation & {
    channelFa: string;
    participantRoleFa: string;
  };
  /** The server always returns false — asserted here so the UI cannot assume otherwise. */
  stateChanged: false;
  participantStatusChanged: false;
}

/** Record that an admin verified a signature a party already gave (POST). */
export function recordAdminAttestation(
  id: string,
  input: RecordAttestationInput
): Promise<RecordAttestationResponse> {
  return apiClient.post<RecordAttestationResponse>(
    `${A}/contracts/${encodeURIComponent(id)}/attestations`,
    input
  );
}

// ---------------------------------------------------------------------------
// Signature invitations — the admin's independent per-party resend (§5)
// ---------------------------------------------------------------------------
// One party at a time. The server reuses the SAME issuing implementation as
// the owner workspace (token rules, expiry, per-recipient events) and reports
// the REAL delivery outcome; the raw token is returned exactly once so the
// operator can hand the link over when SMS did not go out.

export interface ResendInvitationsInput {
  /** Omit to invite every participant; pass one id to resend to that party. */
  participantIds?: string[];
  expiresInHours?: number;
  verifyBeforeView?: boolean;
}

export interface ResentInvitation {
  participantId: string;
  /** The raw link token — returned ONCE and never persisted. */
  token: string;
  expiresAt: string;
  delivered: boolean;
  channel: "sms" | "dev-console" | null;
  failureReasonFa: string | null;
}

export interface ResendInvitationsResponse {
  requestId: string;
  contractVersionId: string;
  documentHash: string | null;
  invitations: ResentInvitation[];
  expiresAt: string;
  /** Participants whose previous ACTIVE link was revoked by this call. */
  revokedInvitationIds: string[];
  actorLabelFa: string;
  /** Parties whose delivery did NOT succeed — hand the link over to these. */
  failedParticipantIds: string[];
}

/** Send (or resend) signature links from the admin panel (POST). */
export function resendAdminInvitations(
  id: string,
  input: ResendInvitationsInput
): Promise<ResendInvitationsResponse> {
  return apiClient.post<ResendInvitationsResponse>(
    `${A}/contracts/${encodeURIComponent(id)}/invitations`,
    input
  );
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

// ---------------------------------------------------------------------------
// Judicial services
// ---------------------------------------------------------------------------

export interface AdminJudicialCatalog {
  /** Effective availability (config AND flag AND provider requirement). */
  services: JudicialServiceView[];
  configs: JudicialServiceConfig[];
  questionnaires: JudicialQuestionnaire[];
}

export function fetchAdminJudicial(): Promise<AdminJudicialCatalog> {
  return apiClient.get<AdminJudicialCatalog>(`${A}/judicial`);
}

export function fetchAdminJudicialQuestionnaires(
  documentType: JudicialDocumentType
): Promise<{ items: JudicialQuestionnaire[] }> {
  return apiClient.get<{ items: JudicialQuestionnaire[] }>(
    `${A}/judicial/questionnaires/${encodeURIComponent(documentType)}`
  );
}

export interface JudicialServiceUpdateInput {
  titleFa?: string;
  shortTitleFa?: string;
  descriptionFa?: string;
  ctaFa?: string;
  status?: JudicialServiceStatus;
  statusNoteFa?: string | null;
  order?: number;
  surfaces?: Partial<JudicialServiceSurfaces>;
  requiresAuth?: boolean;
  access?: { mode?: "free" | "subscription" | "energy"; activity?: ActivityType | null };
  requirement?: { configured?: boolean; noteFa?: string | null };
}

export function updateAdminJudicialService(
  id: string,
  input: JudicialServiceUpdateInput
): Promise<JudicialServiceConfig> {
  return apiClient.patch<JudicialServiceConfig>(
    `${A}/judicial/services/${encodeURIComponent(id)}`,
    input
  );
}

export function createAdminJudicialQuestionnaireVersion(input: {
  documentType: JudicialDocumentType;
  titleFa?: string;
  descriptionFa?: string;
  disclaimerFa?: string;
}): Promise<JudicialQuestionnaire> {
  return apiClient.post<JudicialQuestionnaire>(`${A}/judicial/questionnaires`, input);
}

export function publishAdminJudicialQuestionnaire(id: string): Promise<JudicialQuestionnaire> {
  return apiClient.post<JudicialQuestionnaire>(
    `${A}/judicial/questionnaires/${encodeURIComponent(id)}/publish`,
    {}
  );
}

// ---------------------------------------------------------------------------
// Judicial review queue & tracked orders (§7)
// ---------------------------------------------------------------------------
// The operator side of the judicial lane. Queue counts come from the server
// (computed over the unfiltered set), the detail is the ONE workspace a
// reviewer judges from, and every action is decided server-side against the
// version hash — nothing here invents a transition or a status label.

export function fetchAdminJudicialReviews(
  query: JudicialReviewQueueFilters = {}
): Promise<JudicialReviewQueuePage> {
  return apiClient.get<JudicialReviewQueuePage>(
    `${A}/judicial/reviews${qs({
      status: query.status,
      kind: query.kind,
      assigned: query.assigned,
      q: query.q,
    })}`
  );
}

export function fetchAdminJudicialReview(reviewId: string): Promise<JudicialReviewDetailView> {
  return apiClient.get<JudicialReviewDetailView>(
    `${A}/judicial/reviews/${encodeURIComponent(reviewId)}`
  );
}

/**
 * Record ONE review action. `approve` also issues the final artifact in the
 * same server call, so the decision and the document can never diverge.
 */
export function actOnAdminJudicialReview(
  reviewId: string,
  input: JudicialAdminReviewActionInput
): Promise<JudicialAdminReviewActionResponse> {
  return apiClient.patch<JudicialAdminReviewActionResponse>(
    `${A}/judicial/reviews/${encodeURIComponent(reviewId)}`,
    input
  );
}

/**
 * The issued artifact for one review. Resolved through the review id, so an
 * operator can only open a document they can already see in the queue.
 */
export function adminJudicialFinalDocumentUrl(reviewId: string, download = false): string {
  return `${A}/judicial/reviews/${encodeURIComponent(reviewId)}/final-document${
    download ? "?download=1" : ""
  }`;
}

export function fetchAdminJudicialOrders(
  query: JudicialOrderQueueFilters = {}
): Promise<JudicialOrderQueuePage> {
  return apiClient.get<JudicialOrderQueuePage>(
    `${A}/judicial/orders${qs({
      status: query.status,
      serviceId: query.serviceId,
      q: query.q,
    })}`
  );
}

export function fetchAdminJudicialOrder(orderId: string): Promise<{
  order: JudicialOrderQueueRow;
}> {
  return apiClient.get<{ order: JudicialOrderQueueRow }>(
    `${A}/judicial/orders/${encodeURIComponent(orderId)}`
  );
}

/**
 * Move a tracked order. `delivered` is refused by the server unless a real
 * artifact is attached — the status can never claim a document that does not
 * exist.
 */
export function updateAdminJudicialOrder(
  orderId: string,
  input: JudicialAdminOrderUpdateInput
): Promise<{ order: JudicialOrderQueueRow }> {
  return apiClient.patch<{ order: JudicialOrderQueueRow }>(
    `${A}/judicial/orders/${encodeURIComponent(orderId)}`,
    input
  );
}

/** An admin catalog row: the plan plus its effective status + derived discount. */
export type AdminPlanRow = SubscriptionPlan & {
  status: PlanStatus;
  purchasable: boolean;
  discountPercent: number;
};

export function fetchAdminPlans(): Promise<{ items: AdminPlanRow[] }> {
  return apiClient.get<{ items: AdminPlanRow[] }>(`${A}/plans`);
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

/** The create payload — every field the catalog row needs, minus derived ones. */
export interface AdminPlanCreateInput {
  code: string;
  nameFa: string;
  shortDescriptionFa?: string;
  descriptionFa: string;
  status: PlanStatus;
  displayOrder?: number;
  tags?: string[];
  durationDays: number;
  activityCostPoints: number;
  dailyRequestLimit: number;
  tokenLimit: number;
  aiMessageLimit: number;
  documentAnalysisLimit: number;
  contractDraftLimit: number;
  contractCreationLimit: number;
  contractCreationUnlimited: boolean;
  listPrice: number;
  salePrice: number;
  currency?: string;
  features: string[];
}

export function createAdminPlan(input: AdminPlanCreateInput): Promise<SubscriptionPlan> {
  return apiClient.post<SubscriptionPlan>(`${A}/plans`, input);
}

/** Change only a plan's lifecycle status (publish/deactivate/archive). */
export function setAdminPlanStatus(code: string, status: PlanStatus): Promise<SubscriptionPlan> {
  return apiClient.patch<SubscriptionPlan>(`${A}/plans/${encodeURIComponent(code)}`, { status });
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

export function fetchAdminSettlements(
  filter: {
    lawyerId?: string;
    status?: SettlementStatus;
  } = {}
): Promise<{ items: LawyerSettlement[] }> {
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

// --- Contextual chat tools ------------------------------------------------
// `available` in each row is the SERVER's capability verdict (e.g. a real
// precedent source exists). A toggle changes `enabled`, never `available` —
// the admin cannot fabricate a source by enabling a tool.

export function fetchChatToolSettings(): Promise<{
  items: ChatToolAdminView[];
  serviceTypes: string[];
}> {
  return apiClient.get<{ items: ChatToolAdminView[]; serviceTypes: string[] }>(`${A}/ai/tools`);
}

export interface UpdateChatToolSettingInput {
  enabled?: boolean;
  allowedServiceTypes?: string[];
  labelFa?: string;
  descriptionFa?: string;
  effectNoteFa?: string;
  order?: number;
}

export function updateChatToolSetting(
  toolId: string,
  input: UpdateChatToolSettingInput
): Promise<ChatToolAdminView> {
  return apiClient.post<ChatToolAdminView>(`${A}/ai/tools/${encodeURIComponent(toolId)}`, input);
}

// ---------------------------------------------------------------------------
// RAG sources
// ---------------------------------------------------------------------------

export function fetchRagSources(
  filter: {
    reviewState?: RagReviewState;
    search?: string;
  } = {}
): Promise<{ items: RagSource[]; counts: Record<string, number> }> {
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

/** §1 — the ONE knowledge pipeline's real status (corpus + catalog coverage). */
export function fetchRagPipeline(): Promise<{
  status: RagPipelineStatus;
  coverage: { curated: number; ingested: number };
}> {
  return apiClient.get<{
    status: RagPipelineStatus;
    coverage: { curated: number; ingested: number };
  }>(`${A}/rag/pipeline`);
}

/** One source plus the actual searchable chunks the pipeline will match. */
export function fetchRagSourceDetail(id: string): Promise<{
  source: RagSource;
  chunks: { id: string; locator: string | null; text: string }[];
}> {
  return apiClient.get<{
    source: RagSource;
    chunks: { id: string; locator: string | null; text: string }[];
  }>(`${A}/rag/sources/${encodeURIComponent(id)}`);
}

/** §1 — run a live query through the existing retrieval pipeline (read-only). */
export function testRagRetrieval(
  query: string,
  maxResults?: number
): Promise<RagRetrievalTestResult> {
  return apiClient.post<RagRetrievalTestResult>(`${A}/rag/retrieval-test`, { query, maxResults });
}

/** §1 — re-run ingestion so newly added law files enter the SAME pipeline. */
export function reingestRagCorpus(): Promise<RagIngestReport> {
  return apiClient.post<RagIngestReport>(`${A}/rag/reingest`, {});
}

// ---------------------------------------------------------------------------
// Blog management + AI content generation (§2)
// ---------------------------------------------------------------------------

/** The full admin blog list + categories (the SAME store the public site reads). */
export function fetchAdminBlog(): Promise<{
  items: AdminBlogPost[];
  categories: AdminBlogCategory[];
}> {
  return apiClient.get<{ items: AdminBlogPost[]; categories: AdminBlogCategory[] }>(`${A}/blog`);
}

/** One post by id. */
export function fetchAdminBlogPost(id: string): Promise<AdminBlogPost> {
  return apiClient.get<AdminBlogPost>(`${A}/blog/${encodeURIComponent(id)}`);
}

export function createBlogPost(input: UpsertBlogPostInput): Promise<AdminBlogPost> {
  return apiClient.post<AdminBlogPost>(`${A}/blog`, input);
}

export function updateBlogPost(id: string, input: UpsertBlogPostInput): Promise<AdminBlogPost> {
  return apiClient.patch<AdminBlogPost>(`${A}/blog/${encodeURIComponent(id)}`, input);
}

/** Status-only transition (publish/draft/schedule). */
export function setBlogPostStatus(
  id: string,
  status: AdminBlogPost["status"]
): Promise<AdminBlogPost> {
  return apiClient.patch<AdminBlogPost>(`${A}/blog/${encodeURIComponent(id)}`, { status });
}

export function deleteBlogPost(id: string): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`${A}/blog/${encodeURIComponent(id)}/delete`, {});
}

/** §2 — generate an AI draft (never auto-published; saved as DRAFT when requested). */
export function generateBlogDraft(input: GenerateBlogDraftInput): Promise<GeneratedBlogDraft> {
  return apiClient.post<GeneratedBlogDraft>(`${A}/blog/generate`, input);
}

// ---------------------------------------------------------------------------
// Legal-library management (کتابخانه لیگالیر)
// ---------------------------------------------------------------------------
// A product section of its OWN — a separate store, lifecycle and permission
// pair (`admin:library:*`). Deliberately not folded into the blog surface.

/** The full admin library list + topics (the SAME store the public library reads). */
export function fetchAdminLegalLibrary(): Promise<{
  items: AdminLegalSource[];
  topics: AdminLegalTopic[];
}> {
  return apiClient.get<{ items: AdminLegalSource[]; topics: AdminLegalTopic[] }>(
    `${A}/legal-library`
  );
}

/** One source by id. */
export function fetchAdminLegalSource(id: string): Promise<AdminLegalSource> {
  return apiClient.get<AdminLegalSource>(`${A}/legal-library/${encodeURIComponent(id)}`);
}

export function createLegalSource(input: UpsertLegalSourceInput): Promise<AdminLegalSource> {
  return apiClient.post<AdminLegalSource>(`${A}/legal-library`, input);
}

export function updateLegalSource(
  id: string,
  input: UpsertLegalSourceInput
): Promise<AdminLegalSource> {
  return apiClient.patch<AdminLegalSource>(`${A}/legal-library/${encodeURIComponent(id)}`, input);
}

/** Status-only transition (draft/published/archived). */
export function setLegalSourceStatus(
  id: string,
  status: AdminLegalSource["status"]
): Promise<AdminLegalSource> {
  return apiClient.patch<AdminLegalSource>(`${A}/legal-library/${encodeURIComponent(id)}`, {
    status,
  });
}

export function deleteLegalSource(id: string): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`${A}/legal-library/${encodeURIComponent(id)}/delete`, {});
}

// ---------------------------------------------------------------------------
// Energy & service-cost model (§6)
// ---------------------------------------------------------------------------

/** All pricing profiles (seeded disabled on first read). */
export function fetchCostProfiles(): Promise<{ items: ServiceCostProfile[] }> {
  return apiClient.get<{ items: ServiceCostProfile[] }>(`${A}/energy/profiles`);
}

/** One profile plus its rules, sorted by priority. */
export function fetchCostProfile(
  id: string
): Promise<{ profile: ServiceCostProfile; rules: ServiceCostRule[] }> {
  return apiClient.get<{ profile: ServiceCostProfile; rules: ServiceCostRule[] }>(
    `${A}/energy/profiles/${encodeURIComponent(id)}`
  );
}

export interface SaveCostProfileInput {
  id?: string;
  serviceKey: string;
  nameFa: string;
  descriptionFa?: string;
  activity: ActivityType;
  enabled: boolean;
  billingMode?: ServiceBillingMode;
  chargeBasis?: ServiceChargeBasis;
  baseRequestCost: number;
  inputTokenPer1k: number;
  outputTokenPer1k: number;
  contextTokenPer1k: number;
  unitCosts: Partial<Record<ServiceCostUnit, number>>;
  modelMultipliers: Record<string, number>;
}

export function saveCostProfile(input: SaveCostProfileInput): Promise<ServiceCostProfile> {
  return apiClient.post<ServiceCostProfile>(`${A}/energy/profiles`, input);
}

export interface SaveCostRuleInput {
  id?: string;
  profileId: string;
  activity: ActivityType;
  labelFa: string;
  enabled: boolean;
  priority: number;
  condition: ServiceCostRuleCondition;
  min: number | null;
  max: number | null;
  models: string[];
  addEnergy: number;
  multiply: number | null;
}

export function saveCostRule(input: SaveCostRuleInput): Promise<ServiceCostRule> {
  return apiClient.post<ServiceCostRule>(`${A}/energy/rules`, input);
}

export function deleteCostRule(id: string): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`${A}/energy/rules/${encodeURIComponent(id)}/delete`);
}

export interface AdminLedgerQuery {
  userId?: string;
  serviceKey?: string;
  from?: string;
  to?: string;
}

/** The queryable consumption ledger, newest first. */
export function fetchUsageLedger(
  query: AdminLedgerQuery = {}
): Promise<{ items: UsageLedgerEntry[] }> {
  return apiClient.get<{ items: UsageLedgerEntry[] }>(
    `${A}/energy/ledger${qs({ userId: query.userId, serviceKey: query.serviceKey, from: query.from, to: query.to })}`
  );
}

/** Aggregated energy totals for the admin dashboard. */
export function fetchUsageSummary(rangeDays = 30): Promise<UsageLedgerSummary> {
  return apiClient.get<UsageLedgerSummary>(`${A}/energy/summary${qs({ rangeDays })}`);
}

// ---------------------------------------------------------------------------
// Calculators inventory (read-only)
// ---------------------------------------------------------------------------

export function fetchCalculatorsInventory(): Promise<AdminCalculatorsInventory> {
  return apiClient.get<AdminCalculatorsInventory>(`${A}/calculators`);
}

/** §5 — the editable policy for one calculator (defaults when unset). */
export function fetchCalculatorSetting(slug: string): Promise<CalculatorSetting> {
  return apiClient.get<CalculatorSetting>(`${A}/calculators/${slug}`);
}

export interface UpdateCalculatorSettingInput {
  enabled?: boolean;
  accessTier?: CalculatorAccessTier;
  energyCost?: number;
  allowedPlans?: string[];
  allowedUserIds?: string[];
}

/** §5 — save one calculator's operational policy. */
export function updateCalculatorSetting(
  slug: string,
  input: UpdateCalculatorSettingInput
): Promise<CalculatorSetting> {
  return apiClient.patch<CalculatorSetting>(`${A}/calculators/${slug}`, input);
}

// ---------------------------------------------------------------------------
// Calculator rule versions (DB-backed, versioned rate overrides)
// ---------------------------------------------------------------------------

/** Every dataset's rule layer status (seed, active version, open draft). */
export function fetchCalculatorRules(): Promise<{ items: CalculatorRuleSummary[] }> {
  return apiClient.get<{ items: CalculatorRuleSummary[] }>(`${A}/calculators/rules`);
}

/**
 * The calculator-centric rule board — every calculator with its service status,
 * in-force rule version, open draft, last change and legal source. This is the
 * read model behind «مدیریت فرمول‌ها». Super-Admin-only (enforced server-side by
 * `admin:calculators:rules:read`).
 */
export function fetchCalculatorRuleBoard(): Promise<{ items: CalculatorRuleBoardRow[] }> {
  return apiClient.get<{ items: CalculatorRuleBoardRow[] }>(`${A}/calculators/rules/board`);
}

/** One dataset's full rule view: seed, effective rates, schema, history. */
export function fetchCalculatorRuleDetail(datasetId: string): Promise<CalculatorRuleDetail> {
  return apiClient.get<CalculatorRuleDetail>(`${A}/calculators/rules/${datasetId}`);
}

export interface SaveCalculatorRuleDraftInput {
  rates: Record<string, unknown>;
  source?: CalculatorRuleSourceOverride;
  changeNoteFa?: string;
  effectiveFrom?: string;
  verificationStatus?: "verified" | "pending";
}

/** Create/update the open draft of one dataset (never affects users). */
export function saveCalculatorRuleDraft(
  datasetId: string,
  input: SaveCalculatorRuleDraftInput
): Promise<CalculatorRuleVersion> {
  return apiClient.post<CalculatorRuleVersion>(`${A}/calculators/rules/${datasetId}`, input);
}

/** Validate + test a draft against sample inputs before publishing. */
export function previewCalculatorRuleDraft(
  datasetId: string,
  rates: Record<string, unknown>
): Promise<RulePublishPreview> {
  return apiClient.post<RulePublishPreview>(`${A}/calculators/rules/${datasetId}/preview`, {
    rates,
  });
}

/** Publish a draft; archives the previously-active version. */
export function publishCalculatorRule(
  datasetId: string,
  versionId: string
): Promise<CalculatorRuleVersion> {
  return apiClient.post<CalculatorRuleVersion>(`${A}/calculators/rules/${datasetId}/publish`, {
    versionId,
  });
}

/** Create a new draft copying a prior version's figures (rollback). */
export function rollbackCalculatorRule(
  datasetId: string,
  versionId: string
): Promise<CalculatorRuleVersion> {
  return apiClient.post<CalculatorRuleVersion>(`${A}/calculators/rules/${datasetId}/rollback`, {
    versionId,
  });
}

/** Discard the open draft of one dataset. */
export function deleteCalculatorRuleDraft(
  datasetId: string,
  versionId: string
): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>(`${A}/calculators/rules/${datasetId}/discard`, {
    versionId,
  });
}

// ---------------------------------------------------------------------------
// Platform announcements (content panel)
// ---------------------------------------------------------------------------

export function fetchAdminAnnouncements(): Promise<{ items: AdminAnnouncement[] }> {
  return apiClient.get<{ items: AdminAnnouncement[] }>(`${A}/announcements`);
}

export function createAdminAnnouncement(
  input: CreateAnnouncementInput
): Promise<AdminAnnouncement> {
  return apiClient.post<AdminAnnouncement>(`${A}/announcements`, input);
}

export function setAdminAnnouncementStatus(
  id: string,
  status: AnnouncementStatus
): Promise<AdminAnnouncement> {
  return apiClient.patch<AdminAnnouncement>(`${A}/announcements/${encodeURIComponent(id)}`, {
    status,
  });
}

// ---------------------------------------------------------------------------
// Discount coupons (billing panel)
// ---------------------------------------------------------------------------
// The coupon catalog the checkout applies. Every write is audited server-side;
// a used coupon is never physically deleted (archive only), so historical
// orders keep their reference. `usageCount` is recomputed by the server.

/** A coupon row as the admin list/detail returns it (coupon + live usage). */
export interface AdminCouponRow extends Coupon {
  usageCount: number;
}

/** The editable subset of a coupon (undefined = leave a field untouched). */
export interface AdminCouponDraft {
  title?: string;
  code?: string;
  kind?: "percent" | "fixed";
  value?: number;
  percentCap?: number;
  eligiblePlans?: string[];
  startsAt?: string;
  endsAt?: string;
  minOrderAmount?: number;
  totalUses?: number;
  perUserLimit?: number;
  status?: CouponStatus;
  internalNotes?: string;
  currency?: string;
}

export function fetchAdminCoupons(): Promise<{ items: AdminCouponRow[] }> {
  return apiClient.get<{ items: AdminCouponRow[] }>(`${A}/coupons`);
}

export function fetchAdminCoupon(id: string): Promise<AdminCouponRow> {
  return apiClient.get<AdminCouponRow>(`${A}/coupons/${encodeURIComponent(id)}`);
}

export function createAdminCoupon(input: AdminCouponDraft): Promise<AdminCouponRow> {
  return apiClient.post<AdminCouponRow>(`${A}/coupons`, input);
}

export function updateAdminCoupon(id: string, input: AdminCouponDraft): Promise<AdminCouponRow> {
  return apiClient.patch<AdminCouponRow>(`${A}/coupons/${encodeURIComponent(id)}`, input);
}

export function setAdminCouponStatus(id: string, status: CouponStatus): Promise<AdminCouponRow> {
  return apiClient.patch<AdminCouponRow>(`${A}/coupons/${encodeURIComponent(id)}`, { status });
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export function fetchSupportTickets(
  filter: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
  } = {}
): Promise<AdminSupportResponse> {
  return apiClient.get<AdminSupportResponse>(
    `${A}/support${qs({ status: filter.status, priority: filter.priority })}`
  );
}

export function fetchSupportTicket(
  id: string
): Promise<{ ticket: SupportTicket; overdue: boolean }> {
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
  return apiClient.post<SupportTicket>(`${A}/support/${encodeURIComponent(ticketId)}/messages`, {
    body,
    isInternal,
  });
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

export function fetchAdminStaff(
  params: { search?: string; role?: string } = {}
): Promise<{ items: StaffMember[] }> {
  return apiClient.get<{ items: StaffMember[] }>(
    `${A}/staff${qs({ search: params.search, role: params.role })}`
  );
}

/** The full dossier for one staff member (identity + effective permissions). */
export function fetchAdminStaffMember(id: string): Promise<StaffDetail> {
  return apiClient.get<StaffDetail>(`${A}/staff/${encodeURIComponent(id)}`);
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

/** List the management table. `bucket` is the 4-way review filter, `lifecycle`
 *  the operator status, `search` matches name / licence / specialty / city /
 *  masked mobile. Pass no args for "همه". */
export function fetchAdminLawyers(
  params: {
    bucket?: LawyerDecisionBucket;
    status?: LawyerVerificationStatus;
    lifecycle?: AdminLawyerStatus;
    featured?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<AdminLawyersResponse> {
  return apiClient.get<AdminLawyersResponse>(
    `${A}/lawyers${qs({
      bucket: params.bucket,
      status: params.status,
      lifecycle: params.lifecycle,
      featured: params.featured === undefined ? undefined : String(params.featured),
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    })}`
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

/** The editable fields of a profile PATCH (mirrors AdminLawyerUpdateInput). */
export interface AdminLawyerPatchInput {
  fullName?: string;
  bio?: string;
  professionalTitle?: string | null;
  professionalRank?: LawyerProfessionalRank | null;
  organizationType?: LawyerOrganizationType | null;
  licenseNumber?: string | null;
  licenseYear?: number | null;
  licenseAuthority?: string | null;
  licenseStatus?: LawyerLicenseStatus | null;
  gender?: LawyerGender | null;
  featured?: boolean;
  acceptingClients?: boolean;
  visibility?: LawyerMarketplaceVisibility;
  yearsExperience?: number | null;
  expertise?: LawyerExpertise[];
  serviceIds?: string[];
  jurisdictionIds?: string[];
  locations?: LawyerLocation[];
  pricing?: LawyerPricing;
  reason?: string;
}

/** Apply a partial profile edit. The public site reflects it immediately. */
export function updateAdminLawyer(
  id: string,
  patch: AdminLawyerPatchInput
): Promise<{ id: string; profile: LawyerProfile }> {
  return apiClient.patch<{ id: string; profile: LawyerProfile }>(
    `${A}/lawyers/${encodeURIComponent(id)}`,
    patch
  );
}

/** Set the operator lifecycle status (ACTIVE/INACTIVE/SUSPENDED/DELETED). */
export function setAdminLawyerStatus(
  id: string,
  input: { status: AdminLawyerStatus; reason?: string }
): Promise<unknown> {
  return apiClient.post(`${A}/lawyers/${encodeURIComponent(id)}/status`, input);
}

/** Set (or clear) the admin display rating / review count / fee. */
export function setAdminLawyerRating(
  id: string,
  input: {
    ratingOverride: number | null;
    reviewCountOverride: number | null;
    consultationFeeOverrideToman?: number | null;
    badgeFa?: string | null;
    reason?: string;
  }
): Promise<unknown> {
  return apiClient.patch(`${A}/lawyers/${encodeURIComponent(id)}/rating`, input);
}

/** Change a lawyer's avatar (explicit URL, a regenerated demo SVG, or an uploaded image). */
export function setAdminLawyerAvatar(
  id: string,
  input: {
    avatarUrl?: string | null;
    avatarType?: LawyerAvatarType;
    regenerate?: boolean;
    reason?: string;
    /** Base64 image bytes (no data-URI prefix) for an upload from disk. */
    avatarData?: string;
    /** Original file name, kept for the audit trail only. */
    avatarFileName?: string;
    /** The upload's MIME type (e.g. `image/png`). */
    avatarFormat?: string;
  }
): Promise<{ id: string; avatarUrl: string | null; avatarType: LawyerAvatarType }> {
  return apiClient.patch(`${A}/lawyers/${encodeURIComponent(id)}/avatar`, input);
}

/** Toggle the marketplace "featured" flag. */
export function setAdminLawyerFeatured(
  id: string,
  featured: boolean,
  reason?: string
): Promise<unknown> {
  return apiClient.patch(`${A}/lawyers/${encodeURIComponent(id)}/feature`, {
    featured,
    reason,
  });
}

/**
 * Moderate a single review: publish (approve a pending review) / hide /
 * restore / reject / delete. Withholding (hide, reject) requires a reason.
 */
export function moderateAdminLawyerReview(
  id: string,
  reviewId: string,
  input: { action: "publish" | "hide" | "restore" | "reject" | "delete"; reason?: string }
): Promise<unknown> {
  return apiClient.post(
    `${A}/lawyers/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}`,
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
  AdminLiveReport,
  AdminSalesSplit,
  AdminLivePoint,
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
  ChatToolAdminView,
  RagSource,
  RagReviewState,
  RagPipelineStatus,
  RagRetrievalTestResult,
  RagIngestReport,
  AdminBlogPost,
  AdminBlogCategory,
  UpsertBlogPostInput,
  GenerateBlogDraftInput,
  GeneratedBlogDraft,
  AdminLegalSource,
  AdminLegalTopic,
  UpsertLegalSourceInput,
  SupportTicket,
  SupportTicketStatus,
  SupportTicketPriority,
  StaffMember,
  StaffDetail,
  RoleDescriptor,
  PlatformRole,
  ServiceCostProfile,
  ServiceCostRule,
  ServiceCostUnit,
  ServiceCostRuleCondition,
  UsageLedgerEntry,
  UsageLedgerSummary,
  ActivityType,
};
