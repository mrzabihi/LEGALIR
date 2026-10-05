// ============================================================
// LEGALIR — Case Management persistence (integration, temp DB)
// ============================================================
// `case-db.ts` resolves its store from `process.cwd()/.data` at import time,
// so we chdir into a throwaway directory *before* the dynamic import to keep
// the real dev DB untouched. We never statically import the module — the
// value binding would capture the live `.data` path.
//
// These tests pin the persistence-level guarantees the routes rely on:
//   • idempotent create (a repeat key returns the same case),
//   • optimistic concurrency (a stale version is rejected, not clobbered),
//   • dependency-cycle rejection,
//   • membership isolation (a member of one case has no access to another),
//   • additive schema (a legacy row without v2 fields normalizes on read).
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as caseDbModule from "../../case-db";

type CaseDb = typeof caseDbModule;

let db: CaseDb;
let tmpDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-cases-"));
  process.chdir(tmpDir);
  db = await import("../../case-db");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function newCase(userId: string, title = "پرونده", idempotencyKey?: string) {
  return db.createCase({
    id: crypto.randomUUID(),
    userId,
    title,
    description: "توضیح",
    category: "property",
    priority: "medium",
    idempotencyKey: idempotencyKey ?? null,
  });
}

// ============================================================
// 1. Create & idempotency
// ============================================================

describe("case creation", () => {
  it("assigns an internal LGL-CASE ref and starts ACTIVE at version 1", () => {
    const c = newCase("u1");
    expect(c.internal_ref).toMatch(/^LGL-CASE-[A-Z2-9]{6}$/);
    expect(c.lifecycle).toBe("ACTIVE");
    expect(c.version).toBe(1);
  });

  it("a repeat create with the same idempotency key resolves to the SAME case", () => {
    const first = newCase("u1", "تکراری", "key-abc");
    const found = db.findCaseByIdempotencyKey("u1", "key-abc");
    expect(found?.id).toBe(first.id);
  });

  it("the idempotency key is scoped per user — another user's key never matches", () => {
    newCase("u1", "الف", "shared-key");
    expect(db.findCaseByIdempotencyKey("u2", "shared-key")).toBeUndefined();
  });

  it("listCases only ever returns the caller's own cases", () => {
    newCase("owner-x", "پرونده ایکس");
    newCase("owner-y", "پرونده وای");
    const { items } = db.listCases("owner-x");
    expect(items.every((c) => c.user_id === "owner-x")).toBe(true);
  });
});

// ============================================================
// 2. Optimistic concurrency
// ============================================================

describe("optimistic concurrency", () => {
  it("a matching expectedVersion succeeds and bumps the version", () => {
    const c = newCase("u1");
    const res = db.updateCase(c.id, { title: "عنوان جدید" }, 1);
    expect(res).toHaveProperty("case");
    if ("case" in res!) {
      expect(res.case.title).toBe("عنوان جدید");
      expect(res.case.version).toBe(2);
    }
  });

  it("a stale expectedVersion is rejected with a conflict, not a silent overwrite", () => {
    const c = newCase("u1");
    db.updateCase(c.id, { title: "اول" }, 1); // now version 2
    const stale = db.updateCase(c.id, { title: "دوم" }, 1); // still thinks v1
    expect(stale).toEqual({ conflict: true });
    // The stored title is unchanged — the stale write did not clobber it.
    expect(db.getCaseById(c.id)?.title).toBe("اول");
  });

  it("omitting expectedVersion performs an unconditional update", () => {
    const c = newCase("u1");
    const res = db.updateCase(c.id, { priority: "high" });
    expect(res).toHaveProperty("case");
    expect(db.getCaseById(c.id)?.priority).toBe("high");
  });
});

// ============================================================
// 3. Task dependency cycles
// ============================================================

