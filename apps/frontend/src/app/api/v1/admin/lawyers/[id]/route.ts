// ============================================================
// LEGALIR — GET /api/v1/admin/lawyers/[id]  +  PATCH (profile update)
// ============================================================
// GET: the full registration dossier for one lawyer, for the admin detail
// drawer. Staff-only (`admin:lawyer:read`). Includes contact info (masked
// mobile + email), licence and activity data, specialities, locations, the
// derived lifecycle, the submitted documents, the complete decision history
// and the CURRENT reviews (with their moderation state) so the drawer can
// moderate them without a second round-trip.
//
// PATCH: apply a partial profile edit (the extended professional fields —
// rank, organisation, licence, gender, bio, expertise, services,
// jurisdictions, locations, pricing, visibility, featured). Gated on
// `admin:lawyer:update`. Every change is written to the platform audit trail
// with a before/after snapshot and, when the specialty set changes, a
// dedicated CHANGE_SPECIALTY record — so the public marketplace picks the
// edit up immediately and the operator's edit is fully attributable.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import {
  getLawyerProfileById,
  listStatusHistory,
  computePerformance,
  updateLawyerProfile,
  resolveAdminLifecycle,
  listLawyerReviewRecords,
  listLawyerReviewRows,
  listReviewEvents,
  listReviewReports,
  toReviewReportRecord,
} from "@/lib/lawyer-db";
import {
  findUserById,
  listMessagesForLawyerProfile,
} from "@/lib/db";
import { maskMobileMiddle } from "@/lib/admin/mobile";
import { recordAudit } from "@/lib/admin/audit";
import { requestMeta, readJson } from "@/lib/admin/http";
// The ledger roll-up: gross / fee / net / paid / outstanding for THIS lawyer,
// summed from the real settlement rows. Read-only — settlements are opened and
// moved on the finance surface, never from the lawyer dossier.
import { listLawyerSettlements, summarizeLawyerIncome } from "@/lib/admin/settlements";
// §6/§7 — the per-service prices and the settlement account are the SAME
// records the lawyer portal writes. The dossier reads them through the store
// so the operator never sees a parallel copy, and the bank account is rendered
// in its MASKED form — the full IBAN never leaves the owner's own surface.
import {
  clearLawyerRate,
  getBankRecord,
  listBankEvents,
  listLawyerRateChanges,
  listLawyerRates,
  maskBankAccount,
  replaceBankAccountAsAdmin,
  reviewBankAccount,
  setLawyerRate,
} from "@/lib/lawyer-portal/store";
import type { LawyerBankReview, LawyerRateUnit } from "@legalir/types";
import {
  lawyerDecisionBucket,
  type LawyerProfile,
  type LawyerExpertise,
  type LawyerServiceOffer,
  type LawyerLocation,
  type LawyerPricing,
} from "@legalir/types";

/** Mask a mobile with the panel-wide rule (four middle digits) for the drawer. */
function maskMobile(mobile: string | undefined): string {
  return maskMobileMiddle(mobile);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:read");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const profile = getLawyerProfileById(id);
  if (!profile) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const user = findUserById(profile.userId);
  const history = listStatusHistory(id);
  const messages = listMessagesForLawyerProfile(id);
  const reviews = listLawyerReviewRecords(id);
  const latest = history[0] ?? null;

  // Per-review moderation history + reports, so the drawer can show why a
  // review is withheld and who decided — without a second round-trip.
  const moderation = Object.fromEntries(
    listLawyerReviewRows(id).map((r) => [
      r.id,
      {
        events: listReviewEvents(r.id),
        reports: listReviewReports(r.id).map(toReviewReportRecord),
      },
    ])
  );

  return NextResponse.json({
    data: {
      profile: {
        ...profile,
        performance: computePerformance(id),
      },
      contact: {
        mobileMasked: maskMobile(user?.mobile),
        email: user?.email ?? null,
      },
      user: {
        id: profile.userId,
        displayName: user?.displayName ?? null,
        role: user?.role ?? "USER",
        accountType: user?.platformAccountType ?? "PERSONAL",
        createdAt: user?.createdAt ?? profile.createdAt,
      },
      bucket: lawyerDecisionBucket(profile.verificationStatus),
      lifecycle: resolveAdminLifecycle(profile),
      history,
      lastDecision: latest,
      messages,
      reviews,
      /** reviewId → { events, reports }, for the drawer's moderation panel. */
      moderation,
      stats: {
        messagesSent: messages.length,
        decisions: history.length,
        reviews: reviews.length,
        openReports: reviews.reduce((n, r) => n + r.openReports, 0),
      },
      // §6 — the prices the lawyer published, with the append-only history so
      // an operator can see when a rate moved and who moved it.
      rates: listLawyerRates(id),
      rateChanges: listLawyerRateChanges(id).slice(0, 30),
      // §7 — the settlement account in MASKED form plus its review trail. The
      // drawer must never render the full IBAN; only the owner's own page does.
      bank: (() => {
        const record = getBankRecord(id);
        return {
          ...record,
          account: record.account ? maskBankAccount(record.account) : null,
        };
      })(),
      bankEvents: listBankEvents(id).slice(0, 30),
      // The money side, read-only: the settled/owed split plus the ledger rows
      // behind it. When no settlement was ever opened the summary says so
      // (`hasData: false`) rather than reporting a zero that looks like income.
      income: summarizeLawyerIncome(id),
      settlements: listLawyerSettlements(id, 10),
    },
  });
}

