// ============================================================
// LEGALIR — Admin Excel exports (server-only)
// ============================================================
// §7: every admin list must be exportable to a real, complete Excel workbook.
// Exports read the SAME server-side data the tables read — never the current
// UI page — so a filtered/paginated screen still exports the full dataset.
//
// One `AdminExportKind` per admin surface. Each kind is a thin adapter that
// projects the real domain objects into `SheetSpec`s; `buildXlsx` renders the
// bytes. All headers and cell text are Persian; dates are Jalali and numbers
// use Persian digits, matching the on-screen formatting.
// ============================================================

import type { SheetSpec, CellValue } from "@/lib/excel/xlsx";
import { buildXlsx, exportFilename } from "@/lib/excel/xlsx";
import { readTable, findUserById } from "@/lib/db";
import { toPersianDate, toPersianNumber } from "@/lib/persian-utils";
import { listLawyerProfiles } from "@/lib/lawyer-db";
import { listRagSources } from "@/lib/admin/rag";
import { listAiProviders } from "@/lib/admin/ai-providers";
import { listOrders } from "@/lib/admin/orders";
import { buildCalculatorsInventory } from "@/lib/admin/calculators";
import { listCostProfiles, listCostRules } from "@/lib/usage/energy";
import { listAdminBlogPosts } from "@/lib/admin/blog";
import { listSettlements } from "@/lib/admin/settlements";
import { listTickets, SLA_HOURS } from "@/lib/admin/support";
import { buildKnowledgeInventory } from "@/lib/knowledge/inventory";
import { readPlans } from "@/lib/usage/plans";
import {
  LAWYER_VERIFICATION_FA,
  SERVICE_COST_UNIT_FA,
  SERVICE_COST_RULE_CONDITION_FA,
  BLOG_POST_STATUS_FA,
  SETTLEMENT_STATUS_FA,
  SUPPORT_STATUS_FA,
  SUPPORT_PRIORITY_FA,
  ADMIN_EXPORT_KINDS,
  ADMIN_EXPORT_KIND_FA,
  type AdminExportKind,
  type AdminAuditEntry,
  type PlatformRole,
  type UsageTransaction,
  type VerificationStatus,
  type SourceStatus,
} from "@legalir/types";

/** The append-only audit table name (mirrors lib/admin/audit.ts). */
const AUDIT_TABLE = "admin_audit_log";

// The kind list and its Persian label live in `@legalir/types` (single source
// of truth) so the server, the endpoint's authorization and the UI control can
// never disagree. Re-exported here for existing server-side callers.
export { ADMIN_EXPORT_KINDS, ADMIN_EXPORT_KIND_FA };
export type { AdminExportKind };

/** Base filename for each export kind (the sheet title comes from the shared FA label). */
const META: Record<AdminExportKind, { file: string }> = {
  lawyers: { file: "admin-lawyers" },
  "rag-sources": { file: "admin-knowledge-sources" },
  knowledge: { file: "admin-knowledge-inventory" },
  "ai-providers": { file: "admin-ai-providers" },
  blog: { file: "admin-blog" },
  requests: { file: "admin-requests" },
  users: { file: "admin-users" },
  orders: { file: "admin-orders" },
  settlements: { file: "admin-settlements" },
  calculators: { file: "admin-calculators" },
  services: { file: "admin-services" },
  plans: { file: "admin-plans" },
  "support-tickets": { file: "admin-support-tickets" },
  "energy-usage": { file: "admin-energy-usage" },
  audit: { file: "admin-audit" },
};

/** Persian label for a knowledge source's verification status. */
const KNOWLEDGE_VERIFICATION_FA: Record<VerificationStatus, string> = {
  VERIFIED_OFFICIAL: "تأیید رسمی",
  VERIFIED_SECONDARY: "تأیید ثانویه",
  DEMO_VERIFIED: "تأیید نمایشی",
  UNVERIFIED: "تأییدنشده",
  OUTDATED: "منقضی",
  SUPERSEDED: "جایگزین‌شده",
};

