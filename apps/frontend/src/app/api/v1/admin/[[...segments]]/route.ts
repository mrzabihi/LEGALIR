// ============================================================
// LEGALIR — Admin API (single dispatcher)
// ============================================================
// Every admin endpoint is served from this one route so the whole
// authorization + audit surface is reviewable in one place. The concrete
// routes that predate it (admin/knowledge, admin/lawyers, admin/plans/[code])
// remain as separate files and, being more specific, take precedence.
//
// SECURITY MODEL
//   • No handler runs without `requirePermission(perm)`.
//   • Mutations are appended to the audit trail via `recordAudit`.
//   • Secrets are never returned (see lib/admin/secrets + ai-providers).
//   • Amounts are integers in Toman (IRT).
//
// The path after `/api/v1/admin/` is matched against the ROUTES table; a
// trailing dynamic id is captured. Responses use the `{ data }` envelope.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { readTable, findUserById, normalizeStoredMobile } from "@/lib/db";
import {
  ADMIN_EXPORT_PERMISSION,
  lawyerDecisionBucket,
  LEGAL_REQUEST_TRANSITIONS,
  ANNOUNCEMENT_STATUSES,
  type Permission,
  type PlatformRole,
  type LegalRequestState,
  type AnnouncementAudience,
} from "@legalir/types";

import { adminError, mapDataError, readJson, requestMeta, intParam } from "@/lib/admin/http";
import { buildOverview, revenueByPlan, dailySales, resolvedRangeDays } from "@/lib/admin/metrics";
import { listFlags, updateFlag } from "@/lib/admin/flags";
import {
  listOrders,
  getOrder,
  listAdjustments,
  createAdjustment,
  decideAdjustment,
  buildOrderReceipt,
} from "@/lib/admin/orders";
import { renderOrderReceiptPdf } from "@/lib/admin/receipt-pdf";
import {
  listCommissionRules,
  updateCommissionRule,
  listSettlements,
  getSettlement,
  createSettlement,
  addSettlementLine,
  transitionSettlement,
  maskPayoutDestination,
} from "@/lib/admin/settlements";
import {
  listAiProviders,
  saveAiProvider,
  testAiProvider,
  listPromptVersions,
  createPromptVersion,
  activatePromptVersion,
  getAiUsageMetrics,
  isSecretStorageReady,
} from "@/lib/admin/ai-providers";
import {
  listRagSources,
  ragReviewCounts,
  updateRagReview,
  getRagPipelineStatus,
  getRagSourceDetail,
  testRagRetrieval,
  reingestRagCorpus,
  lawCatalogCoverage,
} from "@/lib/admin/rag";
import {
  listAdminBlogPosts,
  getAdminBlogPost,
  listBlogCategories,
  upsertBlogPost,
  setBlogStatus,
  deleteBlogPost,
  generateBlogDraft,
} from "@/lib/admin/blog";
import { buildCalculatorsInventory } from "@/lib/admin/calculators";
import {
  listCalculatorSettings,
  getCalculatorSetting,
  saveCalculatorSetting,
} from "@/lib/admin/calculator-settings";
import {
  listCostProfiles,
  getCostProfile,
  saveCostProfile,
  listCostRules,
  saveCostRule,
  deleteCostRule,
  readLedger,
  getLedgerSummary,
} from "@/lib/usage/energy";
import { buildAdminExport, isAdminExportKind, type AdminExportKind } from "@/lib/admin/export";
import {
  listAnnouncements,
  createAnnouncement,
  setAnnouncementStatus,
} from "@/lib/admin/announcements";
import {
  listTickets,
  getTicket,
  createTicket,
  addMessage,
  updateTicket,
  supportCounts,
  isOverdue,
} from "@/lib/admin/support";
import { listStaff, getStaffMember, changeUserRole, listRoles } from "@/lib/admin/staff";
import {
  getAdminUserSubscriptionView,
  applyAdminSubscriptionAction,
  grantAdminEnergy,
  getAdminUserUsage,
} from "@/lib/admin/subscription";
import { listAudit, recordAudit } from "@/lib/admin/audit";
import {
  auditPlanCreated,
  createPlan,
  isPurchasable,
  planToPublic,
  readPlans,
  sortPlans,
} from "@/lib/usage/plans";
import type { CreatePlanInput } from "@/lib/usage/plans";
import type { PlanStatus } from "@legalir/types";
import { listOrganizations } from "@/lib/org-db";
import { readBlog } from "@/lib/legal-library-db";
import { listLawyerProfiles } from "@/lib/lawyer-db";
import { getRequestById, listRequestEvents, assignRequestLawyer, transitionRequest } from "@/lib/legal-request-db";
import type {
  AiProviderKind,
  AdjustmentKind,
  SettlementStatus,
  RagReviewState,
  AdminBlogPost,
  CalculatorAccessTier,
  SupportTicketStatus,
  SupportTicketPriority,
  OrderStatus,
  PlanCode,
  AdminSubscriptionActionInput,
  AdminEnergyActionInput,
} from "@legalir/types";

/**
 * Blog lifecycle as declared on the admin row. Derived from the row type
 * because `@legalir/types` also re-exports a WIDER, public `BlogPostStatus`.
 */
type AdminBlogStatus = AdminBlogPost["status"];

// ---------------------------------------------------------------------------
// Shared row shapes (local — keep this module self-contained)
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  mobile: string;
  email: string | null;
  displayName: string | null;
  role?: PlatformRole;
  platformAccountType?: string;
  orgId?: string | null;
  createdAt: string;
}

