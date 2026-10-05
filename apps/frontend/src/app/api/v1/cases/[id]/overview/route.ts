// ============================================================
// LEGALIR — /api/v1/cases/[id]/overview
// ============================================================
// The overview aggregate: lifecycle, current stage, the single computed
// next action, the nearest deadline/hearing, open-task counts and the
// collaboration/representation summaries. Everything here is derived from
// recorded data — no fabricated progress or win-probability.
//
// AUTHORIZATION: `resolveCaseAccess`; a foreign case yields 404.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserIdFromRequest } from "@/lib/api/server-auth";
import {
  getCaseTasks,
  getCaseDeadlines,
  getCaseProceedings,
  getCaseEngagements,
  getCaseRepresentations,
} from "@/lib/case-db";
import { resolveCaseAccess } from "@/lib/cases/access";
import { toCaseV2, toTaskV2, toDeadlineV2, toEngagement, toRepresentation } from "@/lib/cases/dto";
import { computeNextAction, deriveOperationalState } from "@/lib/cases/domain";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ code: "UNAUTHORIZED", message: "لطفاً وارد شوید" }, { status: 401 });

  const { id } = await params;
  const access = resolveCaseAccess(userId, id);
  if (!access) return NextResponse.json({ code: "NOT_FOUND", message: "پرونده یافت نشد" }, { status: 404 });

  const now = new Date();
  const c = access.case;

  const proceedings = getCaseProceedings(id);
  const proceeding = proceedings.length > 0 ? proceedings[0]! : null;

  const tasks = access.canWrite || access.canBeAssigned ? getCaseTasks(id).map(toTaskV2) : [];
  const deadlines = getCaseDeadlines(id).map((row) => {
    const dto = toDeadlineV2(row);
    return { ...dto, operationalState: deriveOperationalState(dto, now) };
  });

  const openTasks = tasks.filter((t) => t.status === "todo" || t.status === "in_progress" || t.status === "blocked");
  const today = now.toISOString().slice(0, 10);
  const overdueTasks = openTasks.filter((t) => t.dueDate !== null && t.dueDate.slice(0, 10) < today);

  const openDeadlines = deadlines.filter(
    (d) => d.operationalState === "open" || d.operationalState === "needs_review_after_due"
  );
  const nearestDeadline = openDeadlines
    .filter((d) => d.kind !== "hearing")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? null;
  const nextHearing = openDeadlines
    .filter((d) => d.kind === "hearing")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? null;

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
      lifecycle: c.lifecycle ?? "ACTIVE",
      currentStage: proceeding?.stage ?? "unknown",
      currentStageSource: proceeding?.stage_source ?? "user",
      currentStageAt: proceeding?.stage_recorded_at ?? null,
      nextAction,
      nearestDeadline,
      nextHearing,
      openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length,
      engagements: getCaseEngagements(id).map(toEngagement),
      representations: getCaseRepresentations(id).map(toRepresentation),
      authorityInfoMissing,
      infoUpdatedAt: c.updated_at,
      // No external provider exists yet — never claim a sync happened.
      lastSyncedAt: null,
    },
  });
}
