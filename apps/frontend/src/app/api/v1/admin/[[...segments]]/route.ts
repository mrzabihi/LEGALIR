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
import { readTable, findUserById } from "@/lib/db";
import { toE164Display } from "@legalir/validation";
import {
  ADMIN_EXPORT_PERMISSION,
  DEFAULT_SLA_SERVICE_KEY,
  LAWYER_SERVICES,
  lawyerDecisionBucket,
  LEGAL_REQUEST_TRANSITIONS,
  ANNOUNCEMENT_STATUSES,
  type Permission,
  type PlatformRole,
  type LegalRequest,
  type LegalRequestState,
  type LegalRequestDiscovery,
  type AnnouncementAudience,
  type JudicialDocumentType,
  type JudicialOrderStatus,
  type JudicialReviewStatus,
} from "@legalir/types";

import { adminError, mapDataError, readJson, requestMeta, intParam } from "@/lib/admin/http";
import { resolvePage, resolvePageSize, paginate } from "@/lib/admin/pagination";
import { matchesRow } from "@/lib/search/normalize";
import {
  buildOverview,
  revenueByPlan,
  dailySales,
  planDailyMix,
  resolvedRangeDays,
} from "@/lib/admin/metrics";
import { buildLiveReport } from "@/lib/admin/live-report";
import { buildDiscoveryStats, hasDiscovery } from "@/lib/admin/discovery-stats";
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
  setAiProviderEnabled,
  testAiProvider,
  listPromptVersions,
  createPromptVersion,
  activatePromptVersion,
  getAiUsageMetrics,
  isSecretStorageReady,
} from "@/lib/admin/ai-providers";
import {
  bindingImpact,
  clearServiceBinding,
  getAiUsageBreakdown,
  getServiceBinding,
  isCapability,
  listCapabilities,
  listServiceBindings,
  saveServiceBinding,
  type AuditMeta,
} from "@/lib/admin/ai-bindings";
import {
  getDisplaySettings,
  saveDisplaySettings,
  serverTimeZone,
  timeZoneOptions,
  TIMESTAMP_STORAGE_FORMAT,
} from "@/lib/admin/platform-settings";
import { listToolsForAdmin, updateToolSetting } from "@/lib/ai/chat-tools";
import { SERVICE_CONTEXTS } from "@/lib/ai/service-context";
import {
  listRagSources,
  ragReviewCounts,
  updateRagReview,
  getRagPipelineStatus,
  getRagSourceDetail,
  testRagRetrieval,
  reingestRagCorpus,
  lawCatalogCoverage,
  uploadRagFile,
  retryRagIngestion,
  retryRagSource,
  ragIngestFailures,
  getRagSource,
  RAG_UPLOAD_MAX_BYTES,
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
import {
  listAdminLegalSources,
  getAdminLegalSource,
  listAdminLegalTopics,
  upsertLegalSource,
  setLegalSourceStatus,
  deleteLegalSource,
} from "@/lib/admin/legal-library";
import {
  listJudicialServices,
  listJudicialServiceViews,
  updateJudicialService,
  type JudicialServiceUpdate,
} from "@/lib/judicial/service-config";
import {
  createQuestionnaireVersion,
  listQuestionnaireVersions,
  listQuestionnaires,
  publishQuestionnaire,
} from "@/lib/judicial/questionnaires";
import {
  getReviewDetail,
  listOrderQueue,
  listReviewQueue,
  orderQueueRow,
  type JudicialOrderQueueFilters,
  type JudicialReviewQueueFilters,
} from "@/lib/judicial/admin-review";
import {
  applyAdminReviewAction,
  getOrderById,
  getReviewById,
  updateOrderByAdmin,
} from "@/lib/judicial/review-db";
import { issueFinalDocument } from "@/lib/judicial/finalize";
import { buildCalculatorsInventory } from "@/lib/admin/calculators";
import {
  listCalculatorSettings,
  getCalculatorSetting,
  saveCalculatorSetting,
} from "@/lib/admin/calculator-settings";
import {
  listRuleSummaries,
  listCalculatorRuleBoard,
  getRuleDetail,
  saveRuleDraft,
  previewDraft,
  publishDraft,
  rollbackToVersion,
  deleteDraft,
  type SaveRuleDraftInput,
} from "@/lib/admin/calculator-rules";
import {
  listCostProfiles,
  getCostProfile,
  saveCostProfile,
  listCostRules,
  saveCostRule,
  deleteCostRule,
  readLedger,
  getLedgerSummary,
  listTariffHistory,
} from "@/lib/usage/energy";
import { buildUsageReport, listUserServiceOptions } from "@/lib/usage/report";
import { ACTIVITY_REGISTRY } from "@/lib/usage/activities";
import type { ActivityType, UsageTransactionStatus } from "@legalir/types";

/** Real activity codes / transaction statuses (never trust raw query strings). */
const ACTIVITY_CODES = new Set<string>(ACTIVITY_REGISTRY.map((a) => a.code));
const USAGE_STATUSES: UsageTransactionStatus[] = ["RESERVED", "COMPLETED", "REVERSED", "FAILED"];
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
  listTicketEvents,
  listAssignableAgents,
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
import { listAdminCoupons, getAdminCoupon, parseCouponDraft } from "@/lib/admin/coupons";
import { createCoupon, updateCoupon, setCouponStatus } from "@/lib/coupons/store";
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
import {
  getRequestById,
  listRequestEvents,
  assignRequestLawyer,
  transitionRequest,
} from "@/lib/legal-request-db";
// §5/§8 — SLA settings and the per-request deadline / re-referral controls
// write through the SAME store the lawyer portal uses, so an operator's edit
// and a lawyer's clock can never disagree. Both paths append to
// `request_actions` and to the platform audit trail.
import {
  ensureRequestSla,
  getSlaPolicyForService,
  getWorkCalendar,
  listRequestActions,
  listSlaPolicies,
  observeSla,
  overrideRequestDeadline,
  reassignRequest,
  saveSlaPolicy,
  saveWorkCalendar,
  type SlaPolicyInput,
} from "@/lib/lawyer-portal/store";
import { slaSnapshot } from "@/lib/lawyer-portal/sla";
import type { SlaPhase } from "@legalir/types";
import type {
  AiProviderKind,
  AdjustmentKind,
  SettlementStatus,
  RagReviewState,
  AdminBlogPost,
  AdminLegalSource,
  CalculatorAccessTier,
  CalculatorRuleSourceOverride,
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

/** Legal-library lifecycle as declared on its admin row (draft/published/archived). */
type AdminLegalStatus = AdminLegalSource["status"];

// ---------------------------------------------------------------------------
// Shared row shapes (local — keep this module self-contained)
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  publicId?: string;
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
  /**
   * The path-discovery record, when the request came through the
   * «از کجا شروع کنم؟» intake. Additive and optional — a request that did
   * not go through the flow simply has no field.
   */
  discovery?: LegalRequestDiscovery;
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

  /**
   * A compact live snapshot of the SAME real ledger the overview reads. It is a
   * separate route so the «گزارش زنده» block can poll it on its own cadence with
   * a light payload, without re-pulling the whole overview. Gated on the same
   * `admin:overview:read` permission (see permissionFor).
   */
  live: ({ url }) => ok(buildLiveReport(intParam(url, "rangeDays", 30), explicitWindow(url))),

  reports: ({ url }) => {
    const days = intParam(url, "rangeDays", 30);
    const win = explicitWindow(url);
    return ok({
      rangeDays: resolvedRangeDays(days, win),
      byPlan: revenueByPlan(days, win),
      daily: dailySales(days, win),
      planMix: planDailyMix(days, win),
    });
  },

  users: ({ url }) => {
    const page = resolvePage(url.searchParams.get("page"));
    const pageSize = resolvePageSize(url.searchParams.get("pageSize"));
    const search = url.searchParams.get("search") ?? "";
    const role = url.searchParams.get("role") ?? "";
    const subs = readTable<{ user_id: string; status_fa?: string; status?: string }>(
      "subscriptions"
    );
    const activeIds = new Set(
      subs.filter((s) => s.status_fa === "فعال" || s.status === "active").map((s) => s.user_id)
    );
    let rows = readTable<UserRow>("users");
    if (role) rows = rows.filter((u) => (u.role ?? "USER") === role);
    if (search.trim()) {
      // Search runs over the WHOLE table (not the current page) and matches a
      // mobile in ANY format — `09122842174`, `9122842174`, `+98…`, Persian
      // digits — alongside the display name and the system id.
      rows = rows.filter((u) =>
        matchesRow(search, {
          phones: [u.mobile],
          texts: [u.displayName, u.id, u.publicId, toE164Display(u.mobile)],
        })
      );
    }
    const mapped = rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((u) => ({
        id: u.id,
        publicId: u.publicId ?? null,
        displayName: u.displayName,
        mobile: toE164Display(u.mobile),
        email: u.email,
        role: u.role ?? "USER",
        accountType: u.platformAccountType ?? "PERSONAL",
        hasActiveSubscription: activeIds.has(u.id),
        createdAt: u.createdAt,
      }));
    const p = paginate(mapped, page, pageSize);
    return ok({
      items: p.items,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
    });
  },

  requests: ({ url }) => {
    const page = resolvePage(url.searchParams.get("page"));
    const pageSize = resolvePageSize(url.searchParams.get("pageSize"));
    const state = url.searchParams.get("state");
    const search = url.searchParams.get("search") ?? "";
    // Tri-state discovery filter: "yes" keeps only requests that came through
    // the path-discovery flow, "no" only the rest, anything else keeps all.
    const discovery = url.searchParams.get("discovery");
    // §8 — the oversight filters: WHO the request was referred to, WHICH
    // service it was placed for, WHEN it was referred, and how its clock
    // stands right now. All four are computed over the same live rows the
    // detail endpoint reads, so a filter can never disagree with the drawer.
    const lawyerId = url.searchParams.get("lawyerId") ?? "";
    const serviceKey = url.searchParams.get("serviceKey") ?? "";
    const fromIso = url.searchParams.get("fromIso") ?? "";
    const toIso = url.searchParams.get("toIso") ?? "";
    const slaHealth = url.searchParams.get("slaHealth") ?? "";
    const calendar = getWorkCalendar();

    let rows = readTable<LegalRequest>("legal_requests");
    if (state) rows = rows.filter((r) => r.state === state);
    if (discovery === "yes") rows = rows.filter((r) => hasDiscovery(r));
    else if (discovery === "no") rows = rows.filter((r) => !hasDiscovery(r));
    if (lawyerId) rows = rows.filter((r) => r.selectedLawyerId === lawyerId);
    if (serviceKey) rows = rows.filter((r) => (r.serviceKey ?? "") === serviceKey);
    if (fromIso) rows = rows.filter((r) => r.createdAt >= fromIso);
    if (toIso) rows = rows.filter((r) => r.createdAt <= toIso);

    const mapped = rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const user = findUserById(r.userId);
        // The clock is observed (not mutated) here: the list must not advance
        // a referral just because an operator refreshed the queue.
        const observed = observeSla(ensureRequestSla(r));
        const snapshot = slaSnapshot({
          state: observed.sla ?? null,
          policy: getSlaPolicyForService(observed.sla?.serviceKey),
          calendar,
          requestState: observed.state,
        });
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
          serviceKey: r.serviceKey ?? null,
          // The discovery outcome, projected so the list can tell at a glance
          // whether the request came through the intake and how it was
          // analysed — without a second round-trip to the detail endpoint.
          hasDiscovery: hasDiscovery(r),
          discoverySource: r.discovery?.source ?? null,
          inferredCategory: r.discovery?.inferredCategory ?? null,
          sla: {
            health: snapshot.health,
            healthFa: snapshot.healthFa,
            phase: snapshot.phase,
            dueAt: snapshot.dueAt,
            remainingMs: snapshot.remainingMs,
            paused: snapshot.paused,
          },
        };
      })
      .filter((r) => (slaHealth ? r.sla.health === slaHealth : true))
      .filter((r) =>
        search.trim() ? matchesRow(search, { texts: [r.title, r.id, r.userDisplayName] }) : true
      );

    // The filter vocabularies are derived from the very rows in play, so an
    // operator can never pick a lawyer/service that yields an empty queue by
    // construction.
    const lawyerNames = new Map(listLawyerProfiles().map((l) => [l.id, l.fullName]));
    const facetLawyers = [...new Set(rows.map((r) => r.selectedLawyerId).filter(Boolean))].map(
      (id) => ({ id: id as string, fullName: lawyerNames.get(id as string) ?? null })
    );
    const facetServices = [...new Set(rows.map((r) => r.serviceKey).filter(Boolean))] as string[];

    const p = paginate(mapped, page, pageSize);
    return ok({
      items: p.items,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
      facets: { lawyers: facetLawyers, services: facetServices },
    });
  },

  // The dedicated discovery intake surface. Returns cohort-wide statistics
  // (computed over the FULL table, never the current page) plus a filterable,
  // paginated list of the requests that carry a discovery record — each with
  // the engine's top pick and the user's actual choice kept distinct.
  discovery: ({ url }) => {
    const page = resolvePage(url.searchParams.get("page"));
    const pageSize = resolvePageSize(url.searchParams.get("pageSize"));
    const search = url.searchParams.get("search") ?? "";
    const source = url.searchParams.get("source"); // "ai" | "rules"
    const rows = readTable<LegalRequestRow>("legal_requests");
    const stats = buildDiscoveryStats(rows);
    const items = rows
      .filter((r) => hasDiscovery(r))
      .filter((r) => (source ? r.discovery?.source === source : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const user = findUserById(r.userId);
        const d = r.discovery!;
        return {
          id: r.id,
          title: r.title,
          state: r.state,
          userDisplayName: user?.displayName ?? null,
          inferredCategory: d.inferredCategory,
          explicitIntent: d.explicitIntent,
          summaryFa: d.summaryFa,
          confidence: d.confidence,
          needsLawyer: d.needsLawyer,
          source: d.source,
          topIntent: d.paths[0]?.intent ?? null,
          selectedIntent: d.paths.find((p) => p.selected)?.intent ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      })
      .filter((r) =>
        search.trim()
          ? matchesRow(search, { texts: [r.title, r.summaryFa, r.id, r.userDisplayName] })
          : true
      );
    const p = paginate(items, page, pageSize);
    return ok({
      stats,
      items: p.items,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
    });
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

  refunds: ({ url }) =>
    ok({ items: listAdjustments(url.searchParams.get("orderId") ?? undefined) }),

  // Coupon catalog. Read is a billing-read capability (it feeds sales
  // reporting); creating/editing a coupon is a billing-manage mutation.
  coupons: () => ok({ items: listAdminCoupons() }),

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

  // Judicial services. `views` carries the EFFECTIVE availability (config AND
  // flag AND provider requirement) beside the raw config, so the operator sees
  // when their own flag toggle — not their label — is what keeps a service off.
  judicial: () =>
    ok({
      services: listJudicialServiceViews(),
      configs: listJudicialServices(),
      questionnaires: listQuestionnaires().sort(
        (a, b) => a.documentType.localeCompare(b.documentType) || b.version - a.version
      ),
    }),

  support: ({ url }) => {
    // `unassigned`/`overdue` are tri-state: an absent param filters nothing,
    // so the plain listing stays the full queue.
    const boolParam = (key: string): boolean | undefined => {
      const raw = url.searchParams.get(key);
      return raw === "true" ? true : raw === "false" ? false : undefined;
    };
    const sortRaw = url.searchParams.get("sort");
    const sort =
      sortRaw === "priority-desc" || sortRaw === "due" || sortRaw === "updated"
        ? sortRaw
        : undefined;
    return ok({
      items: listTickets({
        status: (url.searchParams.get("status") as SupportTicketStatus | null) ?? undefined,
        priority: (url.searchParams.get("priority") as SupportTicketPriority | null) ?? undefined,
        assigneeUserId: url.searchParams.get("assigneeUserId") ?? undefined,
        unassigned: boolParam("unassigned"),
        overdue: boolParam("overdue"),
        search: url.searchParams.get("search") ?? undefined,
        sort,
      }),
      counts: supportCounts(),
      agents: listAssignableAgents(),
    });
  },

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

  // The legal library is a product section of its own — its own store, its own
  // lifecycle, its own permission pair. Never folded into the blog surface.
  "legal-library": () =>
    ok({
      items: listAdminLegalSources(),
      topics: listAdminLegalTopics(),
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
        result:
          (url.searchParams.get("result") as "success" | "failure" | "denied" | null) ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        page: intParam(url, "page", 1),
        pageSize: intParam(url, "pageSize", 25),
      })
    ),

  // §5 — the SLA configuration surface: one policy per service plus the
  // platform working calendar. Both come straight from the store the lawyer
  // portal reads when it starts a clock, so what the operator configures here
  // is exactly what governs a live referral.
  sla: ({ url }) => {
    // Archived rows are hidden by default: an operator scanning "what governs
    // a referral today" should not have to skip past retired services. The
    // `includeArchived=1` view exists for review and un-archiving.
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    // The catalogue is joined only so the "add a policy for a service that has
    // none" picker can offer real service names instead of raw ids.
    const configured = new Set(listSlaPolicies(true).map((p) => p.serviceKey));
    return ok({
      policies: listSlaPolicies(includeArchived),
      calendar: getWorkCalendar(),
      services: LAWYER_SERVICES.map((s) => ({
        id: s.id,
        nameFa: s.nameFa,
        hasPolicy: configured.has(s.id),
      })),
      defaultServiceKey: DEFAULT_SLA_SERVICE_KEY,
    });
  },

  settings: () => {
    const orgs = listOrganizations();
    const providers = listAiProviders();
    // TWO zones, reported side by side and never conflated:
    //   • `serverTimezone` is where the process runs — discovered, not set.
    //   • `displayTimezone` is the panel preference an operator may save.
    // Stored instants stay UTC; the display zone only changes how they are
    // RENDERED, so nothing in the store is ever rewritten by this setting.
    const server = serverTimeZone();
    const display = getDisplaySettings();
    return ok({
      environment: process.env["NODE_ENV"] ?? "development",
      currency: "IRT",
      serverTimezone: server.timeZone,
      serverTimezoneSource: server.source,
      displayTimezone: display.displayTimezone,
      displayTimezoneUpdatedAt: display.updatedAt || null,
      nowUtc: new Date().toISOString(),
      storageFormat: TIMESTAMP_STORAGE_FORMAT,
      timezoneOptions: timeZoneOptions([display.displayTimezone, server.timeZone]),
      secretStorageConfigured: isSecretStorageReady(),
      aiProviders: providers.map((p) => ({
        id: p.id,
        nameFa: p.nameFa,
        status: p.status,
        hasKey: p.hasKey,
        isDefault: p.isDefault,
      })),
      integrations: [
        {
          key: "payments",
          labelFa: "درگاه پرداخت",
          configured: false,
          noteFa: "این محیط از پرداخت شبیه‌سازی‌شده استفاده می‌کند؛ درگاه واقعی متصل نیست.",
        },
        {
          key: "sms",
          labelFa: "پیامک (OTP)",
          configured: Boolean(
            process.env["LEGALIR_OTP_PROVIDER"] && process.env["LEGALIR_OTP_PROVIDER"] !== "mock"
          ),
          noteFa: "در صورت نبود ارائه‌دهنده، کد به‌صورت توسعه‌ای نمایش داده می‌شود.",
        },
        {
          key: "video",
          labelFa: "مشاوره تصویری",
          configured: false,
          noteFa: "ارائه‌دهنده ویدیو متصل نشده است.",
        },
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
    case "coupons": {
      if (!b) return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
      const row = getAdminCoupon(b);
      if (!row) return adminError(404, "COUPON_NOT_FOUND", "کد تخفیف یافت نشد");
      return ok(row);
    }
    case "calculators": {
      // §5-rules — the DB-backed rule layer. `calculators/rules` lists every
      // dataset; `calculators/rules/:datasetId` returns one dataset's full
      // rule view. Everything else under `calculators/:slug` is the §5 policy.
      if (b === "rules") {
        // The calculator-centric rule board: every calculator with its service
        // status, active rule version, last change and legal source. Powers the
        // «مدیریت فرمول‌ها» surface. Super-Admin-gated (see permissionFor).
        if (d === "board") return ok({ items: listCalculatorRuleBoard() });
        if (!d) return ok({ items: listRuleSummaries() });
        const detail = getRuleDetail(d);
        if (!detail) return adminError(404, "DATASET_NOT_FOUND", "مجموعه‌داده یافت نشد");
        return ok(detail);
      }
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
    case "legal-library": {
      // The library's own topics selector + per-source detail (never the blog's).
      if (b === "topics") return ok({ items: listAdminLegalTopics() });
      const source = b ? getAdminLegalSource(b) : undefined;
      if (!source) return adminError(404, "NOT_FOUND", "منبع حقوقی یافت نشد");
      return ok(source);
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
      // `users/:id/usage` is the SAME projection the user's own
      // «تاریخچه و مصرف» page reads (`buildUsageReport`), so the operator and
      // the user can never see two different totals. Gated by
      // `admin:energy:read` in permissionFor — hiding a tab in the UI is not
      // authorization.
      if (d === "usage") {
        const statusRaw = c.url.searchParams.get("status");
        const activityRaw = c.url.searchParams.get("activityType");
        return ok({
          report: buildUsageReport(b!, {
            from: c.url.searchParams.get("from") ?? undefined,
            to: c.url.searchParams.get("to") ?? undefined,
            serviceKey: c.url.searchParams.get("serviceKey") ?? undefined,
            activityType:
              activityRaw && ACTIVITY_CODES.has(activityRaw)
                ? (activityRaw as ActivityType)
                : undefined,
            status:
              statusRaw && USAGE_STATUSES.includes(statusRaw as UsageTransactionStatus)
                ? (statusRaw as UsageTransactionStatus)
                : undefined,
            page: intParam(c.url, "page", 1),
            pageSize: intParam(c.url, "pageSize", 20),
          }),
          // Filter menus come from the user's own real rows, so the operator
          // is never offered a service that has no records.
          services: listUserServiceOptions(b!),
        });
      }
      // §8 — every request this user owns, with the lawyer assigned and the
      // live SLA verdict. This is what the user dossier's «درخواست‌ها» tab
      // reads, and it is the entry point to each request's own timeline.
      if (d === "requests") {
        const rows = readTable<LegalRequest>("legal_requests")
          .filter((r) => r.userId === b)
          .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
        const lawyerNames = new Map(listLawyerProfiles().map((l) => [l.id, l.fullName]));
        const items = rows.map((r) => {
          const observed = observeSla(ensureRequestSla(r));
          const snapshot = slaSnapshot({
            state: observed.sla ?? null,
            policy: getSlaPolicyForService(observed.sla?.serviceKey),
            calendar: getWorkCalendar(),
            requestState: observed.state,
          });
          return {
            id: r.id,
            title: r.title,
            category: r.category,
            state: r.state,
            selectedLawyerId: r.selectedLawyerId,
            selectedLawyerName: r.selectedLawyerId
              ? (lawyerNames.get(r.selectedLawyerId) ?? null)
              : null,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            sla: {
              health: snapshot.health,
              healthFa: snapshot.healthFa,
              phase: snapshot.phase,
              dueAt: snapshot.dueAt,
              remainingMs: snapshot.remainingMs,
              paused: snapshot.paused,
            },
          };
        });
        return ok({ items });
      }
      return ok({
        id: user.id,
        publicId: user.publicId ?? null,
        displayName: user.displayName,
        mobile: toE164Display(user.mobile),
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
      // §5 — the clock as it stands right now. `observeSla` persists a breach
      // the first time it is seen, so the operator and the lawyer read the
      // same verdict from the same record.
      const observed = observeSla(ensureRequestSla(req));
      const policy = getSlaPolicyForService(observed.sla?.serviceKey);
      const sla = slaSnapshot({
        state: observed.sla ?? null,
        policy,
        calendar: getWorkCalendar(),
        requestState: observed.state,
      });

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
          // The recorded path-discovery analysis, when the request went through
          // the «از کجا شروع کنم؟» intake. Null for requests that did not.
          discovery: req.discovery ?? null,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
        },
        // Legal next states for the CURRENT state, taken from the authoritative
        // state machine — the UI never invents a transition the server rejects.
        allowedTransitions: LEGAL_REQUEST_TRANSITIONS[req.state],
        events,
        assignableLawyers,
        // §4/§5 — the lawyer's own attributable workflow log (view, accept,
        // decline, notes, SLA pause/resume/override) kept SEPARATE from the
        // state events so an operator can tell client-visible messages from
        // internal notes at a glance.
        actions: listRequestActions(req.id),
        sla: {
          state: observed.sla ?? null,
          policy,
          snapshot: sla,
          /** Deadline edits already applied, oldest → newest. */
          overrides: observed.sla?.overrides ?? [],
          /** The live calendar, so an operator can read the deadline in context. */
          calendar: getWorkCalendar(),
        },
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
      // Checked BEFORE the `support/:id` branch, which would otherwise read
      // "agents" as a ticket id and answer with a misleading 404.
      if (b === "agents") return ok({ items: listAssignableAgents() });
      // The append-only history of one ticket.
      if (b && d === "history") {
        const ticket = getTicket(b);
        if (!ticket) return adminError(404, "NOT_FOUND", "تیکت یافت نشد");
        return ok({ items: listTicketEvents(b) });
      }
      const t = b ? getTicket(b) : undefined;
      if (!t) return adminError(404, "NOT_FOUND", "تیکت یافت نشد");
      return ok({ ticket: t, overdue: isOverdue(t) });
    }
    case "ai": {
      if (b === "providers")
        return ok({ items: listAiProviders(), secretStorageConfigured: isSecretStorageReady() });
      if (b === "prompts")
        return ok({ items: listPromptVersions(c.url.searchParams.get("key") ?? undefined) });
      if (b === "metrics") return ok(getAiUsageMetrics(intParam(c.url, "rangeDays", 30)));
      // The pre-save preview: exactly the facts the save would freeze into the
      // audit trail, computed from the runs that actually executed. A GET, so
      // opening the editor never mutates anything. Checked BEFORE the plain
      // `bindings` list, because that branch would otherwise shadow it.
      if (b === "bindings" && d === "impact") {
        const serviceType = c.url.searchParams.get("serviceType") ?? "";
        if (!isCapability(serviceType)) {
          return adminError(400, "INVALID_CAPABILITY", "قابلیت انتخاب‌شده شناخته نمی‌شود.");
        }
        const providerIdRaw = c.url.searchParams.get("providerId");
        const modelRaw = c.url.searchParams.get("model");
        const statusRaw = c.url.searchParams.get("status");
        return ok(
          bindingImpact({
            serviceType,
            providerId: providerIdRaw ? providerIdRaw : null,
            model: modelRaw ? modelRaw : null,
            rangeDays: intParam(c.url, "rangeDays", 30),
            status: statusRaw === "inactive" ? "inactive" : "active",
          })
        );
      }
      // Per-capability bindings: every capability is listed, with `configured`
      // telling the panel whether it was set explicitly or follows the default.
      if (b === "bindings") {
        return ok({
          items: listServiceBindings(),
          capabilities: listCapabilities(),
          providers: listAiProviders().map((p) => ({
            id: p.id,
            nameFa: p.nameFa,
            status: p.status,
            enabled: p.enabled !== false,
            hasKey: p.hasKey,
            defaultModel: p.defaultModel ?? p.model ?? null,
            availableModels: p.availableModels ?? [],
          })),
        });
      }
      // The REAL split, computed from recorded runs + the settled ledger.
      if (b === "usage") return ok(getAiUsageBreakdown(intParam(c.url, "rangeDays", 30)));
      // §7/§12 — the contextual chat tools. `available` is the REAL capability
      // verdict (does this server hold the source?), never the toggle alone.
      if (b === "tools") {
        return ok({ items: listToolsForAdmin(), serviceTypes: Object.keys(SERVICE_CONTEXTS) });
      }
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
            reviewState:
              (c.url.searchParams.get("reviewState") as RagReviewState | null) ?? undefined,
            search: c.url.searchParams.get("search") ?? undefined,
          }),
          counts: ragReviewCounts(),
        });
      }
      if (b === "pipeline") {
        return ok({ status: getRagPipelineStatus(), coverage: lawCatalogCoverage() });
      }
      // The unreadable files from the last ingest, with their real errors.
      if (b === "failures") return ok({ items: ragIngestFailures() });
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
      // §3 — the append-only tariff change log. Every profile/rule write appends
      // a version row carrying WHO changed it and WHEN, so an operator can prove
      // why a past operation was priced the way it was.
      if (b === "history") {
        return ok({
          items: listTariffHistory(c.url.searchParams.get("entityId") ?? undefined),
        });
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
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Length": String(result.bytes.length),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    case "judicial": {
      // `judicial/questionnaires/:documentType` — every version of one family,
      // newest first. The list is what the publish dropdown reads; nothing is
      // editable here, editing is a new DRAFT version, never an in-place patch.
      if (b === "questionnaires" && d) {
        return ok({ items: listQuestionnaireVersions(d as JudicialDocumentType) });
      }
      // §7 — the review queue. Filters are read from the query string so the
      // tab state survives a refresh; counts are always computed over the
      // UNFILTERED set so the tabs themselves stay stable.
      if (b === "reviews" && !d) {
        const filters: JudicialReviewQueueFilters = {
          status:
            (c.url.searchParams.get("status") as
              JudicialReviewStatus | "open" | "closed" | "all" | null) ?? "open",
          kind: (c.url.searchParams.get("kind") as "legalir" | "lawyer" | "all" | null) ?? "all",
          assigned: c.url.searchParams.get("assigned") ?? undefined,
          q: c.url.searchParams.get("q") ?? undefined,
        };
        return ok(listReviewQueue(filters));
      }
      // The operator workspace: submitted text, answers, drafts, attachments
      // and the COMPLETE timeline (internal notes included).
      if (b === "reviews" && d) {
        const detail = getReviewDetail(d);
        if (!detail) return adminError(404, "NOT_FOUND", "درخواست بررسی یافت نشد");
        return ok(detail);
      }
      // §7 — the tracked orders of the two provider services. These carry no
      // draft: an operator moves them by hand and records what really happened.
      if (b === "orders" && !d) {
        const filters: JudicialOrderQueueFilters = {
          status:
            (c.url.searchParams.get("status") as JudicialOrderStatus | "open" | "all" | null) ??
            "open",
          serviceId:
            (c.url.searchParams.get("serviceId") as
              "judicial_criminal_record" | "judicial_credit_check" | null) ?? undefined,
          q: c.url.searchParams.get("q") ?? undefined,
        };
        return ok(listOrderQueue(filters));
      }
      if (b === "orders" && d) {
        const order = getOrderById(d);
        if (!order) return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
        return ok({ order: orderQueueRow(order) });
      }
      return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
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

/**
 * The operator's display name for a history/audit entry. Falls back to the
 * role label (never the raw user id) when the account has no name set.
 */
function actorName(actor: Actor): string {
  return findUserById(actor.userId)?.displayName ?? String(actor.role);
}

// Closed vocabularies for the support write path. A string cast is not
// validation: these sets are what actually decides whether a value is written.
const KNOWN_TICKET_STATUS = new Set<SupportTicketStatus>([
  "open",
  "in_progress",
  "waiting",
  "resolved",
  "closed",
]);
const KNOWN_TICKET_PRIORITY = new Set<SupportTicketPriority>([
  "low",
  "normal",
  "high",
  "urgent",
]);

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
  if (Array.isArray(body["allowedUserIds"]))
    out.allowedUserIds = body["allowedUserIds"] as string[];
  return out;
}

/**
 * Narrow a raw rule-draft body to the typed draft fields. `rates` stays a
 * structural patch — it is never trusted; `validateDraftRates` in the rule
 * module is the sole gate. Only explicitly-present optional fields are copied
 * so a partial update never clears a sibling field the operator left alone.
 */
function parseSaveRuleDraft(body: Body): SaveRuleDraftInput {
  const out: SaveRuleDraftInput = { rates: {} };
  if (body["rates"] !== undefined && typeof body["rates"] === "object" && body["rates"] !== null) {
    out.rates = body["rates"] as Record<string, unknown>;
  }
  if (
    body["source"] !== undefined &&
    typeof body["source"] === "object" &&
    body["source"] !== null
  ) {
    out.source = body["source"] as CalculatorRuleSourceOverride;
  }
  if (typeof body["changeNoteFa"] === "string") out.changeNoteFa = body["changeNoteFa"] as string;
  if (typeof body["effectiveFrom"] === "string")
    out.effectiveFrom = body["effectiveFrom"] as string;
  if (body["verificationStatus"] === "verified" || body["verificationStatus"] === "pending") {
    out.verificationStatus = body["verificationStatus"] as "verified" | "pending";
  }
  return out;
}

const JUDICIAL_STATUSES = new Set(["available", "soon", "unavailable"]);
const JUDICIAL_SURFACE_KEYS = ["home", "services", "new", "cases"] as const;

/**
 * §6 — narrow an admin body to the judicial service fields that are actually
 * honoured. Identity (`id` / `family` / `documentType`) is never mutable, and
 * `requirement` stays server-owned: an operator's label change must never make
 * an unconnected external provider look live, so `configured` flips only when
 * the integration itself ships — never through this endpoint.
 *
 * Returns `null` when the body carries nothing to apply and `"invalid"` when a
 * present field is malformed, so the caller can answer with a precise error.
 */
function parseJudicialServiceUpdate(body: Body): JudicialServiceUpdate | null | "invalid" {
  const updates: JudicialServiceUpdate = {};
  const texts = ["titleFa", "shortTitleFa", "descriptionFa", "ctaFa"] as const;
  const maxLen: Record<(typeof texts)[number], number> = {
    titleFa: 200,
    shortTitleFa: 80,
    descriptionFa: 800,
    ctaFa: 80,
  };
  for (const key of texts) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return "invalid";
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLen[key]) return "invalid";
    updates[key] = trimmed;
  }

  if (body["status"] !== undefined) {
    if (typeof body["status"] !== "string" || !JUDICIAL_STATUSES.has(body["status"])) {
      return "invalid";
    }
    updates.status = body["status"] as JudicialServiceUpdate["status"];
  }

  if (body["statusNoteFa"] !== undefined) {
    const note = body["statusNoteFa"];
    if (note === null) updates.statusNoteFa = null;
    else if (typeof note !== "string" || note.length > 800) return "invalid";
    else updates.statusNoteFa = note.trim() || null;
  }

  if (body["order"] !== undefined) {
    const value = num(body["order"], Number.NaN);
    if (!Number.isFinite(value) || value < 0 || value > 999) return "invalid";
    updates.order = Math.round(value);
  }

  if (body["requiresAuth"] !== undefined) {
    if (typeof body["requiresAuth"] !== "boolean") return "invalid";
    updates.requiresAuth = body["requiresAuth"];
  }

  if (body["surfaces"] !== undefined) {
    const raw = body["surfaces"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "invalid";
    const surfaces: Partial<Record<(typeof JUDICIAL_SURFACE_KEYS)[number], boolean>> = {};
    for (const key of JUDICIAL_SURFACE_KEYS) {
      const value = (raw as Record<string, unknown>)[key];
      if (value === undefined) continue;
      if (typeof value !== "boolean") return "invalid";
      surfaces[key] = value;
    }
    updates.surfaces = surfaces;
  }

  // Only modes the engine actually enforces are accepted: `free` skips the
  // charge, `energy` charges through the shared usage engine. A mode with no
  // enforcement path is refused rather than shown as a working toggle.
  if (body["access"] !== undefined) {
    const raw = body["access"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "invalid";
    const mode = (raw as Record<string, unknown>)["mode"];
    if (mode !== "free" && mode !== "energy") return "invalid";
    updates.access = {
      mode,
      activity: mode === "energy" ? "JUDICIAL_DRAFT" : null,
    };
  }

  return Object.keys(updates).length > 0 ? updates : null;
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

async function handlePost(
  request: NextRequest,
  segments: string[],
  actor: Actor
): Promise<NextResponse> {
  const [a, b, c, d] = segments;
  const meta = requestMeta(request);

  // Plans — CREATE a new plan (POST /admin/plans). Status transitions and
  // edits go through PATCH on the concrete /admin/plans/[code] route.
  if (a === "plans" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createPlan(parseCreatePlan(body));
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "plan.create",
        resourceType: "plan",
        resourceId: str(body["code"]),
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    auditPlanCreated(res.plan, actor.userId);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "plan.create",
      resourceType: "plan",
      resourceId: res.plan.code,
      after: {
        code: res.plan.code,
        nameFa: res.plan.nameFa,
        status: res.plan.status,
        listPrice: res.plan.listPrice,
        salePrice: res.plan.salePrice,
      },
      ...meta,
    });
    return NextResponse.json({ data: res.plan }, { status: 201 });
  }

  if (a === "plans" && b) {
    return adminError(405, "METHOD_NOT_ALLOWED", "برای ویرایش پلن از PATCH استفاده کنید");
  }

  // Judicial — a new questionnaire DRAFT version cloned from the newest one.
  // Editing/publishing are separate steps so a live questionnaire is never
  // mutated underneath requests that already answered it.
  if (a === "judicial" && b === "questionnaires" && c && d === "publish") {
    const before = listQuestionnaires().find((q) => q.id === c);
    const res = publishQuestionnaire(c, actor.userId);
    if (!res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "judicial.questionnaire.publish",
        resourceType: "judicial_questionnaire",
        resourceId: c,
        result: "denied",
        reason: "NOT_FOUND_OR_RETIRED",
        ...meta,
      });
      return adminError(404, "NOT_FOUND", "نسخهٔ پرسش‌نامه یافت نشد یا بازنشسته شده است");
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "judicial.questionnaire.publish",
      resourceType: "judicial_questionnaire",
      resourceId: c,
      before: before ? { status: before.status } : null,
      after: { documentType: res.documentType, version: res.version, status: res.status },
      ...meta,
    });
    return ok(res);
  }

  if (a === "judicial" && b === "questionnaires" && !c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const documentType = body["documentType"];
    if (
      documentType !== "statement" &&
      documentType !== "brief" &&
      documentType !== "petition" &&
      documentType !== "complaint"
    ) {
      return adminError(400, "INVALID_DOCUMENT_TYPE", "نوع سند پرسش‌نامه نامعتبر است");
    }
    const created = createQuestionnaireVersion({
      documentType,
      createdBy: actor.userId,
      titleFa: typeof body["titleFa"] === "string" ? body["titleFa"] : undefined,
      descriptionFa: typeof body["descriptionFa"] === "string" ? body["descriptionFa"] : undefined,
      disclaimerFa: typeof body["disclaimerFa"] === "string" ? body["disclaimerFa"] : undefined,
    });
    if (!created) return adminError(404, "NOT_FOUND", "پرسش‌نامهٔ پایه یافت نشد");
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "judicial.questionnaire.create_version",
      resourceType: "judicial_questionnaire",
      resourceId: created.id,
      after: {
        documentType: created.documentType,
        version: created.version,
        status: created.status,
      },
      ...meta,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  }

  // Coupons — CREATE (POST /admin/coupons). Edits + status changes go through
  // PATCH on /admin/coupons/:id.
  if (a === "coupons" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createCoupon(parseCouponDraft(body), actor.userId);
    if (!res.ok) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "coupon.create",
        resourceType: "coupon",
        resourceId: str(body["code"]),
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "coupon.create",
      resourceType: "coupon",
      resourceId: res.coupon.id,
      after: {
        code: res.coupon.code,
        kind: res.coupon.kind,
        value: res.coupon.value,
        status: res.coupon.status,
      },
      ...meta,
    });
    return NextResponse.json({ data: res.coupon }, { status: 201 });
  }

  // §5-rules — the DB-backed, versioned rule layer. `calculators/rules/:datasetId`
  // saves the open draft; the `/preview`, `/publish`, `/rollback` and `/discard`
  // sub-paths drive the draft lifecycle. A draft never affects users; only a
  // published version whose effective date has arrived is applied.
  if (a === "calculators" && b === "rules" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    if (!d) {
      const res = saveRuleDraft(c, parseSaveRuleDraft(body), actor.userId);
      if ("error" in res) {
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: "calculator.rule.draft.save",
          resourceType: "calculator_rule",
          resourceId: c,
          result: "denied",
          reason: res.error,
          ...meta,
        });
        return mapDataError(res.error);
      }
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "calculator.rule.draft.save",
        resourceType: "calculator_rule",
        resourceId: res.id,
        after: { datasetId: res.datasetId, version: res.version, keys: Object.keys(res.rates) },
        ...meta,
      });
      return ok(res);
    }

    if (d === "preview") {
      return ok(previewDraft(c, (body["rates"] as Record<string, unknown>) ?? {}));
    }

    if (d === "publish") {
      const res = publishDraft(str(body["versionId"]), actor.userId);
      if ("error" in res) {
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: "calculator.rule.publish",
          resourceType: "calculator_rule",
          resourceId: str(body["versionId"]),
          result: "denied",
          reason: res.error,
          ...meta,
        });
        return mapDataError(res.error);
      }
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "calculator.rule.publish",
        resourceType: "calculator_rule",
        resourceId: res.id,
        after: { datasetId: res.datasetId, version: res.version, effectiveFrom: res.effectiveFrom },
        reason: res.changeNoteFa,
        ...meta,
      });
      return ok(res);
    }

    if (d === "rollback") {
      const res = rollbackToVersion(c, str(body["versionId"]), actor.userId);
      if ("error" in res) {
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: "calculator.rule.rollback",
          resourceType: "calculator_rule",
          resourceId: str(body["versionId"]),
          result: "denied",
          reason: res.error,
          ...meta,
        });
        return mapDataError(res.error);
      }
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "calculator.rule.rollback",
        resourceType: "calculator_rule",
        resourceId: res.id,
        after: { datasetId: res.datasetId, version: res.version },
        ...meta,
      });
      return ok(res);
    }

    if (d === "discard") {
      const res = deleteDraft(str(body["versionId"]));
      if ("error" in res) return mapDataError(res.error);
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "calculator.rule.draft.discard",
        resourceType: "calculator_rule",
        resourceId: str(body["versionId"]),
        ...meta,
      });
      return ok(res);
    }

    return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
  }

  if (a === "calculators" && b) {
    // §5 — save one calculator's operational policy (save-as-create; the
    // surface has no separate create form).
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = saveCalculatorSetting(b, parseCalculatorSetting(body), actor.userId);
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "calculator.settings.update",
        resourceType: "calculator",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "calculator.settings.update",
      resourceType: "calculator",
      resourceId: b,
      after: { enabled: res.enabled, accessTier: res.accessTier, energyCost: res.energyCost },
      ...meta,
    });
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
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "order.refund.create",
      resourceType: "order",
      resourceId: b,
      after: { amount: res.amount, kind: res.kind },
      reason: res.reason,
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "refunds" && b && c === "decide") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const decision = body["decision"] === "approved" ? "approved" : "rejected";
    const res = decideAdjustment(b, decision, actor.userId);
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "refund.decide",
        resourceType: "adjustment",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "refund.decide",
      resourceType: "adjustment",
      resourceId: b,
      after: { status: res.status },
      ...meta,
    });
    return ok(res);
  }

  if (a === "finance" && b === "commission-rules") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = updateCommissionRule({
      serviceType: str(body["serviceType"], "consultation"),
      platformPercent: num(body["platformPercent"]),
      platformFixedToman: num(body["platformFixedToman"]),
      allowedDeductions: Array.isArray(body["allowedDeductions"])
        ? (body["allowedDeductions"] as string[])
        : [],
      changedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "commission.update",
      resourceType: "commission_rule",
      resourceId: res.id,
      after: {
        serviceType: res.serviceType,
        platformPercent: res.platformPercent,
        version: res.version,
      },
      ...meta,
    });
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
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "settlement.create",
      resourceType: "settlement",
      resourceId: res.id,
      after: { lawyerId: res.lawyerId },
      ...meta,
    });
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
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "settlement.line.add",
      resourceType: "settlement",
      resourceId: b,
      after: { grossAmount: gross },
      ...meta,
    });
    return ok(res);
  }

  if (a === "settlements" && b && c === "transition") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const rawDest =
      typeof body["payoutDestination"] === "string" ? (body["payoutDestination"] as string) : null;
    const reason = typeof body["reason"] === "string" ? (body["reason"] as string) : undefined;
    const res = transitionSettlement({
      settlementId: b,
      to: body["to"] as SettlementStatus,
      actorUserId: actor.userId,
      reason,
      payoutDestinationMasked: rawDest ? maskPayoutDestination(rawDest) : null,
      payoutReference:
        typeof body["payoutReference"] === "string" ? (body["payoutReference"] as string) : null,
    });
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "settlement.transition",
        resourceType: "settlement",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "settlement.transition",
      resourceType: "settlement",
      resourceId: b,
      after: { status: res.status },
      reason: reason ?? null,
      ...meta,
    });
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
      embeddingModel:
        typeof body["embeddingModel"] === "string" ? (body["embeddingModel"] as string) : null,
      timeoutMs: num(body["timeoutMs"], 30000),
      maxOutputTokens: num(body["maxOutputTokens"], 2048),
      isDefault: Boolean(body["isDefault"]),
      apiKey: typeof body["apiKey"] === "string" ? (body["apiKey"] as string) : undefined,
      clearKey: Boolean(body["clearKey"]),
      // Lifecycle + catalogue. Each is only forwarded when actually supplied,
      // so an older client that omits them cannot silently re-enable a
      // provider the operator paused.
      ...(typeof body["enabled"] === "boolean" ? { enabled: body["enabled"] as boolean } : {}),
      ...(Array.isArray(body["availableModels"])
        ? {
            availableModels: (body["availableModels"] as unknown[]).filter(
              (m): m is string => typeof m === "string"
            ),
          }
        : {}),
      ...(body["defaultModel"] === null || typeof body["defaultModel"] === "string"
        ? { defaultModel: body["defaultModel"] as string | null }
        : {}),
      ...(body["configuration"] && typeof body["configuration"] === "object"
        ? { configuration: body["configuration"] as Record<string, string> }
        : {}),
      updatedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "ai.provider.save",
      resourceType: "ai_provider",
      resourceId: res.id,
      after: {
        nameFa: res.nameFa,
        kind: res.kind,
        hasKey: res.hasKey,
        isDefault: res.isDefault,
        enabled: res.enabled !== false,
        models: res.availableModels?.length ?? null,
        defaultModel: res.defaultModel ?? null,
      },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "ai" && b === "providers" && c && d === "test") {
    const res = await testAiProvider(c);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "ai.provider.test",
      resourceType: "ai_provider",
      resourceId: c,
      result: res.ok ? "success" : "failure",
      reason: res.messageFa,
      ...meta,
    });
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
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "ai.prompt.create",
      resourceType: "ai_prompt",
      resourceId: res.id,
      after: { key: res.key, version: res.version },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "ai" && b === "prompts" && c && d === "activate") {
    const res = activatePromptVersion(c, actor.userId);
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "ai.prompt.activate",
      resourceType: "ai_prompt",
      resourceId: c,
      after: { key: res.key, version: res.version },
      ...meta,
    });
    return ok(res);
  }

  // §12 — edit one contextual tool. Every field is optional, so a body of
  // `{ enabled }` is a pure capability toggle. The write is audited and the
  // response carries the REAL verdict, so the panel can never imply that a
  // toggle made an unavailable source exist.
  if (a === "ai" && b === "tools" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    const allowed = body["allowedServiceTypes"];
    const before = listToolsForAdmin().find((t) => t.toolId === c);
    const after = updateToolSetting(
      c,
      {
        enabled: typeof body["enabled"] === "boolean" ? (body["enabled"] as boolean) : undefined,
        allowedServiceTypes: Array.isArray(allowed)
          ? allowed.filter((s): s is string => typeof s === "string")
          : undefined,
        labelFa: typeof body["labelFa"] === "string" ? (body["labelFa"] as string) : undefined,
        descriptionFa:
          typeof body["descriptionFa"] === "string" ? (body["descriptionFa"] as string) : undefined,
        effectNoteFa:
          typeof body["effectNoteFa"] === "string" ? (body["effectNoteFa"] as string) : undefined,
        order: typeof body["order"] === "number" ? (body["order"] as number) : undefined,
      },
      actor.userId
    );
    if (!after) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "ai.tool.update",
        resourceType: "chat_tool",
        resourceId: c,
        result: "denied",
        reason: "TOOL_NOT_FOUND",
        ...meta,
      });
      return adminError(404, "TOOL_NOT_FOUND", "ابزار یافت نشد");
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "ai.tool.update",
      resourceType: "chat_tool",
      resourceId: c,
      before: before
        ? {
            enabled: before.enabled,
            allowedServiceTypes: before.allowedServiceTypes,
            labelFa: before.labelFa,
            order: before.order,
          }
        : null,
      after: {
        enabled: after.enabled,
        allowedServiceTypes: after.allowedServiceTypes,
        labelFa: after.labelFa,
        order: after.order,
      },
      ...meta,
    });
    const view = listToolsForAdmin().find((t) => t.toolId === c) ?? null;
    return ok(view);
  }

  if (a === "support" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = createTicket({
      subject: str(body["subject"]),
      category: str(body["category"], "general"),
      priority: (body["priority"] as SupportTicketPriority) ?? "normal",
      requesterUserId:
        typeof body["requesterUserId"] === "string" ? (body["requesterUserId"] as string) : null,
      requesterName: str(body["requesterName"], "کاربر"),
      body: str(body["body"]),
      authorUserId: actor.userId,
      authorName: actorName(actor),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "support.create",
      resourceType: "support_ticket",
      resourceId: res.id,
      after: { subject: res.subject },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "energy" && b === "profiles" && !c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = saveCostProfile({
      id: typeof body["id"] === "string" ? (body["id"] as string) : undefined,
      serviceKey: str(body["serviceKey"]),
      nameFa: str(body["nameFa"]),
      descriptionFa:
        typeof body["descriptionFa"] === "string" ? (body["descriptionFa"] as string) : undefined,
      activity: body["activity"] as never,
      enabled: Boolean(body["enabled"]),
      billingMode:
        body["billingMode"] === "FREE"
          ? "FREE"
          : body["billingMode"] === "ENERGY"
            ? "ENERGY"
            : undefined,
      chargeBasis:
        body["chargeBasis"] === "PER_CONVERSATION"
          ? "PER_CONVERSATION"
          : body["chargeBasis"] === "PER_MESSAGE"
            ? "PER_MESSAGE"
            : undefined,
      baseRequestCost: num(body["baseRequestCost"]),
      inputTokenPer1k: num(body["inputTokenPer1k"]),
      outputTokenPer1k: num(body["outputTokenPer1k"]),
      contextTokenPer1k: num(body["contextTokenPer1k"]),
      unitCosts: (body["unitCosts"] as never) ?? {},
      modelMultipliers: (body["modelMultipliers"] as Record<string, number>) ?? {},
      updatedBy: actor.userId,
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "energy.profile.save",
      resourceType: "service_cost_profile",
      resourceId: res.id,
      after: {
        serviceKey: res.serviceKey,
        enabled: res.enabled,
        billingMode: res.billingMode,
        chargeBasis: res.chargeBasis,
        baseRequestCost: res.baseRequestCost,
      },
      ...meta,
    });
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
      multiply:
        body["multiply"] === null || body["multiply"] === undefined ? null : num(body["multiply"]),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "energy.rule.save",
      resourceType: "service_cost_rule",
      resourceId: res.id,
      after: {
        profileId: res.profileId,
        condition: res.condition,
        addEnergy: res.addEnergy,
        enabled: res.enabled,
      },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
  }

  if (a === "energy" && b === "rules" && c && d === "delete") {
    const res = deleteCostRule(c);
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "energy.rule.delete",
      resourceType: "service_cost_rule",
      resourceId: c,
      ...meta,
    });
    return ok(res);
  }

  if (a === "support" && b && c === "messages") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = addMessage({
      ticketId: b,
      authorUserId: actor.userId,
      authorName: actorName(actor),
      body: str(body["body"]),
      isInternal: Boolean(body["isInternal"]),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "support.message",
      resourceType: "support_ticket",
      resourceId: b,
      after: { internal: Boolean(body["isInternal"]) },
      ...meta,
    });
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

  if (a === "rag" && b === "retry") {
    // §2 — retry the files the last ingest could not read. Deterministic and
    // honest: files that are still unreadable are reported back as such.
    const res = retryRagIngestion();
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "rag.corpus.retry",
      resourceType: "rag_corpus",
      resourceId: res.report.corpusDir,
      after: {
        sources: res.report.sources,
        chunks: res.report.chunks,
        stillFailing: res.stillFailing,
      },
      ...meta,
    });
    return ok(res);
  }

  if (a === "rag" && b === "upload") {
    // §2 — the ONE write path into the source folder. The uploaded bytes land
    // in the pipeline's own folder and are ingested immediately, so an
    // operator adding a law sees the real effect (sources/chunks/failures)
    // rather than a queued job that may never run.
    //
    // Refuse an oversized body BEFORE parsing: base64 inflates by ~4/3, and
    // a multi-hundred-MB JSON body must not reach the JSON parser.
    const declared = Number(request.headers.get("content-length") ?? "0");
    const bodyCap = Math.ceil((RAG_UPLOAD_MAX_BYTES * 4) / 3) + 64 * 1024;
    if (Number.isFinite(declared) && declared > bodyCap) {
      return adminError(413, "TOO_LARGE", "حجم فایل بیش از حد مجاز است (حداکثر ۵۰ مگابایت)");
    }
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    const fileName = str(body["fileName"]);
    const data = str(body["data"]);
    if (!fileName || !data) {
      return adminError(400, "INVALID_BODY", "نام فایل و محتوای آن الزامی است");
    }
    const bytes = Buffer.from(data, "base64");
    const res = uploadRagFile(fileName, bytes);
    if ("error" in res) {
      const messageFa =
        res.error === "UNSUPPORTED_TYPE"
          ? "فقط فایل‌های PDF، DOCX و TXT پذیرفته می‌شوند"
          : res.error === "EMPTY_FILE"
            ? "فایل خالی است"
            : res.error === "TOO_LARGE"
              ? "حجم فایل بیش از حد مجاز است (حداکثر ۵۰ مگابایت)"
              : res.error === "INVALID_NAME"
                ? "نام فایل نامعتبر است"
                : "ذخیرهٔ فایل ناموفق بود";
      const status = res.error === "TOO_LARGE" ? 413 : res.error === "STORE_FAILED" ? 500 : 400;
      // A rejected upload is a DENIED action, and is recorded as one.
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "rag.source.upload",
        resourceType: "rag_source",
        resourceId: fileName || "(unnamed)",
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return adminError(status, res.error, messageFa);
    }

    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "rag.source.upload",
      resourceType: "rag_source",
      resourceId: res.fileName,
      after: {
        bytes: res.bytes,
        sources: res.ingest.sources,
        chunks: res.ingest.chunks,
        discovered: res.ingest.discovered,
      },
      ...meta,
    });
    return NextResponse.json({ data: res }, { status: 201 });
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

  if (a === "legal-library") {
    // Delete a source (the library's own store — never the blog's).
    if (b && c === "delete") {
      const res = deleteLegalSource(b);
      if ("error" in res) return mapDataError(res.error);
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "library.delete",
        resourceType: "legal_source",
        resourceId: b,
        ...meta,
      });
      return ok(res);
    }

    // Create a source (always a draft unless a status is supplied).
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const res = upsertLegalSource(
      {
        title: str(body["title"]),
        slug: body["slug"] === undefined ? null : str(body["slug"]),
        sourceType: body["sourceType"] as AdminLegalSource["sourceType"] | undefined,
        topic: body["topic"] === undefined ? null : str(body["topic"]),
        topicSlug: body["topicSlug"] === undefined ? null : str(body["topicSlug"]),
        summary: body["summary"] === undefined ? null : str(body["summary"]),
        body: body["body"] === undefined ? null : str(body["body"]),
        authority: body["authority"] === undefined ? null : str(body["authority"]),
        readingTime: body["readingTime"] === undefined ? null : num(body["readingTime"]),
        popular: Boolean(body["popular"]),
        featured: Boolean(body["featured"]),
        seoTitle: body["seoTitle"] === undefined ? null : str(body["seoTitle"]),
        seoDescription: body["seoDescription"] === undefined ? null : str(body["seoDescription"]),
        canonicalUrl: body["canonicalUrl"] === undefined ? null : str(body["canonicalUrl"]),
        sourceUrl: body["sourceUrl"] === undefined ? null : str(body["sourceUrl"]),
        officialSourceUrl:
          body["officialSourceUrl"] === undefined ? null : str(body["officialSourceUrl"]),
        status: (body["status"] as AdminLegalStatus | undefined) ?? "DRAFT",
      },
      actor.userId
    );
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "library.create",
      resourceType: "legal_source",
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
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "subscription.admin.action",
        resourceType: "user",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "subscription.admin.action",
      resourceType: "user",
      resourceId: b,
      after: {
        action: input.action,
        planCode: input.planCode ?? null,
        days: input.days ?? null,
        subscriptionId: res.result.subscriptionId,
        supersededIds: res.result.supersededIds,
      },
      reason: input.reason,
      ...meta,
    });
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
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "energy.admin.adjust",
        resourceType: "user",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "energy.admin.adjust",
      resourceType: "user",
      resourceId: b,
      after: { action: input.action, delta: res.result.delta, balance: res.result.balance },
      reason: input.reason,
      ...meta,
    });
    return ok(res.result);
  }

  return adminError(404, "NOT_FOUND", "مسیر یافت نشد");
}