interface LegalRequestRow {
  id: string;
  userId: string;
  title: string;
  category: string;
  state: LegalRequestState;
  selectedLawyerId: string | null;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mask(mobile: string): string {
  const m = normalizeStoredMobile(mobile);
  if (m.length <= 8) return "••••";
  return `${m.slice(0, 4)}•••${m.slice(-4)}`;
}

const ok = <T>(data: T) => NextResponse.json({ data });

type Body = Record<string, unknown>;

// ---------------------------------------------------------------------------
// GET handlers
// ---------------------------------------------------------------------------

interface GetCtx {
  request: NextRequest;
  url: URL;
  segments: string[];
  id: string | undefined;
  perm: Permission;
  ctx: { userId: string; role: PlatformRole; orgId: string | null };
}

/**
 * Parse an optional explicit date window from the query string. Both `from`
 * and `to` must be present; otherwise the caller falls back to a rolling
 * `rangeDays` window. This is what powers the «بازهٔ سفارشی» preset.
 */
function explicitWindow(url: URL): { from: string; to: string } | null {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return from && to ? { from, to } : null;
}

const GET_ROUTES: Record<string, (c: GetCtx) => Promise<NextResponse> | NextResponse> = {
  overview: ({ url }) => ok(buildOverview(intParam(url, "rangeDays", 30), explicitWindow(url))),

  reports: ({ url }) => {
    const days = intParam(url, "rangeDays", 30);
    const win = explicitWindow(url);
    return ok({
      rangeDays: resolvedRangeDays(days, win),
      byPlan: revenueByPlan(days, win),
      daily: dailySales(days, win),
    });
  },

  users: ({ url }) => {
    const page = intParam(url, "page", 1);
    const pageSize = Math.min(100, intParam(url, "pageSize", 25));
    const q = (url.searchParams.get("search") ?? "").toLowerCase();
    const role = url.searchParams.get("role") ?? "";
    const subs = readTable<{ user_id: string; status_fa?: string; status?: string }>("subscriptions");
    const activeIds = new Set(
      subs.filter((s) => s.status_fa === "فعال" || s.status === "active").map((s) => s.user_id)
    );
    let rows = readTable<UserRow>("users");
    if (role) rows = rows.filter((u) => (u.role ?? "USER") === role);
    if (q) {
      rows = rows.filter(
        (u) =>
          (u.displayName ?? "").toLowerCase().includes(q) ||
          mask(u.mobile).includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }
    const items = rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        mobileMasked: mask(u.mobile),
        email: u.email,
        role: u.role ?? "USER",
        accountType: u.platformAccountType ?? "PERSONAL",
        hasActiveSubscription: activeIds.has(u.id),
        createdAt: u.createdAt,
      }));
    const total = items.length;
    const start = (page - 1) * pageSize;
    return ok({ items: items.slice(start, start + pageSize), total, page, pageSize });
  },

  requests: ({ url }) => {
    const page = intParam(url, "page", 1);
    const pageSize = Math.min(100, intParam(url, "pageSize", 25));
    const state = url.searchParams.get("state");
    const q = (url.searchParams.get("search") ?? "").toLowerCase();
    let rows = readTable<LegalRequestRow>("legal_requests");
    if (state) rows = rows.filter((r) => r.state === state);
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    const items = rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const user = findUserById(r.userId);
        return {
          id: r.id,
          title: r.title,
          category: r.category,
          state: r.state,
          userDisplayName: user?.displayName ?? null,
          selectedLawyerId: r.selectedLawyerId,
          orgId: r.orgId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      });
    const total = items.length;
    const start = (page - 1) * pageSize;
    return ok({ items: items.slice(start, start + pageSize), total, page, pageSize });
  },

  flags: () => ok({ items: listFlags() }),

  plans: () =>
    ok({
      items: sortPlans(readPlans()).map((p) => ({
        ...p,
        // Surface the effective status + whether it is purchasable so the
        // admin table never has to re-derive legacy `isActive` rows itself.
        status: p.status ?? (p.isActive ? "active" : "inactive"),
        purchasable: isPurchasable(p),
        discountPercent: planToPublic(p).discountPercent,
      })),
    }),

  orders: ({ url }) =>
    ok(
      listOrders({
        search: url.searchParams.get("search") ?? undefined,
        status: (url.searchParams.get("status") as OrderStatus | null) ?? undefined,
        planCode: url.searchParams.get("planCode") ?? undefined,
        page: intParam(url, "page", 1),
        pageSize: intParam(url, "pageSize", 20),
      })
    ),

  refunds: ({ url }) => ok({ items: listAdjustments(url.searchParams.get("orderId") ?? undefined) }),

  finance: () => ok({ rules: listCommissionRules() }),

  settlements: ({ url }) =>
    ok({
      items: listSettlements({
        lawyerId: url.searchParams.get("lawyerId") ?? undefined,
        status: (url.searchParams.get("status") as SettlementStatus | null) ?? undefined,
      }),
    }),

  // §5 — inventory (read-only datasets) PLUS the operational settings rows the
  // /admin/calculators page edits (enabled / accessTier / energyCost).
  calculators: () => ok({ ...buildCalculatorsInventory(), settings: listCalculatorSettings() }),

  support: ({ url }) =>
    ok({
      items: listTickets({
        status: (url.searchParams.get("status") as SupportTicketStatus | null) ?? undefined,
        priority: (url.searchParams.get("priority") as SupportTicketPriority | null) ?? undefined,
      }),
      counts: supportCounts(),
    }),

  content: () => {
    // §2 — the admin blog surface reports the real publish state from the ONE
    // blog store (lib/admin/blog reads the same .data/blog.json the public
    // site does). `readBlog` remains for the categories + legacy shape.
    const posts = listAdminBlogPosts();
    const blog = readBlog();
    return ok({
      blog: {
        total: posts.length,
        published: posts.filter((p) => p.status === "PUBLISHED").length,
        items: posts.slice(0, 100),
        categories: listBlogCategories(),
        legacyCategoryCount: blog.categories.length,
      },
    });
  },

  blog: ({ url }) =>
    ok({
      items: listAdminBlogPosts(),
      categories: listBlogCategories(),
      status: url.searchParams.get("status") ?? undefined,
    }),

  announcements: () => ok({ items: listAnnouncements() }),

  staff: ({ url }) =>
    ok({
      items: listStaff({
        search: url.searchParams.get("search") ?? undefined,
        role: url.searchParams.get("role") ?? undefined,
      }),
    }),

  roles: () => ok({ items: listRoles() }),

  audit: ({ url }) =>
    ok(
      listAudit({
        actorUserId: url.searchParams.get("actorUserId") ?? undefined,
        action: url.searchParams.get("action") ?? undefined,
        resourceType: url.searchParams.get("resourceType") ?? undefined,
        result: (url.searchParams.get("result") as "success" | "failure" | "denied" | null) ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        page: intParam(url, "page", 1),
        pageSize: intParam(url, "pageSize", 25),
      })
    ),

  settings: () => {
    const orgs = listOrganizations();
    const providers = listAiProviders();
    return ok({
      environment: process.env["NODE_ENV"] ?? "development",
      timezone: "Asia/Tehran",
      currency: "IRT",
      secretStorageConfigured: isSecretStorageReady(),
      aiProviders: providers.map((p) => ({
        id: p.id,
        nameFa: p.nameFa,
        status: p.status,
        hasKey: p.hasKey,
        isDefault: p.isDefault,
      })),
      integrations: [
        { key: "payments", labelFa: "درگاه پرداخت", configured: false, noteFa: "این محیط از پرداخت شبیه‌سازی‌شده استفاده می‌کند؛ درگاه واقعی متصل نیست." },
        { key: "sms", labelFa: "پیامک (OTP)", configured: Boolean(process.env["LEGALIR_OTP_PROVIDER"] && process.env["LEGALIR_OTP_PROVIDER"] !== "mock"), noteFa: "در صورت نبود ارائه‌دهنده، کد به‌صورت توسعه‌ای نمایش داده می‌شود." },
        { key: "video", labelFa: "مشاوره تصویری", configured: false, noteFa: "ارائه‌دهنده ویدیو متصل نشده است." },
      ],
      organizations: { total: orgs.length },
      lawyers: { total: listLawyerProfiles().filter((l) => !l.isDemo).length },
    });
  },
};

