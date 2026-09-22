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
import { LAW_SOURCES, type LawSourceDef } from "@/lib/law-catalog";
import type {
  ActiveRequestItem,
  DashboardRecommendation,
  RecommendationSource,
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

// ============================================================
// Smart Recommendations — grounded in the real «iran legal» corpus
// ============================================================
// Every recommendation is derived from an actual artifact: one of the
// user's documents/contracts, or one of the 16 curated law sources in
// law-catalog.ts (which map 1:1 to the real files under «iran legal»).
// Nothing here is a generic AI tip — each card carries provenance
// (source title, article/clause locator, issuing authority, file name).

/** Map a curated law source to the provenance shape the UI renders. */
function lawProvenance(def: LawSourceDef): RecommendationSource {
  return {
    title: def.title,
    locator: def.articleSection,
    authority: def.publicationAuthority,
    fileName: def.fileName,
    kind: "law",
  };
}

/** Find a curated law source by id (defensive — catalog is static). */
function law(id: string): LawSourceDef | undefined {
  return LAW_SOURCES.find((l) => l.id === id);
}

/**
 * Keyword → law-source mapping. When a user document/contract mentions a
 * topic, we surface the *actual* governing provision from the corpus
 * instead of a generic suggestion. Ordered by specificity.
 */
interface TopicRule {
  /** Phrases that indicate the topic. Longer/more specific phrases score higher. */
  keywords: string[];
  lawIds: string[];
  note: string;
}

// Keywords are deliberately specific: a bare «بیمه» must NOT match a
// property-insurance clause in a lease, so the social-security rule
// requires «تأمین اجتماعی» / «حق بیمه» / «سهم کارگر» instead.
const TOPIC_RULES: TopicRule[] = [
  {
    keywords: ["تأمین اجتماعی", "تامین اجتماعی", "حق بیمه", "سهم کارگر", "سازمان تأمین"],
    lawIds: ["law-social-security", "law-labor"],
    note: "سهم حق بیمه و مهلت واریز را صریحاً در سند قید کنید تا مسئولیت کارفرما مشخص باشد.",
  },
  {
    keywords: ["اضافه‌کاری", "اضافه کاری", "ساعات کار", "فوق‌العاده", "۴۴ ساعت"],
    lawIds: ["law-labor"],
    note: "نرخ فوق‌العاده اضافه‌کاری و سقف ساعات را مطابق قانون کار تعیین کنید.",
  },
  {
    keywords: ["وجه التزام", "شرط کیفری", "خسارت قراردادی", "جریمه تأخیر", "جریمه تاخیر"],
    lawIds: ["law-penalty-clause", "law-penalty-clause-iran"],
    note: "سقف و مبنای وجه التزام را روشن کنید؛ دادگاه نمی‌تواند بیش از مبلغ مقرر حکم دهد.",
  },
  {
    keywords: ["تأخیر تأدیه", "تاخیر تادیه", "شاخص قیمت", "دیرکرد"],
    lawIds: ["law-delayed-payment", "law-central-bank"],
    note: "مبنای محاسبه خسارت را به شاخص قیمت بانک مرکزی پیوند دهید.",
  },
  {
    keywords: ["چک", "برگشتی", "بلامحل", "صیاد"],
    lawIds: ["law-cheque"],
    note: "ضمانت اجراهای کیفری و حقوقی چک و مهلت‌های قانونی را در نظر بگیرید.",
  },
  {
    keywords: ["طلاق", "مهریه", "نفقه", "حضانت"],
    lawIds: ["law-divorce"],
    note: "آثار مالی و غیرمالی انحلال نکاح را مطابق قانون مدنی بررسی کنید.",
  },
  {
    keywords: ["اجاره", "موجر", "مستأجر", "ودیعه", "تخلیه"],
    lawIds: ["law-civil-procedure", "law-civil-procedure-doctrine"],
    note: "شرایط فسخ، افزایش اجاره و تخلیه را به سقف قانونی و رویه دادگاه‌ها پیوند دهید.",
  },
  {
    keywords: ["گمرک", "ترخیص", "تعرفه", "حقوق ورودی", "ارزش گمرکی"],
    lawIds: ["law-customs", "law-hs"],
    note: "طبقه‌بندی تعرفه‌ای و ارزش گمرکی را مطابق قواعد HS تعیین کنید.",
  },
  {
    keywords: ["تسهیلات", "اعتباری", "نرخ سود", "بانک مرکزی"],
    lawIds: ["law-monetary-banking", "law-central-bank"],
    note: "شروط قرارداد اعتباری را با قانون پولی و بانکی و مقررات بانک مرکزی تطبیق دهید.",
  },
  {
    keywords: ["استخدام", "کارمند", "کارفرما", "قرارداد کار", "دوره آزمایشی"],
    lawIds: ["law-labor", "law-civil-service"],
    note: "شرایط ورود به خدمت و تکالیف کارفرما را مطابق قانون کار و خدمات کشوری تنظیم کنید.",
  },
  {
    keywords: ["دادخواست", "دعوی", "صلاحیت", "دادرسی", "لایحه"],
    lawIds: ["law-civil-procedure", "law-civil-procedure-doctrine"],
    note: "شرایط اقامه دعوی و صلاحیت دادگاه را مطابق آیین دادرسی مدنی بررسی کنید.",
  },
  {
    keywords: ["محرمانگی", "NDA", "افشای اطلاعات", "اطلاعات محرمانه"],
    lawIds: ["law-penalty-clause"],
    note: "سازوکار جبران خسارت نقض محرمانگی را با وجه التزام قابل اجرا تعیین کنید.",
  },
];

/**
 * Score a document/contract against the topic rules and return the single
 * best-matching topic. Scoring (rather than first-match) prevents a weak
 * incidental keyword from beating the document's actual subject — e.g. a
 * lease that merely mentions property insurance must resolve to the
 * landlord/tenant topic, not to social security.
 */
function matchTopics(text: string): { lawIds: string[]; note: string } | null {
  const haystack = text.toLowerCase();
  let best: { lawIds: string[]; note: string; score: number } | null = null;

  for (const rule of TOPIC_RULES) {
    let score = 0;
    for (const k of rule.keywords) {
      if (haystack.includes(k.toLowerCase())) score += k.length; // longer phrase = stronger signal
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { lawIds: rule.lawIds, note: rule.note, score };
    }
  }

  return best ? { lawIds: best.lawIds, note: best.note } : null;
}

export function buildRecommendations(
  documents: V1DocumentDetail[],
  contracts: V1ContractDetail[]
): DashboardRecommendation[] {
  const recs: DashboardRecommendation[] = [];

  // --- 1) Actionable state of the user's own artifacts (highest priority) ---

  const failedDoc = documents.find((d) => d.status === "failed");
  if (failedDoc) {
    recs.push({
      id: "rec-failed-doc",
      text: `سند «${failedDoc.name}» با خطا مواجه شد؛ می‌توانید دوباره تلاش کنید.`,
      detail: "پردازش این سند نیمه‌کاره مانده و تا رفع خطا، تحلیل آن در دسترس نیست.",
      icon: "⚠️",
      link: `/documents/${failedDoc.id}`,
      linkLabel: "بررسی سند",
      urgency: "action",
      source: { title: failedDoc.name, kind: "document", documentName: failedDoc.name },
    });
  }

  const reviewContract = contracts.find((c) => c.state === "under_review");
  if (reviewContract) {
    recs.push({
      id: "rec-review-contract",
      text: `قرارداد «${reviewContract.title}» منتظر بررسی نهایی شماست.`,
      detail: "پیش از تولید نسخه نهایی، بندهای حفاظتی پیشنهادی را تأیید کنید.",
      icon: "📝",
      link: `/contracts/${reviewContract.id}`,
      linkLabel: "ادامه بررسی",
      urgency: "warning",
      source: { title: reviewContract.title, kind: "contract", documentName: reviewContract.title },
    });
  }

  const processingDoc = documents.find(isActiveDocument);
  if (processingDoc) {
    recs.push({
      id: "rec-processing-doc",
      text: `تحلیل «${processingDoc.name}» در حال انجام است.`,
      detail: "پس از پایان استخراج متن، یافته‌های حقوقی روی همین صفحه نمایش داده می‌شود.",
      icon: "🔄",
      link: `/documents/${processingDoc.id}`,
      linkLabel: "مشاهده وضعیت",
      urgency: "info",
      source: { title: processingDoc.name, kind: "document", documentName: processingDoc.name },
    });
  }

  // --- 2) Corpus-grounded recommendations from the user's real documents ---
  // For each analysed document, match its content against the curated law
  // catalog and surface the actual governing provision (with provenance).

  const analysed = documents.filter((d) => d.status === "ready" && d.report);
  for (const doc of analysed) {
    const text = `${doc.name} ${doc.extractedText ?? ""} ${doc.report?.summary ?? ""}`;
    const topic = matchTopics(text);
    if (!topic) continue;
    const def = topic.lawIds.map(law).find((l): l is LawSourceDef => Boolean(l));
    if (!def) continue;
    const id = `rec-law-${def.id}-${doc.id}`;
    if (recs.some((r) => r.id === id)) continue;
    recs.push({
      id,
      text: `«${doc.name}» با ${def.articleSection} مرتبط است.`,
      detail: topic.note,
      icon: "⚖️",
      link: `/legal-library`,
      linkLabel: "مشاهده منبع قانونی",
      urgency: "info",
      source: { ...lawProvenance(def), documentName: doc.name },
    });
  }

  // --- 3) Contract-grounded recommendations (governing provision per type) ---

  const CONTRACT_LAW: Record<string, string> = {
    employment: "law-labor",
    contracting: "law-penalty-clause",
    nda: "law-penalty-clause",
    partnership: "law-civil-procedure",
    lease: "law-civil-procedure",
    saas: "law-monetary-banking",
  };

  for (const c of contracts) {
    const lawId = CONTRACT_LAW[c.type];
    if (!lawId) continue;
    const def = law(lawId);
    if (!def) continue;
    const id = `rec-ctr-law-${def.id}-${c.id}`;
    if (recs.some((r) => r.id === id)) continue;
    recs.push({
      id,
      text: `قرارداد «${c.title}» را با ${def.articleSection} تطبیق دهید.`,
      detail: def.summary,
      icon: "📘",
      link: `/contracts/${c.id}`,
      linkLabel: "بررسی قرارداد",
      urgency: "info",
      source: { ...lawProvenance(def), documentName: c.title },
    });
  }

  // --- 4) Fallback: a real corpus entry when the user has no artifacts yet ---

  if (recs.length === 0) {
    const def = law("law-civil-procedure");
    if (def) {
      recs.push({
        id: "rec-law-starter",
        text: `از ${def.articleSection} شروع کنید.`,
        detail: def.summary,
        icon: "⚖️",
        link: "/legal-library",
        linkLabel: "مشاهده منبع قانونی",
        urgency: "info",
        source: lawProvenance(def),
      });
    }
  }

  // Actionable items first, then corpus-grounded ones; cap at 4.
  const rank: Record<DashboardRecommendation["urgency"], number> = { action: 0, warning: 1, info: 2 };
  return recs.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 4);
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
