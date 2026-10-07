// ============================================================
// LEGALIR — Admin Panel Domain Types
// ============================================================
// Additive types for the platform admin panel: audit log, feature
// flags, orders/adjustments, commission & lawyer settlements, AI
// provider configuration, RAG review, support tickets, calculator
// parameters and staff administration.
//
// These types carry NO secrets. Provider credentials are represented
// only by a masked hint (last 4 characters) and a boolean.
// ============================================================

import type { PlatformRole, Permission, LegalRequestState } from "./platform";

// ---------------------------------------------------------------------------
// Audit log (append-only)
// ---------------------------------------------------------------------------

export type AuditResult = "success" | "failure" | "denied";

/**
 * A single append-only admin audit entry. `before`/`after` carry only the
 * fields explicitly allowed for the action — never secrets, passwords,
 * OTPs, full document text or bank account numbers.
 */
export interface AdminAuditEntry {
  id: string;
  actorUserId: string;
  actorRole: string;
  /** The organization scope at the time of the action, when org-scoped. */
  orgId: string | null;
  /** Dotted action key, e.g. "plan.update", "lawyer.verify", "refund.approve". */
  action: string;
  /** The kind of resource the action targeted, e.g. "plan", "user". */
  resourceType: string;
  resourceId: string;
  result: AuditResult;
  /** Human reason supplied by the actor for sensitive actions, when required. */
  reason: string | null;
  /** Correlation / trace id for cross-referencing logs. */
  requestId: string | null;
  /** Redacted before/after snapshot of the changed fields only. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AdminAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export type FeatureFlagStatus = "on" | "off" | "experiment" | "limited";

export const FEATURE_FLAG_STATUS_FA: Record<FeatureFlagStatus, string> = {
  on: "فعال",
  off: "غیرفعال",
  experiment: "آزمایشی",
  limited: "محدود",
};

export interface FeatureFlag {
  key: string;
  nameFa: string;
  descriptionFa: string;
  status: FeatureFlagStatus;
  /** When status === "limited", the percentage of traffic (0–100). */
  rolloutPercent: number;
  /** When status === "limited", the plans allowed to see it. */
  allowedPlans: string[];
  /** When status === "limited", explicit org ids allowed. */
  allowedOrgIds: string[];
  /** Environment the flag is scoped to. */
  environment: "development" | "staging" | "production";
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Orders, payments & refunds
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "CREATED"
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "DISPUTED";

/** A sales order. Derived from a subscription purchase, with adjustments. */
export interface AdminOrder {
  id: string;
  referenceId: string;
  userId: string;
  userDisplayName: string | null;
  /** Masked user mobile (e.g. 0912***0003). */
  userMobileMasked: string;
  orgId: string | null;
  planCode: string;
  planNameFa: string;
  /** Snapshotted amounts at purchase time, in Toman (IRT). */
  listPrice: number;
  salePrice: number;
  discountAmount: number;
  /** Net refunded amount across all adjustments. */
  refundedAmount: number;
  netAmount: number;
  currency: string;
  status: OrderStatus;
  /** Gateway is simulated in this environment. */
  gateway: string;
  trackingId: string | null;
  purchasedAt: string;
  createdAt: string;
}

export const ORDER_STATUS_FA: Record<OrderStatus, string> = {
  CREATED: "ایجاد شده",
  PENDING: "در انتظار پرداخت",
  SUCCESS: "موفق",
  FAILED: "ناموفق",
  EXPIRED: "منقضی",
  REFUNDED: "بازگشت کامل",
  PARTIALLY_REFUNDED: "بازگشت جزئی",
  DISPUTED: "در اختلاف",
};

export interface AdminOrderListResponse {
  items: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * What a «رسید» (receipt) actually is for an order. The kinds are kept
 * distinct on purpose and must never be conflated:
 *   • system_receipt       — a receipt THIS platform renders itself from a
 *                            confirmed purchase (our gateway is simulated).
 *   • gateway_confirmation — the payment gateway's own confirmation payload,
 *                            stored with the order when the gateway supplies one.
 *   • uploaded_proof       — a file the payer uploaded as proof of payment.
 */
export type AdminReceiptKind = "system_receipt" | "gateway_confirmation" | "uploaded_proof";

export const ADMIN_RECEIPT_KIND_FA: Record<AdminReceiptKind, string> = {
  system_receipt: "رسید سامانه",
  gateway_confirmation: "تأییدیهٔ درگاه",
  uploaded_proof: "فایل بارگذاری‌شدهٔ کاربر",
};

/**
 * Why no receipt can be shown. Distinguishing these lets the UI give a
 * specific, honest message instead of one generic one.
 *   • not_paid     — the order never completed (pending/failed/expired).
 *   • not_recorded — paid, but no receipt file/confirmation was ever stored.
 *   • file_missing — a receipt is referenced but its file is gone from storage.
 *   • expired_link — the access link has expired and must be re-issued.
 *   • forbidden    — the caller is not allowed to read this receipt.
 */
export type AdminReceiptUnavailableReason =
  | "not_paid"
  | "not_recorded"
  | "file_missing"
  | "expired_link"
  | "forbidden";

/**
 * A receipt descriptor for one order. `available` is the single source of
 * truth for whether a receipt can be opened. When it is false, `reason`
 * explains why and NO field is fabricated. When it is true, every field is a
 * value that really exists on the order — a field that is unknown is null and
 * is omitted from the rendered receipt rather than zero-filled.
 */
export interface AdminOrderReceipt {
  orderId: string;
  /** The platform's real order/transaction reference (the subscription id). */
  referenceId: string;
  available: boolean;
  reason: AdminReceiptUnavailableReason | null;
  /** The kind of receipt, when one exists. */
  kind: AdminReceiptKind | null;
  /** The platform transaction reference, when one exists. */
  transactionId: string | null;
  /** The gateway's own tracking code, when the source supplies one. */
  trackingId: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
  gateway: string;
  /** Whether the gateway is simulated in this environment (never hidden). */
  gatewaySimulated: boolean;
  status: OrderStatus;
  statusFa: string;
  /** The service/plan the payment was for. */
  serviceFa: string | null;
  /** Masked payer mobile — never the full number. */
  payerMobileMasked: string;
  payerDisplayName: string | null;
  /** True when a downloadable/previewable file backs this receipt. */
  hasDocument: boolean;
  /** The content type of the backing file, when known. */
  documentMime: string | null;
  /** Permission-checked same-origin URL that streams the receipt file. */
  fileUrl: string | null;
  /** ISO timestamp the receipt descriptor was produced. */
  generatedAt: string;
}

export type AdjustmentKind = "refund_full" | "refund_partial" | "adjustment";

export const ADJUSTMENT_KIND_FA: Record<AdjustmentKind, string> = {
  refund_full: "بازگشت کامل",
  refund_partial: "بازگشت جزئی",
  adjustment: "تعدیل",
};

export type AdjustmentStatus = "pending" | "approved" | "rejected" | "completed";

export const ADJUSTMENT_STATUS_FA: Record<AdjustmentStatus, string> = {
  pending: "در انتظار تأیید",
  approved: "تأیید شده",
  rejected: "رد شده",
  completed: "تکمیل شده",
};

export interface FinancialAdjustment {
  id: string;
  orderId: string;
  kind: AdjustmentKind;
  amount: number;
  currency: string;
  reason: string;
  requestedBy: string;
  /** The second approver for financially sensitive operations. */
  approvedBy: string | null;
  status: AdjustmentStatus;
  /** The original entry this adjustment reverses/references. */
  referencesEntryId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

// ---------------------------------------------------------------------------
// Commission & lawyer settlement
// ---------------------------------------------------------------------------

export interface CommissionRule {
  id: string;
  /** Service type the rule applies to. */
  serviceType: string;
  /** Percentage kept by the platform (0–100). */
  platformPercent: number;
  /** Fixed platform fee in Toman (added on top of the percentage). */
  platformFixedToman: number;
  /** Deductions allowed before settlement. */
  allowedDeductions: string[];
  validFrom: string;
  validTo: string | null;
  version: number;
  createdAt: string;
}

export type SettlementStatus =
  | "OPEN"
  | "INVOICED"
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PAID"
  | "FAILED"
  | "NEEDS_REVIEW";

export const SETTLEMENT_STATUS_FA: Record<SettlementStatus, string> = {
  OPEN: "باز",
  INVOICED: "صورت‌حساب صادر شده",
  REQUESTED: "درخواست پرداخت",
  UNDER_REVIEW: "در حال بررسی",
  APPROVED: "تأیید شده",
  PAID: "پرداخت شده",
  FAILED: "ناموفق",
  NEEDS_REVIEW: "نیازمند بازبینی",
};

/**
 * Reachable settlement transitions — the state machine. Mirrors the
 * server's guard (`lib/admin/settlements.ts`) so the UI only offers moves
 * the server will accept. The server remains the authority.
 */
export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  OPEN: ["INVOICED", "REQUESTED", "NEEDS_REVIEW"],
  INVOICED: ["REQUESTED", "UNDER_REVIEW", "NEEDS_REVIEW"],
  REQUESTED: ["UNDER_REVIEW", "NEEDS_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "NEEDS_REVIEW", "FAILED"],
  APPROVED: ["PAID", "FAILED"],
  PAID: [],
  FAILED: ["NEEDS_REVIEW"],
  NEEDS_REVIEW: ["UNDER_REVIEW", "APPROVED", "FAILED"],
};

export interface SettlementLine {
  id: string;
  settlementId: string;
  /** The completed consultation/order that generated the line. */
  sourceType: string;
  sourceId: string;
  grossAmount: number;
  platformFee: number;
  deductions: number;
  netAmount: number;
  currency: string;
  createdAt: string;
}

export interface LawyerSettlement {
  id: string;
  lawyerId: string;
  lawyerName: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  platformFee: number;
  deductions: number;
  netAmount: number;
  currency: string;
  status: SettlementStatus;
  /** Masked payout destination (IBAN / card), never the full number. */
  payoutDestinationMasked: string | null;
  /** Bank/payment reference — recorded manually, never fabricated. */
  payoutReference: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  paidAt: string | null;
  lines: SettlementLine[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// AI provider configuration
// ---------------------------------------------------------------------------

export type AiProviderKind = "openai" | "anthropic" | "azure" | "openrouter" | "custom";

export type AiProviderStatus = "configured" | "unconfigured" | "disabled";

export const AI_PROVIDER_KIND_FA: Record<AiProviderKind, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  azure: "Azure OpenAI",
  openrouter: "OpenRouter",
  custom: "سازگار با OpenAI",
};

export const AI_PROVIDER_STATUS_FA: Record<AiProviderStatus, string> = {
  configured: "پیکربندی‌شده",
  unconfigured: "پیکربندی‌نشده",
  disabled: "غیرفعال",
};

export interface AiProviderConfig {
  id: string;
  nameFa: string;
  kind: AiProviderKind;
  /** The API base URL, or null when not set. Never includes a key. */
  baseUrl: string | null;
  /** The chat/generation model id, e.g. "gpt-4o". */
  model: string | null;
  /** The embedding model id. */
  embeddingModel: string | null;
  timeoutMs: number;
  maxOutputTokens: number;
  /** True when this provider serves production traffic. */
  isDefault: boolean;
  /** Test-only routing config (never exposed raw). */
  isTestOverride: boolean;
  status: AiProviderStatus;
  /** True when an API key is stored (the key itself is never returned). */
  hasKey: boolean;
  /** A masked hint of the stored key, e.g. "••••abcd". Never the full key. */
  keyHint: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestLatencyMs: number | null;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
  // --- Additive: model catalogue & enable/disable (optional on legacy rows) ---
  /** The model ids the operator has declared available for this provider. */
  availableModels?: string[];
  /** The model used when a request does not specify one explicitly. */
  defaultModel?: string | null;
  /** Whether the provider participates in routing at all. */
  enabled?: boolean;
  /** Free-form, non-secret provider configuration (region, deployment, …). */
  configuration?: Record<string, string>;
}

/**
 * A knowledge source managed by an operator. This is the editable
 * definition layer that feeds the existing retrieval corpus / legal
 * library — it is NOT a parallel RAG pipeline. A `law`-type source that is
 * published is merged into the legal knowledge base the
 * `legal-library`/corpus readers consume.
 */
export type KnowledgeSourceType =
  | "law"
  | "regulation"
  | "circular"
  | "judicial_procedure"
  | "article"
  | "faq"
  | "internal_document"
  | "legalir_exclusive";

export const KNOWLEDGE_SOURCE_TYPE_FA: Record<KnowledgeSourceType, string> = {
  law: "قانون",
  regulation: "آیین‌نامه",
  circular: "بخشنامه",
  judicial_procedure: "رویهٔ قضایی",
  article: "مقالهٔ حقوقی",
  faq: "پرسش‌های متداول",
  internal_document: "سند داخلی",
  legalir_exclusive: "منبع اختصاصی لیگالیر",
};

export type KnowledgeSourceStatus =
  | "draft"
  | "processing"
  | "indexed"
  | "published"
  | "failed"
  | "disabled";

export const KNOWLEDGE_SOURCE_STATUS_FA: Record<KnowledgeSourceStatus, string> = {
  draft: "پیش‌نویس",
  processing: "در حال پردازش",
  indexed: "نمایه‌شده",
  published: "منتشرشده",
  failed: "ناموفق",
  disabled: "غیرفعال",
};

export interface KnowledgeSource {
  id: string;
  title: string;
  description: string;
  type: KnowledgeSourceType;
  /** The issuing authority, e.g. «مجلس شورای اسلامی». */
  authority: string;
  /** Optional document number (شمارهٔ بخشنامه/قانون). */
  docNumber: string | null;
  /** Inlined text content or a reference to the uploaded file. */
  content: string;
  /** Optional link to an uploaded/provided file. */
  fileName: string | null;
  tags: string[];
  status: KnowledgeSourceStatus;
  /**
   * True when the source is reachable by the retrieval engine. A `law`
   * source published into the legal library sets this true.
   */
  activeInRetrieval: boolean;
  /** True when merged into the legal knowledge base (published laws). */
  publishedToLibrary: boolean;
  /** Number of chunks produced by indexing (0 until processed). */
  chunkCount: number;
  /** ISO timestamp of the last successful indexing run, when any. */
  lastIndexedAt: string | null;
  /** Failure reason when status is `failed`. */
  errorFa: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Who may use a legal calculator. */
export type CalculatorAccessTier = "free" | "subscription" | "purchase" | "restricted";

export const CALCULATOR_ACCESS_TIER_FA: Record<CalculatorAccessTier, string> = {
  free: "رایگان",
  subscription: "نیازمند اشتراک",
  purchase: "نیازمند خرید",
  restricted: "محدود به کاربران خاص",
};

/** The admin-editable operational settings for one calculator. */
export interface CalculatorSetting {
  /** The calculator slug (stable id). */
  slug: string;
  enabled: boolean;
  accessTier: CalculatorAccessTier;
  /** Energy charged per run. 0 = free. */
  energyCost: number;
  /** Plan codes allowed when `accessTier === "restricted"`. */
  allowedPlans: string[];
  /** User ids allowed when `accessTier === "restricted"`. */
  allowedUserIds: string[];
  updatedBy: string | null;
  updatedAt: string;
}

/** Blog publication lifecycle. */
export type BlogPostStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED";

export const BLOG_POST_STATUS_FA: Record<BlogPostStatus, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشرشده",
  SCHEDULED: "زمان‌بندی‌شده",
};

/** An admin-managed blog post (superset of the public list/detail shapes). */
export interface AdminBlogPost {
  id: string;
  slug: string;
  titleFa: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  author: string;
  category: string;
  tags: string[];
  readingTime: number;
  status: BlogPostStatus;
  /** ISO publish time (past for PUBLISHED, future for SCHEDULED). */
  publishedAt: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  /** True when an AI generation produced/assisted the current body. */
  aiAssisted: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result of a live connection test against a configured provider. */
export interface AiTestResult {
  ok: boolean;
  /** Persian, sanitized status/error message — never a raw stack or key. */
  messageFa: string;
  latencyMs: number | null;
  testedAt: string;
  model: string | null;
}

export interface AiPromptVersion {
  id: string;
  /** e.g. "system.consult", "developer.contract_review". */
  key: string;
  labelFa: string;
  version: number;
  content: string;
  /** True when this version is live in production routing. */
  isActive: boolean;
  changelog: string | null;
  createdBy: string;
  createdAt: string;
}

export interface AiUsageMetrics {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  fallbackCount: number;
  /** Token totals reported by the provider, when available. */
  totalTokens: number;
  /** Cost in Toman, when derivable; null when the provider does not report. */
  estimatedCostToman: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  /** Responses flagged as needing human review (unverified/unsourced). */
  needsReviewCount: number;
}

// ---------------------------------------------------------------------------
// RAG source review & publication
// ---------------------------------------------------------------------------

export type RagReviewState =
  | "ingested"
  | "extracted"
  | "indexed"
  | "under_review"
  | "approved"
  | "published"
  | "retired"
  | "failed";

export const RAG_REVIEW_STATE_FA: Record<RagReviewState, string> = {
  ingested: "دریافت شده",
  extracted: "استخراج شده",
  indexed: "نمایه‌شده",
  under_review: "در حال بازبینی",
  approved: "تأیید شده",
  published: "منتشرشده",
  retired: "بازنشسته",
  failed: "ناموفق",
};

export interface RagSource {
  id: string;
  title: string;
  sourceType: string;
  sourceTypeFa: string;
  authority: string;
  domain: string;
  docNumber: string | null;
  docDate: string | null;
  jurisdiction: string | null;
  validFrom: string | null;
  validTo: string | null;
  version: number;
  retrievedFrom: string | null;
  reviewState: RagReviewState;
  reviewerUserId: string | null;
  /** True when the source is reachable by the retrieval engine. */
  activeInRetrieval: boolean;
  /** True when it is separately published in the public library. */
  publishedInLibrary: boolean;
  pageCount: number | null;
  chunkCount: number;
  textHash: string | null;
  lastIndexedAt: string | null;
  /** Reference-question evaluation score (0–1), when evaluated. */
  evalScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Knowledge & RAG pipeline status (§1)
// ---------------------------------------------------------------------------
// The admin Knowledge center inspects the ONE ingestion pipeline that feeds
// retrieval. These shapes describe that pipeline's real state — never a
// fabricated parallel corpus.

export interface RagPipelineStatus {
  corpusVersion: string;
  /** The folder the ingestion pipeline reads official law files from. */
  corpusDir: string;
  sourceCount: number;
  chunkCount: number;
  tokenCount: number;
  /** Sources whose review state makes them reachable by retrieval. */
  activeInRetrieval: number;
  lastIngestedAt: string | null;
  /** Files present in the folder that the corpus has not yet ingested. */
  unindexedFiles: string[];
}

/** A single retrieval hit from a live pipeline test. */
export interface RagRetrievalHit {
  chunkId: string;
  sourceId: string;
  title: string;
  locator: string | null;
  excerpt: string;
  score: number;
  /** Whether this hit's source is currently eligible for retrieval. */
  activeInRetrieval: boolean;
}

export interface RagRetrievalTestResult {
  query: string;
  activeSources: number;
  totalSources: number;
  hits: RagRetrievalHit[];
}

export interface RagIngestReport {
  discovered: number;
  duplicatesSkipped: number;
  sources: number;
  chunks: number;
  tokens: number;
  corpusDir: string;
}

// ---------------------------------------------------------------------------
// Blog management + AI content generation (§2)
// ---------------------------------------------------------------------------
// Admin authoring surface for the public blog. The list/detail store is the
// SAME `.data/blog.json` the public site reads — the admin mutates it in place
// rather than maintaining a parallel copy. AI-generated posts are always saved
// as DRAFTS unless the operator explicitly publishes them.
//
// NOTE: the admin row type is the existing `AdminBlogPost` (above) and the
// lifecycle is the existing `BlogPostStatus` — this section only adds the
// AI-draft and category helper shapes on top of them.

export interface AdminBlogCategory {
  id: string;
  slug: string;
  titleFa: string;
  description: string | null;
}

export interface GenerateBlogDraftInput {
  topic: string;
  category?: string | null;
  keywords?: string[];
  tone?: string | null;
  titleHint?: string | null;
  /** When true the generated draft is persisted immediately (as a draft). */
  save?: boolean;
}

export interface GeneratedBlogDraft {
  titleFa: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  readingTime: number;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Which provider produced the text (honest — "mock" in development). */
  provider: string;
  model: string;
  mock: boolean;
  totalTokens: number;
  estimatedTokens: boolean;
  /** The saved post id when `save` was requested, else null. */
  savedPostId: string | null;
}

export interface UpsertBlogPostInput {
  id?: string;
  slug?: string | null;
  titleFa: string;
  excerpt?: string | null;
  body?: string | null;
  category?: string | null;
  tags?: string[];
  author?: string | null;
  coverImage?: string | null;
  readingTime?: number | null;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: BlogPostStatus;
  /** True when an AI generation produced the body (set on save). */
  aiAssisted?: boolean;
}

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

export type SupportTicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export const SUPPORT_STATUS_FA: Record<SupportTicketStatus, string> = {
  open: "باز",
  in_progress: "در حال پیگیری",
  waiting: "در انتظار کاربر",
  resolved: "حل شده",
  closed: "بسته",
};

export const SUPPORT_PRIORITY_FA: Record<SupportTicketPriority, string> = {
  low: "کم",
  normal: "عادی",
  high: "زیاد",
  urgent: "فوری",
};

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorUserId: string;
  authorName: string;
  /** True when authored by an automated/bot channel (vs. a human agent). */
  isBot: boolean;
  isInternal: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  requesterUserId: string | null;
  requesterName: string;
  requesterMobileMasked: string | null;
  assigneeUserId: string | null;
  /** Response SLA target in hours. */
  slaHours: number;
  dueAt: string | null;
  messages: SupportTicketMessage[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Calculator parameters (versioned legal data)
// ---------------------------------------------------------------------------

export interface CalculatorParam {
  id: string;
  /** The calculator slug this parameter belongs to. */
  slug: string;
  key: string;
  labelFa: string;
  value: number;
  unit: string | null;
  /** Official source of the value. */
  source: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reviewState: "draft" | "under_review" | "approved" | "published" | "retired";
  reviewerUserId: string | null;
  version: number;
  changelog: string | null;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Staff administration
// ---------------------------------------------------------------------------
// Shared (client-safe) shapes for the staff listing and the role→permission
// matrix. The mobile number is always MASKED (first 4 + last 4) — the full
// number is never represented here.

export interface StaffMember {
  id: string;
  displayName: string | null;
  /** Masked mobile (e.g. 0912•••0003). Never the full number. */
  mobileMasked: string;
  email: string | null;
  role: PlatformRole;
  roleFa: string;
  orgId: string | null;
  createdAt: string;
  /** Last time any of the user's sessions was seen (ISO), or null. */
  lastActiveAt: string | null;
}

export interface RoleDescriptor {
  role: PlatformRole;
  roleFa: string;
  isStaff: boolean;
  isSuperAdmin: boolean;
  permissions: Permission[];
}

/**
 * The full dossier for one staff member (the detail drawer). Same identity as
 * `StaffMember`, plus the effective permission set and org label — everything
 * derived from the real user row, role map and organization table. No field is
 * invented, and the mobile stays masked.
 */
export interface StaffDetail extends StaffMember {
  /** The permissions the member's role actually grants (server-authoritative). */
  permissions: Permission[];
  isStaff: boolean;
  isSuperAdmin: boolean;
  /** The organization's display name, when the member is org-scoped. */
  orgName: string | null;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface AdminKpi {
  key: string;
  labelFa: string;
  value: number;
  /** A human hint of how the number is computed. */
  formulaFa: string;
  /** True when the metric cannot be computed from available data. */
  unavailable?: boolean;
  unavailableReasonFa?: string;
  /** Where the card drills down to, when available. */
  drillHref?: string;
  /**
   * The same measurement over the immediately preceding window of equal
   * length (e.g. days 31–60 for a 30-day range). `null` when the metric is
   * range-independent (a lifetime total) or not comparable.
   */
  previousValue?: number | null;
  /**
   * Percent change vs `previousValue`, rounded to one decimal. `null` when
   * there is no honest comparison: the previous window has no data, the
   * previous value is zero, or the metric is not comparable. The UI must
   * show «—» rather than inventing a trend from a zero base.
   */
  changePct?: number | null;
  /**
   * How the UI should read a movement. `neutral` (default) means up is good;
   * `inverse` means up is bad (error rates, latencies, failed jobs) so the
   * arrow colour is inverted.
   */
  trend?: "neutral" | "inverse";
  /** Display unit appended after the formatted value (e.g. «درصد»). */
  unitFa?: string;
}

/** A single «needs attention» row — a real count with a direct link. */
export interface AdminAttentionItem {
  key: string;
  labelFa: string;
  count: number;
  /** Short, factual explanation of what this count is. */
  hintFa: string;
  /** Where the operator goes to act on it. */
  href: string;
  severity: "info" | "warning" | "error";
}

/** One slice of a composition breakdown (by state, by category, …). */
export interface AdminBreakdownItem {
  key: string;
  labelFa: string;
  count: number;
}

/** One point of a daily series (ISO `YYYY-MM-DD` + real count). */
export interface AdminDailyPoint {
  date: string;
  count: number;
}

/**
 * A compact, non-sensitive activity row: enough to recognise a request
 * without exposing the requester's identity (no mobile, email or user id).
 */
export interface AdminRecentRequest {
  id: string;
  title: string;
  category: string;
  categoryFa: string;
  state: LegalRequestState;
  stateFa: string;
  createdAt: string;
}

/** The comparison window that `previousValue`/`changePct` refer to. */
export interface AdminOverviewComparison {
  /** Length of one window in days. */
  windowDays: number;
  /** ISO cutoff of the current window start (inclusive). */
  currentFrom: string;
  /** ISO cutoff of the previous window start (inclusive). */
  previousFrom: string;
  /** ISO cutoff of the previous window end (exclusive — start of current). */
  previousTo: string;
}

export interface AdminOverview {
  rangeDays: number;
  generatedAt: string;
  timezone: string;
  currency: string;
  kpis: AdminKpi[];
  /** Real counts that may require an operator decision, or `[]`. */
  attention: AdminAttentionItem[];
  /** Active requests grouped by state (non-terminal states only). */
  requestsByState: AdminBreakdownItem[];
  /** Requests registered in the window grouped by legal category. */
  requestsByCategory: AdminBreakdownItem[];
  /** Requests registered per day over the window. */
  dailyRequests: AdminDailyPoint[];
  /** The window compared against, or `null` when not comparable. */
  comparison: AdminOverviewComparison | null;
  /** Total active (non-terminal) requests right now — a live snapshot. */
  openRequestsTotal: number;
  /** The state ids used for `requestsByState`, in display order. */
  activeRequestStates: LegalRequestState[];
  /** The most recently registered requests, newest first (bounded). */
  recentRequests: AdminRecentRequest[];
}

// ---------------------------------------------------------------------------
// Excel exports (§7)
// ---------------------------------------------------------------------------
// One `AdminExportKind` per exportable admin surface. This is the SINGLE
// source of truth: the server adapters, the download endpoint's authorization
// and the UI export control all read these lists, so a new surface can never
// drift between the three.

/** The admin surfaces that can be exported to a real Excel workbook. */
export const ADMIN_EXPORT_KINDS = [
  "lawyers",
  "rag-sources",
  "knowledge",
  "ai-providers",
  "blog",
  "requests",
  "users",
  "orders",
  "settlements",
  "calculators",
  "services",
  "plans",
  "support-tickets",
  "energy-usage",
  "audit",
] as const;

export type AdminExportKind = (typeof ADMIN_EXPORT_KINDS)[number];

/**
 * The permission required to export each surface. It mirrors the READ
 * permission of the underlying resource — exporting the audit log demands
 * `admin:audit:read`, never a generic overview permission — so an operator can
 * only download data they are already allowed to view.
 */
export const ADMIN_EXPORT_PERMISSION: Record<AdminExportKind, Permission> = {
  lawyers: "admin:lawyer:read",
  "rag-sources": "admin:rag:read",
  knowledge: "admin:knowledge:read",
  "ai-providers": "admin:ai:read",
  blog: "admin:content:read",
  requests: "admin:requests:read",
  users: "admin:users:read",
  orders: "admin:billing:read",
  settlements: "admin:finance:read",
  calculators: "admin:calculators:read",
  services: "admin:services:read",
  plans: "admin:plans:read",
  "support-tickets": "admin:support:read",
  "energy-usage": "admin:energy:read",
  audit: "admin:audit:read",
};

/** Persian display name for each export surface (UI control + workbook tab). */
export const ADMIN_EXPORT_KIND_FA: Record<AdminExportKind, string> = {
  lawyers: "وکلا",
  "rag-sources": "منابع دانش",
  knowledge: "پایگاه دانش حقوقی",
  "ai-providers": "ارائه‌دهندگان هوش مصنوعی",
  blog: "مقالات",
  requests: "درخواست‌ها",
  users: "کاربران",
  orders: "سفارش‌ها",
  settlements: "تسویه‌حساب وکلا",
  calculators: "محاسبه‌گرها",
  services: "سرویس‌ها",
  plans: "پلن‌های اشتراک",
  "support-tickets": "تیکت‌های پشتیبانی",
  "energy-usage": "مصرف انرژی",
  audit: "رویدادنگار",
};

// ---------------------------------------------------------------------------
// Platform announcements (بازبینی محتوا / اطلاع‌رسانی)
// ---------------------------------------------------------------------------
// An admin-authored announcement is NOT a parallel inbox: it is persisted and
// then surfaced through the SAME derived notification feed the user already
// has (`deriveNotifications`), under the `public` category. Read receipts,
// unread counts and the bell therefore all stay consistent with one source.

/** Who receives an announcement. */
export const ANNOUNCEMENT_AUDIENCES = ["ALL", "LAWYERS"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ANNOUNCEMENT_AUDIENCE_FA: Record<AnnouncementAudience, string> = {
  ALL: "همه کاربران",
  LAWYERS: "کاربران با نقش وکیل",
};

/** Lifecycle: a draft is never delivered; only `published` reaches the feed. */
export const ANNOUNCEMENT_STATUSES = ["draft", "published"] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const ANNOUNCEMENT_STATUS_FA: Record<AnnouncementStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
};

/** A persisted, admin-authored announcement. */
export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  /** Optional in-app destination paired with `actionLabel`. */
  href: string | null;
  actionLabel: string | null;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  /** Actor user id + a display name resolved at read time. */
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  publishedAt: string | null;
}

/** Request body for creating an announcement. `publish` decides draft vs live. */
export interface CreateAnnouncementInput {
  title: string;
  message: string;
  href?: string | null;
  actionLabel?: string | null;
  audience: AnnouncementAudience;
  publish: boolean;
}