// Nested GET routes (path has an id or sub-path).
async function handleNestedGet(c: GetCtx): Promise<NextResponse> {
  const [a, b, d] = c.segments;
  switch (a) {
    case "calculators": {
      // §5 — one calculator's editable operational policy (defaults when unset).
      if (!b) return adminError(400, "BAD_PATH", "شناسهٔ محاسبه‌گر لازم است");
      return ok(getCalculatorSetting(b));
    }
    case "blog": {
      // §2 — blog categories + per-post detail.
      if (b === "categories") return ok({ items: listBlogCategories() });
      const post = b ? getAdminBlogPost(b) : undefined;
      if (!post) return adminError(404, "NOT_FOUND", "مطلب یافت نشد");
      return ok(post);
    }
    case "staff": {
      // One staff member's dossier (identity + effective permissions + org).
      const member = b ? getStaffMember(b) : undefined;
      if (!member) return adminError(404, "STAFF_NOT_FOUND", "کارمند یافت نشد");
      return ok(member);
    }
    case "users": {
      const user = b ? findUserById(b) : undefined;
      if (!user) return adminError(404, "USER_NOT_FOUND", "کاربر یافت نشد");
      // §30 — the per-user subscription + energy dossier. A sub-path
      // `users/:id/subscription` reads the full billing view; the bare
      // `users/:id` remains the identity record.
      if (d === "subscription") {
        const view = getAdminUserSubscriptionView(b!);
        if (!view) return adminError(404, "USER_NOT_FOUND", "کاربر یافت نشد");
        return ok(view);
      }
      // `users/:id/energy` reads today's credit + period quotas (the live
      // counters behind the subscription). Read-only; mutations are POST-only.
      if (d === "energy") {
        return ok(getAdminUserUsage(b!));
      }
      return ok({
        id: user.id,
        displayName: user.displayName,
        mobileMasked: mask(user.mobile),
        email: user.email,
        role: user.role ?? "USER",
        accountType: user.platformAccountType ?? "PERSONAL",
        orgId: user.orgId ?? null,
        createdAt: user.createdAt,
      });
    }
    case "requests": {
      const req = b ? getRequestById(b) : undefined;
      if (!req) return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
      const user = findUserById(req.userId);
      const lawyer = req.selectedLawyerId
        ? listLawyerProfiles().find((l) => l.id === req.selectedLawyerId)
        : undefined;
      // The auditable history the client and lawyer themselves see.
      const events = listRequestEvents(req.id);
      // Assignable lawyers: only APPROVED profiles — an operator must never be
      // able to route a live request to a suspended or unverified lawyer.
      const assignableLawyers = listLawyerProfiles()
        .filter((l) => lawyerDecisionBucket(l.verificationStatus) === "APPROVED")
        .map((l) => ({
          id: l.id,
          fullName: l.fullName,
          professionalTitle: l.professionalTitle ?? null,
        }));
      return ok({
        request: {
          id: req.id,
          title: req.title,
          category: req.category,
          state: req.state,
          userId: req.userId,
          userDisplayName: user?.displayName ?? null,
          selectedLawyerId: req.selectedLawyerId,
          selectedLawyerName: lawyer?.fullName ?? null,
          orgId: req.orgId,
          caseId: req.caseId,
          conversationId: req.conversationId,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
        },
        // Legal next states for the CURRENT state, taken from the authoritative
        // state machine — the UI never invents a transition the server rejects.
        allowedTransitions: LEGAL_REQUEST_TRANSITIONS[req.state],
        events,
        assignableLawyers,
      });
    }
    case "orders": {
      if (!b) return adminError(400, "BAD_PATH", "درخواست نامعتبر");
      if (d === "refunds") return ok({ items: listAdjustments(b) });

      const order = getOrder(b);
      if (!order) return adminError(404, "ORDER_NOT_FOUND", "سفارش یافت نشد");

      // Receipt descriptor — describes what a «رسید» is for THIS order and
      // whether one can be opened. Never fabricates a value or a file.
      if (d === "receipt") {
        return ok(buildOrderReceipt(order));
      }

      // The receipt PDF (system-generated for a confirmed purchase). Only a
      // paid order has one; an unpaid order yields 409 so the UI can say so.
      if (d === "receipt.pdf") {
        const receipt = buildOrderReceipt(order);
        if (!receipt.available) {
          return adminError(409, "RECEIPT_UNAVAILABLE", "برای این تراکنش رسیدی ثبت نشده است.");
        }
        let bytes: Uint8Array;
        try {
          bytes = await renderOrderReceiptPdf(receipt);
        } catch {
          return adminError(500, "RECEIPT_RENDER_FAILED", "تولید فایل رسید ناموفق بود.");
        }
        const fileName = encodeURIComponent(`receipt-${order.referenceId}.pdf`);
        return new NextResponse(new Uint8Array(bytes), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(bytes.length),
            // `inline` lets the browser's secure PDF viewer render it in a new
            // tab; the UI's download control forces the save via the anchor
            // `download` attribute. Never a shared/permanent public URL.
            "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
            // Private, per-operator financial content — never shared-cached.
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      return ok({ order, refunds: listAdjustments(b) });
    }
    case "settlements": {
      const s = b ? getSettlement(b) : undefined;
      if (!s) return adminError(404, "NOT_FOUND", "تسویه یافت نشد");
      return ok(s);
    }
    case "support": {
      const t = b ? getTicket(b) : undefined;
      if (!t) return adminError(404, "NOT_FOUND", "تیکت یافت نشد");
      return ok({ ticket: t, overdue: isOverdue(t) });
    }
    case "ai": {
      if (b === "providers") return ok({ items: listAiProviders(), secretStorageConfigured: isSecretStorageReady() });
      if (b === "prompts") return ok({ items: listPromptVersions(c.url.searchParams.get("key") ?? undefined) });
      if (b === "metrics") return ok(getAiUsageMetrics(intParam(c.url, "rangeDays", 30)));
      return adminError(400, "BAD_PATH", "درخواست نامعتبر");
    }
    case "rag": {
      if (b === "sources") {
        // §1 — source detail includes the actual searchable chunks, so an
        // operator can verify WHAT the retrieval pipeline will match.
        if (d) {
          const detail = getRagSourceDetail(d);
          if (!detail) return adminError(404, "NOT_FOUND", "منبع یافت نشد");
          return ok(detail);
        }
        return ok({
          items: listRagSources({
            reviewState: (c.url.searchParams.get("reviewState") as RagReviewState | null) ?? undefined,
            search: c.url.searchParams.get("search") ?? undefined,
          }),
          counts: ragReviewCounts(),
        });
      }
      if (b === "pipeline") {
        return ok({ status: getRagPipelineStatus(), coverage: lawCatalogCoverage() });
      }
      return adminError(400, "BAD_PATH", "درخواست نامعتبر");
    }
    case "energy": {
      // §6 — Service Cost / Energy model + the queryable usage ledger.
      if (b === "profiles") {
        if (!d) return ok({ items: listCostProfiles() });
        const profile = getCostProfile(d);
        if (!profile) return adminError(404, "NOT_FOUND", "مدل هزینه یافت نشد");
        return ok({ profile, rules: listCostRules(profile.id) });
      }
      if (b === "ledger") {
        return ok({
          items: readLedger({
            userId: c.url.searchParams.get("userId") ?? undefined,
            serviceKey: c.url.searchParams.get("serviceKey") ?? undefined,
            from: c.url.searchParams.get("from") ?? undefined,
            to: c.url.searchParams.get("to") ?? undefined,
          }),
        });
      }
      if (b === "summary") {
        return ok(getLedgerSummary(intParam(c.url, "rangeDays", 30)));
      }
      return adminError(400, "BAD_PATH", "درخواست نامعتبر");
    }
    case "exports": {
      // §7 — server-side Excel export of a complete admin surface.
      if (!b || !isAdminExportKind(b)) {
        return adminError(404, "NOT_FOUND", "نوع خروجی پشتیبانی نمی‌شود");
      }
      const kind: AdminExportKind = b;
      const result = buildAdminExport(kind);
      if ("error" in result) {
        return adminError(500, "EXPORT_FAILED", "تولید فایل خروجی ناموفق بود");
      }
      // Audited like every other sensitive operator action (§9).
      const meta = requestMeta(c.request);
      recordAudit({
        actorUserId: c.ctx.userId,
        actorRole: c.ctx.role,
        orgId: c.ctx.orgId,
        action: "export.download",
        resourceType: "export",
        resourceId: kind,
        after: { rows: result.rowCount },
        ...meta,
      });
      return new NextResponse(new Uint8Array(result.bytes), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Length": String(result.bytes.length),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    default:
      return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

interface Actor {
  userId: string;
  role: PlatformRole;
  orgId: string | null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * §5 — narrow a raw admin body to only the calculator-setting fields that are
 * actually present, so a PATCH-style partial save never blanks a field the
 * operator did not touch.
 */
function parseCalculatorSetting(body: Body): {
  enabled?: boolean;
  accessTier?: CalculatorAccessTier;
  energyCost?: number;
  allowedPlans?: string[];
  allowedUserIds?: string[];
} {
  const out: {
    enabled?: boolean;
    accessTier?: CalculatorAccessTier;
    energyCost?: number;
    allowedPlans?: string[];
    allowedUserIds?: string[];
  } = {};
  if ("enabled" in body) out.enabled = Boolean(body["enabled"]);
  if ("accessTier" in body) out.accessTier = body["accessTier"] as CalculatorAccessTier;
  if ("energyCost" in body) out.energyCost = num(body["energyCost"]);
  if (Array.isArray(body["allowedPlans"])) out.allowedPlans = body["allowedPlans"] as string[];
  if (Array.isArray(body["allowedUserIds"])) out.allowedUserIds = body["allowedUserIds"] as string[];
  return out;
}

/** Narrow a raw create body to the typed plan fields (numbers stay raw for
 *  `createPlan` to validate, so a bad value yields a precise Persian error). */
function parseCreatePlan(body: Body): CreatePlanInput {
  const s = (k: string): string | undefined =>
    typeof body[k] === "string" ? (body[k] as string) : undefined;
  return {
    code: s("code") ?? "",
    nameFa: s("nameFa") ?? "",
    descriptionFa: s("descriptionFa") ?? "",
    shortDescriptionFa: s("shortDescriptionFa"),
    durationDays: num(body["durationDays"]),
    activityCostPoints: num(body["activityCostPoints"]),
    dailyRequestLimit: num(body["dailyRequestLimit"]),
    tokenLimit: num(body["tokenLimit"]),
    aiMessageLimit: num(body["aiMessageLimit"]),
    documentAnalysisLimit: num(body["documentAnalysisLimit"]),
    contractDraftLimit: num(body["contractDraftLimit"]),
    contractCreationLimit: num(body["contractCreationLimit"]),
    contractCreationUnlimited: Boolean(body["contractCreationUnlimited"]),
    listPrice: num(body["listPrice"]),
    salePrice: num(body["salePrice"]),
    currency: s("currency"),
    features: Array.isArray(body["features"]) ? (body["features"] as string[]) : [],
    status: (body["status"] as PlanStatus | undefined) ?? "draft",
    displayOrder: body["displayOrder"] === undefined ? undefined : num(body["displayOrder"]),
    tags: Array.isArray(body["tags"]) ? (body["tags"] as string[]) : undefined,
  };
}

async function handlePost(request: NextRequest, segments: string[], actor: Actor): Promise<NextResponse> {
  const [a, b, c, d] = segments;
  const meta = requestMeta(request);

  // Plans — CREATE a new plan (POST /admin/plans). Status transitions and
  // edits go through PATCH on the concrete /admin/plans/[code] route.
  if (a === "plans" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createPlan(parseCreatePlan(body));
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "plan.create", resourceType: "plan", resourceId: str(body["code"]), result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    auditPlanCreated(res.plan, actor.userId);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "plan.create", resourceType: "plan", resourceId: res.plan.code, after: { code: res.plan.code, nameFa: res.plan.nameFa, status: res.plan.status, listPrice: res.plan.listPrice, salePrice: res.plan.salePrice }, ...meta });
    return NextResponse.json({ data: res.plan }, { status: 201 });
  }

  if (a === "plans" && b) {
    return adminError(405, "METHOD_NOT_ALLOWED", "برای ویرایش پلن از PATCH استفاده کنید");
  }

  if (a === "calculators" && b) {
    // §5 — save one calculator's operational policy (save-as-create; the
    // surface has no separate create form).
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = saveCalculatorSetting(b, parseCalculatorSetting(body), actor.userId);
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "calculator.settings.update", resourceType: "calculator", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "calculator.settings.update", resourceType: "calculator", resourceId: b, after: { enabled: res.enabled, accessTier: res.accessTier, energyCost: res.energyCost }, ...meta });
    return ok(res);
  }

  if (a === "orders" && b && c === "refunds") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createAdjustment({
      orderId: b,
      kind: (body["kind"] as AdjustmentKind) ?? "refund_partial",
      amount: num(body["amount"]),
      reason: str(body["reason"]),
      requestedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "order.refund.create", resourceType: "order", resourceId: b, after: { amount: res.amount, kind: res.kind }, reason: res.reason, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "refunds" && b && c === "decide") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const decision = body["decision"] === "approved" ? "approved" : "rejected";
    const res = decideAdjustment(b, decision, actor.userId);
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "refund.decide", resourceType: "adjustment", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "refund.decide", resourceType: "adjustment", resourceId: b, after: { status: res.status }, ...meta });
    return ok(res);
  }

  if (a === "finance" && b === "commission-rules") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = updateCommissionRule({
      serviceType: str(body["serviceType"], "consultation"),
      platformPercent: num(body["platformPercent"]),
      platformFixedToman: num(body["platformFixedToman"]),
      allowedDeductions: Array.isArray(body["allowedDeductions"]) ? (body["allowedDeductions"] as string[]) : [],
      changedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "commission.update", resourceType: "commission_rule", resourceId: res.id, after: { serviceType: res.serviceType, platformPercent: res.platformPercent, version: res.version }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "settlements" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createSettlement({
      lawyerId: str(body["lawyerId"]),
      lawyerName: str(body["lawyerName"]),
      periodStart: str(body["periodStart"]),
      periodEnd: str(body["periodEnd"]),
      createdBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "settlement.create", resourceType: "settlement", resourceId: res.id, after: { lawyerId: res.lawyerId }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "settlements" && b && c === "lines") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const gross = num(body["grossAmount"]);
    const res = addSettlementLine({
      settlementId: b,
      sourceType: str(body["sourceType"], "consultation"),
      sourceId: str(body["sourceId"]),
      grossAmount: gross,
      serviceType: str(body["serviceType"], "consultation"),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "settlement.line.add", resourceType: "settlement", resourceId: b, after: { grossAmount: gross }, ...meta });
    return ok(res);
  }

  if (a === "settlements" && b && c === "transition") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const rawDest = typeof body["payoutDestination"] === "string" ? (body["payoutDestination"] as string) : null;
    const reason = typeof body["reason"] === "string" ? (body["reason"] as string) : undefined;
    const res = transitionSettlement({
      settlementId: b,
      to: body["to"] as SettlementStatus,
      actorUserId: actor.userId,
      reason,
      payoutDestinationMasked: rawDest ? maskPayoutDestination(rawDest) : null,
      payoutReference: typeof body["payoutReference"] === "string" ? (body["payoutReference"] as string) : null,
    });
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "settlement.transition", resourceType: "settlement", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "settlement.transition", resourceType: "settlement", resourceId: b, after: { status: res.status }, reason: reason ?? null, ...meta });
    return ok(res);
  }

  if (a === "ai" && b === "providers" && !c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = saveAiProvider({
      id: typeof body["id"] === "string" ? (body["id"] as string) : undefined,
      nameFa: str(body["nameFa"]),
      kind: (body["kind"] as AiProviderKind) ?? "custom",
      baseUrl: typeof body["baseUrl"] === "string" ? (body["baseUrl"] as string) : null,
      model: typeof body["model"] === "string" ? (body["model"] as string) : null,
      embeddingModel: typeof body["embeddingModel"] === "string" ? (body["embeddingModel"] as string) : null,
      timeoutMs: num(body["timeoutMs"], 30000),
      maxOutputTokens: num(body["maxOutputTokens"], 2048),
      isDefault: Boolean(body["isDefault"]),
      apiKey: typeof body["apiKey"] === "string" ? (body["apiKey"] as string) : undefined,
      clearKey: Boolean(body["clearKey"]),
      updatedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "ai.provider.save", resourceType: "ai_provider", resourceId: res.id, after: { nameFa: res.nameFa, kind: res.kind, hasKey: res.hasKey, isDefault: res.isDefault }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "ai" && b === "providers" && c && d === "test") {
    const res = await testAiProvider(c);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "ai.provider.test", resourceType: "ai_provider", resourceId: c, result: res.ok ? "success" : "failure", reason: res.messageFa, ...meta });
    return ok(res);
  }

  if (a === "ai" && b === "prompts" && !c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createPromptVersion({
      key: str(body["key"]),
      labelFa: str(body["labelFa"]),
      content: str(body["content"]),
      changelog: typeof body["changelog"] === "string" ? (body["changelog"] as string) : null,
      createdBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "ai.prompt.create", resourceType: "ai_prompt", resourceId: res.id, after: { key: res.key, version: res.version }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "ai" && b === "prompts" && c && d === "activate") {
    const res = activatePromptVersion(c, actor.userId);
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "ai.prompt.activate", resourceType: "ai_prompt", resourceId: c, after: { key: res.key, version: res.version }, ...meta });
    return ok(res);
  }

  if (a === "support" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createTicket({
      subject: str(body["subject"]),
      category: str(body["category"], "general"),
      priority: (body["priority"] as SupportTicketPriority) ?? "normal",
      requesterUserId: typeof body["requesterUserId"] === "string" ? (body["requesterUserId"] as string) : null,
      requesterName: str(body["requesterName"], "کاربر"),
      body: str(body["body"]),
      authorUserId: actor.userId,
      authorName: "پشتیبانی",
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "support.create", resourceType: "support_ticket", resourceId: res.id, after: { subject: res.subject }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "energy" && b === "profiles" && !c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = saveCostProfile({
      id: typeof body["id"] === "string" ? (body["id"] as string) : undefined,
      serviceKey: str(body["serviceKey"]),
      nameFa: str(body["nameFa"]),
      descriptionFa: typeof body["descriptionFa"] === "string" ? (body["descriptionFa"] as string) : undefined,
      activity: body["activity"] as never,
      enabled: Boolean(body["enabled"]),
      baseRequestCost: num(body["baseRequestCost"]),
      inputTokenPer1k: num(body["inputTokenPer1k"]),
      outputTokenPer1k: num(body["outputTokenPer1k"]),
      contextTokenPer1k: num(body["contextTokenPer1k"]),
      unitCosts: (body["unitCosts"] as never) ?? {},
      modelMultipliers: (body["modelMultipliers"] as Record<string, number>) ?? {},
      updatedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "energy.profile.save", resourceType: "service_cost_profile", resourceId: res.id, after: { serviceKey: res.serviceKey, enabled: res.enabled, baseRequestCost: res.baseRequestCost }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "energy" && b === "rules" && !c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = saveCostRule({
      id: typeof body["id"] === "string" ? (body["id"] as string) : undefined,
      profileId: str(body["profileId"]),
      activity: body["activity"] as never,
      labelFa: str(body["labelFa"]),
      enabled: Boolean(body["enabled"]),
      priority: num(body["priority"], 100),
      condition: body["condition"] as never,
      min: body["min"] === null || body["min"] === undefined ? null : num(body["min"]),
      max: body["max"] === null || body["max"] === undefined ? null : num(body["max"]),
      models: Array.isArray(body["models"]) ? (body["models"] as string[]) : [],
      addEnergy: num(body["addEnergy"]),
      multiply: body["multiply"] === null || body["multiply"] === undefined ? null : num(body["multiply"]),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "energy.rule.save", resourceType: "service_cost_rule", resourceId: res.id, after: { profileId: res.profileId, condition: res.condition, addEnergy: res.addEnergy, enabled: res.enabled }, ...meta });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "energy" && b === "rules" && c && d === "delete") {
    const res = deleteCostRule(c);
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "energy.rule.delete", resourceType: "service_cost_rule", resourceId: c, ...meta });
    return ok(res);
  }

  if (a === "support" && b && c === "messages") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = addMessage({
      ticketId: b,
      authorUserId: actor.userId,
      authorName: "پشتیبانی",
      body: str(body["body"]),
      isInternal: Boolean(body["isInternal"]),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "support.message", resourceType: "support_ticket", resourceId: b, after: { internal: Boolean(body["isInternal"]) }, ...meta });
    return ok(res);
  }

  if (a === "announcements" && !b) {
    // Compose a platform announcement. Publishing delivers it through the
    // user's real notification feed; a draft is stored but withheld.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createAnnouncement(
      {
        title: str(body["title"]),
        message: str(body["message"]),
        href: body["href"] === undefined || body["href"] === null ? null : str(body["href"]),
        actionLabel:
          body["actionLabel"] === undefined || body["actionLabel"] === null
            ? null
            : str(body["actionLabel"]),
        audience: body["audience"] as AnnouncementAudience,
        publish: Boolean(body["publish"]),
      },
      actor.userId
    );
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "announcement.create",
      resourceType: "announcement",
      resourceId: res.id,
      after: { status: res.status, audience: res.audience },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "rag" && b === "retrieval-test") {
    // §1 — run a REAL query through the one retrieval pipeline so an operator
    // can verify a source is reachable. Read-only, so never audited as a change.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = testRagRetrieval(str(body["query"]), num(body["maxResults"]));
    if ("error" in res) return mapDataError(res.error);
    return ok(res);
  }

  if (a === "rag" && b === "reingest") {
    // §1 — re-run ingestion over the source folder. Idempotent (hash-deduped);
    // newly added law files enter the SAME pipeline that chat retrieval uses.
    const report = reingestRagCorpus();
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "rag.corpus.reingest",
      resourceType: "rag_corpus",
      resourceId: report.corpusDir,
      after: { sources: report.sources, chunks: report.chunks, tokens: report.tokens },
      ...meta,
    });
    return ok(report);
  }

  if (a === "blog") {
    // §2 — AI content generation. Produces a draft from the configured provider
    // (honestly reporting the mock); saving keeps it as a DRAFT — publishing is
    // a separate, explicit step.
    if (b === "generate") {
      const body = (await readJson(request)) as Body | null;
      if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
      const res = await generateBlogDraft(
        {
          topic: str(body["topic"]),
          category: body["category"] === undefined ? null : str(body["category"]),
          keywords: Array.isArray(body["keywords"]) ? (body["keywords"] as string[]) : [],
          tone: body["tone"] === undefined ? null : str(body["tone"]),
          titleHint: body["titleHint"] === undefined ? null : str(body["titleHint"]),
          save: Boolean(body["save"]),
        },
        actor.userId
      );
      if ("error" in res) return mapDataError(res.error);
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "blog.generate",
        resourceType: "blog_post",
        resourceId: res.savedPostId ?? res.slug,
        after: { provider: res.provider, mock: res.mock, saved: Boolean(res.savedPostId) },
        ...meta,
      });
      return NextResponse.json({ data: res }, { status: 201 });
    }

    // Delete a post.
    if (b && c === "delete") {
      const res = deleteBlogPost(b);
      if ("error" in res) return mapDataError(res.error);
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "blog.delete",
        resourceType: "blog_post",
        resourceId: b,
        ...meta,
      });
      return ok(res);
    }

    // Create a post (always created as a draft unless a status is supplied).
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = upsertBlogPost(
      {
        titleFa: str(body["titleFa"]),
        slug: body["slug"] === undefined ? null : str(body["slug"]),
        excerpt: body["excerpt"] === undefined ? null : str(body["excerpt"]),
        body: body["body"] === undefined ? null : str(body["body"]),
        category: body["category"] === undefined ? null : str(body["category"]),
        tags: Array.isArray(body["tags"]) ? (body["tags"] as string[]) : undefined,
        author: body["author"] === undefined ? null : str(body["author"]),
        coverImage: body["coverImage"] === undefined ? null : str(body["coverImage"]),
        readingTime: body["readingTime"] === undefined ? null : num(body["readingTime"]),
        featured: Boolean(body["featured"]),
        seoTitle: body["seoTitle"] === undefined ? null : str(body["seoTitle"]),
        seoDescription: body["seoDescription"] === undefined ? null : str(body["seoDescription"]),
        status: (body["status"] as AdminBlogStatus | undefined) ?? "DRAFT",
      },
      actor.userId
    );
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "blog.create",
      resourceType: "blog_post",
      resourceId: res.id,
      after: { status: res.status, slug: res.slug },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  // §31 — admin subscription actions for one user (activate / extend /
  // deactivate / change_plan). Every branch reuses the lifecycle module so the
  // one-active invariant can never be bypassed from the admin surface.
  if (a === "users" && b && c === "subscription") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const input: AdminSubscriptionActionInput = {
      action: body["action"] as AdminSubscriptionActionInput["action"],
      planCode: body["planCode"] as PlanCode | undefined,
      days: body["days"] === undefined ? undefined : num(body["days"]),
      reason: str(body["reason"]),
    };
    const res = applyAdminSubscriptionAction({ userId: b, input });
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "subscription.admin.action", resourceType: "user", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "subscription.admin.action", resourceType: "user", resourceId: b, after: { action: input.action, planCode: input.planCode ?? null, days: input.days ?? null, subscriptionId: res.result.subscriptionId, supersededIds: res.result.supersededIds }, reason: input.reason, ...meta });
    return ok(res.result);
  }

  // §31 — admin energy grant / adjust for one user (audited).
  if (a === "users" && b && c === "energy") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const input: AdminEnergyActionInput = {
      action: body["action"] === "adjust" ? "adjust" : "grant",
      amount: num(body["amount"]),
      reason: str(body["reason"]),
    };
    const res = grantAdminEnergy(b, input, actor.userId);
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "energy.admin.adjust", resourceType: "user", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "energy.admin.adjust", resourceType: "user", resourceId: b, after: { action: input.action, delta: res.result.delta, balance: res.result.balance }, reason: input.reason, ...meta });
    return ok(res.result);
  }

  return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
}