/** Fields a profile PATCH may set. Anything else in the body is ignored. */
interface LawyerPatchBody {
  fullName?: string;
  bio?: string;
  professionalTitle?: string | null;
  professionalRank?: LawyerProfile["professionalRank"];
  organizationType?: LawyerProfile["organizationType"];
  licenseNumber?: string | null;
  licenseYear?: number | null;
  licenseAuthority?: string | null;
  licenseStatus?: LawyerProfile["licenseStatus"];
  gender?: LawyerProfile["gender"];
  featured?: boolean;
  acceptingClients?: boolean;
  /** The switch that decides whether new referrals reach this lawyer at all. */
  acceptingRequests?: boolean;
  avatarUrl?: string | null;
  visibility?: LawyerProfile["visibility"];
  yearsExperience?: number | null;
  expertise?: LawyerExpertise[];
  serviceIds?: string[];
  jurisdictionIds?: string[];
  locations?: LawyerLocation[];
  pricing?: LawyerPricing;
  reason?: string;
}

function pickPatch(body: LawyerPatchBody): Partial<LawyerProfile> {
  const patch: Partial<LawyerProfile> = {};
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  if (typeof body.fullName === "string") patch.fullName = body.fullName.trim();
  if (typeof body.bio === "string") patch.bio = body.bio;
  if ("professionalTitle" in body) patch.professionalTitle = str(body.professionalTitle) ?? null;
  if ("professionalRank" in body)
    patch.professionalRank = (body.professionalRank as LawyerProfile["professionalRank"]) ?? null;
  if ("organizationType" in body)
    patch.organizationType = (body.organizationType as LawyerProfile["organizationType"]) ?? null;
  if ("licenseNumber" in body) patch.licenseNumber = str(body.licenseNumber) ?? null;
  if ("licenseYear" in body)
    patch.licenseYear = typeof body.licenseYear === "number" ? body.licenseYear : null;
  if ("licenseAuthority" in body) patch.licenseAuthority = str(body.licenseAuthority) ?? null;
  if ("licenseStatus" in body)
    patch.licenseStatus = (body.licenseStatus as LawyerProfile["licenseStatus"]) ?? null;
  if ("gender" in body) patch.gender = (body.gender as LawyerProfile["gender"]) ?? null;
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (typeof body.acceptingClients === "boolean") patch.acceptingClients = body.acceptingClients;
  if (typeof body.acceptingRequests === "boolean") patch.acceptingRequests = body.acceptingRequests;
  if ("avatarUrl" in body) patch.avatarUrl = str(body.avatarUrl) ?? null;
  if ("visibility" in body)
    patch.visibility = (body.visibility as LawyerProfile["visibility"]) ?? null;
  if ("yearsExperience" in body)
    patch.yearsExperience = typeof body.yearsExperience === "number" ? body.yearsExperience : null;

  if (Array.isArray(body.expertise)) {
    patch.expertise = body.expertise as LawyerExpertise[];
    // Keep the flattened `specializations` in step with the expertise links so
    // legacy surfaces (search haystack, grouping) see the same nodes.
    patch.specializations = (body.expertise as LawyerExpertise[]).map((e) => ({
      category: e.taxonomyNodeId,
      yearsExperience: e.yearsExperience,
    }));
  }
  if (Array.isArray(body.serviceIds)) {
    patch.services = (body.serviceIds as string[]).map<LawyerServiceOffer>((serviceId) => ({
      serviceId,
      enabled: true,
    }));
  }
  if (Array.isArray(body.jurisdictionIds)) patch.jurisdictions = body.jurisdictionIds as string[];
  if (Array.isArray(body.locations)) patch.locations = body.locations as LawyerLocation[];
  if (body.pricing && typeof body.pricing === "object") patch.pricing = body.pricing as LawyerPricing;

  return patch;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:update");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as LawyerPatchBody | null;
  if (!body) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const before = getLawyerProfileById(id);
  if (!before) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const patch = pickPatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "هیچ فیلد قابل ویرایشی ارسال نشد" },
      { status: 400 }
    );
  }

  const updated = updateLawyerProfile(id, patch);
  if (!updated) {
    return NextResponse.json({ code: "NOT_FOUND", message: "وکیل یافت نشد" }, { status: 404 });
  }

  const meta = requestMeta(request);
  const reason = typeof body.reason === "string" ? body.reason : null;

  // Snapshot only the keys the caller actually touched, so the trail is legible.
  const beforeSnapshot: Record<string, unknown> = {};
  const afterSnapshot: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) {
    beforeSnapshot[key] = (before as unknown as Record<string, unknown>)[key] ?? null;
    afterSnapshot[key] = (updated as unknown as Record<string, unknown>)[key] ?? null;
  }

  const specialtyChanged = "expertise" in patch;
  recordAudit({
    actorUserId: auth.ctx.userId,
    actorRole: auth.ctx.role,
    orgId: auth.ctx.orgId,
    action: specialtyChanged ? "LAWYER_CHANGE_SPECIALTY" : "LAWYER_UPDATE",
    resourceType: "lawyer",
    resourceId: id,
    reason,
    before: beforeSnapshot,
    after: afterSnapshot,
    ...meta,
  });

  return NextResponse.json({ data: { id: updated.id, profile: updated } });
}

