// ============================================================
// LEGALIR — Usage report (server-only projection)
// ============================================================
// ONE read model behind every consumption surface:
//
//   • GET /api/v1/usage/report             → the user's own page
//   • GET /api/v1/admin/users/:id/usage    → the admin user tab
//   • GET /api/v1/subscription/usage/cards → the subscription banner
//
// Energy and tokens are deliberately kept in separate fields and separate
// aggregates — they are different units (internal charge vs. real model use)
// and must never be summed into one number.
//
// The rows are the SAME `usage_transactions` the engine writes; there is no
// second store and no parallel calculation.
// ============================================================

import { readTable } from "@/lib/db";
import { getActivity, ACTIVITY_REGISTRY } from "./activities";
import { serviceKeyForActivity, serviceNameForActivity } from "./energy";
import type {
  ActivityType,
  EnergySettlementStatus,
  SubscriptionUsageCard,
  UsageActionBreakdown,
  UsageReportItem,
  UsageReportQuery,
  UsageReportResponse,
  UsageReportTotals,
  UsageServiceBreakdown,
  UsageTransaction,
  UsageTransactionStatus,
} from "@legalir/types";

const TX_TABLE = "usage_transactions";

/** Persian labels for the action registry (the ledger never shows a raw code). */
const ACTION_LABEL_FA: Record<ActivityType, string> = Object.fromEntries(
  ACTIVITY_REGISTRY.map((a) => [a.code, a.displayNameFa])
) as Record<ActivityType, string>;

const SERVICE_LABEL_FALLBACK: Record<string, string> = {
  "ai-legal-assistant": "دستیار حقوقی هوشمند",
  "legal-chat": "گفتگوی حقوقی",
  "document-analysis": "تحلیل سند",
  "contract-draft": "پیش‌نویس قرارداد",
  "contract-create": "ایجاد قرارداد",
  "document-generation": "تولید سند",
  "legal-calculation": "محاسبه حقوقی",
  "case-analysis": "تحلیل پرونده",
  "lawyer-ai-prep": "آماده‌سازی هوشمند وکیل",
  "regenerate-response": "تولید مجدد پاسخ",
  "judicial-draft": "تنظیم دادخواست و شکواییه",
};

const SETTLEMENT_LABEL_FA: Record<EnergySettlementStatus, string> = {
  RESERVED: "در حال انجام",
  CHARGED: "کسر شده",
  REFUNDED: "بازگردانده‌شده",
  CREDITED: "بازگشت مابه‌التفاوت",
  FAILED: "ناموفق (بدون کسر)",
  FREE: "رایگان",
};

/** Derive the settlement state from the persisted facts (never stored twice). */
function settlementOf(tx: UsageTransaction): EnergySettlementStatus {
  if (tx.status === "RESERVED") return "RESERVED";
  if (tx.status === "REVERSED") return "REFUNDED";
  if (tx.status === "FAILED") return "FAILED";
  const finalEnergy = tx.energyFinal ?? tx.pointsCost;
  if (finalEnergy <= 0) {
    return tx.pointsCost > 0 || (tx.energyRefunded ?? 0) > 0 ? "CREDITED" : "FREE";
  }
  return "CHARGED";
}

/** The label shown for the row's state (the text the user understands). */
function settlementLabelOf(tx: UsageTransaction): string {
  if (tx.status === "FAILED") {
    return (tx.energyRefunded ?? 0) > 0 || tx.pointsCost === 0
      ? SETTLEMENT_LABEL_FA.FAILED
      : "ناموفق (طبق قاعده، کسر شده)";
  }
  return SETTLEMENT_LABEL_FA[settlementOf(tx)];
}

function serviceKeyOf(tx: UsageTransaction): string {
  // A row priced by a tariff carries the profile's slug; an un-tariffed row
  // must resolve to the SAME slug, otherwise one service splits into two keys.
  return tx.serviceKey ?? serviceKeyForActivity(tx.activityType);
}

function serviceNameOf(tx: UsageTransaction): string {
  const key = serviceKeyOf(tx);
  return (
    tx.tariffSnapshot?.nameFa ??
    serviceNameForActivity(tx.activityType) ??
    SERVICE_LABEL_FALLBACK[key] ??
    ACTION_LABEL_FA[tx.activityType] ??
    key
  );
}

function actionNameOf(tx: UsageTransaction): string {
  return ACTION_LABEL_FA[tx.activityType] ?? tx.activityType;
}