async function handlePatch(
  request: NextRequest,
  segments: string[],
  actor: Actor
): Promise<NextResponse> {
  const [a, b, c] = segments;
  const meta = requestMeta(request);

  // --- AI · provider lifecycle -------------------------------------------
  // Enable/disable is a PATCH of ONE field, so a click can never reset the
  // model, limits or key. Disabling the default provider clears the default
  // flag: the router then falls back to the environment, which is the honest
  // state rather than a default that silently refuses to serve.
  if (a === "ai" && b === "providers" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    if (typeof body["enabled"] !== "boolean") {
      return adminError(400, "INVALID_BODY", "وضعیت فعال/غیرفعال لازم است");
    }
    const before = listAiProviders().find((p) => p.id === c);
    if (!before) return adminError(404, "NOT_FOUND", "ارائه‌دهنده یافت نشد");
    const res = setAiProviderEnabled(c, body["enabled"] as boolean, actor.userId);
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: res.enabled === false ? "ai.provider.disable" : "ai.provider.enable",
      resourceType: "ai_provider",
      resourceId: c,
      before: { enabled: before.enabled !== false, isDefault: before.isDefault },
      after: { enabled: res.enabled !== false, isDefault: res.isDefault },
      ...meta,
    });
    return ok(res);
  }

  // --- AI · per-capability binding ---------------------------------------
  // The body may also be `{ clear: true }` — the capability returns to the
  // default provider. Both paths are audited with the impact facts the
  // operator was shown, so a later reader can reconstruct the decision.
  if (a === "ai" && b === "bindings" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    if (!isCapability(c)) {
      return adminError(400, "INVALID_CAPABILITY", "قابلیت انتخاب‌شده شناخته نمی‌شود.");
    }

    const auditMeta: AuditMeta = {
      actorRole: actor.role,
      orgId: actor.orgId,
      ip: meta.ip ?? null,
      requestId: meta.requestId ?? null,
    };

    if (body["clear"] === true) {
      const removed = clearServiceBinding(c, actor.userId, auditMeta);
      if (!removed) {
        return adminError(404, "NOT_FOUND", "اتصال اختصاصی برای این قابلیت ثبت نشده است");
      }
      return ok({ binding: null, cleared: true });
    }

    // Three distinct states, never conflated:
    //   • key ABSENT  → keep what is stored (a partial save cannot widen scope);
    //   • explicit [] → answer WITHOUT retrieval;
    //   • explicit null → every published source (the unrestricted default).
    // Anything else is malformed and rejected rather than guessed at.
    const knowledgeRaw = body["knowledgeSourceIds"];
    let knowledgeSourceIds: string[] | null;
    if (!("knowledgeSourceIds" in body)) {
      knowledgeSourceIds = getServiceBinding(c)?.knowledgeSourceIds ?? null;
    } else if (knowledgeRaw === null) {
      knowledgeSourceIds = null;
    } else if (Array.isArray(knowledgeRaw)) {
      knowledgeSourceIds = (knowledgeRaw as unknown[]).filter(
        (id): id is string => typeof id === "string"
      );
    } else {
      return adminError(400, "INVALID_BODY", "دامنهٔ منابع دانش نامعتبر است");
    }

    const result = saveServiceBinding(
      {
        serviceType: c,
        providerId: typeof body["providerId"] === "string" ? (body["providerId"] as string) : null,
        model: typeof body["model"] === "string" ? (body["model"] as string) : null,
        temperature:
          body["temperature"] === null
            ? null
            : body["temperature"] === undefined
              ? null
              : num(body["temperature"], Number.NaN),
        maxOutputTokens:
          body["maxOutputTokens"] === null || body["maxOutputTokens"] === undefined
            ? null
            : num(body["maxOutputTokens"], Number.NaN),
        timeoutMs:
          body["timeoutMs"] === null || body["timeoutMs"] === undefined
            ? null
            : num(body["timeoutMs"], Number.NaN),
        fallbackProviderId:
          typeof body["fallbackProviderId"] === "string"
            ? (body["fallbackProviderId"] as string)
            : null,
        knowledgeSourceIds,
        status: body["status"] === "inactive" ? "inactive" : "active",
        updatedBy: actor.userId,
      },
      auditMeta
    );
    if (!result.ok) return adminError(400, result.error, result.messageFa);
    return ok(result);
  }

  // Platform settings — the ONLY editable row today is the panel's DISPLAY
  // timezone. It changes how stored instants are rendered, never the instants
  // themselves and never the server's own zone; the audit entry carries both
  // sides so a zone change is attributable.
  if (a === "settings" && !b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    if (typeof body["displayTimezone"] !== "string") {
      return adminError(400, "INVALID_BODY", "منطقهٔ زمانی نمایش لازم است");
    }
    const res = saveDisplaySettings(
      { displayTimezone: body["displayTimezone"] as string },
      actor.userId
    );
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "settings.display_timezone.update",
        resourceType: "platform_settings",
        resourceId: "display",
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return adminError(400, "INVALID_TIMEZONE", "منطقهٔ زمانی انتخاب‌شده معتبر نیست.");
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "settings.display_timezone.update",
      resourceType: "platform_settings",
      resourceId: "display",
      before: { displayTimezone: res.before.displayTimezone },
      after: { displayTimezone: res.after.displayTimezone },
      ...meta,
    });
    return ok({
      displayTimezone: res.after.displayTimezone,
      displayTimezoneUpdatedAt: res.after.updatedAt,
      // Re-read the live server zone so the confirmation panel can restate it.
      serverTimezone: serverTimeZone().timeZone,
      timezoneOptions: timeZoneOptions([
        res.after.displayTimezone,
        serverTimeZone().timeZone,
      ]),
    });
  }

  // Coupons — a `{ status }`-only body is a lifecycle change (enable/disable/
  // archive); anything else is a full edit. Both are audited distinctly.
  if (a === "coupons" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const keys = Object.keys(body);
    const statusOnly = keys.length === 1 && keys[0] === "status";

    if (statusOnly) {
      const before = getAdminCoupon(b);
      const res = setCouponStatus(b, body["status"] as never, actor.userId);
      if (!res) return adminError(404, "COUPON_NOT_FOUND", "کد تخفیف یافت نشد");
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "coupon.status.change",
        resourceType: "coupon",
        resourceId: b,
        before: before ? { status: before.status } : null,
        after: { status: res.status },
        ...meta,
      });
      return ok(res);
    }

    const before = getAdminCoupon(b);
    const res = updateCoupon(b, parseCouponDraft(body), actor.userId);
    if (!res.ok) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "coupon.update",
        resourceType: "coupon",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "coupon.update",
      resourceType: "coupon",
      resourceId: b,
      before: before ? { code: before.code, value: before.value, status: before.status } : null,
      after: { code: res.coupon.code, value: res.coupon.value, status: res.coupon.status },
      ...meta,
    });
    return ok(res.coupon);
  }

  if (a === "users" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    // Snapshot the prior role so the trail records the full before → after diff.
    const priorStaff = getStaffMember(b);
    const res = changeUserRole({
      userId: b,
      role: body["role"] as PlatformRole,
      actorUserId: actor.userId,
    });
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "user.role.change",
        resourceType: "user",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "user.role.change",
      resourceType: "user",
      resourceId: b,
      before: priorStaff ? { role: priorStaff.role } : null,
      after: { role: res.role },
      ...meta,
    });
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
        rolloutPercent:
          body["rolloutPercent"] === undefined ? undefined : num(body["rolloutPercent"]),
        allowedPlans: Array.isArray(body["allowedPlans"])
          ? (body["allowedPlans"] as string[])
          : undefined,
        allowedOrgIds: Array.isArray(body["allowedOrgIds"])
          ? (body["allowedOrgIds"] as string[])
          : undefined,
      },
      actor.userId
    );
    if (!res) return adminError(404, "NOT_FOUND", "ویژگی یافت نشد");
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "flag.update",
      resourceType: "feature_flag",
      resourceId: b,
      before: before ? { status: before.status, rolloutPercent: before.rolloutPercent } : null,
      after: { status: res.status, rolloutPercent: res.rolloutPercent },
      ...meta,
    });
    return ok(res);
  }

  if (a === "judicial" && b === "services" && c) {
    // §6 — one service's release control. The module refuses to mark a
    // provider-dependent service available while its provider is unconfigured,
    // and every refusal is recorded as a denied audit entry.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const before = listJudicialServices().find((s) => s.id === c);
    if (!before) return adminError(404, "SERVICE_NOT_FOUND", "خدمت یافت نشد");

    const updates = parseJudicialServiceUpdate(body);
    if (updates === "invalid") {
      return adminError(400, "INVALID_BODY", "مقدار یکی از فیلدها نامعتبر است");
    }
    if (updates === null) {
      return adminError(400, "INVALID_BODY", "تغییری برای اعمال ارسال نشده است");
    }

    const res = updateJudicialService(c, updates, actor.userId);
    if (!res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "judicial.service.update",
        resourceType: "judicial_service",
        resourceId: c,
        result: "denied",
        reason: "UNCONFIGURED_PROVIDER",
        ...meta,
      });
      return adminError(
        409,
        "PROVIDER_NOT_CONFIGURED",
        "این خدمت به یک ارائه‌دهندهٔ بیرونی وابسته است و تا زمان اتصال واقعی نمی‌تواند «در دسترس» شود."
      );
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "judicial.service.update",
      resourceType: "judicial_service",
      resourceId: c,
      before: {
        status: before.status,
        order: before.order,
        surfaces: before.surfaces,
        configured: before.requirement.configured,
        version: before.version,
      },
      after: {
        status: res.status,
        order: res.order,
        surfaces: res.surfaces,
        configured: res.requirement.configured,
        version: res.version,
      },
      ...meta,
    });
    return ok(res);
  }

  // §7 — the review workspace. Every action appends to the review timeline
  // (and the owner-visible status history) inside `review-db`; this handler
  // only validates the request and audits the decision.
  //
  // `approve` is special: it changes the review to `approved`, and then the
  // FINAL ARTIFACT is issued from the SAME handler, so the decision and the
  // document can never diverge. A stale version is refused before anything is
  // written — the browser cannot talk the server into printing text the
  // reviewer never read.
  if (a === "judicial" && b === "reviews" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    const before = getReviewById(c);
    if (!before) return adminError(404, "NOT_FOUND", "درخواست بررسی یافت نشد");

    const action = body["action"];
    if (
      action !== "assign" &&
      action !== "note" &&
      action !== "request_changes" &&
      action !== "approve" &&
      action !== "reject" &&
      action !== "cancel"
    ) {
      return adminError(400, "INVALID_BODY", "عملیات درخواستی نامعتبر است");
    }

    // The actor's label is resolved HERE, never taken from the body.
    const actorLabel = (() => {
      const user = findUserById(actor.userId);
      return user?.displayName?.trim() || "کارشناس لیگالیر";
    })();

    const res = applyAdminReviewAction({
      reviewId: c,
      actor: { userId: actor.userId, labelFa: actorLabel },
      action,
      noteFa: typeof body["noteFa"] === "string" ? body["noteFa"] : undefined,
      assigneeUserId:
        body["assigneeUserId"] === undefined
          ? undefined
          : (body["assigneeUserId"] as string | null),
      versionId: typeof body["versionId"] === "string" ? body["versionId"] : undefined,
      revisedText: typeof body["revisedText"] === "string" ? body["revisedText"] : undefined,
      internalNote: body["internalNote"] === true,
    });

    if (!res.ok) {
      const map: Record<typeof res.code, { status: number; code: string; message: string }> = {
        NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "درخواست بررسی یافت نشد" },
        REVIEW_CLOSED: {
          status: 409,
          code: "REVIEW_CLOSED",
          message: "این بررسی بسته شده است و تغییر آن ممکن نیست",
        },
        STALE_VERSION: {
          status: 409,
          code: "STALE_VERSION",
          message: "نسخهٔ بررسی‌شده با متن فعلی یکسان نیست؛ صفحه را بازخوانی کنید",
        },
        NOTE_REQUIRED: {
          status: 400,
          code: "NOTE_REQUIRED",
          message: "برای این عملیات، ثبت متن الزامی است",
        },
        VERSION_REQUIRED: {
          status: 400,
          code: "VERSION_REQUIRED",
          message: "نسخهٔ تأییدشده مشخص نشده است",
        },
        OK: { status: 409, code: "REVIEW_ACTION_FAILED", message: "این عملیات انجام نشد" },
      };
      const mapped = map[res.code];
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: `judicial.review.${action}`,
        resourceType: "judicial_review",
        resourceId: c,
        result: "denied",
        reason: res.code,
        ...meta,
      });
      return adminError(mapped.status, mapped.code, mapped.message);
    }

    // Issuance is part of the approval, not a second click. If it fails the
    // approval still stands but the operator is told plainly — never a silent
    // "approved" with no artifact.
    let issued: { serialFa: string } | null = null;
    if (action === "approve") {
      const issue = await issueFinalDocument({
        reviewId: c,
        actorLabelFa: actorLabel,
      });
      if (!issue.ok) {
        recordAudit({
          actorUserId: actor.userId,
          actorRole: actor.role,
          orgId: actor.orgId,
          action: "judicial.final.issue",
          resourceType: "judicial_final_document",
          resourceId: before.requestId,
          result: "denied",
          reason: issue.code,
          ...meta,
        });
        return adminError(
          502,
          "FINAL_ISSUE_FAILED",
          "بررسی تأیید شد اما صدور فایل نهایی ناموفق بود؛ دوباره تلاش کنید تا نسخهٔ نهایی صادر شود."
        );
      }
      issued = { serialFa: issue.document.serialFa };
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "judicial.final.issue",
        resourceType: "judicial_final_document",
        resourceId: issue.document.id,
        after: {
          serialFa: issue.document.serialFa,
          requestId: issue.document.requestId,
          versionNumber: issue.document.versionNumber,
        },
        ...meta,
      });
    }

    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: `judicial.review.${action}`,
      resourceType: "judicial_review",
      resourceId: c,
      before: { status: before.status },
      after: { status: res.review.status, ...(issued ? { serialFa: issued.serialFa } : {}) },
      ...meta,
    });

    return ok({ review: res.review, finalDocument: issued });
  }

  // §7 — the tracked orders. An operator may move the status, assign a
  // handler, and record an owner-visible note. `delivered` is refused by the
  // module unless a real artifact is attached, so the status can never claim a
  // document that does not exist.
  if (a === "judicial" && b === "orders" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    const before = getOrderById(c);
    if (!before) return adminError(404, "NOT_FOUND", "درخواست یافت نشد");

    const status = body["status"];
    const validStatuses = [
      "draft",
      "submitted",
      "in_progress",
      "waiting_user",
      "ready",
      "delivered",
      "rejected",
      "cancelled",
    ];
    if (status !== undefined && !validStatuses.includes(status as string)) {
      return adminError(400, "INVALID_BODY", "وضعیت درخواستی نامعتبر است");
    }

    const actorLabel = (() => {
      const user = findUserById(actor.userId);
      return user?.displayName?.trim() || "کارشناس لیگالیر";
    })();

    const updated = updateOrderByAdmin(
      c,
      {
        status: status === undefined ? undefined : (status as JudicialOrderStatus),
        assignedToUserId:
          body["assignedToUserId"] === undefined
            ? undefined
            : (body["assignedToUserId"] as string | null),
        operatorNoteFa:
          body["operatorNoteFa"] === undefined
            ? undefined
            : (body["operatorNoteFa"] as string | null),
        deliveryDocumentId:
          body["deliveryDocumentId"] === undefined
            ? undefined
            : (body["deliveryDocumentId"] as string | null),
        deliveryNameFa:
          body["deliveryNameFa"] === undefined
            ? undefined
            : (body["deliveryNameFa"] as string | null),
      },
      { userId: actor.userId, labelFa: actorLabel }
    );

    if (!updated) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "judicial.order.update",
        resourceType: "judicial_order",
        resourceId: c,
        result: "denied",
        reason: "DELIVERY_REQUIRES_DOCUMENT",
        ...meta,
      });
      return adminError(
        409,
        "DELIVERY_REQUIRES_DOCUMENT",
        "وضعیت «تحویل‌شده» فقط با پیوست فایل تحویل قابل ثبت است."
      );
    }

    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "judicial.order.update",
      resourceType: "judicial_order",
      resourceId: c,
      before: { status: before.status, assignedToUserId: before.assignedToUserId },
      after: { status: updated.status, assignedToUserId: updated.assignedToUserId },
      ...meta,
    });

    return ok({ order: orderQueueRow(updated) });
  }

  if (a === "support" && b) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    // A closed-vocabulary check: an unknown status must be refused rather than
    // written into the ticket (the type assertion below is not validation).
    // An absent field means "leave it", so only a PRESENT value is validated.
    const statusRaw = body["status"];
    if (statusRaw !== undefined && !KNOWN_TICKET_STATUS.has(statusRaw as SupportTicketStatus)) {
      return adminError(400, "INVALID_STATUS", "وضعیت تیکت نامعتبر است");
    }
    const priorityRaw = body["priority"];
    if (
      priorityRaw !== undefined &&
      !KNOWN_TICKET_PRIORITY.has(priorityRaw as SupportTicketPriority)
    ) {
      return adminError(400, "INVALID_STATUS", "اولویت تیکت نامعتبر است");
    }
    if (body["assigneeUserId"] !== undefined && body["assigneeUserId"] !== null) {
      if (typeof body["assigneeUserId"] !== "string") {
        return adminError(400, "INVALID_BODY", "شناسهٔ کارشناس نامعتبر است");
      }
    }

    const before = getTicket(b);
    const res = updateTicket({
      ticketId: b,
      status: statusRaw as SupportTicketStatus | undefined,
      priority: priorityRaw as SupportTicketPriority | undefined,
      assigneeUserId:
        body["assigneeUserId"] === undefined
          ? undefined
          : (body["assigneeUserId"] as string | null),
      referralNote:
        typeof body["referralNote"] === "string" ? (body["referralNote"] as string) : null,
      actor: { userId: actor.userId, name: actorName(actor) },
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "support.update",
      resourceType: "support_ticket",
      resourceId: b,
      before: before
        ? {
            status: before.status,
            priority: before.priority,
            assigneeUserId: before.assigneeUserId,
          }
        : null,
      after: {
        status: res.status,
        priority: res.priority,
        assigneeUserId: res.assigneeUserId,
      },
      ...meta,
    });
    return ok(res);
  }

  if (a === "calculators" && b) {
    // §5 — partial save of one calculator's operational policy.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const before = getCalculatorSetting(b);
    const res = saveCalculatorSetting(b, parseCalculatorSetting(body), actor.userId);
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "calculator.settings.update",
        resourceType: "calculator",
        resourceId: b,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "calculator.settings.update",
      resourceType: "calculator",
      resourceId: b,
      before: {
        enabled: before.enabled,
        accessTier: before.accessTier,
        energyCost: before.energyCost,
      },
      after: { enabled: res.enabled, accessTier: res.accessTier, energyCost: res.energyCost },
      ...meta,
    });
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
        readingTime:
          body["readingTime"] === undefined ? before.readingTime : num(body["readingTime"]),
        featured: body["featured"] === undefined ? before.featured : Boolean(body["featured"]),
        seoTitle: body["seoTitle"] === undefined ? before.seoTitle : str(body["seoTitle"]),
        seoDescription:
          body["seoDescription"] === undefined
            ? before.seoDescription
            : str(body["seoDescription"]),
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

  if (a === "legal-library" && b) {
    // Update a source, or change only its status. Publishing is explicit; a
    // status change away from `published` removes it from the public library.
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    // A status-only change (no other fields) routes through setLegalSourceStatus.
    const keys = Object.keys(body);
    if (keys.length === 1 && "status" in body) {
      const before = getAdminLegalSource(b);
      if (!before) return adminError(404, "NOT_FOUND", "منبع حقوقی یافت نشد");
      const res = setLegalSourceStatus(b, body["status"] as AdminLegalStatus);
      if ("error" in res) return mapDataError(res.error);
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: res.status === "PUBLISHED" ? "library.publish" : "library.status.change",
        resourceType: "legal_source",
        resourceId: b,
        before: { status: before.status },
        after: { status: res.status },
        ...meta,
      });
      return ok(res);
    }

    const before = getAdminLegalSource(b);
    if (!before) return adminError(404, "NOT_FOUND", "منبع حقوقی یافت نشد");
    const res = upsertLegalSource(
      {
        id: b,
        title: body["title"] === undefined ? before.title : str(body["title"]),
        slug: body["slug"] === undefined ? before.slug : str(body["slug"]),
        sourceType:
          body["sourceType"] === undefined
            ? before.sourceType
            : (body["sourceType"] as AdminLegalSource["sourceType"]),
        topic: body["topic"] === undefined ? before.topic : str(body["topic"]),
        topicSlug: body["topicSlug"] === undefined ? before.topicSlug : str(body["topicSlug"]),
        summary: body["summary"] === undefined ? before.summary : str(body["summary"]),
        body: body["body"] === undefined ? before.body : str(body["body"]),
        authority: body["authority"] === undefined ? before.authority : str(body["authority"]),
        readingTime:
          body["readingTime"] === undefined ? before.readingTime : num(body["readingTime"]),
        popular: body["popular"] === undefined ? before.popular : Boolean(body["popular"]),
        featured: body["featured"] === undefined ? before.featured : Boolean(body["featured"]),
        seoTitle: body["seoTitle"] === undefined ? before.seoTitle : str(body["seoTitle"]),
        seoDescription:
          body["seoDescription"] === undefined
            ? before.seoDescription
            : str(body["seoDescription"]),
        canonicalUrl:
          body["canonicalUrl"] === undefined ? before.canonicalUrl : str(body["canonicalUrl"]),
        sourceUrl: body["sourceUrl"] === undefined ? before.sourceUrl : str(body["sourceUrl"]),
        officialSourceUrl:
          body["officialSourceUrl"] === undefined
            ? before.officialSourceUrl
            : str(body["officialSourceUrl"]),
        status: (body["status"] as AdminLegalStatus | undefined) ?? before.status,
      },
      actor.userId
    );
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "library.update",
      resourceType: "legal_source",
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
          return adminError(
            409,
            "LAWYER_NOT_ELIGIBLE",
            "این وکیل برای تخصیص مجاز نیست (تأییدنشده)."
          );
        }
      }
      const before = getRequestById(b);
      const res = assignRequestLawyer({
        requestId: b,
        lawyerId,
        actorId: actor.userId,
        actorRole: actor.role,
        note: lawyerId ? "تخصیص وکیل توسط پشتیبانی" : "حذف وکیل توسط پشتیبانی",
        // Admin-initiated: keep the support note out of the client/lawyer timeline.
        noteVisibility: "internal",
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

    // --- §5 — shift one deadline, with a recorded reason ---
    if ("slaOverride" in body) {
      const raw = body["slaOverride"];
      if (!raw || typeof raw !== "object") {
        return adminError(400, "INVALID_BODY", "اطلاعات تغییر مهلت نامعتبر است");
      }
      const o = raw as Body;
      const phase = o["phase"];
      if (phase !== "RESPONSE" && phase !== "COMPLETION") {
        return adminError(400, "INVALID_PHASE", "فاز مهلت باید «پاسخ» یا «تکمیل» باشد.");
      }
      const nextDueRaw = o["nextDueAt"];
      const res = overrideRequestDeadline({
        requestId: b,
        actor: { userId: actor.userId, role: actor.role },
        phase: phase as SlaPhase,
        nextDueAt:
          nextDueRaw === null || nextDueRaw === "" || nextDueRaw === undefined
            ? null
            : String(nextDueRaw),
        reason: str(o["reason"]),
      });
      if (!res.ok) {
        if (res.reason === "not_found") return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
        if (res.reason === "invalid_input") {
          return adminError(400, "INVALID_INPUT", res.messageFa);
        }
        return adminError(409, "SLA_CONFLICT", res.messageFa);
      }
      // `overrideRequestDeadline` writes its own audit row (with the reason and
      // both instants); nothing more to record here.
      return ok(res.request);
    }

    // --- §8 — re-refer to another lawyer, with a recorded reason ---
    if ("reassignTo" in body) {
      const lawyerId = str(body["reassignTo"]);
      const profile = listLawyerProfiles().find((l) => l.id === lawyerId);
      if (!profile) return adminError(404, "LAWYER_NOT_FOUND", "وکیل یافت نشد");
      if (lawyerDecisionBucket(profile.verificationStatus) !== "APPROVED") {
        return adminError(409, "LAWYER_NOT_ELIGIBLE", "این وکیل برای ارجاع مجدد مجاز نیست.");
      }
      const res = reassignRequest({
        requestId: b,
        actor: { userId: actor.userId, role: actor.role },
        lawyerId,
        reason: str(body["reason"]),
      });
      if (!res.ok) {
        if (res.reason === "not_found") return adminError(404, "NOT_FOUND", "درخواست یافت نشد");
        if (res.reason === "invalid_input") {
          return adminError(400, "INVALID_INPUT", res.messageFa);
        }
        return adminError(409, "ILLEGAL_REASSIGN", res.messageFa);
      }
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
        note:
          typeof body["note"] === "string" ? (body["note"] as string) : "تغییر وضعیت توسط پشتیبانی",
        // Admin-originated note: never surfaced in the client/lawyer timeline.
        noteVisibility: "internal",
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
    if (
      typeof status !== "string" ||
      !(ANNOUNCEMENT_STATUSES as readonly string[]).includes(status)
    ) {
      return adminError(400, "INVALID_STATUS", "وضعیت نامعتبر است");
    }
    const res = setAnnouncementStatus(
      b,
      status as (typeof ANNOUNCEMENT_STATUSES)[number],
      actor.userId
    );
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

  // §5 — edit one service's SLA policy. The body is the full policy (the
  // store validates every field); the service key is taken from the path so
  // a save can never silently relocate a policy.
  if (a === "sla" && b === "policies" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    // `audience` / `priority` / `status` are validated by the store: passing an
    // unrecognised value straight through is what lets it say WHY it refused
    // rather than silently coercing to a default the operator never picked.
    // `status` is only forwarded when supplied, so an older client that still
    // sends `enabled` keeps working untouched.
    const input: SlaPolicyInput = {
      serviceKey: c,
      labelFa: str(body["labelFa"]),
      audience: body["audience"] as SlaPolicyInput["audience"],
      priority: body["priority"] as SlaPolicyInput["priority"],
      responseHours: num(body["responseHours"]),
      completionHours: num(body["completionHours"]),
      clock: body["clock"] === "BUSINESS_HOURS" ? "BUSINESS_HOURS" : "CALENDAR",
      pauseBehavior: body["pauseBehavior"] === "CONTINUE" ? "CONTINUE" : "PAUSE",
      warnBeforeHours: num(body["warnBeforeHours"]),
      // Only forward a lifecycle field that was actually sent: a partial PATCH
      // must never re-activate a policy the operator paused on purpose.
      ...(typeof body["status"] === "string"
        ? { status: body["status"] as SlaPolicyInput["status"] }
        : typeof body["enabled"] === "boolean"
          ? { enabled: body["enabled"] }
          : {}),
    };
    const res = saveSlaPolicy(input, actor);
    if (!res.ok) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "sla.policy.update",
        resourceType: "sla_policy",
        resourceId: c,
        result: "denied",
        reason: res.messageFa,
        ...meta,
      });
      return adminError(400, "INVALID_POLICY", res.messageFa);
    }
    return ok(res.policy);
  }
  if (a === "sla" && b === "policies") {
    return adminError(400, "BAD_PATH", "شناسهٔ سرویس الزامی است");
  }

  // §5 — the platform working calendar (timezone, working days, hours,
  // holidays). The store validates it and audits every save.
  if (a === "sla" && b === "calendar") {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");
    const hours = body["hours"];
    const input = {
      timezone: str(body["timezone"]),
      workingDays: Array.isArray(body["workingDays"])
        ? (body["workingDays"] as unknown[]).map((x) => num(x, -1))
        : [],
      hours: {
        startTime:
          hours && typeof hours === "object" ? str((hours as Body)["startTime"]) : "",
        endTime: hours && typeof hours === "object" ? str((hours as Body)["endTime"]) : "",
      },
      holidays: Array.isArray(body["holidays"])
        ? (body["holidays"] as unknown[]).map((x) => str(x))
        : [],
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    };
    const res = saveWorkCalendar(input, actor);
    if (!res.ok) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "sla.calendar.update",
        resourceType: "platform_work_calendar",
        resourceId: "default",
        result: "denied",
        reason: res.messageFa,
        ...meta,
      });
      return adminError(400, "INVALID_CALENDAR", res.messageFa);
    }
    return ok(res.calendar);
  }

  // Per-source retry: re-run the real ingest for a source marked «ناموفق».
  // Checked BEFORE the plain `sources/:id` review branch, which would
  // otherwise shadow this deeper path.
  if (a === "rag" && b === "sources" && c && segments[3] === "retry") {
    const res = retryRagSource(c, actor.userId);
    if ("error" in res) {
      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        orgId: actor.orgId,
        action: "rag.source.retry",
        resourceType: "rag_source",
        resourceId: c,
        result: "denied",
        reason: res.error,
        ...meta,
      });
      if (res.error === "NOT_FOUND") return adminError(404, "NOT_FOUND", res.message ?? "منبع یافت نشد");
      if (res.error === "STILL_FAILING") {
        return adminError(409, "STILL_FAILING", res.message ?? "فایل منبع هنوز خوانده نمی‌شود");
      }
      return mapDataError(res.error);
    }
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "rag.source.retry",
      resourceType: "rag_source",
      resourceId: c,
      after: { reviewState: res.reviewState, activeInRetrieval: res.activeInRetrieval },
      ...meta,
    });
    return ok(res);
  }

  if (a === "rag" && b === "sources" && c) {
    const body = (await readJson(request)) as Body | null;
    if (!body) return adminError(400, "INVALID_BODY", "بدنه درخواست نامعتبر است");

    const before = getRagSource(c);
    if (!before) return adminError(404, "NOT_FOUND", "منبع یافت نشد");

    // The review state is a closed vocabulary. An unknown string would persist
    // as a state the UI cannot render and retrieval cannot reason about.
    const KNOWN_STATES: RagReviewState[] = [
      "ingested",
      "extracted",
      "indexed",
      "under_review",
      "approved",
      "published",
      "retired",
      "failed",
    ];
    const rawState = body["reviewState"];
    if (typeof rawState !== "string" || !KNOWN_STATES.includes(rawState as RagReviewState)) {
      return adminError(400, "INVALID_STATUS", "وضعیت بازبینی نامعتبر است");
    }
    if (body["enabled"] !== undefined && typeof body["enabled"] !== "boolean") {
      return adminError(400, "INVALID_BODY", "وضعیت فعال/غیرفعال نامعتبر است");
    }

    const res = updateRagReview({
      sourceId: c,
      reviewState: rawState as RagReviewState,
      reviewerUserId: actor.userId,
      publishedInLibrary:
        body["publishedInLibrary"] === undefined ? undefined : Boolean(body["publishedInLibrary"]),
      enabled: typeof body["enabled"] === "boolean" ? (body["enabled"] as boolean) : undefined,
      notes: typeof body["notes"] === "string" ? (body["notes"] as string) : undefined,
      evalScore:
        body["evalScore"] === undefined || body["evalScore"] === null
          ? undefined
          : num(body["evalScore"]),
    });
    if ("error" in res) return mapDataError(res.error);
    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      orgId: actor.orgId,
      action: "rag.review.update",
      resourceType: "rag_source",
      resourceId: c,
      before: {
        reviewState: before.reviewState,
        enabled: before.enabled,
        activeInRetrieval: before.activeInRetrieval,
      },
      after: {
        reviewState: res.reviewState,
        enabled: res.enabled,
        publishedInLibrary: res.publishedInLibrary,
        activeInRetrieval: res.activeInRetrieval,
      },
      ...meta,
    });
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
    case "overview":
      return "admin:overview:read";
    // The live snapshot is a projection of the overview, so it needs the same
    // read permission — a viewer who cannot read the overview cannot read it.
    case "live":
      return "admin:overview:read";
    case "reports":
      return method === "GET" ? "admin:reports:read" : "admin:reports:export";
    case "exports":
      // §9 — exporting a surface requires the READ permission of that very
      // surface (audit export → admin:audit:read, …), never a generic one.
      return b && isAdminExportKind(b) ? ADMIN_EXPORT_PERMISSION[b] : "admin:reports:export";
    case "users":
      // `users/:id/energy` is an energy mutation → its own permission;
      // `users/:id/usage` reads the consumption ledger → energy read. The
      // subscription sub-route stays under users:manage.
      if (segments[2] === "energy" || segments[2] === "usage" || segments[2] === "tariff-history") {
        return method === "GET" ? "admin:energy:read" : "admin:energy:manage";
      }
      // §8 — a user's request/referral history is REQUEST data, not identity
      // data: an operator who may read requests but not edit user records
      // still needs it, and one who may edit identity but not requests must
      // not acquire it here.
      if (segments[2] === "requests") return "admin:requests:read";
      return method === "GET" ? "admin:users:read" : "admin:users:manage";
    case "requests":
      return method === "GET" ? "admin:requests:read" : "admin:requests:manage";
    // The discovery analytics surface reads the same records the requests
    // section does, so it is gated by the same read permission.
    case "discovery":
      return "admin:requests:read";
    case "flags":
      return "admin:flags:manage";
    // Reading the catalog is a plans-read capability; CREATE/EDIT/PUBLISH a
    // plan is a system-level change, reserved to the super-admin (matches the
    // concrete /admin/plans/[code] route and the page's edit gate).
    case "plans":
      return method === "GET" ? "admin:plans:read" : "admin:system:manage";
    case "orders":
      return method === "GET" ? "admin:billing:read" : "admin:billing:manage";
    // Coupons are a sales/discount capability: reading the catalog aligns with
    // sales reporting (billing:read); creating/editing/archiving is a
    // billing:manage mutation.
    case "coupons":
      return method === "GET" ? "admin:billing:read" : "admin:billing:manage";
    case "refunds":
      return "admin:refund:approve";
    case "finance":
      return method === "GET" ? "admin:finance:read" : "admin:finance:manage";
    case "settlements":
      return b && method === "GET" ? "admin:finance:read" : "admin:settlement:manage";
    case "ai":
      return method === "GET" ? "admin:ai:read" : "admin:ai:manage";
    case "rag":
      return method === "GET" ? "admin:rag:read" : "admin:rag:manage";
    case "calculators":
      // The RULE layer (`calculators/rules*`) is a system-level, publish-gated
      // surface gated by its OWN Super-Admin-only permissions; the calc's
      // operational policy (`calculators/:slug`) stays under the manager pair.
      if (b === "rules") {
        return method === "GET" ? "admin:calculators:rules:read" : "admin:calculators:rules:manage";
      }
      return method === "GET" ? "admin:calculators:read" : "admin:calculators:manage";
    case "energy":
      return method === "GET" ? "admin:energy:read" : "admin:energy:manage";
    case "support":
      return method === "GET" ? "admin:support:read" : "admin:support:manage";
    case "content":
      return "admin:content:read";
    case "blog":
      return method === "GET" ? "admin:content:read" : "admin:content:manage";
    // The legal library has its OWN permission pair — distinct from the blog's,
    // so the two content workflows can be delegated independently.
    case "legal-library":
      return method === "GET" ? "admin:library:read" : "admin:library:manage";
    case "announcements":
      return method === "GET" ? "admin:content:read" : "admin:content:manage";
    case "staff":
      return method === "GET" ? "admin:staff:read" : "admin:staff:manage";
    // Judicial has TWO capability pairs, deliberately separate:
    //   • the service catalog + questionnaire versions are a services surface;
    //   • the review/order queue and its decisions carry applicant data and
    //     produce a legal artifact, so they need their OWN pair — an operator
    //     who may reorder the catalog must not thereby read someone's
    //     submitted draft or approve it.
    case "judicial": {
      if (b === "reviews" || b === "orders") {
        return method === "GET" ? "admin:judicial:read" : "admin:judicial:review";
      }
      return method === "GET" ? "admin:services:read" : "admin:services:manage";
    }
    case "roles":
      return "admin:staff:read";
    case "audit":
      return "admin:audit:read";
    // §5 — the SLA policies and working calendar are platform configuration,
    // so they ride on the same settings pair. A read-only operator can inspect
    // the deadlines; only a settings manager may move them.
    case "sla":
      return method === "GET" ? "admin:settings:read" : "admin:settings:manage";
    case "settings":
      return method === "GET" ? "admin:settings:read" : "admin:settings:manage";
    default:
      return "admin:overview:read";
  }
}

interface RouteParams {
  params: Promise<{ segments?: string[] }>;
}

async function dispatch(
  request: NextRequest,
  method: string,
  params: RouteParams["params"]
): Promise<NextResponse> {
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
