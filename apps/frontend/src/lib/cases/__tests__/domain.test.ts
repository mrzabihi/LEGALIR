// ============================================================
// LEGALIR — Case Management domain logic (pure unit tests)
// ============================================================
// These tests pin the product rules that must never drift:
//   • a stage belongs to exactly one path template,
//   • prior stages are NOT asserted as history,
//   • the next-action order is explainable and stable,
//   • a date-only deadline is NOT overdue at the start of its day,
//   • a criminal legal role is never offered on a civil path.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  WORKFLOW_TEMPLATES,
  WORKFLOW_TEMPLATE_VERSION,
  getTemplate,
  stagesForPath,
  isTerminalStage,
  isValidStageForPath,
  futureStages,
  priorStages,
  computeNextAction,
  tehranDateString,
  classifyDateOnly,
  deriveOperationalState,
  openDeadlinesOnClose,
  stageSourceLabel,
} from "../domain";
import type { CaseDeadlineV2, CaseTaskV2, CaseProceedingPath } from "@legalir/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function deadline(over: Partial<CaseDeadlineV2> = {}): CaseDeadlineV2 {
  return {
    id: "d1",
    caseId: "c1",
    proceedingId: null,
    kind: "legal",
    title: "موعد",
    dueAt: "2026-09-01",
    dateOnly: true,
    basis: "manual",
    reviewState: "user_entered",
    operationalState: "open",
    ruleRef: null,
    sourceDocumentId: null,
    reviewedByUserId: null,
    reviewedAt: null,
    overrideReason: null,
    announcedDueAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function task(over: Partial<CaseTaskV2> = {}): CaseTaskV2 {
  return {
    id: "t1",
    caseId: "c1",
    proceedingId: null,
    stageKey: null,
    title: "وظیفه",
    description: "",
    actionType: "general",
    status: "todo",
    priority: "medium",
    assigneeUserId: null,
    createdByUserId: "u1",
    dueDate: null,
    dependsOn: [],
    checklist: [],
    result: null,
    resultIsClaim: false,
    documentIds: [],
    completedAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

// ============================================================
// 1. Workflow templates & stage membership
// ============================================================

describe("workflow templates", () => {
  it("every path has a versioned template with at least one terminal stage", () => {
    for (const path of Object.keys(WORKFLOW_TEMPLATES) as CaseProceedingPath[]) {
      const t = getTemplate(path);
      expect(t.version).toBe(WORKFLOW_TEMPLATE_VERSION);
      expect(t.stages.length).toBeGreaterThan(0);
      expect(t.terminalStages.length).toBeGreaterThan(0);
      for (const s of t.terminalStages) expect(t.stages).toContain(s);
    }
  });

  it("a stage is valid only for its own path", () => {
    expect(isValidStageForPath("civil", "civil_hearing")).toBe(true);
    expect(isValidStageForPath("civil", "criminal_judgment")).toBe(false);
    expect(isValidStageForPath("criminal", "criminal_judgment")).toBe(true);
    expect(isValidStageForPath("criminal", "civil_hearing")).toBe(false);
  });

  it("`unknown` is always accepted — a case may enter at any stage", () => {
    for (const path of Object.keys(WORKFLOW_TEMPLATES) as CaseProceedingPath[]) {
      expect(isValidStageForPath(path, "unknown")).toBe(true);
    }
  });

  it("terminal stages are recognised per path", () => {
    expect(isTerminalStage("civil", "civil_end")).toBe(true);
    expect(isTerminalStage("civil", "civil_hearing")).toBe(false);
    expect(isTerminalStage("enforcement", "enforcement_result")).toBe(true);
  });

  it("futureStages returns only stages AFTER the current one", () => {
    const stages = stagesForPath("civil");
    const idx = stages.indexOf("civil_hearing");
    const future = futureStages("civil", "civil_hearing");
    expect(future).toEqual(stages.slice(idx + 1));
    expect(future).not.toContain("civil_hearing");
    expect(future).not.toContain("civil_preparation");
  });

  it("priorStages returns the stages BEFORE — never asserted as history", () => {
    const stages = stagesForPath("civil");
    const idx = stages.indexOf("civil_hearing");
    expect(priorStages("civil", "civil_hearing")).toEqual(stages.slice(0, idx));
  });

  it("an unknown stage yields no future/prior stages", () => {
    expect(futureStages("civil", "unknown")).toEqual([]);
    expect(priorStages("civil", "unknown")).toEqual([]);
  });
});

// ============================================================
// 2. Next-action selection — the explainable order
// ============================================================

describe("computeNextAction", () => {
  const base = { authorityInfoMissing: false, hasProceeding: true, now: "2026-08-15T00:00:00Z" };

  it("prefers the nearest open hearing over everything else", () => {
    const action = computeNextAction({
      ...base,
      deadlines: [
        deadline({ id: "legal-1", kind: "legal", dueAt: "2026-08-20" }),
        deadline({ id: "hearing-1", kind: "hearing", dueAt: "2026-08-25" }),
      ],
      tasks: [task({ id: "t1", priority: "urgent" })],
    });
    expect(action.kind).toBe("hearing");
    expect(action.targetId).toBe("hearing-1");
    expect(action.targetTab).toBe("deadlines");
  });

  it("falls back to the nearest open legal deadline when no hearing exists", () => {
    const action = computeNextAction({
      ...base,
      deadlines: [
        deadline({ id: "legal-late", kind: "legal", dueAt: "2026-09-10" }),
        deadline({ id: "legal-soon", kind: "legal", dueAt: "2026-08-20" }),
      ],
      tasks: [task({ id: "t1", priority: "urgent" })],
    });
    expect(action.kind).toBe("deadline");
    expect(action.targetId).toBe("legal-soon");
  });

  it("flags a proposed/needs_review deadline as needing confirmation first", () => {
    const action = computeNextAction({
      ...base,
      deadlines: [deadline({ id: "legal-1", kind: "legal", reviewState: "proposed" })],
      tasks: [],
    });
    expect(action.kind).toBe("deadline");
    expect(action.title).toContain("بررسی");
    expect(action.reason).toContain("پیشنهادی");
  });

  it("ignores cancelled and action_done deadlines", () => {
    const action = computeNextAction({
      ...base,
      deadlines: [
        deadline({ id: "cancelled", kind: "hearing", operationalState: "cancelled" }),
        deadline({ id: "done", kind: "legal", operationalState: "action_done" }),
      ],
      tasks: [task({ id: "t1", priority: "high" })],
    });
    expect(action.kind).toBe("task");
    expect(action.targetId).toBe("t1");
  });

  it("picks the highest-priority open task, then the earliest due date", () => {
    const action = computeNextAction({
      ...base,
      deadlines: [],
      tasks: [
        task({ id: "low", priority: "low" }),
        task({ id: "urgent-late", priority: "urgent", dueDate: "2026-09-01" }),
        task({ id: "urgent-soon", priority: "urgent", dueDate: "2026-08-20" }),
      ],
    });
    expect(action.kind).toBe("task");
    expect(action.targetId).toBe("urgent-soon");
  });

  it("ignores done/cancelled tasks", () => {
    const action = computeNextAction({
      ...base,
      deadlines: [],
      tasks: [task({ id: "done", status: "done" }), task({ id: "cancelled", status: "cancelled" })],
    });
    expect(action.kind).toBe("none");
  });

  it("asks for missing information when there is no proceeding", () => {
    const action = computeNextAction({ ...base, hasProceeding: false, deadlines: [], tasks: [] });
    expect(action.kind).toBe("info");
    expect(action.targetTab).toBe("overview");
  });

  it("asks for missing information when authority info is absent", () => {
    const action = computeNextAction({ ...base, authorityInfoMissing: true, deadlines: [], tasks: [] });
    expect(action.kind).toBe("info");
  });

  it("says so honestly when nothing is recorded", () => {
    const action = computeNextAction({ ...base, deadlines: [], tasks: [] });
    expect(action.kind).toBe("none");
    expect(action.title).toContain("ثبت نشده");
  });
});

// ============================================================
// 3. Date-only deadlines (Asia/Tehran)
// ============================================================

describe("date-only deadline rules", () => {
  it("Tehran is a fixed UTC+03:30 — a late-UTC instant rolls to the next Tehran day", () => {
    // 2026-08-15T21:00:00Z → 2026-08-16T00:30 Tehran
    expect(tehranDateString(new Date("2026-08-15T21:00:00Z"))).toBe("2026-08-16");
    // 2026-08-15T20:00:00Z → 2026-08-15T23:30 Tehran
    expect(tehranDateString(new Date("2026-08-15T20:00:00Z"))).toBe("2026-08-15");
  });

  it("classifies upcoming / due_today / past in the Tehran calendar", () => {
    const now = new Date("2026-08-15T10:00:00Z"); // 13:30 Tehran, 2026-08-15
    expect(classifyDateOnly("2026-08-16", now)).toBe("upcoming");
    expect(classifyDateOnly("2026-08-15", now)).toBe("due_today");
    expect(classifyDateOnly("2026-08-14", now)).toBe("past");
  });

  it("a date-only deadline is NOT overdue at the START of its day", () => {
    // 00:00 Tehran on the due date = 20:30 UTC the previous day.
    const startOfDueDay = new Date("2026-08-14T20:30:00Z");
    expect(tehranDateString(startOfDueDay)).toBe("2026-08-15");
    const state = deriveOperationalState(
      { dueAt: "2026-08-15", dateOnly: true, operationalState: "open" },
      startOfDueDay
    );
    expect(state).toBe("open");
  });

  it("a date-only deadline becomes needs_review_after_due only after its day ends", () => {
    const endOfDueDay = new Date("2026-08-15T20:31:00Z"); // 00:01 Tehran on 08-16
    const state = deriveOperationalState(
      { dueAt: "2026-08-15", dateOnly: true, operationalState: "open" },
      endOfDueDay
    );
    expect(state).toBe("needs_review_after_due");
  });

  it("never overrides a cancelled or action_done deadline", () => {
    const now = new Date("2026-08-20T00:00:00Z");
    expect(deriveOperationalState({ dueAt: "2026-08-01", dateOnly: true, operationalState: "cancelled" }, now)).toBe(
      "cancelled"
    );
    expect(deriveOperationalState({ dueAt: "2026-08-01", dateOnly: true, operationalState: "action_done" }, now)).toBe(
      "action_done"
    );
  });

  it("a timestamp deadline past its instant needs review", () => {
    const now = new Date("2026-08-15T12:00:00Z");
    expect(
      deriveOperationalState({ dueAt: "2026-08-15T10:00:00Z", dateOnly: false, operationalState: "open" }, now)
    ).toBe("needs_review_after_due");
    expect(
      deriveOperationalState({ dueAt: "2026-08-15T14:00:00Z", dateOnly: false, operationalState: "open" }, now)
    ).toBe("open");
  });

  it("closing a case does NOT close its open deadlines", () => {
    const open = openDeadlinesOnClose([
      deadline({ id: "open", operationalState: "open" }),
      deadline({ id: "after", operationalState: "needs_review_after_due" }),
      deadline({ id: "done", operationalState: "action_done" }),
      deadline({ id: "cancelled", operationalState: "cancelled" }),
    ]);
    expect(open.map((d) => d.id)).toEqual(["open", "after"]);
  });
});

// ============================================================
// 4. Provenance labels
// ============================================================

describe("stageSourceLabel", () => {
  it("labels each provenance source in Persian", () => {
    expect(stageSourceLabel("user")).toBe("اعلام کاربر");
    expect(stageSourceLabel("lawyer")).toBe("اعلام وکیل");
    expect(stageSourceLabel("legal_source")).toBe("منبع قانونی");
    expect(stageSourceLabel("system")).toBe("سیستم");
    expect(stageSourceLabel("external")).toBe("منبع بیرونی");
  });
});