/** Project one engine row into the report shape. */
export function toReportItem(tx: UsageTransaction): UsageReportItem {
  const inputTokens = tx.inputTokens ?? 0;
  const outputTokens = tx.outputTokens ?? 0;
  // A legacy row has no explicit status: tokens > 0 can only have come from
  // the provider, so ACTUAL is honest; otherwise UNAVAILABLE (never "0 actual").
  const tokenStatus = tx.tokenUsageStatus ?? (tx.tokenCost > 0 ? "ACTUAL" : "UNAVAILABLE");
  const totalTokens = tx.tokenCost > 0 ? tx.tokenCost : inputTokens + outputTokens;
  const energyFinal = tx.energyFinal ?? (tx.status === "REVERSED" ? 0 : tx.pointsCost);

  return {
    id: tx.id,
    trackingId: tx.trackingId ?? tx.id,
    activityType: tx.activityType,
    serviceKey: serviceKeyOf(tx),
    serviceNameFa: serviceNameOf(tx),
    actionNameFa: actionNameOf(tx),
    model: tx.model ?? null,
    createdAt: tx.createdAt,
    energyReserved: tx.pointsCost,
    energyFinal,
    energyRefunded: tx.energyRefunded ?? 0,
    inputTokens,
    outputTokens,
    totalTokens,
    tokenStatus,
    tokenStatusReasonFa: tx.tokenUsageNoteFa ?? null,
    status: tx.status,
    settlement: settlementOf(tx),
    settlementLabelFa: settlementLabelOf(tx),
    creditSource: tx.creditSource,
    isFree: energyFinal <= 0 && tx.status !== "RESERVED",
    subscriptionId: tx.subscriptionId,
    relatedEntityId: tx.relatedEntityId,
    tariffVersion: tx.tariffVersion ?? null,
    breakdown: tx.tariffSnapshot?.breakdown ?? null,
  };
}

/** Inclusive ISO-date bounds from the query (defaults: last 30 days). */
function resolveWindow(query: UsageReportQuery): { from: string; to: string } {
  const to = query.to ? new Date(query.to) : new Date();
  const defaultFrom = new Date(to.getTime() - 30 * 86_400_000);
  const from = query.from ? new Date(query.from) : defaultFrom;
  return {
    from: Number.isNaN(from.getTime()) ? defaultFrom.toISOString() : from.toISOString(),
    to: Number.isNaN(to.getTime()) ? new Date().toISOString() : to.toISOString(),
  };
}

const STATUS_SET = new Set<UsageTransactionStatus>([
  "RESERVED",
  "COMPLETED",
  "REVERSED",
  "FAILED",
]);

/**
 * Build the usage report for one user (ownership is enforced by the caller).
 *
 * All aggregates are computed over the FILTERED set before pagination, so the
 * totals on the page always describe exactly what the table shows.
 */
