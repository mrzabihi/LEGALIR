// ============================================================
// LEGALIR — Case Management domain logic (pure, no I/O)
// ============================================================
// Workflow templates, stage catalogs, next-action selection and the
// date-only deadline rules. Everything here is deterministic and
// unit-testable; the DB and route layers import from here so the
// product rules live in exactly one place.
//
// Design constraints from the spec:
//   • Templates are the OPERATIONAL model, not a binding statement about
//     the path of every claim. Every stage is optional.
//   • A case may enter at ANY stage — never fabricate prior history.
//   • No fabricated win-probability or progress percentages.
//   • A date-only deadline is NOT overdue at the start of its day; it is
//     «روز موعد» until the end of that date in the Asia/Tehran calendar.
// ============================================================

import type {
  CaseProceedingPath,
  CaseStageKey,
  CaseWorkflowTemplate,
  CaseNextAction,
  CaseDeadlineV2,
  CaseTaskV2,
  CaseInfoSource,
} from "@legalir/types";

// ---------------------------------------------------------------------------
// Workflow templates (versioned)
// ---------------------------------------------------------------------------

export const WORKFLOW_TEMPLATE_VERSION = 1;

const CIVIL_STAGES: CaseStageKey[] = [
  "civil_preparation",
  "civil_filing",
  "civil_defect_or_referral",
  "civil_hearing",
  "civil_judgment",
  "civil_appeal_review",
  "civil_appeal_hearing",
  "civil_enforcement",
  "civil_end",
];

const CRIMINAL_STAGES: CaseStageKey[] = [
  "criminal_preparation",
  "criminal_complaint_filed",
  "criminal_investigation",
  "criminal_investigation_decision",
  "criminal_court_hearing",
  "criminal_judgment",
  "criminal_appeal_review",
  "criminal_enforcement",
  "criminal_end",
];

const FAMILY_STAGES: CaseStageKey[] = [
  "family_preparation",
  "family_filing",
  "family_hearing",
  "family_decision",
  "family_appeal_review",
  "family_enforcement",
  "family_end",
];

const ENFORCEMENT_STAGES: CaseStageKey[] = [
  "enforcement_basis_review",
  "enforcement_request",
  "enforcement_writ",
  "enforcement_actions",
  "enforcement_result",
];

const OTHER_STAGES: CaseStageKey[] = [
  "other_info_completion",
  "other_path_review",
  "other_action",
  "other_followup",
  "other_result",
];

export const WORKFLOW_TEMPLATES: Record<CaseProceedingPath, CaseWorkflowTemplate> = {
  civil: { path: "civil", version: WORKFLOW_TEMPLATE_VERSION, stages: CIVIL_STAGES, terminalStages: ["civil_end"] },
  criminal: {
    path: "criminal",
    version: WORKFLOW_TEMPLATE_VERSION,
    stages: CRIMINAL_STAGES,
    terminalStages: ["criminal_end"],
  },
  family: { path: "family", version: WORKFLOW_TEMPLATE_VERSION, stages: FAMILY_STAGES, terminalStages: ["family_end"] },
  enforcement: {
    path: "enforcement",
    version: WORKFLOW_TEMPLATE_VERSION,
    stages: ENFORCEMENT_STAGES,
    terminalStages: ["enforcement_result"],
  },
  other: { path: "other", version: WORKFLOW_TEMPLATE_VERSION, stages: OTHER_STAGES, terminalStages: ["other_result"] },
};

export function getTemplate(path: CaseProceedingPath): CaseWorkflowTemplate {
  return WORKFLOW_TEMPLATES[path] ?? WORKFLOW_TEMPLATES.other;
}

export function stagesForPath(path: CaseProceedingPath): CaseStageKey[] {
  return getTemplate(path).stages;
}

export function isTerminalStage(path: CaseProceedingPath, stage: CaseStageKey): boolean {
  return getTemplate(path).terminalStages.includes(stage);
}

