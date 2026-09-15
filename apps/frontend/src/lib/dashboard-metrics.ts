// ============================================================
// LEGALIR — Real Dashboard Metrics (server-only)
// ============================================================
// Computes the operational overview numbers from the JSON DB
// instead of the hard-coded placeholders that previously shipped
// in /api/v1/dashboard/summary.
//
// Business day = Asia/Tehran. Iran has not observed DST since 2022,
// so Tehran is a fixed UTC+03:30 offset going forward.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import {
  listDemoDocuments,
  listDemoContracts,
  listDemoMemories,
} from "@/lib/demo-seed";
import {
  queryRecentActivity,
  queryActiveSubscription,
  queryProfileUsage,
} from "@/lib/db";
import { tehranDateString } from "@/lib/rewards";
import type {
  ActiveRequestItem,
  DashboardRecommendation,
  RecentDocumentItem,
  V1ContractDetail,
  V1DocumentDetail,
} from "@legalir/types";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const TEHRAN_UTC_OFFSET_MS = 210 * 60 * 1000; // +03:30

// ============================================================
// Timezone helpers
// ============================================================

/** Start of the current Asia/Tehran day, expressed as a UTC Date. */
export function tehranDayStartUtc(date: Date = new Date()): Date {
  const [y, m, d] = tehranDateString(date).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) - TEHRAN_UTC_OFFSET_MS);
}

/** End (exclusive) of the current Asia/Tehran day, expressed as a UTC Date. */
export function tehranDayEndUtc(date: Date = new Date()): Date {
  return new Date(tehranDayStartUtc(date).getTime() + 24 * 60 * 60 * 1000);
}

function isTehranToday(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= tehranDayStartUtc(now).getTime() && t < tehranDayEndUtc(now).getTime();
}

// ============================================================
// Conversations (stored separately in .data/conversations.json)
// ============================================================

interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  status: string;
  riskLevel: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

function readConversations(): StoredConversation[] {
  const file = path.join(DATA_DIR, "conversations.json");
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as StoredConversation[];
  } catch {
    return [];
  }
}

// ============================================================
// Status → Persian label maps (shared by all builders)
// ============================================================

const DOC_STATUS_FA: Record<string, string> = {
  ready: "آماده",
  processing: "در حال پردازش",
  analyzing: "در حال تحلیل",
  extracting: "در حال استخراج",
  failed: "ناموفق",
  uploaded: "بارگذاری شده",
  blocked: "مسدود",
  cancelled: "لغو شده",
};

const CONTRACT_STATE_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  collecting: "در حال تکمیل",
  generated: "تولید شده",
  under_review: "در حال بررسی",
  approved: "تأیید شده",
  exported: "خروجی گرفته شده",
  archived: "بایگانی",
};

// ============================================================
// Metric builders
// ============================================================

/** Documents currently being processed/analysed (not yet ready). */
function isActiveDocument(d: V1DocumentDetail): boolean {
  return d.status === "processing" || d.status === "analyzing" || d.status === "extracting";
}

/** Contracts still being drafted / reviewed. */
function isActiveContract(c: V1ContractDetail): boolean {
  return c.state === "collecting" || c.state === "under_review" || c.state === "draft";
}

function buildActiveRequests(
  userId: string,
  documents: V1DocumentDetail[],
  contracts: V1ContractDetail[],
  conversations: StoredConversation[]
): ActiveRequestItem[] {
  const requests: ActiveRequestItem[] = [];

  for (const doc of documents.filter(isActiveDocument)) {
    const progress =
      doc.jobs.find((j) => j.status === "running")?.progress ?? 0;
    requests.push({
      id: doc.id,
      title: doc.name,
      type: "document",
      typeFa: "سند",
      date: doc.updatedAt,
      progress,
      status: "processing",
      statusFa: DOC_STATUS_FA[doc.status] ?? "در حال پردازش",
      link: `/documents/${doc.id}`,
    });
  }

  for (const c of contracts.filter(isActiveContract)) {
    requests.push({
      id: c.id,
      title: c.title,
      type: "contract",
      typeFa: "قرارداد",
      date: c.updatedAt,
      progress: c.state === "under_review" ? 75 : 40,
      status: c.state === "collecting" ? "needs_info" : "processing",
      statusFa: CONTRACT_STATE_FA[c.state] ?? "در حال انجام",
      link: `/contracts/${c.id}`,
    });
  }

  for (const conv of conversations.filter((c) => c.status === "active")) {
    requests.push({
      id: conv.id,
      title: conv.title,
      type: "conversation",
      typeFa: "گفتگو",
      date: conv.updatedAt,
      progress: 50,
      status: "processing",
      statusFa: "در حال بررسی",
      link: `/chat/${conv.id}`,
    });
  }

  // Most recent first.
  return requests
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}