export function buildUsageReport(
  userId: string,
  query: UsageReportQuery = {}
): UsageReportResponse {
  const { from, to } = resolveWindow(query);

  let rows = readTable<UsageTransaction>(TX_TABLE).filter((t) => t.userId === userId);
  if (query.subscriptionId) {
    rows = rows.filter((t) => t.subscriptionId === query.subscriptionId);
  }
  rows = rows.filter((t) => t.createdAt >= from && t.createdAt <= to);
  if (query.serviceKey) {
    rows = rows.filter((t) => serviceKeyOf(t) === query.serviceKey);
  }
  if (query.activityType) {
    rows = rows.filter((t) => t.activityType === query.activityType);
  }
  if (query.status && STATUS_SET.has(query.status)) {
    rows = rows.filter((t) => t.status === query.status);
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const items = rows.map(toReportItem);

  // --- Totals (energy and tokens stay separate) ---------------------------
  const totals: UsageReportTotals = {
    operations: items.length,
    energy: 0,
    energyReserved: 0,
    energyRefunded: 0,
    freeOperations: 0,
    failedOperations: 0,
    refundedOperations: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    unavailableTokenOperations: 0,
    estimatedTokenOperations: 0,
  };

  const byService = new Map<string, UsageServiceBreakdown>();
  const byAction = new Map<string, UsageActionBreakdown>();

  for (const item of items) {
    totals.energy += item.energyFinal;
    totals.energyReserved += item.energyReserved;
    totals.energyRefunded += item.energyRefunded;
    if (item.isFree) totals.freeOperations += 1;
    if (item.status === "FAILED") totals.failedOperations += 1;
    if (item.status === "REVERSED") totals.refundedOperations += 1;
    totals.inputTokens += item.inputTokens;
    totals.outputTokens += item.outputTokens;
    totals.totalTokens += item.totalTokens;
    if (item.tokenStatus === "UNAVAILABLE") totals.unavailableTokenOperations += 1;
    if (item.tokenStatus === "ESTIMATED") totals.estimatedTokenOperations += 1;

    const svc = byService.get(item.serviceKey) ?? {
      serviceKey: item.serviceKey,
      serviceNameFa: item.serviceNameFa,
      operations: 0,
      energy: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    svc.operations += 1;
    svc.energy += item.energyFinal;
    svc.inputTokens += item.inputTokens;
    svc.outputTokens += item.outputTokens;
    svc.totalTokens += item.totalTokens;
    byService.set(item.serviceKey, svc);

    const act = byAction.get(item.activityType) ?? {
      activityType: item.activityType,
      actionNameFa: item.actionNameFa,
      serviceKey: item.serviceKey,
      operations: 0,
      energy: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    act.operations += 1;
    act.energy += item.energyFinal;
    act.inputTokens += item.inputTokens;
    act.outputTokens += item.outputTokens;
    act.totalTokens += item.totalTokens;
    byAction.set(item.activityType, act);
  }

  const pageSize = Math.min(100, Math.max(1, Math.round(query.pageSize ?? 20)));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.round(query.page ?? 1)));
  const start = (page - 1) * pageSize;

  return {
    from,
    to,
    totals,
    byService: [...byService.values()].sort((a, b) => b.energy - a.energy),
    byAction: [...byAction.values()].sort((a, b) => b.energy - a.energy),
    items: items.slice(start, start + pageSize),
    totalItems,
    page,
    pageSize,
  };
}

/**
 * The real consumption recorded against ONE subscription — the data behind the
 * per-subscription banner. `energyQuota` is intentionally `null`: the current
 * plan model defines daily request / token quotas, not a per-subscription
 * energy cap, and this service never invents one.
 */
export function buildSubscriptionUsageCard(sub: {
  id: string;
  plan_name_fa: string;
  status: string;
  start_at: string;
  end_at: string;
}): SubscriptionUsageCard {
  const rows = readTable<UsageTransaction>(TX_TABLE).filter(
    (t) => t.subscriptionId === sub.id
  );

  let energyUsed = 0;
  let energyRefunded = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let operations = 0;

  for (const tx of rows) {
    if (tx.status === "FAILED" || tx.status === "REVERSED") {
      // A reversed request consumed nothing; it is reported as a refund, not
      // as real usage.
      if (tx.status === "REVERSED") energyRefunded += tx.energyRefunded ?? tx.pointsCost;
      continue;
    }
    const item = toReportItem(tx);
    energyUsed += item.energyFinal;
    energyRefunded += item.energyRefunded;
    inputTokens += item.inputTokens;
    outputTokens += item.outputTokens;
    totalTokens += item.totalTokens;
    operations += 1;
  }

  const end = new Date(sub.end_at).getTime();
  const daysRemaining = Number.isNaN(end)
    ? null
    : Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));

  return {
    subscriptionId: sub.id,
    planNameFa: sub.plan_name_fa,
    status: sub.status,
    startAt: sub.start_at,
    endAt: sub.end_at,
    daysRemaining,
    energyUsed,
    energyRefunded,
    inputTokens,
    outputTokens,
    totalTokens,
    operations,
    energyQuota: null,
    energyRemaining: null,
  };
}

/** The service filter options shown on the page (derived from real rows). */
export function listUserServiceOptions(userId: string): {
  serviceKey: string;
  serviceNameFa: string;
}[] {
  const seen = new Map<string, string>();
  for (const tx of readTable<UsageTransaction>(TX_TABLE)) {
    if (tx.userId !== userId) continue;
    const key = serviceKeyOf(tx);
    if (!seen.has(key)) seen.set(key, serviceNameOf(tx));
  }
  return [...seen.entries()]
    .map(([serviceKey, serviceNameFa]) => ({ serviceKey, serviceNameFa }))
    .sort((a, b) => a.serviceNameFa.localeCompare(b.serviceNameFa, "fa"));
}

/** Persian label for an activity, for filter menus and headers. */
export function actionLabelFa(activity: ActivityType): string {
  return ACTION_LABEL_FA[activity] ?? getActivity(activity)?.displayNameFa ?? activity;
}