// ---------------------------------------------------------------------------
// POST — the operator's write sub-actions
// ---------------------------------------------------------------------------
// Everything an operator can DO to a lawyer beyond a profile PATCH lives here,
// as a single audited write per action:
//
//   VERIFY / REQUEST_CORRECTION — decide the settlement-account review. The
//     account is never returned in full, and the decision is recorded on the
//     account AND as an immutable event.
//   ADMIN_UPDATE_BANK — REPLACE the settlement account on the lawyer's behalf
//     (the lawyer asked support to fix a typo, or supplied it by phone). It is
//     stored as a distinct `ADMIN_UPDATED` event and still lands in
//     PENDING_REVIEW, so an operator edit is a correction and never a
//     self-approval. A reason is mandatory.
//   SET_RATE / CLEAR_RATE — set or remove one per-service price, through the
//     same `lawyer_rates` store the lawyer's own /lawyer/rates writes to, so
//     the marketplace and the portal show the operator's price immediately.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, "admin:lawyer:update");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = (await readJson(request)) as
    | (LawyerBankReview & {
        action?: string;
        submission?: {
          holderName?: string;
          bankName?: string;
          iban?: string;
          accountNumber?: string | null;
          cardLast4?: string | null;
          cardNumber?: string | null;
        };
        serviceKey?: string;
        amountToman?: number;
        unit?: LawyerRateUnit;
        noteFa?: string | null;
      })
    | null;
  if (!body) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" },
      { status: 400 }
    );
  }

  const actor = { userId: auth.ctx.userId, role: auth.ctx.role };

  if (body.action === "VERIFY" || body.action === "REQUEST_CORRECTION") {
    const res = reviewBankAccount({
      lawyerId: id,
      actor,
      review: { action: body.action, reason: body.reason },
    });
    if (!res.ok) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: res.messageFa }, { status: 400 });
    }
    return NextResponse.json({
      data: {
        ...res.record,
        account: res.record.account ? maskBankAccount(res.record.account) : null,
      },
    });
  }

  if (body.action === "ADMIN_UPDATE_BANK") {
    const sub = body.submission ?? {};
    const res = replaceBankAccountAsAdmin({
      lawyerId: id,
      actor,
      submission: {
        holderName: typeof sub.holderName === "string" ? sub.holderName : "",
        bankName: typeof sub.bankName === "string" ? sub.bankName : "",
        iban: typeof sub.iban === "string" ? sub.iban : "",
        accountNumber: typeof sub.accountNumber === "string" ? sub.accountNumber : null,
        cardLast4: typeof sub.cardLast4 === "string" ? sub.cardLast4 : null,
        cardNumber: typeof sub.cardNumber === "string" ? sub.cardNumber : null,
      },
      reason: typeof body.reason === "string" ? body.reason : "",
    });
    if (!res.ok) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: res.messageFa }, { status: 400 });
    }
    return NextResponse.json({
      data: {
        ...res.record,
        account: res.record.account ? maskBankAccount(res.record.account) : null,
      },
    });
  }

  if (body.action === "SET_RATE") {
    const res = setLawyerRate({
      lawyerId: id,
      actor,
      serviceKey: typeof body.serviceKey === "string" ? body.serviceKey : "",
      amountToman: typeof body.amountToman === "number" ? body.amountToman : Number.NaN,
      unit: (body.unit ?? "fixed") as LawyerRateUnit,
      noteFa: typeof body.noteFa === "string" ? body.noteFa : null,
    });
    if (!res.ok) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: res.messageFa }, { status: 400 });
    }
    return NextResponse.json({ data: { rate: res.rate } });
  }

  if (body.action === "CLEAR_RATE") {
    const res = clearLawyerRate({
      lawyerId: id,
      actor,
      serviceKey: typeof body.serviceKey === "string" ? body.serviceKey : "",
    });
    if (!res.ok) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "نرخی برای این خدمت ثبت نشده است" },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: { change: res.change } });
  }

  return NextResponse.json(
    { code: "VALIDATION_ERROR", message: "نوع تصمیم معتبر نیست" },
    { status: 400 }
  );
}
