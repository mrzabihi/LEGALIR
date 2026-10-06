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
import type { Permission, PlatformRole, LegalRequestState } from "@legalir/types";

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
import { listRagSources, ragReviewCounts, updateRagReview } from "@/lib/admin/rag";
import { buildCalculatorsInventory } from "@/lib/admin/calculators";
import {
  listTickets,
  getTicket,
  createTicket,
  addMessage,
  updateTicket,
  supportCounts,
  isOverdue,
} from "@/lib/admin/support";
import { listStaff, changeUserRole, listRoles } from "@/lib/admin/staff";
import { listAudit, recordAudit } from "@/lib/admin/audit";
import { readPlans } from "@/lib/usage/plans";
import { listOrganizations } from "@/lib/org-db";
import { readBlog } from "@/lib/legal-library-db";
import { listLawyerProfiles } from "@/lib/lawyer-db";
import type {
  AiProviderKind,
  AdjustmentKind,
  SettlementStatus,
  RagReviewState,
  SupportTicketStatus,
  SupportTicketPriority,
  OrderStatus,
} from "@legalir/types";

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

  plans: () => ok({ items: readPlans() }),

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

  calculators: () => ok(buildCalculatorsInventory()),

  support: ({ url }) =>
    ok({
      items: listTickets({
        status: (url.searchParams.get("status") as SupportTicketStatus | null) ?? undefined,
        priority: (url.searchParams.get("priority") as SupportTicketPriority | null) ?? undefined,
      }),
      counts: supportCounts(),
    }),

  content: () => {
    const blog = readBlog();
    const items = blog.items;
    return ok({
      blog: {
        total: items.length,
        published: items.filter((p) => p.publishedAt).length,
        items: items.slice(0, 50),
      },
    });
  },

  staff: () => ok({ items: listStaff() }),

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
    case "users": {
      const user = b ? findUserById(b) : undefined;
      if (!user) return adminError(404, "USER_NOT_FOUND", "کاربر یافت نشد");
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
      const req = b ? readTable<LegalRequestRow>("legal_requests").find((r) => r.id === b) : undefined;
      if (!req) return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
      return ok(req);
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
        return ok({
          items: listRagSources({
            reviewState: (c.url.searchParams.get("reviewState") as RagReviewState | null) ?? undefined,
            search: c.url.searchParams.get("search") ?? undefined,
          }),
          counts: ragReviewCounts(),
        });
      }
      return adminError(400, "BAD_PATH", "درخواست نامعتبر");
    }
    default:
      return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

type Actor = { userId: string; role: PlatformRole; orgId: string | null };

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function handlePost(request: NextRequest, segments: string[], actor: Actor): Promise<NextResponse> {
  const [a, b, c, d] = segments;
  const meta = requestMeta(request);

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

  return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
}

async function handlePatch(request: NextRequest, segments: string[], actor: Actor): Promise<NextResponse> {
  const [a, b, c] = segments;
  const meta = requestMeta(request);

  if (a === "users" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = changeUserRole({ userId: b, role: body["role"] as PlatformRole, actorUserId: actor.userId });
    if ("error" in res) {
      recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "user.role.change", resourceType: "user", resourceId: b, result: "denied", reason: res.error, ...meta });
      return mapDataError(res.error);
    }
    recordAudit({ actorUserId: actor.userId, actorRole: actor.role, orgId: actor.orgId, action: "user.role.change", resourceType: "user", resourceId: b, after: { role: res.role }, ...meta });
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
    case "users": return method === "GET" ? "admin:users:read" : "admin:users:manage";
    case "requests": return method === "GET" ? "admin:requests:read" : "admin:requests:manage";
    case "flags": return "admin:flags:manage";
    case "plans": return method === "GET" ? "admin:plans:read" : "admin:plans:manage";
    case "orders": return method === "GET" ? "admin:billing:read" : "admin:billing:manage";
    case "refunds": return "admin:refund:approve";
    case "finance": return method === "GET" ? "admin:finance:read" : "admin:finance:manage";
    case "settlements": return b && method === "GET" ? "admin:finance:read" : "admin:settlement:manage";
    case "ai": return method === "GET" ? "admin:ai:read" : "admin:ai:manage";
    case "rag": return method === "GET" ? "admin:rag:read" : "admin:rag:manage";
    case "calculators": return "admin:calculators:read";
    case "support": return method === "GET" ? "admin:support:read" : "admin:support:manage";
    case "content": return "admin:content:read";
    case "staff": return method === "GET" ? "admin:staff:read" : "admin:staff:manage";
    case "roles": return "admin:staff:read";
    case "audit": return "admin:audit:read";
    case "settings": return method === "GET" ? "admin:settings:read" : "admin:settings:manage";
    default: return "admin:overview:read";
  }
}

type RouteParams = { params: Promise<{ segments?: string[] }> };

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
