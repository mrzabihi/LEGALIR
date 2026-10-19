// ============================================================
// LEGALIR — Lawyer portal projections (server-only, read paths)
// ============================================================
// Every number the lawyer sees is derived here from stored rows. There is
// no seeded/fabricated counter: a lawyer with no referrals sees zeros, and
// each KPI carries the request ids behind it (`buckets`) so the dashboard
// can deep-link every number into the filtered referral list.
//
// Access model: callers pass the lawyer's own profile id, obtained from the
// authenticated user. Nothing here trusts a request id on its own — the
// detail builder returns `null` when the request is not assigned to the
// lawyer, and the caller maps that to 404.
// ============================================================

import {
  DEFAULT_SLA_SERVICE_KEY,
  LEGAL_REQUEST_STATE_FA,
  REQUEST_ACTION_FA,
  type LegalRequest,
  type LegalRequestEvent,
  type LawyerDashboard,
  type LawyerDashboardCounts,
  type LawyerProfile,
  type LawyerProfileCompleteness,
  type LawyerProfileGap,
  type LawyerReferralDetail,
  type LawyerReferralListItem,
  type LawyerReferralListResponse,
  type LawyerReferralTrendPoint,
  type LawyerServiceRate,
  type PlatformRole,
  type RequestTimelineEntry,
  type ServiceSlaPolicy,
  type SlaHealth,
  type SlaSnapshot,
  type V1DocumentDetail,
} from "@legalir/types";
import { findUserById, getProfile, readTable } from "../db";
import { getOrganizationById } from "../org-db";
import { getLawyerProfileByUserId } from "../lawyer-db";
import { getThreadByRequestId, listMessages } from "../consultation-message-db";
import { buildReferrals } from "../lawyer-workspace";
import { listRequestEvents } from "../legal-request-db";
import { maskMobileMiddle } from "../admin/mobile";
import {
  ensureRequestSla,
  getBankRecord,
  getLawyerRate,
  getSlaPolicyForService,
  getWorkCalendar,
  listLawyerRates,
  listRequestActions,
  observeSla,
} from "./store";
import { activeDueAt, formatRemaining, slaSnapshot } from "./sla";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Iranian civil date key (`YYYY-MM-DD`) in the platform timezone. */
const TEHRAN = "Asia/Tehran";

function tehranDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Requests whose state still obliges the lawyer to act. */
const OPEN_STATES = new Set([
  "LAWYER_SELECTED",
  "WAITING_FOR_ACCEPTANCE",
  "ACCEPTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING_FOR_CLIENT",
  "WAITING_FOR_LAWYER",
]);

function clientDisplay(userId: string): string {
  const name = getProfile(userId).displayName?.trim();
  return name && name.length > 0 ? name : "موکل";
}

interface ClientIdentity {
  displayName: string;
  mobileMasked: string | null;
  organizationName: string | null;
  representativeName: string | null;
  representativeMobileMasked: string | null;
  orgId: string | null;
}

/**
 * Resolve who the client is. A company request must show the organization and
 * its representative — never the individual's details — and vice versa, so
 * the branch is chosen from the request's own `orgId`, not from the user's
 * current account type (which may change later).
 */
function resolveClient(request: LegalRequest): ClientIdentity {
  const user = findUserById(request.userId);
  const profile = getProfile(request.userId);
  const orgId = request.orgId ?? user?.orgId ?? null;
  const org = orgId ? getOrganizationById(orgId) : undefined;

  if (org) {
    return {
      displayName: org.name,
      mobileMasked: null,
      organizationName: org.name,
      representativeName: profile.displayName?.trim() || null,
      representativeMobileMasked: user?.mobile ? maskMobileMiddle(user.mobile) : null,
      orgId: org.id,
    };
  }

  return {
    displayName: clientDisplay(request.userId),
    mobileMasked: user?.mobile ? maskMobileMiddle(user.mobile) : null,
    organizationName: null,
    representativeName: null,
    representativeMobileMasked: null,
    orgId: null,
  };
}

/** The request's service label, falling back to its category. */
function serviceLabel(serviceKey: string | null | undefined, category: string): string {
  const policy = getSlaPolicyForService(serviceKey ?? DEFAULT_SLA_SERVICE_KEY);
  if (serviceKey && policy.serviceKey === serviceKey) return policy.labelFa;
  return category;
}

