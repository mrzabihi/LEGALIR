// ============================================================
// LEGALIR — /api/v1/cases/[id]
// ============================================================
// The single case detail endpoint. It returns the full v2 shape: the case,
// its primary proceeding, parties, members, documents, contracts, timeline,
// tasks, deadlines, engagements, representations and the computed next
// action — so the overview and the detail tabs never disagree.
//
// AUTHORIZATION: every branch goes through `resolveCaseAccess`. A caller
// with no access gets a 404 (never a 403) so the existence of a foreign
// case is never leaked. Private timeline events are filtered per viewer.
//
// CONCURRENCY: PATCH accepts an `expectedVersion`; a stale write returns
// 409 CONFLICT instead of silently clobbering another edit.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  updateCase,
  getCaseTimeline,
  getCaseTasks,
  getCaseDocuments,
  getCaseDeadlines,
  getCaseParties,
  getCaseMembers,
  getCaseProceedings,
  getCaseEngagements,
  getCaseRepresentations,
  getCaseContractLinks,
  addCaseTimelineEvent,
  type DbCase,
} from "@/lib/case-db";
import { resolveCaseAccess, canReadPrivateNote } from "@/lib/cases/access";
import {
  toCaseV2,
  toEvent,
  toTaskV2,
  toDeadlineV2,
  toParty,
  toMember,
  toProceeding,
  toEngagement,
  toRepresentation,
} from "@/lib/cases/dto";
import { computeNextAction, deriveOperationalState } from "@/lib/cases/domain";
import { listContractsForUser } from "@/lib/contracts/db";
import { getDemoDocument } from "@/lib/demo-seed";
import { recordActivity } from "@/lib/db";
import type { CaseUpdateRequest, CaseLifecycleStatus } from "@legalir/types";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** The primary proceeding is the first one recorded (creation order). */
/**
 * The case's primary proceeding — the one the overview and next-action read.
 * A case is created with a placeholder `other` proceeding; once the user
 * records a real path/stage, that proceeding must take over. We therefore
 * prefer the most recently updated proceeding, and only fall back to the
 * first when none has been touched.
 */