describe("task dependency cycles", () => {
  it("a direct self-dependency is a cycle", () => {
    const c = newCase("u1");
    const t = db.createCaseTask({
      id: "t-a",
      caseId: c.id,
      title: "الف",
      description: "",
      priority: "medium",
      dueDate: null,
    });
    expect(db.wouldCreateDependencyCycle(c.id, t.id, [t.id])).toBe(true);
  });

  it("a two-node cycle (A→B, then B→A) is detected", () => {
    const c = newCase("u1");
    db.createCaseTask({ id: "t-a", caseId: c.id, title: "الف", description: "", priority: "medium", dueDate: null, dependsOn: ["t-b"] });
    db.createCaseTask({ id: "t-b", caseId: c.id, title: "ب", description: "", priority: "medium", dueDate: null });
    // Adding B→A would close the loop A→B→A.
    expect(db.wouldCreateDependencyCycle(c.id, "t-b", ["t-a"])).toBe(true);
  });

  it("a diamond (no cycle) is allowed", () => {
    const c = newCase("u1");
    db.createCaseTask({ id: "t-root", caseId: c.id, title: "ریشه", description: "", priority: "medium", dueDate: null });
    db.createCaseTask({ id: "t-l", caseId: c.id, title: "چپ", description: "", priority: "medium", dueDate: null, dependsOn: ["t-root"] });
    db.createCaseTask({ id: "t-r", caseId: c.id, title: "راست", description: "", priority: "medium", dueDate: null, dependsOn: ["t-root"] });
    expect(db.wouldCreateDependencyCycle(c.id, "t-join", ["t-l", "t-r"])).toBe(false);
  });

  it("completing a task stamps completed_at; reopening clears it", () => {
    const c = newCase("u1");
    db.createCaseTask({ id: "t-1", caseId: c.id, title: "کار", description: "", priority: "medium", dueDate: null });
    const done = db.updateCaseTask(c.id, "t-1", { status: "done" });
    expect(done?.completed_at).toBeTruthy();
    const reopened = db.updateCaseTask(c.id, "t-1", { status: "todo" });
    expect(reopened?.completed_at).toBeNull();
  });
});

// ============================================================
// 4. Membership isolation
// ============================================================

describe("membership isolation", () => {
  it("a member of case A has no membership on case B", () => {
    const a = newCase("owner-a");
    const b = newCase("owner-b");
    db.addCaseMember({ id: "m-1", caseId: a.id, accountId: "lawyer-1", role: "lawyer", grantedByUserId: "owner-a" });
    expect(db.getActiveCaseMember(a.id, "lawyer-1")?.role).toBe("lawyer");
    expect(db.getActiveCaseMember(b.id, "lawyer-1")).toBeUndefined();
  });

  it("a revoked member is no longer active", () => {
    const c = newCase("owner-c");
    db.addCaseMember({ id: "m-2", caseId: c.id, accountId: "viewer-1", role: "viewer", grantedByUserId: "owner-c" });
    expect(db.revokeCaseMember(c.id, "viewer-1")).toBe(true);
    expect(db.getActiveCaseMember(c.id, "viewer-1")).toBeUndefined();
  });

  it("adding the same member twice is idempotent (one active row)", () => {
    const c = newCase("owner-d");
    db.addCaseMember({ id: "m-3", caseId: c.id, accountId: "law-2", role: "lawyer", grantedByUserId: "owner-d" });
    db.addCaseMember({ id: "m-4", caseId: c.id, accountId: "law-2", role: "lawyer", grantedByUserId: "owner-d" });
    const active = db.getCaseMembers(c.id).filter((m) => m.account_id === "law-2" && m.status === "active");
    expect(active).toHaveLength(1);
  });

  it("promoting a pending member to lawyer updates the SAME row (no duplicate)", () => {
    const c = newCase("owner-e");
    db.addCaseMember({ id: "m-5", caseId: c.id, accountId: "law-3", role: "pending", scopes: ["summary"], grantedByUserId: "owner-e" });
    const promoted = db.updateCaseMemberRole(c.id, "law-3", "lawyer", ["summary", "documents"]);
    expect(promoted?.role).toBe("lawyer");
    expect(promoted?.scopes).toEqual(["summary", "documents"]);
    const rows = db.getCaseMembers(c.id).filter((m) => m.account_id === "law-3");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.role).toBe("lawyer");
  });

  it("promoting a non-member returns undefined", () => {
    const c = newCase("owner-f");
    expect(db.updateCaseMemberRole(c.id, "ghost", "lawyer")).toBeUndefined();
  });
});

// ============================================================
// 5. Proceedings & stage changes
// ============================================================