async function handlePatch(request: NextRequest, segments: string[], actor: Actor): Promise<NextResponse> {
  const [a, b, c] = segments;
  const meta = requestMeta(request);

  if (a === "users" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    // Snapshot the prior role so the trail records the full before → after diff.
    const priorStaff = getStaffMember(b);
    const res = changeUserRole({ userId: b, role: body["role"] as PlatformRole, actorUserId: actor.userId });
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "user.role.change", resourceType: "user", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "user.role.change", resourceType: "user", resourceId: b, before: priorStaff ? { role: priorStaff.role } : null, after: { role: res.role }, ...meta });
    return ok(res);
  }

  if (a === "flags" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const before = listFlags().find((f) => f.key === b);
    const res = updateFlag(
      b,
      {
        status: body["status"] as never,
        rolloutPercent: body["rolloutPercent"] === undefined ? undefined : num(body["rolloutPercent"]),
        allowedPlans: Array.isArray(body["allowedPlans"]) ? (body["allowedPlans"] as string[]) : undefined,
        allowedOrgIds: Array.isArray(body["allowedOrgIds"]) ? (body["allowedOrgIds"] as string[]) : undefined,
      },
      actor.userId
    );
    if (!res) return adminError(404, "NOT_FOUND", "ویژگی یافت نشد");
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "flag.update", resourceType: "feature_flag", resourceId: b, before: before ? { status: before.status, rolloutPercent: before.rolloutPercent } : null, after: { status: res.status, rolloutPercent: res.rolloutPercent }, ...meta });
    return ok(res);
  }

  if (a === "support" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = updateTicket({
      ticketId: b,
      status: body["status"] as SupportTicketStatus | undefined,
      priority: body["priority"] as SupportTicketPriority | undefined,
      assigneeUserId: body["assigneeUserId"] === undefined ? undefined : (body["assigneeUserId"] as string | null),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "support.update", resourceType: "support_ticket", resourceId: b, after: { status: res.status, priority: res.priority }, ...meta });
    return ok(res);
  }

  if (a === "calculators" && b) {
    // §5 — partial save of one calculator's operational policy.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const before = getCalculatorSetting(b);
    const res = saveCalculatorSetting(b, parseCalculatorSetting(body), actor.userId);
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "calculator.settings.update", resourceType: "calculator", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "calculator.settings.update", resourceType: "calculator", resourceId: b, before: { enabled: before.enabled, accessTier: before.accessTier, energyCost: before.energyCost }, after: { enabled: res.enabled, accessTier: res.accessTier, energyCost: res.energyCost }, ...meta });
    return ok(res);
  }

  if (a === "blog" && b) {
    // §2 — update a post, or change only its status. Publishing is explicit;
    // a status change away from `published` removes it from the public list.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    // A status-only change (no other fields) routes through setBlogStatus.
    const keys = Object.keys(body);
    if (keys.length === 1 && "status" in body) {
      const before = getAdminBlogPost(b);
      if (!before) return adminError(404, "NOT_FOUND", "مطلب یافت نشد");
      const res = setBlogStatus(b, body["status"] as AdminBlogStatus);
      if ("error" in res) return mapDataError(res.error);
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: res.status === "PUBLISHED" ? "blog.publish" : "blog.status.change",
        resourceType: "blog_post",
        resourceId: b,
        before: { status: before.status },
        after: { status: res.status },
        ...meta,
      });
      return ok(res);
    }

    const before = getAdminBlogPost(b);
    if (!before) return adminError(404, "NOT_FOUND", "مطلب یافت نشد");
    const res = upsertBlogPost(
      {
        id: b,
        titleFa: body["titleFa"] === undefined ? before.titleFa : str(body["titleFa"]),
        slug: body["slug"] === undefined ? before.slug : str(body["slug"]),
        excerpt: body["excerpt"] === undefined ? before.excerpt : str(body["excerpt"]),
        body: body["body"] === undefined ? before.body : str(body["body"]),
        category: body["category"] === undefined ? before.category : str(body["category"]),
        tags: Array.isArray(body["tags"]) ? (body["tags"] as string[]) : before.tags,
        author: body["author"] === undefined ? before.author : str(body["author"]),
        coverImage: body["coverImage"] === undefined ? before.coverImage : str(body["coverImage"]),
        readingTime: body["readingTime"] === undefined ? before.readingTime : num(body["readingTime"]),
        featured: body["featured"] === undefined ? before.featured : Boolean(body["featured"]),
        seoTitle: body["seoTitle"] === undefined ? before.seoTitle : str(body["seoTitle"]),
        seoDescription:
          body["seoDescription"] === undefined ? before.seoDescription : str(body["seoDescription"]),
        status: (body["status"] as AdminBlogStatus | undefined) ?? before.status,
      },
      actor.userId
    );
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "blog.update",
      resourceType: "blog_post",
      resourceId: b,
      before: { status: before.status },
      after: { status: res.status },
      ...meta,
    });
    return ok(res);
  }

  if (a === "requests" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    // --- Assign / change the lawyer (a field change, not a transition) ---
    if ("selectedLawyerId" in body) {
      const raw = body["selectedLawyerId"];
      const lawyerId = raw === null || raw === "" ? null : String(raw);
      if (lawyerId) {
        const profile = listLawyerProfiles().find((l) => l.id === lawyerId);
        if (!profile) return adminError(404, "LAWYER_NOT_FOUND", "وکیل یافت نشد");
        if (lawyerDecisionBucket(profile.verificationStatus) !== "APPROVED") {
          return adminError(409, "LAWYER_NOT_ELIGIBLE", "این وکیل برای تخصیص مجاز نیست (تأییدنشده).");
        }
      }
      const before = getRequestById(b);
      const res = assignRequestLawyer({
        requestId: b,
        lawyerId,
        actorId: actor.userId,
        actorRole: actor.role,
        note: lawyerId ? "تخصیص وکیل توسط پشتیبانی" : "حذف وکیل توسط پشتیبانی",
      });
      if (!res.ok) {
        if (res.reason === "not_found") return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
        return adminError(409, "TERMINAL_REQUEST", "درخواست بسته یا لغو‌شده قابل ویرایش نیست.");
      }
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "request.lawyer.assign",
        resourceType: "legal_request",
        resourceId: b,
        before: { selectedLawyerId: before?.selectedLawyerId ?? null },
        after: { selectedLawyerId: lawyerId },
        ...meta,
      });
      return ok(res.request);
    }

    // --- Change the status via the authoritative state machine ---
    if ("state" in body) {
      const to = body["state"] as LegalRequestState;
      const before = getRequestById(b);
      if (!before) return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
      const res = transitionRequest({
        requestId: b,
        to,
        actorId: actor.userId,
        actorRole: actor.role,
        note: typeof body["note"] === "string" ? (body["note"] as string) : "تغییر وضعیت توسط پشتیبانی",
      });
      if (!res.ok) {
        if (res.reason === "not_found") return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: "request.state.change",
          resourceType: "legal_request",
          resourceId: b,
          result: "denied",
          reason: "illegal_transition",
          before: { state: before.state },
          after: { state: to },
          ...meta,
        });
        return adminError(409, "ILLEGAL_TRANSITION", "این تغییر وضعیت مجاز نیست.");
      }
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "request.state.change",
        resourceType: "legal_request",
        resourceId: b,
        before: { state: before.state },
        after: { state: res.request!.state },
        ...meta,
      });
      return ok(res.request!);
    }

    return adminError(400, "INVALID_BODY", "هیچ تغییری برای اعمال ارسال نشده است");
  }

  if (a === "announcements" && b) {
    // Publish or retract an announcement. Only `status` is editable; the
    // body text is immutable once written (compose a new one instead).
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const status = body["status"];
    if (typeof status !== "string" || !(ANNOUNCEMENT_STATUSES as readonly string[]).includes(status)) {
      return adminError(400, "INVALID_STATUS", "وضعیت نامعتبر است");
    }
    const res = setAnnouncementStatus(b, status as (typeof ANNOUNCEMENT_STATUSES)[number], actor.userId);
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: status === "published" ? "announcement.publish" : "announcement.retract",
      resourceType: "announcement",
      resourceId: b,
      after: { status: res.status },
      ...meta,
    });
    return ok(res);
  }

  if (a === "rag" && b === "sources" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = updateRagReview({
      sourceId: c,
      reviewState: body["reviewState"] as RagReviewState,
      reviewerUserId: actor.userId,
      publishedInLibrary: body["publishedInLibrary"] === undefined ? undefined : Boolean(body["publishedInLibrary"]),
      notes: typeof body["notes"] === "string" ? (body["notes"] as string) : undefined,
      evalScore: body["evalScore"] === undefined || body["evalScore"] === null ? undefined : num(body["evalScore"]),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "rag.review.update", resourceType: "rag_source", resourceId: c, after: { reviewState: res.reviewState, publishedInLibrary: res.publishedInLibrary }, ...meta });
    return ok(res);
  }

  return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
}