function primaryProceeding(caseId: string) {
  const all = getCaseProceedings(caseId);
  if (all.length === 0) return null;
  return [...all].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0]!;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });

  const c = access.case;
  const now = new Date();

  // --- Timeline: private events are filtered per viewer. ---
  const timeline = getCaseTimeline(id)
    .filter((e) => {
      if ((e.visibility ?? "shared") === "shared") return true;
      return canReadPrivateNote(access, e.recorded_by_user_id ?? "", userId);
    })
    .map(toEvent);

  // --- Tasks: a viewer/pending member may not read tasks. ---
  const tasks = access.canWrite || access.canBeAssigned ? getCaseTasks(id).map(toTaskV2) : [];

  // --- Deadlines: operational state is derived, never stored stale. ---
  const deadlines = getCaseDeadlines(id).map((row) => {
    const dto = toDeadlineV2(row);
    return { ...dto, operationalState: deriveOperationalState(dto, now) };
  });

  // --- Documents: each link is re-checked against the caller's own docs. ---
  const documents = access.canReadDocuments
    ? getCaseDocuments(id)
        .map((link) => {
          const doc = getDemoDocument(userId, link.document_id);
          if (!doc) return null;
          return {
            id: doc.id,
            name: doc.name,
            mime: doc.mime,
            sizeBytes: doc.sizeBytes,
            status: doc.status,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            linkedAt: link.created_at,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
    : [];

  // --- Contracts: scoped to the session user so a foreign one never leaks. ---
  const contractLinks = getCaseContractLinks(id);
  const contracts = listContractsForUser(userId)
    .filter((ct) => ct.caseId === id)
    .map((ct) => ({
      id: ct.id,
      referenceCode: ct.referenceCode,
      title: ct.title,
      typeFa: ct.typeFa,
      state: ct.state,
      progress: ct.progress,
      updatedAt: ct.updatedAt,
      kind: contractLinks.find((l) => l.contract_id === ct.id)?.kind ?? "other",
    }));

  const proceeding = primaryProceeding(id);
  const proceedings = getCaseProceedings(id).map(toProceeding);
  const parties = getCaseParties(id).map(toParty);
  const members = getCaseMembers(id).map(toMember);
  const engagements = getCaseEngagements(id).map(toEngagement);
  const representations = getCaseRepresentations(id).map(toRepresentation);

  const authorityInfoMissing = !proceeding || (!proceeding.authority && !proceeding.judicial_number);
  const nextAction = computeNextAction({
    deadlines,
    tasks,
    authorityInfoMissing,
    hasProceeding: proceeding !== null,
    now: now.toISOString(),
  });

  return NextResponse.json({
    data: {
      case: toCaseV2(c, access.role),
      proceeding: proceeding ? toProceeding(proceeding) : null,
      proceedings,
      parties,
      members,
      documents,
      contracts,
      timeline,
      tasks,
      deadlines,
      engagements,
      representations,
      nextAction,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.canWrite) {
    return NextResponse.json({ code: "FORBIDDEN", message: "دسترسی کافی ندارید" }, { status: 403 });
  }

  let body: CaseUpdateRequest & { expectedVersion?: number; lifecycle?: CaseLifecycleStatus; lifecycleReason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "درخواست نامعتبر است" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body["title"] !== undefined) updates["title"] = body["title"];
  if (body["description"] !== undefined) updates["description"] = body["description"];
  if (body["category"] !== undefined) updates["category"] = body["category"];
  if (body["status"] !== undefined) updates["status"] = body["status"];
  if (body["priority"] !== undefined) updates["priority"] = body["priority"];
  if (body.lifecycle !== undefined) {
    updates["lifecycle"] = body.lifecycle;
    updates["lifecycle_reason"] = body.lifecycleReason ?? null;
    updates["lifecycle_changed_at"] = new Date().toISOString();
  }

  const result = updateCase(id, updates, body.expectedVersion);
  if (!result) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: "به‌روزرسانی پرونده ناموفق بود" }, { status: 500 });
  }
  if ("conflict" in result) {
    return NextResponse.json(
      { code: "CONFLICT", message: "این پرونده توسط کاربر دیگری تغییر کرده است. لطفاً دوباره بارگذاری کنید." },
      { status: 409 }
    );
  }

  const updated: DbCase = result.case;
  recordActivity({
    userId,
    type: "case",
    title: updated.title,
    status: updated.status,
    statusFa: "به‌روزرسانی شد",
    description: updated.description.slice(0, 160),
    category: updated.category,
    categoryFa: null,
    sourceId: id,
  });

  return NextResponse.json({ data: toCaseV2(updated, access.role) });
}

/**
 * Archive a case. This is an INTERNAL LEGALIR action — it never closes
 * anything before an authority. Owner-only. Open deadlines keep their
 * reminders; the case is simply moved to the ARCHIVED lifecycle.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });
  if (!access.isOwner) {
    return NextResponse.json({ code: "FORBIDDEN", message: "فقط مالک پرونده می‌تواند آن را بایگانی کند" }, { status: 403 });
  }

  const result = updateCase(id, {
    lifecycle: "ARCHIVED",
    lifecycle_reason: "بایگانی توسط مالک پرونده",
    lifecycle_changed_at: new Date().toISOString(),
  });
  if (!result || "conflict" in result) {
    return NextResponse.json({ code: "UPDATE_FAILED", message: "بایگانی پرونده ناموفق بود" }, { status: 500 });
  }

  addCaseTimelineEvent({
    id: generateId(),
    caseId: id,
    eventType: "case_closed",
    title: "بایگانی پرونده",
    description: "پرونده در لیگالیر بایگانی شد. این اقدام داخلی است و تغییری در روند مرجع ایجاد نمی‌کند.",
    recordedByUserId: userId,
    source: "user",
  });

  return NextResponse.json({ data: toCaseV2(result.case, access.role) });
}