/** True when `stage` belongs to the given path's template. */
export function isValidStageForPath(path: CaseProceedingPath, stage: CaseStageKey): boolean {
  return stage === "unknown" || getTemplate(path).stages.includes(stage);
}

/**
 * The stages that come AFTER `stage` in the template — shown as "possible
 * future stages", never as recorded history. Returns [] for an unknown stage.
 */
export function futureStages(path: CaseProceedingPath, stage: CaseStageKey): CaseStageKey[] {
  const stages = getTemplate(path).stages;
  const idx = stages.indexOf(stage);
  if (idx === -1) return [];
  return stages.slice(idx + 1);
}

/**
 * The stages that come BEFORE `stage`. These are NOT asserted as having
 * happened — the UI labels them «نامشخص» unless an event records them.
 */
export function priorStages(path: CaseProceedingPath, stage: CaseStageKey): CaseStageKey[] {
  const stages = getTemplate(path).stages;
  const idx = stages.indexOf(stage);
  if (idx === -1) return [];
  return stages.slice(0, idx);
}

// ---------------------------------------------------------------------------
// Next-action selection
// ---------------------------------------------------------------------------
// Explainable order (spec §5):
//   1. an action required for a valid near deadline or hearing,
//   2. an important actionable task,
//   3. a missing-information gap.
// If nothing is recorded, say so honestly and suggest completing info.

export interface NextActionInput {
  deadlines: CaseDeadlineV2[];
  tasks: CaseTaskV2[];
  /** True when no authority information has been recorded. */
  authorityInfoMissing: boolean;
  /** True when the case has no proceeding yet. */
  hasProceeding: boolean;
  /** "now" as an ISO timestamp — injected so the logic is testable. */
  now: string;
}

/** A deadline is "actionable" when it is open and not cancelled. */
function isOpenDeadline(d: CaseDeadlineV2): boolean {
  return d.operationalState === "open" || d.operationalState === "needs_review_after_due";
}

/** A task is "actionable" when it is not done/cancelled. */
function isOpenTask(t: CaseTaskV2): boolean {
  return t.status === "todo" || t.status === "in_progress" || t.status === "blocked";
}

export function computeNextAction(input: NextActionInput): CaseNextAction {
  const { deadlines, tasks, authorityInfoMissing, hasProceeding } = input;

  // 1. Nearest open hearing, then nearest open legal deadline.
  const openDeadlines = deadlines.filter(isOpenDeadline);
  const hearings = openDeadlines
    .filter((d) => d.kind === "hearing")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const legalDeadlines = openDeadlines
    .filter((d) => d.kind === "legal")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const nextHearing = hearings[0];
  if (nextHearing) {
    return {
      kind: "hearing",
      title: `آماده‌سازی برای جلسه «${nextHearing.title}»`,
      reason: "جلسه پیش رو نزدیک‌ترین اقدام زمان‌دار است.",
      assigneeUserId: null,
      dueAt: nextHearing.dueAt,
      targetTab: "deadlines",
      targetId: nextHearing.id,
    };
  }

  const nextLegal = legalDeadlines[0];
  if (nextLegal) {
    const needsReview = nextLegal.reviewState === "proposed" || nextLegal.reviewState === "needs_review";
    return {
      kind: "deadline",
      title: needsReview ? `بررسی و تأیید موعد «${nextLegal.title}»` : `اقدام برای موعد «${nextLegal.title}»`,
      reason: needsReview
        ? "این موعد پیشنهادی است و پیش از اقدام باید بررسی و تأیید شود."
        : "نزدیک‌ترین موعد حقوقی باز این پرونده است.",
      assigneeUserId: null,
      dueAt: nextLegal.dueAt,
      targetTab: "deadlines",
      targetId: nextLegal.id,
    };
  }

  // 2. The most important actionable task (priority, then due date).
  const openTasks = tasks.filter(isOpenTask);
  if (openTasks.length > 0) {
    const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...openTasks].sort((a, b) => {
      const pr = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (pr !== 0) return pr;
      const ad = a.dueDate ?? "9999";
      const bd = b.dueDate ?? "9999";
      return ad.localeCompare(bd);
    });
    const task = sorted[0]!;
    return {
      kind: "task",
      title: task.title,
      reason: "مهم‌ترین وظیفه باز قابل انجام این پرونده است.",
      assigneeUserId: task.assigneeUserId,
      dueAt: task.dueDate,
      targetTab: "tasks",
      targetId: task.id,
    };
  }

  // 3. Missing information.
  if (!hasProceeding || authorityInfoMissing) {
    return {
      kind: "info",
      title: "تکمیل اطلاعات پرونده",
      reason: "برای نمایش دقیق روند، اطلاعات مرجع و مرحله پرونده را تکمیل کنید.",
      assigneeUserId: null,
      dueAt: null,
      targetTab: "overview",
      targetId: null,
    };
  }

  // Nothing recorded — say so honestly.
  return {
    kind: "none",
    title: "اقدامی ثبت نشده است",
    reason: "در حال حاضر موعد، جلسه یا وظیفه بازی برای این پرونده ثبت نشده است.",
    assigneeUserId: null,
    dueAt: null,
    targetTab: "overview",
    targetId: null,
  };
}