// ---------------------------------------------------------------------------
// Permission resolution
// ---------------------------------------------------------------------------

function permissionFor(method: string, segments: string[]): Permission {
  const [a, b] = segments;
  switch (a) {
    case "overview": return "admin:overview:read";
    case "reports": return method === "GET" ? "admin:reports:read" : "admin:reports:export";
    case "exports":
      // §9 — exporting a surface requires the READ permission of that very
      // surface (audit export → admin:audit:read, …), never a generic one.
      return b && isAdminExportKind(b)
        ? ADMIN_EXPORT_PERMISSION[b]
        : "admin:reports:export";
    case "users":
      // `users/:id/energy` is an energy mutation → its own permission; the
      // subscription sub-route stays under users:manage.
      if (segments[2] === "energy") {
        return method === "GET" ? "admin:energy:read" : "admin:energy:manage";
      }
      return method === "GET" ? "admin:users:read" : "admin:users:manage";
    case "requests": return method === "GET" ? "admin:requests:read" : "admin:requests:manage";
    case "flags": return "admin:flags:manage";
    // Reading the catalog is a plans-read capability; CREATE/EDIT/PUBLISH a
    // plan is a system-level change, reserved to the super-admin (matches the
    // concrete /admin/plans/[code] route and the page's edit gate).
    case "plans": return method === "GET" ? "admin:plans:read" : "admin:system:manage";
    case "orders": return method === "GET" ? "admin:billing:read" : "admin:billing:manage";
    case "refunds": return "admin:refund:approve";
    case "finance": return method === "GET" ? "admin:finance:read" : "admin:finance:manage";
    case "settlements": return b && method === "GET" ? "admin:finance:read" : "admin:settlement:manage";
    case "ai": return method === "GET" ? "admin:ai:read" : "admin:ai:manage";
    case "rag": return method === "GET" ? "admin:rag:read" : "admin:rag:manage";
    case "calculators": return method === "GET" ? "admin:calculators:read" : "admin:calculators:manage";
    case "energy": return method === "GET" ? "admin:energy:read" : "admin:energy:manage";
    case "support": return method === "GET" ? "admin:support:read" : "admin:support:manage";
    case "content": return "admin:content:read";
    case "blog": return method === "GET" ? "admin:content:read" : "admin:content:manage";
    case "announcements":
      return method === "GET" ? "admin:content:read" : "admin:content:manage";
    case "staff": return method === "GET" ? "admin:staff:read" : "admin:staff:manage";
    case "roles": return "admin:staff:read";
    case "audit": return "admin:audit:read";
    case "settings": return method === "GET" ? "admin:settings:read" : "admin:settings:manage";
    default: return "admin:overview:read";
  }
}