function buildRecentDocuments(documents: V1DocumentDetail[]): RecentDocumentItem[] {
  return documents
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      name: d.name,
      mime: d.mime,
      uploadedAt: d.createdAt,
      status: d.status,
      statusFa: DOC_STATUS_FA[d.status] ?? d.status,
    }));
}

function buildRecommendations(
  documents: V1DocumentDetail[],
  contracts: V1ContractDetail[]
): DashboardRecommendation[] {
  const recs: DashboardRecommendation[] = [];

  const failedDoc = documents.find((d) => d.status === "failed");
  if (failedDoc) {
    recs.push({
      id: "rec-failed-doc",
      text: `سند «${failedDoc.name}» با خطا مواجه شد؛ می‌توانید دوباره تلاش کنید.`,
      icon: "⚠️",
      link: `/documents/${failedDoc.id}`,
      linkLabel: "بررسی سند",
      urgency: "action",
    });
  }

  const reviewContract = contracts.find((c) => c.state === "under_review");
  if (reviewContract) {
    recs.push({
      id: "rec-review-contract",
      text: `قرارداد «${reviewContract.title}» منتظر بررسی نهایی شماست.`,
      icon: "📝",
      link: `/contracts/${reviewContract.id}`,
      linkLabel: "ادامه بررسی",
      urgency: "warning",
    });
  }

  const processingDoc = documents.find(isActiveDocument);
  if (processingDoc) {
    recs.push({
      id: "rec-processing-doc",
      text: `تحلیل «${processingDoc.name}» در حال انجام است.`,
      icon: "🔄",
      link: `/documents/${processingDoc.id}`,
      linkLabel: "مشاهده وضعیت",
      urgency: "info",
    });
  }

  return recs.slice(0, 3);
}

// ============================================================
// Public aggregate
// ============================================================

export interface DashboardMetrics {
  documentsCount: number;
  contractsCount: number;
  memoriesCount: number;
  activeRequests: ActiveRequestItem[];
  recentDocuments: RecentDocumentItem[];
  recommendations: DashboardRecommendation[];
  activeProcessingCount: number;
  savedSourcesCount: number;
  /** Activities updated within the current Asia/Tehran day. */
  requestsToday: number;
  dailyRequestsUsed: number;
  dailyRequestsTotal: number;
}

export function computeDashboardMetrics(userId: string, now = new Date()): DashboardMetrics {
  const documents = listDemoDocuments(userId);
  const contracts = listDemoContracts(userId);
  const memories = listDemoMemories(userId);
  const conversations = readConversations().filter((c) => c.userId === userId);
  const activities = queryRecentActivity(userId, 1000);
  const usage = queryProfileUsage(userId);

  const requestsToday = activities.filter((a) => isTehranToday(a.updated_at, now)).length;

  const activeRequests = buildActiveRequests(userId, documents, contracts, conversations);

  return {
    documentsCount: documents.length,
    contractsCount: contracts.length,
    memoriesCount: memories.length,
    activeRequests,
    recentDocuments: buildRecentDocuments(documents),
    recommendations: buildRecommendations(documents, contracts),
    activeProcessingCount: activeRequests.length,
    // "منابع ذخیره‌شده" = legal-context memories (the user's saved legal
    // knowledge), surfaced as a count for the dashboard overview.
    savedSourcesCount: memories.filter((m) => m.category === "legal_context").length,
    requestsToday,
    dailyRequestsUsed: usage.dailyRequestsUsed,
    dailyRequestsTotal: usage.dailyRequestsTotal,
  };
}

/** Days remaining on the user's active subscription (or null if none). */
export function subscriptionDaysRemaining(userId: string): number | null {
  const sub = queryActiveSubscription(userId);
  if (!sub) return null;
  const end = new Date(sub.endAt).getTime();
  const remaining = Math.ceil((end - Date.now()) / 86_400_000);
  return Math.max(0, remaining);
}