// ---------------------------------------------------------------------------
// Date-only deadline rules (Asia/Tehran)
// ---------------------------------------------------------------------------
// Iran has observed no DST since 2022, so Asia/Tehran is a fixed UTC+03:30.
// We compute the Tehran calendar date by shifting the UTC instant and reading
// the date part — this never shifts a date-only value by a timezone.

const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;

/** The Asia/Tehran calendar date (YYYY-MM-DD) for a given instant. */
export function tehranDateString(instant: Date): string {
  const shifted = new Date(instant.getTime() + TEHRAN_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export type DateOnlyStatus = "upcoming" | "due_today" | "past";

/**
 * Classify a date-only deadline relative to `now` in the Tehran calendar.
 * A date-only deadline is NEVER "past" at the start of its day — it is
 * `due_today` until the end of that date, and only then `past`.
 */
export function classifyDateOnly(dueDate: string, now: Date): DateOnlyStatus {
  const today = tehranDateString(now);
  if (dueDate > today) return "upcoming";
  if (dueDate === today) return "due_today";
  return "past";
}

/**
 * The operational state a deadline should show, derived from its stored
 * state and its date. A date-only deadline that has passed becomes
 * `needs_review_after_due` — never an assertion that a legal right lapsed.
 */
export function deriveOperationalState(
  deadline: Pick<CaseDeadlineV2, "dueAt" | "dateOnly" | "operationalState">,
  now: Date
): CaseDeadlineV2["operationalState"] {
  if (deadline.operationalState === "cancelled" || deadline.operationalState === "action_done") {
    return deadline.operationalState;
  }
  if (deadline.dateOnly) {
    const status = classifyDateOnly(deadline.dueAt.slice(0, 10), now);
    return status === "past" ? "needs_review_after_due" : "open";
  }
  // A timestamp deadline: past the instant means it needs review.
  const due = Date.parse(deadline.dueAt);
  if (!Number.isNaN(due) && due < now.getTime()) return "needs_review_after_due";
  return "open";
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Closing/archiving a case does NOT close its open deadlines — they keep
 * their reminders unless the user explicitly stops them. This returns the
 * open deadlines that would still be live when a case is closed/archived.
 */
export function openDeadlinesOnClose(deadlines: CaseDeadlineV2[]): CaseDeadlineV2[] {
  return deadlines.filter((d) => d.operationalState === "open" || d.operationalState === "needs_review_after_due");
}

/** The provenance label shown for a stage, e.g. «اعلام کاربر». */
export function stageSourceLabel(source: CaseInfoSource): string {
  const map: Record<CaseInfoSource, string> = {
    user: "اعلام کاربر",
    lawyer: "اعلام وکیل",
    legal_source: "منبع قانونی",
    system: "سیستم",
    external: "منبع بیرونی",
  };
  return map[source];
}