interface RouteParams {
  params: Promise<{ segments?: string[] }>;
}

async function dispatch(request: NextRequest, method: string, params: RouteParams["params"]): Promise<NextResponse> {
  const { segments = [] } = await params;
  const url = new URL(request.url);

  const perm = permissionFor(method, segments);
  const auth = requirePermission(request, perm);
  if (!auth.ok) return auth.response;

  const base: GetCtx = {
    request,
    url,
    segments,
    id: segments[1],
    perm,
    ctx: { userId: auth.ctx.userId, role: auth.ctx.role, orgId: auth.ctx.orgId },
  };

  if (method === "GET") {
    if (segments.length === 1) {
      const handler = GET_ROUTES[segments[0]!];
      if (!handler) return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
      return handler(base);
    }
    return handleNestedGet(base);
  }

  const actor: Actor = { userId: auth.ctx.userId, role: auth.ctx.role, orgId: auth.ctx.orgId };
  if (method === "POST") return handlePost(request, segments, actor);
  if (method === "PATCH") return handlePatch(request, segments, actor);
  return adminError(405, "METHOD_NOT_ALLOWED", "متد پشتیبانی نمی‌شود");
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return dispatch(request, "GET", params);
}
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return dispatch(request, "POST", params);
}
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return dispatch(request, "PATCH", params);
}