describe("proceedings", () => {
  it("a proceeding records its path, stage and provenance", () => {
    const c = newCase("u1");
    const p = db.createCaseProceeding({
      id: "p-1",
      caseId: c.id,
      path: "civil",
      stage: "civil_hearing",
      authority: "دادگاه عمومی",
      stageSource: "user",
    });
    expect(p.path).toBe("civil");
    expect(p.stage).toBe("civil_hearing");
    expect(p.stage_source).toBe("user");
    expect(p.template_version).toBeGreaterThan(0);
  });

  it("a stage change updates the stage and its provenance", () => {
    const c = newCase("u1");
    db.createCaseProceeding({ id: "p-2", caseId: c.id, path: "civil", stage: "civil_filing" });
    const updated = db.updateCaseProceeding(c.id, "p-2", { stage: "civil_judgment", stage_source: "lawyer" });
    expect(updated?.stage).toBe("civil_judgment");
    expect(updated?.stage_source).toBe("lawyer");
  });

  it("official numbers are stored as strings, kept separate from the internal ref", () => {
    const c = newCase("u1");
    const p = db.createCaseProceeding({
      id: "p-3",
      caseId: c.id,
      path: "civil",
      stage: "civil_filing",
      judicialNumber: "001234567890123456",
      archiveNumber: "0009876",
    });
    expect(typeof p.judicial_number).toBe("string");
    expect(p.judicial_number).toBe("001234567890123456");
    expect(p.judicial_number).not.toBe(c.internal_ref);
  });
});

// ============================================================
// 6. Deadlines — three independent kinds
// ============================================================

describe("deadlines", () => {
  it("keeps legal / internal / hearing kinds independent", () => {
    const c = newCase("u1");
    db.createCaseDeadline({ id: "d-legal", caseId: c.id, title: "موعد حقوقی", dueAt: "2026-09-01", source: "user", sourceRef: null, needsConfirmation: false, kind: "legal" });
    db.createCaseDeadline({ id: "d-internal", caseId: c.id, title: "موعد داخلی", dueAt: "2026-08-25", source: "user", sourceRef: null, needsConfirmation: false, kind: "internal" });
    db.createCaseDeadline({ id: "d-hearing", caseId: c.id, title: "جلسه", dueAt: "2026-09-10", source: "user", sourceRef: null, needsConfirmation: false, kind: "hearing" });
    const kinds = db.getCaseDeadlines(c.id).map((d) => d.kind).sort();
    expect(kinds).toEqual(["hearing", "internal", "legal"]);
  });

  it("a computed/legal_source deadline is never auto-trusted", () => {
    const c = newCase("u1");
    const d = db.createCaseDeadline({
      id: "d-computed",
      caseId: c.id,
      title: "موعد محاسبه‌شده",
      dueAt: "2026-09-01",
      source: "legal_source",
      sourceRef: "rule-1",
      needsConfirmation: true,
      basis: "computed",
    });
    expect(d.needs_confirmation).toBe(true);
    expect(d.review_state).toBe("needs_review");
    expect(d.rule_ref).toBe("rule-1");
  });

  it("a user-entered deadline is trusted and marked user_entered", () => {
    const c = newCase("u1");
    const d = db.createCaseDeadline({
      id: "d-user",
      caseId: c.id,
      title: "موعد کاربر",
      dueAt: "2026-09-01",
      source: "user",
      sourceRef: null,
      needsConfirmation: false,
    });
    expect(d.needs_confirmation).toBe(false);
    expect(d.review_state).toBe("user_entered");
  });
});

// ============================================================
// 7. Additive schema — legacy rows normalize on read
// ============================================================

describe("additive schema (normalize on read)", () => {
  /** Write a raw table file directly — simulates a row from an older schema. */
  function writeRawTable(name: string, rows: unknown[]) {
    fs.writeFileSync(path.join(tmpDir, ".data", `${name}.json`), JSON.stringify(rows, null, 2), "utf-8");
  }

  it("a legacy case row without v2 fields reads back with honest defaults", () => {
    // Simulate a row written before the v2 fields existed.
    writeRawTable("cases", [
      {
        id: "legacy-1",
        user_id: "u-legacy",
        title: "پرونده قدیمی",
        description: "…",
        category: "family",
        status: "ACTIVE",
        priority: "medium",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const read = db.getCaseById("legacy-1");
    expect(read).toBeDefined();
    expect(read?.lifecycle).toBe("ACTIVE");
    expect(read?.version).toBe(1);
    expect(read?.internal_ref).toBeTruthy();
  });

  it("a legacy deadline row without v2 fields normalizes to a legal, date-only, open deadline", () => {
    writeRawTable("case_deadlines", [
      {
        id: "legacy-dl",
        case_id: "legacy-1",
        title: "مهلت قدیمی",
        due_at: "2026-09-01T00:00:00Z",
        source: "user",
        source_ref: null,
        needs_confirmation: false,
        completed: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const read = db.getCaseDeadline("legacy-1", "legacy-dl");
    expect(read?.kind).toBe("legal");
    expect(read?.date_only).toBe(true);
    expect(read?.operational_state).toBe("open");
    expect(read?.review_state).toBe("user_entered");
  });
});