function snapshotFor(request: LegalRequest, policy: ServiceSlaPolicy, now: string): SlaSnapshot {
  return slaSnapshot({
    state: request.sla ?? null,
    policy,
    calendar: getWorkCalendar(),
    requestState: request.state,
    now,
  });
}

/**
 * Every request this lawyer has a stake in: currently assigned, or previously
 * assigned and acted upon (a reassigned/declined request stays in the
 * lawyer's records forever).
 */
function referralsFor(lawyerId: string, lawyerUserId: string): LegalRequest[] {
  const rows = readTable<LegalRequest>("legal_requests");
  const actedRequestIds = new Set(
    readTable<LegalRequestEvent>("legal_request_events")
      .filter((e) => e.actorId === lawyerUserId)
      .map((e) => e.requestId)
  );
  return rows
    .filter((r) => r.selectedLawyerId === lawyerId || actedRequestIds.has(r.id))
    .map((r) => observeSla(ensureRequestSla(r)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function perspectiveOf(
  request: LegalRequest,
  sla: SlaSnapshot
): LawyerReferralListItem["perspective"] {
  if (
    request.state === "COMPLETED" ||
    request.state === "DECLINED" ||
    request.state === "CANCELLED" ||
    request.state === "CLOSED"
  ) {
    return "DONE";
  }
  if (request.state === "WAITING_FOR_CLIENT") return "WAITING_ON_CLIENT";
  if (sla.health === "BREACHED" || sla.health === "AT_RISK") return "NEEDS_ACTION";
  if (request.state === "WAITING_FOR_ACCEPTANCE") {
    return request.sla?.viewedAt ? "ACTIVE" : "NEEDS_ACTION";
  }
  return "ACTIVE";
}

// ---------------------------------------------------------------------------
// KPI buckets
// ---------------------------------------------------------------------------

function emptyBuckets(): Record<keyof LawyerDashboardCounts, string[]> {
  return {
    newAssignments: [],
    viewed: [],
    accepted: [],
    inProgress: [],
    waitingForClient: [],
    completed: [],
    declined: [],
    cancelled: [],
    atRisk: [],
    breached: [],
  };
}

/**
 * Classify each request into the dashboard KPI buckets. Exported because the
 * referral list reuses it: a dashboard stat links to the list filtered by the
 * SAME predicate that produced the number, so the count and the rows can never
 * disagree.
 */
export function classify(
  requests: LegalRequest[],
  policyOf: (r: LegalRequest) => ServiceSlaPolicy,
  now: string
): { counts: LawyerDashboardCounts; buckets: Record<keyof LawyerDashboardCounts, string[]> } {
  const buckets = emptyBuckets();

  for (const request of requests) {
    const snapshot = snapshotFor(request, policyOf(request), now);
    const open = OPEN_STATES.has(request.state);

    switch (request.state) {
      case "WAITING_FOR_ACCEPTANCE":
        if (request.sla?.viewedAt) buckets.viewed.push(request.id);
        else buckets.newAssignments.push(request.id);
        break;
      case "ACCEPTED":
      case "SCHEDULED":
        buckets.accepted.push(request.id);
        break;
      case "IN_PROGRESS":
      case "WAITING_FOR_LAWYER":
        buckets.inProgress.push(request.id);
        break;
      case "WAITING_FOR_CLIENT":
        buckets.waitingForClient.push(request.id);
        break;
      case "COMPLETED":
        buckets.completed.push(request.id);
        break;
      case "DECLINED":
        buckets.declined.push(request.id);
        break;
      case "CANCELLED":
        buckets.cancelled.push(request.id);
        break;
      default:
        break;
    }

    // SLA buckets are orthogonal to the state buckets: the same request can
    // appear in "in progress" and in "at risk".
    if (open && snapshot.atRisk) buckets.atRisk.push(request.id);
    if (open && snapshot.breached) buckets.breached.push(request.id);
  }

  const counts = Object.fromEntries(
    Object.entries(buckets).map(([k, ids]) => [k, ids.length])
  ) as unknown as LawyerDashboardCounts;

  return { counts, buckets };
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

function buildTrend(requests: LegalRequest[], days: number, now: Date): LawyerReferralTrendPoint[] {
  const points: LawyerReferralTrendPoint[] = [];
  const byDate = new Map<string, LawyerReferralTrendPoint>();
  const todayKey = tehranDateKey(now.toISOString());

  // Build the empty axis from today backwards so the chart has no gaps.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = tehranDateKey(d.toISOString());
    const point: LawyerReferralTrendPoint = {
      date: key,
      referred: 0,
      accepted: 0,
      completed: 0,
      declined: 0,
    };
    byDate.set(key, point);
    points.push(point);
  }

  const bump = (iso: string | null | undefined, field: keyof Omit<LawyerReferralTrendPoint, "date">) => {
    if (!iso) return;
    const key = tehranDateKey(iso);
    const point = byDate.get(key);
    if (!point || key > todayKey) return;
    point[field] += 1;
  };

  for (const request of requests) {
    bump(request.sla?.assignedAt, "referred");
    bump(request.sla?.acceptedAt, "accepted");
    bump(request.sla?.completedAt, "completed");
    bump(request.sla?.declinedAt, "declined");
  }

  return points;
}

// ---------------------------------------------------------------------------
// Action items + summary
// ---------------------------------------------------------------------------

function buildActionItems(
  requests: LegalRequest[],
  policyOf: (r: LegalRequest) => ServiceSlaPolicy,
  now: string
): LawyerDashboard["actionItems"] {
  const items: LawyerDashboard["actionItems"] = [];

  for (const request of requests) {
    const snapshot = snapshotFor(request, policyOf(request), now);

    if (request.state === "WAITING_FOR_ACCEPTANCE" && !request.sla?.viewedAt) {
      items.push({
        kind: "new",
        requestId: request.id,
        title: request.title,
        detailFa: "درخواست جدید ارجاع‌شده — هنوز باز نشده است.",
        weight: 80,
      });
      continue;
    }

    if (request.state === "WAITING_FOR_ACCEPTANCE" && request.sla?.viewedAt) {
      items.push({
        kind: "accept",
        requestId: request.id,
        title: request.title,
        detailFa: "باز شده اما هنوز پذیرش یا رد نشده است.",
        weight: 70,
      });
    }

    if (snapshot.breached) {
      items.push({
        kind: "sla",
        requestId: request.id,
        title: request.title,
        detailFa: `مهلت گذشته است — ${formatRemaining(snapshot.remainingMs)}.`,
        weight: 100,
      });
    } else if (snapshot.atRisk) {
      items.push({
        kind: "sla",
        requestId: request.id,
        title: request.title,
        detailFa: `نزدیک مهلت — ${formatRemaining(snapshot.remainingMs)}.`,
        weight: 90,
      });
    }

    if (request.state === "WAITING_FOR_CLIENT") {
      items.push({
        kind: "info",
        requestId: request.id,
        title: request.title,
        detailFa: "در انتظار پاسخ یا اطلاعات از سوی موکل.",
        weight: 20,
      });
    }

    if (request.state === "IN_PROGRESS" || request.state === "WAITING_FOR_LAWYER") {
      items.push({
        kind: "reply",
        requestId: request.id,
        title: request.title,
        detailFa: "در حال انجام — نتیجه یا پیام تازه ثبت نشده است.",
        weight: 40,
      });
    }
  }

  return items.sort((a, b) => b.weight - a.weight).slice(0, 12);
}

function buildSummaryFa(
  counts: LawyerDashboardCounts,
  actionItems: { detailFa: string; title: string }[],
  complete: boolean
): string {
  const parts: string[] = [];
  if (counts.breached > 0) parts.push(`${counts.breached} درخواست از مهلت گذشته است`);
  if (counts.atRisk > 0) parts.push(`${counts.atRisk} درخواست نزدیک مهلت است`);
  if (counts.newAssignments > 0) parts.push(`${counts.newAssignments} درخواست جدید باز نشده است`);
  if (counts.viewed > 0) parts.push(`${counts.viewed} درخواست باز‌شده منتظر تصمیم شماست`);
  if (counts.waitingForClient > 0) parts.push(`${counts.waitingForClient} درخواست منتظر پاسخ موکل است`);

  const head =
    parts.length > 0
      ? `اکنون: ${parts.join("، ")}.`
      : "هیچ کار عقب‌افتاده‌ای ندارید؛ همهٔ درخواست‌ها در محدودهٔ مهلت هستند.";
  const next = actionItems[0] ? ` اولویت نخست: «${actionItems[0].title}».` : "";
  const profileNote = complete ? "" : " تکمیل پروفایل حرفه‌ای برای دریافت ارجاع تازه لازم است.";
  return `${head}${next}${profileNote}`;
}

// ---------------------------------------------------------------------------
// Profile completeness
// ---------------------------------------------------------------------------

export function profileCompleteness(profile: LawyerProfile | null): LawyerProfileCompleteness {
  if (!profile) {
    return {
      complete: false,
      percent: 0,
      missing: [
        { key: "profile", labelFa: "پروفایل حرفه‌ای ایجاد نشده است", href: "/lawyer/profile" },
      ],
      acceptingReferrals: false,
    };
  }

  const rates = listLawyerRates(profile.id);
  const missing: LawyerProfileGap[] = [];
  const check = (ok: boolean, gap: LawyerProfileGap) => {
    if (!ok) missing.push(gap);
  };

  check(Boolean(profile.fullName?.trim()), {
    key: "fullName",
    labelFa: "نام و نام خانوادگی",
    href: "/lawyer/profile",
  });
  check(Boolean(profile.licenseNumber?.trim()), {
    key: "licenseNumber",
    labelFa: "شمارهٔ پروانهٔ وکالت",
    href: "/lawyer/profile",
  });
  check(Boolean(profile.professionalTitle?.trim()), {
    key: "professionalTitle",
    labelFa: "عنوان حرفه‌ای",
    href: "/lawyer/profile",
  });
  check(profile.specializations.length > 0, {
    key: "specializations",
    labelFa: "تخصص‌ها",
    href: "/lawyer/profile",
  });
  check(profile.locations.length > 0, {
    key: "locations",
    labelFa: "شهر و محدودهٔ خدمات",
    href: "/lawyer/profile",
  });
  check(Boolean(profile.bio?.trim()), {
    key: "bio",
    labelFa: "معرفی کوتاه",
    href: "/lawyer/profile",
  });
  check(rates.length > 0, {
    key: "rates",
    labelFa: "نرخ خدمات",
    href: "/lawyer/rates",
  });

  const total = 7;
  const percent = Math.round(((total - missing.length) / total) * 100);
  const complete = missing.length === 0;

  return {
    complete,
    percent,
    missing,
    // A lawyer who is suspended or has left the marketplace cannot receive
    // referrals, regardless of profile completeness.
    acceptingReferrals:
      complete &&
      profile.acceptingRequests &&
      profile.verificationStatus !== "REJECTED" &&
      profile.verificationStatus !== "SUSPENDED" &&
      !profile.deletedAt,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function buildLawyerDashboard(params: { userId: string; now?: Date }): LawyerDashboard {
  const nowDate = params.now ?? new Date();
  const now = nowDate.toISOString();
  const profile = getLawyerProfileByUserId(params.userId) ?? null;
  const lawyerId = profile?.id ?? null;

  if (!profile || !lawyerId) {
    return {
      counts: {
        newAssignments: 0,
        viewed: 0,
        accepted: 0,
        inProgress: 0,
        waitingForClient: 0,
        completed: 0,
        declined: 0,
        cancelled: 0,
        atRisk: 0,
        breached: 0,
      },
      trend: buildTrend([], 30, nowDate),
      actionItems: [],
      summaryFa: "پروفایل حرفه‌ای وکیل برای این حساب ثبت نشده است.",
      profileCompleteness: profileCompleteness(null),
      bankStatus: "NOT_SET",
      lawyerId: null,
      profile: null,
      buckets: emptyBuckets(),
      referrals: [],
      generatedAt: now,
    };
  }

  const requests = referralsFor(lawyerId, params.userId);
  const policyOf = (r: LegalRequest) => getSlaPolicyForService(r.sla?.serviceKey ?? r.serviceKey);
  const { counts, buckets } = classify(requests, policyOf, now);
  const actionItems = buildActionItems(requests, policyOf, now);
  const completeness = profileCompleteness(profile);

  return {
    counts,
    trend: buildTrend(requests, 30, nowDate),
    actionItems,
    summaryFa: buildSummaryFa(counts, actionItems, completeness.complete),
    profileCompleteness: completeness,
    bankStatus: getBankRecord(lawyerId).status,
    lawyerId,
    profile,
    buckets,
    // The same unified referral projection the workspace endpoint serves:
    // one row per referral, tagged with every surface it belongs to, so the
    // dashboard's «ارجاعات شما» section never shows a referral twice.
    referrals: buildReferrals(params.userId, lawyerId, requests),
    generatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Referral list
// ---------------------------------------------------------------------------

export interface ReferralListQuery {
  serviceKey?: string | null;
  state?: string | null;
  perspective?: LawyerReferralListItem["perspective"] | null;
  slaHealth?: SlaHealth | null;
  fromIso?: string | null;
  toIso?: string | null;
  search?: string | null;
  /**
   * One dashboard KPI bucket (e.g. `newAssignments`, `breached`). Filtering by
   * bucket reuses the exact predicate behind the KPI, so a stat's deep link
   * lists precisely the requests it counted.
   */
  bucket?: keyof LawyerDashboardCounts | null;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "due";
}

export function buildReferralList(params: {
  lawyerId: string;
  userId: string;
  query?: ReferralListQuery;
  now?: Date;
}): LawyerReferralListResponse {
  const now = (params.now ?? new Date()).toISOString();
  const query = params.query ?? {};
  const all = referralsFor(params.lawyerId, params.userId);

  const items: LawyerReferralListItem[] = all.map((request) => {
    const policy = getSlaPolicyForService(request.sla?.serviceKey ?? request.serviceKey);
    const snapshot = snapshotFor(request, policy, now);
    const client = resolveClient(request);
    const actions = listRequestActions(request.id).filter((a) => a.visibility !== "internal");
    const last = actions[actions.length - 1];
    const lastEvent = listRequestEvents(request.id).slice(-1)[0];
    const lastActivityAt =
      [last?.createdAt, lastEvent?.createdAt, request.updatedAt]
        .filter((v): v is string => Boolean(v))
        .sort()
        .slice(-1)[0] ?? request.updatedAt;
    const lastActivityFa = last
      ? REQUEST_ACTION_FA[last.kind]
      : lastEvent?.toState
        ? LEGAL_REQUEST_STATE_FA[lastEvent.toState]
        : LEGAL_REQUEST_STATE_FA[request.state];

    return {
      requestId: request.id,
      title: request.title,
      serviceKey: request.sla?.serviceKey ?? request.serviceKey ?? null,
      serviceLabelFa: serviceLabel(request.sla?.serviceKey ?? request.serviceKey, request.category),
      requestCategory: request.category,
      requestCategoryLabelFa: request.category,
      state: request.state,
      stateLabelFa: LEGAL_REQUEST_STATE_FA[request.state],
      clientName: client.displayName,
      organizationName: client.organizationName,
      referredAt: request.sla?.assignedAt ?? request.createdAt,
      lastActivityAt,
      lastActivityFa,
      sla: snapshot,
      perspective: perspectiveOf(request, snapshot),
    };
  });

  // Facets are computed over the unfiltered set so the filter UI always
  // offers the full option list, with counts.
  const serviceCounts = new Map<string, { labelFa: string; count: number }>();
  const stateCounts = new Map<string, number>();
  const slaCounts: Record<SlaHealth, number> = {
    ON_TRACK: 0,
    AT_RISK: 0,
    BREACHED: 0,
    PAUSED: 0,
    MET: 0,
    MISSED: 0,
    NONE: 0,
  };
  for (const item of items) {
    const key = item.serviceKey ?? DEFAULT_SLA_SERVICE_KEY;
    const entry = serviceCounts.get(key) ?? { labelFa: item.serviceLabelFa, count: 0 };
    entry.count += 1;
    serviceCounts.set(key, entry);
    stateCounts.set(item.state, (stateCounts.get(item.state) ?? 0) + 1);
    slaCounts[item.sla.health] += 1;
  }

  let filtered = items;

  if (query.bucket) {
    const policyOf = (r: LegalRequest) =>
      getSlaPolicyForService(r.sla?.serviceKey ?? r.serviceKey);
    const allowed = new Set(classify(all, policyOf, now).buckets[query.bucket]);
    filtered = filtered.filter((i) => allowed.has(i.requestId));
  }
  if (query.serviceKey) {
    filtered = filtered.filter(
      (i) => (i.serviceKey ?? DEFAULT_SLA_SERVICE_KEY) === query.serviceKey
    );
  }
  if (query.state) filtered = filtered.filter((i) => i.state === query.state);
  if (query.perspective) filtered = filtered.filter((i) => i.perspective === query.perspective);
  if (query.slaHealth) filtered = filtered.filter((i) => i.sla.health === query.slaHealth);
  if (query.fromIso) filtered = filtered.filter((i) => i.referredAt >= query.fromIso!);
  if (query.toIso) filtered = filtered.filter((i) => i.referredAt <= query.toIso!);
  if (query.search) {
    const needle = query.search.trim().toLowerCase();
    if (needle) {
      filtered = filtered.filter((i) =>
        [i.title, i.clientName, i.organizationName ?? "", i.requestId, i.serviceLabelFa]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
  }

  const sort = query.sort ?? "newest";
  filtered = [...filtered].sort((a, b) => {
    if (sort === "oldest") return a.referredAt.localeCompare(b.referredAt);
    if (sort === "due") {
      const aDue = a.sla.dueAt ? Date.parse(a.sla.dueAt) : Number.POSITIVE_INFINITY;
      const bDue = b.sla.dueAt ? Date.parse(b.sla.dueAt) : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    }
    return b.referredAt.localeCompare(a.referredAt);
  });

  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), totalPages);

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages,
    facets: {
      services: [...serviceCounts.entries()]
        .map(([value, v]) => ({ value, labelFa: v.labelFa, count: v.count }))
        .sort((a, b) => b.count - a.count),
      states: [...stateCounts.entries()]
        .map(([value, count]) => ({
          value: value as LawyerReferralListItem["state"],
          labelFa: LEGAL_REQUEST_STATE_FA[value as LawyerReferralListItem["state"]],
          count,
        }))
        .sort((a, b) => b.count - a.count),
      sla: slaCounts,
    },
  };
}

// ---------------------------------------------------------------------------
// Referral detail
// ---------------------------------------------------------------------------

function actorLabel(actorId: string, role: PlatformRole | "system"): string {
  if (role === "system") return "سامانهٔ لیگالیر";
  if (role === "LAWYER") {
    const name = getProfile(actorId).displayName?.trim();
    return name || "وکیل";
  }
  return clientDisplay(actorId);
}

function buildTimeline(request: LegalRequest, lawyerUserId: string): RequestTimelineEntry[] {
  const entries: RequestTimelineEntry[] = [];

  for (const event of listRequestEvents(request.id)) {
    entries.push({
      id: event.id,
      kind: "STATE",
      at: event.createdAt,
      actorLabel: actorLabel(event.actorId ?? "system", event.actorRole),
      actorRole: event.actorRole,
      titleFa: event.toState ? LEGAL_REQUEST_STATE_FA[event.toState] : "تغییر وضعیت",
      body: event.note,
      visibility: event.noteVisibility ?? "public",
      fromState: event.fromState,
      toState: event.toState,
    });
  }

  for (const action of listRequestActions(request.id)) {
    entries.push({
      id: action.id,
      kind: "ACTION",
      at: action.createdAt,
      actorLabel: actorLabel(action.actorId, action.actorRole),
      actorRole: action.actorRole,
      titleFa: REQUEST_ACTION_FA[action.kind],
      body: action.note,
      visibility: action.visibility ?? "public",
    });
  }

  const thread = getThreadByRequestId(request.id);
  if (thread) {
    for (const message of listMessages(thread.id)) {
      entries.push({
        id: message.id,
        kind: "MESSAGE",
        at: message.createdAt,
        actorLabel:
          message.senderUserId === lawyerUserId ? "شما" : clientDisplay(message.senderUserId),
        actorRole: message.senderRole,
        titleFa: "پیام",
        body: message.body,
        visibility: "public",
      });
    }
  }

  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

function allowedActionsFor(request: LegalRequest): LawyerReferralDetail["allowedActions"] {
  if (request.state === "CLOSED" || request.state === "CANCELLED") return [];
  const actions: LawyerReferralDetail["allowedActions"] = [];

  if (request.state === "WAITING_FOR_ACCEPTANCE") {
    if (!request.sla?.viewedAt) actions.push("VIEW");
    actions.push("ACCEPT", "DECLINE");
  }
  if (["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "WAITING_FOR_CLIENT"].includes(request.state)) {
    actions.push("START");
  }
  if (["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "WAITING_FOR_LAWYER"].includes(request.state)) {
    actions.push("REQUEST_INFO");
  }
  if (["IN_PROGRESS", "WAITING_FOR_CLIENT", "WAITING_FOR_LAWYER"].includes(request.state)) {
    actions.push("COMPLETE");
  }
  actions.push("SEND_MESSAGE", "ADD_NOTE");
  return actions;
}

/**
 * Build the lawyer's referral detail. Returns `null` when the request is not
 * this lawyer's — the route turns that into 404 without revealing existence.
 */
export function buildLawyerReferralDetail(params: {
  request: LegalRequest;
  lawyerId: string;
  lawyerUserId: string;
  now?: Date;
}): LawyerReferralDetail | null {
  const { request, lawyerId, lawyerUserId } = params;
  const isCurrentlyAssigned = request.selectedLawyerId === lawyerId;
  const hasActed = listRequestEvents(request.id).some((e) => e.actorId === lawyerUserId);
  if (!isCurrentlyAssigned && !hasActed) return null;

  const hydrated = observeSla(ensureRequestSla(request));
  const now = (params.now ?? new Date()).toISOString();
  const policy = getSlaPolicyForService(hydrated.sla?.serviceKey ?? hydrated.serviceKey);
  const snapshot = snapshotFor(hydrated, policy, now);
  const client = resolveClient(hydrated);

  const documents = readTable<V1DocumentDetail>("documents");
  const attachments = (hydrated.attachmentDocumentIds ?? [])
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is V1DocumentDetail => Boolean(d))
    .map((d) => ({
      id: d.id,
      name: d.name,
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
    }));

  const thread = getThreadByRequestId(hydrated.id);
  const messages = thread
    ? listMessages(thread.id).map((m) => ({
        id: m.id,
        senderName: m.senderUserId === lawyerUserId ? "شما" : clientDisplay(m.senderUserId),
        senderRole: m.senderRole,
        isMine: m.senderUserId === lawyerUserId,
        body: m.body,
        createdAt: m.createdAt,
        readAt: m.readAt,
      }))
    : [];

  const currentRate: LawyerServiceRate | null = getLawyerRate(
    lawyerId,
    hydrated.sla?.serviceKey ?? hydrated.serviceKey
  );

  const policyNoteFa =
    policy.pauseBehavior === "PAUSE"
      ? "ساعت پاسخ‌گویی هنگام انتظار برای پاسخ کاربر متوقف می‌شود."
      : "ساعت پاسخ‌گویی حتی هنگام انتظار برای پاسخ کاربر ادامه می‌یابد.";

  return {
    requestId: hydrated.id,
    title: hydrated.title,
    serviceKey: hydrated.sla?.serviceKey ?? hydrated.serviceKey ?? null,
    serviceLabelFa: serviceLabel(
      hydrated.sla?.serviceKey ?? hydrated.serviceKey,
      hydrated.category
    ),
    category: hydrated.category,
    categoryLabelFa: hydrated.category,
    state: hydrated.state,
    stateLabelFa: LEGAL_REQUEST_STATE_FA[hydrated.state],
    intakeAnswers: hydrated.intakeAnswers ?? {},
    client: {
      displayName: client.displayName,
      mobileMasked: client.mobileMasked,
      organizationName: client.organizationName,
      representativeName: client.representativeName,
      representativeMobileMasked: client.representativeMobileMasked,
    },
    referredAt: hydrated.sla?.assignedAt ?? hydrated.createdAt,
    sla: {
      snapshot,
      state: hydrated.sla ?? null,
      policy,
      pausesOnClientWait: policy.pauseBehavior === "PAUSE",
      policyNoteFa,
    },
    agreedRate: hydrated.agreedRate ?? null,
    currentRate,
    result: hydrated.result ?? null,
    attachments,
    timeline: buildTimeline(hydrated, lawyerUserId),
    messages,
    allowedActions: allowedActionsFor(hydrated),
    createdAt: hydrated.createdAt,
    updatedAt: hydrated.updatedAt,
  };
}

/** The due instant + countdown, for the list/detail header. */
export function describeDeadline(request: LegalRequest): {
  dueAt: string | null;
  remainingMs: number | null;
  remainingFa: string;
} {
  const hydrated = ensureRequestSla(request);
  const policy = getSlaPolicyForService(hydrated.sla?.serviceKey ?? hydrated.serviceKey);
  const snapshot = slaSnapshot({
    state: hydrated.sla ?? null,
    policy,
    calendar: getWorkCalendar(),
    requestState: hydrated.state,
  });
  return {
    dueAt: hydrated.sla ? activeDueAt(hydrated.sla) : null,
    remainingMs: snapshot.remainingMs,
    remainingFa: formatRemaining(snapshot.remainingMs),
  };
}
