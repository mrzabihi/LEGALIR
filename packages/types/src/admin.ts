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

import type { PlatformRole, Permission } from "./platform";

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
  role: PlatformRole;
  roleFa: string;
  orgId: string | null;
  createdAt: string;
}

export interface RoleDescriptor {
  role: PlatformRole;
  roleFa: string;
  isStaff: boolean;
  isSuperAdmin: boolean;
  permissions: Permission[];
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
}

export interface AdminOverview {
  rangeDays: number;
  generatedAt: string;
  timezone: string;
  currency: string;
  kpis: AdminKpi[];
}