/** Persian label for the validity status of a knowledge source. */
const KNOWLEDGE_SOURCE_STATUS_FA: Record<SourceStatus, string> = {
  valid: "معتبر",
  amended: "اصلاح‌شده",
  expired: "منقضی",
  needs_review: "نیازمند بازبینی",
};

/** Persian label for a knowledge source's provenance origin. */
const KNOWLEDGE_ORIGIN_FA: Record<string, string> = {
  LIBRARY: "کتابخانه حقوقی",
  CATALOG: "فهرست قوانین",
  CORPUS: "پیکره ایندکس‌شده",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const YEAR = /^\d{4}-\d{2}-\d{2}/;

/** ISO timestamp → Jalali date-time, or the raw value when unparseable. */
function dt(value: string | null | undefined): string {
  if (!value) return "";
  if (!YEAR.test(value) && Number.isNaN(Date.parse(value))) return value;
  try {
    return toPersianDate(value, {
      calendar: "persian",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/** Number → Persian-digit string; null/undefined → "". */
function n(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? toPersianNumber(value) : "";
}

function yn(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "بله" : "خیر";
}

function join(list: string[] | null | undefined): string {
  return Array.isArray(list) ? list.join("، ") : "";
}

/** Collect every page of a `{items,total,page,pageSize}`-shaped paged list. */
function collectAll<T>(
  fetch: (page: number, pageSize: number) => { items: T[]; total: number }
): T[] {
  const pageSize = 100;
  const first = fetch(1, pageSize);
  const all = [...first.items];
  const pages = Math.ceil(first.total / pageSize);
  for (let page = 2; page <= pages; page++) all.push(...fetch(page, pageSize).items);
  return all;
}

// ---------------------------------------------------------------------------
// Row shapes read directly (kept local & minimal)
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  mobile: string;
  email: string | null;
  displayName: string | null;
  role?: PlatformRole;
  platformAccountType?: string;
  createdAt: string;
}

interface RequestRow {
  id: string;
  userId: string;
  title: string;
  category: string;
  state: string;
  selectedLawyerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

function buildSheets(kind: AdminExportKind): { sheets: Omit<SheetSpec, "name">[] } {
  switch (kind) {
    case "lawyers": {
      const rows = listLawyerProfiles().filter((l) => !l.isDemo);
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "fullName", header: "نام کامل", width: 26 },
              { key: "licenseNumber", header: "شماره پروانه", width: 16 },
              { key: "licenseYear", header: "سال پروانه", width: 12 },
              { key: "professionalTitle", header: "عنوان حرفه‌ای", width: 26 },
              { key: "city", header: "شهر", width: 16 },
              { key: "verificationStatusFa", header: "وضعیت تأیید", width: 18 },
              { key: "acceptingRequests", header: "پذیرش درخواست", width: 14 },
              { key: "completedCases", header: "پرونده‌های تکمیل‌شده", width: 16 },
              { key: "rating", header: "میانگین امتیاز", width: 12 },
              { key: "createdAt", header: "تاریخ ایجاد", width: 22 },
            ],
            rows: rows.map((l) => ({
              id: l.id,
              fullName: l.fullName,
              licenseNumber: l.licenseNumber ?? "",
              licenseYear: n(l.licenseYear),
              professionalTitle: l.professionalTitle ?? "",
              city: l.locations[0]?.city ?? "",
              verificationStatusFa: LAWYER_VERIFICATION_FA[l.verificationStatus],
              acceptingRequests: yn(l.acceptingRequests),
              completedCases: n(l.performance.completedCases),
              rating: n(l.performance.averageRating),
              createdAt: dt(l.createdAt),
            })),
          },
        ],
      };
    }

    case "rag-sources": {
      const rows = listRagSources();
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "title", header: "عنوان", width: 40 },
              { key: "sourceTypeFa", header: "نوع منبع", width: 20 },
              { key: "authority", header: "مرجع", width: 24 },
              { key: "jurisdiction", header: "صلاحیت", width: 20 },
              { key: "reviewState", header: "وضعیت بازبینی", width: 18 },
              { key: "activeInRetrieval", header: "فعال در بازیابی", width: 14 },
              { key: "publishedInLibrary", header: "منتشر در کتابخانه", width: 16 },
              { key: "chunkCount", header: "تعداد قطعه", width: 12 },
              { key: "lastIndexedAt", header: "آخرین نمایه‌سازی", width: 22 },
              { key: "updatedAt", header: "آخرین ویرایش", width: 22 },
            ],
            rows: rows.map((s) => ({
              id: s.id,
              title: s.title,
              sourceTypeFa: s.sourceTypeFa,
              authority: s.authority,
              jurisdiction: s.jurisdiction,
              reviewState: s.reviewState,
              activeInRetrieval: yn(s.activeInRetrieval),
              publishedInLibrary: yn(s.publishedInLibrary),
              chunkCount: s.chunkCount,
              lastIndexedAt: dt(s.lastIndexedAt),
              updatedAt: dt(s.updatedAt),
            })),
          },
        ],
      };
    }

    case "ai-providers": {
      const rows = listAiProviders();
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "nameFa", header: "نام", width: 26 },
              { key: "kind", header: "نوع ارائه‌دهنده", width: 18 },
              { key: "baseUrl", header: "آدرس سرویس", width: 32 },
              { key: "model", header: "مدل پیش‌فرض", width: 20 },
              { key: "availableModels", header: "مدل‌های موجود", width: 34 },
              { key: "embeddingModel", header: "مدل امبدینگ", width: 20 },
              { key: "status", header: "وضعیت", width: 14 },
              { key: "isDefault", header: "پیش‌فرض", width: 12 },
              { key: "hasKey", header: "کلید ذخیره‌شده", width: 14 },
              { key: "timeoutMs", header: "مهلت (ms)", width: 12 },
              { key: "maxOutputTokens", header: "حداکثر توکن خروجی", width: 16 },
              { key: "updatedAt", header: "آخرین ویرایش", width: 22 },
            ],
            rows: rows.map((p) => ({
              id: p.id,
              nameFa: p.nameFa,
              kind: p.kind,
              baseUrl: p.baseUrl ?? "",
              model: p.model ?? "",
              availableModels: join(p.availableModels),
              embeddingModel: p.embeddingModel ?? "",
              status: p.status,
              isDefault: yn(p.isDefault),
              hasKey: yn(p.hasKey),
              timeoutMs: p.timeoutMs,
              maxOutputTokens: p.maxOutputTokens,
              updatedAt: dt(p.updatedAt),
            })),
          },
        ],
      };
    }

    case "blog": {
      // The SAME admin store the authoring UI writes to — so the export carries
      // the real publish status, not just the public projection.
      const posts = listAdminBlogPosts();
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "slug", header: "نامک", width: 28 },
              { key: "titleFa", header: "عنوان", width: 40 },
              { key: "status", header: "وضعیت", width: 14 },
              { key: "category", header: "دسته", width: 20 },
              { key: "author", header: "نویسنده", width: 20 },
              { key: "tags", header: "برچسب‌ها", width: 28 },
              { key: "readingTime", header: "زمان مطالعه", width: 12 },
              { key: "featured", header: "ویژه", width: 10 },
              { key: "aiAssisted", header: "تولید با AI", width: 12 },
              { key: "publishedAt", header: "تاریخ انتشار", width: 22 },
              { key: "updatedAt", header: "آخرین به‌روزرسانی", width: 22 },
              { key: "excerpt", header: "خلاصه", width: 50 },
            ],
            rows: posts.map((p) => ({
              id: p.id,
              slug: p.slug,
              titleFa: p.titleFa,
              status: BLOG_POST_STATUS_FA[p.status],
              category: p.category,
              author: p.author,
              tags: join(p.tags),
              readingTime: n(p.readingTime),
              featured: yn(p.featured),
              aiAssisted: yn(p.aiAssisted),
              publishedAt: dt(p.publishedAt),
              updatedAt: dt(p.updatedAt),
              excerpt: p.excerpt,
            })),
          },
        ],
      };
    }

    case "requests": {
      const rows = readTable<RequestRow>("legal_requests");
      const items: Record<string, CellValue>[] = rows
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => {
          const user = findUserById(r.userId);
          return {
            id: r.id,
            title: r.title,
            category: r.category,
            state: r.state,
            userDisplayName: user?.displayName ?? "",
            userId: r.userId,
            selectedLawyerId: r.selectedLawyerId ?? "",
            createdAt: dt(r.createdAt),
            updatedAt: dt(r.updatedAt),
          };
        });
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "title", header: "عنوان", width: 40 },
              { key: "category", header: "دسته", width: 18 },
              { key: "state", header: "وضعیت", width: 18 },
              { key: "userDisplayName", header: "کاربر", width: 24 },
              { key: "userId", header: "شناسه کاربر", width: 24 },
              { key: "selectedLawyerId", header: "وکیل انتخاب‌شده", width: 24 },
              { key: "createdAt", header: "تاریخ ایجاد", width: 22 },
              { key: "updatedAt", header: "آخرین تغییر", width: 22 },
            ],
            rows: items,
          },
        ],
      };
    }

    case "users": {
      const users = readTable<UserRow>("users");
      const subs = readTable<{ user_id: string; status_fa?: string; status?: string }>("subscriptions");
      const active = new Set(
        subs.filter((s) => s.status_fa === "فعال" || s.status === "active").map((s) => s.user_id)
      );
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "displayName", header: "نام نمایشی", width: 24 },
              { key: "role", header: "نقش", width: 16 },
              { key: "accountType", header: "نوع حساب", width: 16 },
              { key: "email", header: "ایمیل", width: 28 },
              { key: "hasActiveSubscription", header: "اشتراک فعال", width: 14 },
              { key: "createdAt", header: "تاریخ عضویت", width: 22 },
            ],
            // Mobile is intentionally masked in exports too (matches the UI).
            rows: users
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((u) => ({
                id: u.id,
                displayName: u.displayName ?? "",
                role: u.role ?? "USER",
                accountType: u.platformAccountType ?? "PERSONAL",
                email: u.email ?? "",
                hasActiveSubscription: yn(active.has(u.id)),
                createdAt: dt(u.createdAt),
              })),
          },
        ],
      };
    }

    case "orders": {
      const rows = collectAll((page, pageSize) => listOrders({ page, pageSize }));
      return {
        sheets: [
          {
            columns: [
              { key: "referenceId", header: "کد سفارش", width: 24 },
              { key: "userDisplayName", header: "کاربر", width: 24 },
              { key: "userMobileMasked", header: "موبایل", width: 16 },
              { key: "planNameFa", header: "پلن", width: 22 },
              { key: "listPrice", header: "قیمت فهرست", width: 16 },
              { key: "salePrice", header: "قیمت پرداختی", width: 16 },
              { key: "discountAmount", header: "تخفیف", width: 14 },
              { key: "refundedAmount", header: "بازگشتی", width: 14 },
              { key: "netAmount", header: "مبلغ خالص", width: 16 },
              { key: "status", header: "وضعیت", width: 16 },
              { key: "gateway", header: "درگاه", width: 14 },
              { key: "purchasedAt", header: "تاریخ پرداخت", width: 22 },
            ],
            rows: rows.map((o) => ({
              referenceId: o.referenceId,
              userDisplayName: o.userDisplayName ?? "",
              userMobileMasked: o.userMobileMasked,
              planNameFa: o.planNameFa,
              listPrice: n(o.listPrice),
              salePrice: n(o.salePrice),
              discountAmount: n(o.discountAmount),
              refundedAmount: n(o.refundedAmount),
              netAmount: n(o.netAmount),
              status: o.status,
              gateway: o.gateway,
              purchasedAt: dt(o.purchasedAt),
            })),
          },
        ],
      };
    }

    case "calculators": {
      const inv = buildCalculatorsInventory();
      const settings = readTable<{
        slug: string;
        enabled?: boolean;
        accessTier?: string;
        energyCost?: number;
      }>("calculator_settings");
      const bySlug = new Map(settings.map((s) => [s.slug, s]));
      return {
        sheets: [
          {
            columns: [
              { key: "slug", header: "نامک", width: 26 },
              { key: "titleFa", header: "عنوان", width: 32 },
              { key: "category", header: "دسته", width: 18 },
              { key: "legalBasisFa", header: "مبنای قانونی", width: 34 },
              { key: "confidence", header: "اطمینان", width: 14 },
              { key: "available", header: "دردسترس", width: 12 },
              { key: "enabled", header: "فعال", width: 12 },
              { key: "accessTier", header: "سطح دسترسی", width: 20 },
              { key: "energyCost", header: "هزینه انرژی", width: 14 },
              { key: "datasetIds", header: "مجموعه‌داده‌ها", width: 30 },
              { key: "warningsFa", header: "هشدارها", width: 30 },
            ],
            rows: inv.calculators.map((c) => {
              const s = bySlug.get(c.slug);
              return {
                slug: c.slug,
                titleFa: c.titleFa,
                category: c.category,
                legalBasisFa: c.legalBasisFa,
                confidence: c.confidence,
                available: yn(c.available),
                enabled: yn(s?.enabled ?? c.available),
                accessTier: s?.accessTier ?? "",
                energyCost: n(s?.energyCost ?? 0),
                datasetIds: join(c.datasetIds),
                warningsFa: join(c.warningsFa),
              };
            }),
          },
        ],
      };
    }

    case "services": {
      // §6 — the Service Cost Management system: one sheet of pricing profiles
      // and one of their rules (ordering preserved by priority).
      const profiles = listCostProfiles();
      const rules = listCostRules();
      const nameByProfile = new Map(profiles.map((p) => [p.id, p.nameFa]));
      const unitSummary = (profile: (typeof profiles)[number]) =>
        Object.entries(profile.unitCosts)
          .filter(([, v]) => typeof v === "number" && v > 0)
          .map(([k, v]) => `${SERVICE_COST_UNIT_FA[k as keyof typeof SERVICE_COST_UNIT_FA]}: ${v}`)
          .join(" / ");
      const modelSummary = (profile: (typeof profiles)[number]) =>
        Object.entries(profile.modelMultipliers)
          .map(([m, f]) => `${m}×${f}`)
          .join(" / ");
      return {
        sheets: [
          {
            columns: [
              { key: "serviceKey", header: "کلید سرویس", width: 24 },
              { key: "nameFa", header: "نام", width: 28 },
              { key: "activity", header: "فعالیت", width: 22 },
              { key: "enabled", header: "فعال", width: 12 },
              { key: "baseRequestCost", header: "هزینه پایه", width: 14 },
              { key: "inputTokenPer1k", header: "توکن ورودی/۱۰۰۰", width: 16 },
              { key: "outputTokenPer1k", header: "توکن خروجی/۱۰۰۰", width: 16 },
              { key: "contextTokenPer1k", header: "توکن زمینه/۱۰۰۰", width: 16 },
              { key: "units", header: "هزینه واحدها", width: 40 },
              { key: "models", header: "ضریب مدل‌ها", width: 30 },
              { key: "updatedAt", header: "آخرین ویرایش", width: 22 },
            ],
            rows: profiles.map((p) => ({
              serviceKey: p.serviceKey,
              nameFa: p.nameFa,
              activity: p.activity,
              enabled: yn(p.enabled),
              baseRequestCost: n(p.baseRequestCost),
              inputTokenPer1k: n(p.inputTokenPer1k),
              outputTokenPer1k: n(p.outputTokenPer1k),
              contextTokenPer1k: n(p.contextTokenPer1k),
              units: unitSummary(p),
              models: modelSummary(p),
              updatedAt: dt(p.updatedAt),
            })),
          },
          {
            columns: [
              { key: "priority", header: "اولویت", width: 10 },
              { key: "profile", header: "سرویس", width: 28 },
              { key: "labelFa", header: "عنوان قاعده", width: 34 },
              { key: "conditionFa", header: "شرط", width: 24 },
              { key: "min", header: "حد پایین", width: 14 },
              { key: "max", header: "حد بالا", width: 14 },
              { key: "models", header: "مدل‌ها", width: 24 },
              { key: "addEnergy", header: "افزایش انرژی", width: 14 },
              { key: "multiply", header: "ضریب", width: 12 },
              { key: "enabled", header: "فعال", width: 12 },
              { key: "updatedAt", header: "آخرین ویرایش", width: 22 },
            ],
            rows: rules.map((r) => ({
              priority: n(r.priority),
              profile: nameByProfile.get(r.profileId) ?? r.profileId,
              labelFa: r.labelFa,
              conditionFa: SERVICE_COST_RULE_CONDITION_FA[r.condition],
              min: r.min === null ? "" : n(r.min),
              max: r.max === null ? "" : n(r.max),
              models: join(r.models),
              addEnergy: n(r.addEnergy),
              multiply: r.multiply === null ? "" : String(r.multiply),
              enabled: yn(r.enabled),
              updatedAt: dt(r.updatedAt),
            })),
          },
        ],
      };
    }

    case "knowledge": {
      const rows = buildKnowledgeInventory();
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "title", header: "عنوان", width: 44 },
              { key: "tierFa", header: "سطح اعتبار", width: 18 },
              { key: "sourceTypeFa", header: "نوع منبع", width: 20 },
              { key: "authority", header: "مرجع", width: 26 },
              { key: "verificationStatusFa", header: "وضعیت تأیید", width: 16 },
              { key: "statusFa", header: "وضعیت اعتبار", width: 16 },
              { key: "originFa", header: "منشأ", width: 20 },
              { key: "locator", header: "موضع", width: 18 },
              { key: "textHash", header: "اثر انگشت متن", width: 26 },
              { key: "popular", header: "پرتکرار", width: 12 },
            ],
            rows: rows.map((k) => ({
              id: k.id,
              title: k.title,
              tierFa: k.tierFa,
              sourceTypeFa: k.sourceTypeFa,
              authority: k.authority,
              verificationStatusFa: KNOWLEDGE_VERIFICATION_FA[k.verificationStatus],
              statusFa: KNOWLEDGE_SOURCE_STATUS_FA[k.status],
              originFa: KNOWLEDGE_ORIGIN_FA[k.origin] ?? k.origin,
              locator: k.locator,
              textHash: k.textHash ?? "",
              popular: yn(k.popular),
            })),
          },
        ],
      };
    }

    case "settlements": {
      const rows = listSettlements();
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "lawyerName", header: "وکیل", width: 26 },
              { key: "lawyerId", header: "شناسه وکیل", width: 24 },
              { key: "periodStart", header: "شروع دوره", width: 20 },
              { key: "periodEnd", header: "پایان دوره", width: 20 },
              { key: "grossAmount", header: "مبلغ ناخالص", width: 16 },
              { key: "platformFee", header: "کارمزد پلتفرم", width: 16 },
              { key: "deductions", header: "کسرها", width: 14 },
              { key: "netAmount", header: "خالص", width: 16 },
              { key: "statusFa", header: "وضعیت", width: 20 },
              { key: "lineCount", header: "تعداد ردیف", width: 12 },
              { key: "payoutDestinationMasked", header: "مقصد پرداخت", width: 24 },
              { key: "payoutReference", header: "مرجع پرداخت", width: 20 },
              { key: "approvedBy", header: "تأییدکننده", width: 24 },
              { key: "paidAt", header: "تاریخ پرداخت", width: 22 },
              { key: "createdAt", header: "تاریخ ایجاد", width: 22 },
            ],
            rows: rows.map((s) => ({
              id: s.id,
              lawyerName: s.lawyerName,
              lawyerId: s.lawyerId,
              periodStart: dt(s.periodStart),
              periodEnd: dt(s.periodEnd),
              grossAmount: n(s.grossAmount),
              platformFee: n(s.platformFee),
              deductions: n(s.deductions),
              netAmount: n(s.netAmount),
              statusFa: SETTLEMENT_STATUS_FA[s.status],
              lineCount: n(s.lines.length),
              payoutDestinationMasked: s.payoutDestinationMasked ?? "",
              payoutReference: s.payoutReference ?? "",
              approvedBy: s.approvedBy ?? "",
              paidAt: dt(s.paidAt),
              createdAt: dt(s.createdAt),
            })),
          },
        ],
      };
    }

    case "plans": {
      const rows = readPlans();
      return {
        sheets: [
          {
            columns: [
              { key: "code", header: "کد پلن", width: 16 },
              { key: "nameFa", header: "نام", width: 24 },
              { key: "durationDays", header: "مدت (روز)", width: 14 },
              { key: "dailyRequestLimit", header: "سقف درخواست روزانه", width: 16 },
              { key: "tokenLimit", header: "سقف توکن", width: 14 },
              { key: "aiMessageLimit", header: "سقف پیام هوش مصنوعی", width: 16 },
              { key: "documentAnalysisLimit", header: "سقف تحلیل سند", width: 16 },
              { key: "contractDraftLimit", header: "سقف پیش‌نویس قرارداد", width: 16 },
              { key: "contractCreationLimit", header: "سقف ایجاد قرارداد", width: 16 },
              { key: "activityCostPoints", header: "هزینه هر فعالیت", width: 16 },
              { key: "listPrice", header: "قیمت فهرست", width: 16 },
              { key: "salePrice", header: "قیمت فروش", width: 16 },
              { key: "currency", header: "واحد پول", width: 12 },
              { key: "isActive", header: "فعال", width: 10 },
              { key: "updatedAt", header: "آخرین ویرایش", width: 22 },
            ],
            rows: rows.map((p) => ({
              code: p.code,
              nameFa: p.nameFa,
              durationDays: n(p.durationDays),
              dailyRequestLimit: n(p.dailyRequestLimit),
              tokenLimit: n(p.tokenLimit),
              aiMessageLimit: n(p.aiMessageLimit),
              documentAnalysisLimit: n(p.documentAnalysisLimit),
              contractDraftLimit: n(p.contractDraftLimit),
              contractCreationLimit: n(p.contractCreationLimit),
              activityCostPoints: n(p.activityCostPoints),
              listPrice: n(p.listPrice),
              salePrice: n(p.salePrice),
              currency: p.currency,
              isActive: yn(p.isActive),
              updatedAt: dt(p.updatedAt),
            })),
          },
        ],
      };
    }

    case "support-tickets": {
      const rows = listTickets();
      return {
        sheets: [
          {
            columns: [
              { key: "id", header: "شناسه", width: 24 },
              { key: "subject", header: "موضوع", width: 40 },
              { key: "category", header: "دسته", width: 20 },
              { key: "statusFa", header: "وضعیت", width: 16 },
              { key: "priorityFa", header: "اولویت", width: 14 },
              { key: "requesterName", header: "درخواست‌کننده", width: 24 },
              { key: "requesterMobileMasked", header: "موبایل", width: 16 },
              { key: "slaHours", header: "مهلت (ساعت)", width: 12 },
              { key: "dueAt", header: "زمان مهلت", width: 22 },
              { key: "messageCount", header: "تعداد پیام", width: 12 },
              { key: "createdAt", header: "تاریخ ایجاد", width: 22 },
              { key: "updatedAt", header: "آخرین به‌روزرسانی", width: 22 },
            ],
            rows: rows.map((t) => ({
              id: t.id,
              subject: t.subject,
              category: t.category,
              statusFa: SUPPORT_STATUS_FA[t.status],
              priorityFa: SUPPORT_PRIORITY_FA[t.priority],
              requesterName: t.requesterName,
              requesterMobileMasked: t.requesterMobileMasked ?? "",
              slaHours: n(SLA_HOURS[t.priority]),
              dueAt: dt(t.dueAt),
              messageCount: n(t.messages.length),
              createdAt: dt(t.createdAt),
              updatedAt: dt(t.updatedAt),
            })),
          },
        ],
      };
    }

    case "energy-usage": {
      const rows = readTable<UsageTransaction>("usage_transactions");
      return {
        sheets: [
          {
            columns: [
              { key: "createdAt", header: "زمان", width: 22 },
              { key: "userId", header: "کاربر", width: 24 },
              { key: "serviceKey", header: "سرویس", width: 22 },
              { key: "activityType", header: "فعالیت", width: 20 },
              { key: "requestId", header: "شناسه درخواست", width: 24 },
              { key: "model", header: "مدل", width: 20 },
              { key: "inputTokens", header: "توکن ورودی", width: 14 },
              { key: "outputTokens", header: "توکن خروجی", width: 14 },
              { key: "contextTokens", header: "توکن زمینه", width: 14 },
              { key: "toolCalls", header: "فراخوانی ابزار", width: 14 },
              { key: "ragCalls", header: "بازیابی RAG", width: 14 },
              { key: "requestCost", header: "هزینه پایه", width: 14 },
              { key: "tokenCost", header: "هزینه توکن", width: 14 },
              { key: "additionalCost", header: "هزینه اضافه", width: 14 },
              { key: "pointsCost", header: "انرژی کل", width: 14 },
              { key: "creditSource", header: "منبع اعتبار", width: 16 },
              { key: "status", header: "وضعیت", width: 14 },
            ],
            rows: rows
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((t) => ({
                createdAt: dt(t.createdAt),
                userId: t.userId,
                serviceKey: t.serviceKey ?? "",
                activityType: t.activityType,
                requestId: t.relatedEntityId ?? "",
                model: t.model ?? "",
                inputTokens: n(t.inputTokens ?? 0),
                outputTokens: n(t.outputTokens ?? 0),
                contextTokens: n(t.contextTokens ?? 0),
                toolCalls: n(t.toolCalls ?? 0),
                ragCalls: n(t.ragCalls ?? 0),
                requestCost: n(t.requestCost),
                tokenCost: n(t.tokenCost),
                additionalCost: n(t.additionalCost ?? 0),
                pointsCost: n(t.pointsCost),
                creditSource: t.creditSource,
                status: t.status,
              })),
          },
        ],
      };
    }

    case "audit": {
      // Read the append-only table directly the way `listAudit` does, so the
      // export is never truncated by the 200-row page cap.
      const rows = readTable<AdminAuditEntry>(AUDIT_TABLE).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      return {
        sheets: [
          {
            columns: [
              { key: "createdAt", header: "زمان", width: 22 },
              { key: "actorRole", header: "نقش کنشگر", width: 16 },
              { key: "action", header: "عملیات", width: 24 },
              { key: "resourceType", header: "نوع منبع", width: 18 },
              { key: "resourceId", header: "شناسه منبع", width: 24 },
              { key: "result", header: "نتیجه", width: 12 },
              { key: "reason", header: "دلیل", width: 34 },
            ],
            rows: rows.map((a) => ({
              createdAt: dt(a.createdAt),
              actorRole: a.actorRole,
              action: a.action,
              resourceType: a.resourceType,
              resourceId: a.resourceId ?? "",
              result: a.result,
              reason: a.reason ?? "",
            })),
          },
        ],
      };
    }

    default: {
      const never: never = kind;
      throw new Error(`unknown export kind: ${String(never)}`);
    }
  }
}

/** True when `kind` is a supported export. */
export function isAdminExportKind(kind: string): kind is AdminExportKind {
  return (ADMIN_EXPORT_KINDS as readonly string[]).includes(kind);
}

/**
 * Build the Excel workbook for one admin surface.
 * @returns `{ fileName, bytes, rowCount }` on success, or `{ error }`.
 */
export function buildAdminExport(
  kind: AdminExportKind
): { fileName: string; bytes: Uint8Array; rowCount: number } | { error: string } {
  try {
    const { sheets } = buildSheets(kind);
    // One worksheet per returned table. Excel caps a sheet name at 31 chars,
    // so suffix the shared Persian label for the 2nd+ sheet when needed.
    const base = ADMIN_EXPORT_KIND_FA[kind];
    const specs: SheetSpec[] = sheets.map((s, i) => ({
      ...s,
      name: (i === 0 ? base : `${base} ${i + 1}`).slice(0, 31),
    }));
    const bytes = buildXlsx(specs);
    return {
      fileName: exportFilename(META[kind].file),
      bytes: new Uint8Array(bytes),
      rowCount: specs.reduce((sum, s) => sum + s.rows.length, 0),
    };
  } catch {
    return { error: "EXPORT_FAILED" };
  }
}
