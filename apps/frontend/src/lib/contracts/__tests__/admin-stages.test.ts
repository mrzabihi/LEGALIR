// ============================================================
// LEGALIR — Admin stage derivation (§4)
// ============================================================
// «مراحل و گردش کار قرارداد» must reflect the contract's REAL walk, never
// a template reused for every type. These tests pin:
//
//   • the type's OWN sections appear, one row each, in order;
//   • a self-final path shows the review row as SKIPPED, never as done;
//   • an approval that no longer matches the hash is «نیازمند اصلاح»;
//   • signature / stamp states map onto the shared status vocabulary;
//   • `currentKey` points at the first row that actually needs attention.
// ============================================================

import { describe, it, expect } from "vitest";
import type { ContractStageRow } from "@legalir/types";
import { buildAdminStages, type AdminStageInput } from "../admin-stages";

function input(overrides: Partial<AdminStageInput> = {}): AdminStageInput {
  return {
    sections: [
      { key: "parties", labelFa: "طرفین", percent: 100, missing: [] },
      { key: "property", labelFa: "مشخصات ملک", percent: 50, missing: ["متراژ", "پلاک"] },
    ],
    state: "DRAFT",
    contractUpdatedAt: "2026-10-01T00:00:00.000Z",
    currentVersionCreatedAt: "2026-10-01T00:00:00.000Z",
    review: null,
    registration: null,
    signatures: null,
    finalVersion: null,
    finalDocument: null,
    printIssueCount: 0,
    stamp: {
      applied: false,
      appliedAt: null,
      approvedByLabelFa: null,
      pending: false,
      requestedAt: null,
      canRequest: false,
      canApply: false,
      blockingFa: "نسخهٔ فعلی هنوز تأیید بررسی داخلی لیگالیر را ندارد.",
      staleRequest: false,
    },
    permissions: {
      review: true,
      resendInvitations: true,
      registerSelfFinal: true,
      manageStamp: true,
    },
    canAdvanceToSigning: false,
    ...overrides,
  };
}

function byKey(rows: ContractStageRow[], key: string): ContractStageRow {
  const row = rows.find((r) => r.key === key);
  if (!row) throw new Error(`row ${key} missing; got ${rows.map((r) => r.key).join(",")}`);
  return row;
}

describe("admin stages — the type's own sections", () => {
  it("emits one row per declared section, in declaration order", () => {
    const view = buildAdminStages(input());
    expect(view.rows.slice(0, 2).map((r) => r.key)).toEqual([
      "section:parties",
      "section:property",
    ]);
    expect(view.rows[0]!.titleFa).toBe("طرفین");
  });

  it("marks a complete section done and an incomplete one needs_fix with its missing items", () => {
    const view = buildAdminStages(input());
    const parties = byKey(view.rows, "section:parties");
    const property = byKey(view.rows, "section:property");
    expect(parties.status).toBe("done");
    expect(parties.percent).toBe(100);
    expect(property.status).toBe("needs_fix");
    expect(property.missingFa).toEqual(["متراژ", "پلاک"]);
    expect(property.noteFa).toContain("2");
  });

  it("never invents a stage a different contract type would have", () => {
    // A contract type with no sections yields no section rows at all —
    // the walk is derived, not templated.
    const view = buildAdminStages(input({ sections: [] }));
    expect(view.rows.some((r) => r.key.startsWith("section:"))).toBe(false);
    expect(view.rows.map((r) => r.key)).toEqual([
      "review",
      "authorisation",
      "signatures",
      "final",
      "stamp",
    ]);
  });

  it("numbers rows contiguously from 1", () => {
    const view = buildAdminStages(input());
    expect(view.rows.map((r) => r.index)).toEqual(view.rows.map((_, i) => i + 1));
  });
});

describe("admin stages — review", () => {
  it("treats a self-final path as skipped with the unreviewed disclaimer", () => {
    const view = buildAdminStages(
      input({
        state: "READY_TO_SIGN",
        registration: {
          path: "self_final",
          createdAt: "2026-10-02T00:00:00.000Z",
          actorLabelFa: "ادمین نمونه",
          reasonFa: "پیشبرد با درخواست مشتری",
        },
      })
    );
    const review = byKey(view.rows, "review");
    expect(review.status).toBe("skipped");
    expect(review.noteFa).toContain("بدون بررسی");
    expect(review.updatedAt).toBe("2026-10-02T00:00:00.000Z");
  });

  it("keeps a pending review active", () => {
    const view = buildAdminStages(
      input({
        state: "PENDING_ADMIN_REVIEW",
        review: {
          status: "PENDING",
          submittedAt: "2026-10-03T00:00:00.000Z",
          decidedAt: null,
          reasonFa: "",
          reviewerLabelFa: null,
          validForCurrentVersion: false,
        },
      })
    );
    expect(byKey(view.rows, "review").status).toBe("active");
  });

  it("flags an approval whose hash moved on as needs_fix, not done", () => {
    const view = buildAdminStages(
      input({
        review: {
          status: "APPROVED",
          submittedAt: "2026-10-03T00:00:00.000Z",
          decidedAt: "2026-10-04T00:00:00.000Z",
          reasonFa: "",
          reviewerLabelFa: "بررسی‌کننده",
          validForCurrentVersion: false,
        },
      })
    );
    const review = byKey(view.rows, "review");
    expect(review.status).toBe("needs_fix");
    expect(review.noteFa).toContain("معتبر نیست");
  });

  it("maps a rejected review onto rejected", () => {
    const view = buildAdminStages(
      input({
        review: {
          status: "REJECTED",
          submittedAt: "2026-10-03T00:00:00.000Z",
          decidedAt: "2026-10-04T00:00:00.000Z",
          reasonFa: "نقص مدارک",
          reviewerLabelFa: "بررسی‌کننده",
          validForCurrentVersion: false,
        },
      })
    );
    const review = byKey(view.rows, "review");
    expect(review.status).toBe("rejected");
    expect(review.noteFa).toBe("نقص مدارک");
  });
});

describe("admin stages — authorisation", () => {
  it("records the real path and actor when a registration exists", () => {
    const view = buildAdminStages(
      input({
        registration: {
          path: "legalir_review",
          createdAt: "2026-10-05T00:00:00.000Z",
          actorLabelFa: "واحد بررسی",
          reasonFa: "تأیید شد",
        },
      })
    );
    const row = byKey(view.rows, "authorisation");
    expect(row.status).toBe("done");
    expect(row.responsibleFa).toBe("واحد بررسی");
    expect(row.noteFa).toContain("بررسی حقوقی لیگالیر");
  });

  it("offers the self-final action only with the permission and the real endpoint's verdict", () => {
    const allowed = byKey(
      buildAdminStages(input({ canAdvanceToSigning: true })).rows,
      "authorisation"
    );
    expect(allowed.actions[0]!.enabled).toBe(true);
    expect(allowed.actions[0]!.reasonFa).toBeNull();

    const denied = byKey(buildAdminStages(input()).rows, "authorisation");
    expect(denied.actions[0]!.enabled).toBe(false);
    expect(denied.actions[0]!.reasonFa).toBeTruthy();
  });

  it("explains a disabled action by permission before state", () => {
    const view = buildAdminStages(
      input({
        canAdvanceToSigning: true,
        permissions: {
          review: false,
          resendInvitations: false,
          registerSelfFinal: false,
          manageStamp: false,
        },
      })
    );
    const row = byKey(view.rows, "authorisation");
    expect(row.actions[0]!.enabled).toBe(false);
    expect(row.actions[0]!.reasonFa).toContain("مجوز «بررسی قراردادها»");
  });

  it("refuses self-final once a signature request exists", () => {
    const view = buildAdminStages(
      input({
        canAdvanceToSigning: false,
        signatures: {
          status: "PARTIALLY_SIGNED",
          createdAt: "2026-10-06T00:00:00.000Z",
          completedAt: null,
          participants: [
            { roleFa: "موجر", status: "SIGNED", signedAt: "2026-10-06T01:00:00.000Z" },
          ],
        },
      })
    );
    const row = byKey(view.rows, "authorisation");
    expect(row.actions[0]!.enabled).toBe(false);
    expect(row.actions[0]!.reasonFa).toContain("درخواست امضا");
  });
});

describe("admin stages — signatures", () => {
  const participants = (statuses: string[]) =>
    statuses.map((status, i) => ({
      roleFa: i === 0 ? "موجر" : "مستأجر",
      status,
      signedAt: status === "SIGNED" ? "2026-10-07T00:00:00.000Z" : null,
    }));

  it("shows a partial request as active with the signed count", () => {
    const view = buildAdminStages(
      input({
        signatures: {
          status: "PARTIALLY_SIGNED",
          createdAt: "2026-10-06T00:00:00.000Z",
          completedAt: null,
          participants: participants(["SIGNED", "PENDING"]),
        },
      })
    );
    const row = byKey(view.rows, "signatures");
    expect(row.status).toBe("active");
    expect(row.noteFa).toContain("1 از 2");
  });

  it("maps a completed request to done and a decline to rejected", () => {
    const done = buildAdminStages(
      input({
        signatures: {
          status: "COMPLETED",
          createdAt: "2026-10-06T00:00:00.000Z",
          completedAt: "2026-10-08T00:00:00.000Z",
          participants: participants(["SIGNED", "SIGNED"]),
        },
      })
    );
    expect(byKey(done.rows, "signatures").status).toBe("done");

    const declined = buildAdminStages(
      input({
        signatures: {
          status: "DECLINED",
          createdAt: "2026-10-06T00:00:00.000Z",
          completedAt: null,
          participants: participants(["SIGNED", "DECLINED"]),
        },
      })
    );
    const row = byKey(declined.rows, "signatures");
    expect(row.status).toBe("rejected");
    expect(row.noteFa).toContain("مستأجر");
  });

  it("maps an expired request to blocked", () => {
    const view = buildAdminStages(
      input({
        signatures: {
          status: "EXPIRED",
          createdAt: "2026-10-06T00:00:00.000Z",
          completedAt: null,
          participants: participants(["PENDING", "PENDING"]),
        },
      })
    );
    expect(byKey(view.rows, "signatures").status).toBe("blocked");
  });
});

describe("admin stages — final artifact and seal", () => {
  it("marks the final stage needs_fix when the version froze but no file exists", () => {
    const view = buildAdminStages(
      input({ finalVersion: { versionNumber: 3, finalizedAt: "2026-10-09T00:00:00.000Z" } })
    );
    const row = byKey(view.rows, "final");
    expect(row.status).toBe("needs_fix");
    expect(row.noteFa).toContain("3");
  });

  it("marks the final stage done when the stored artifact exists", () => {
    const view = buildAdminStages(
      input({
        finalVersion: { versionNumber: 3, finalizedAt: "2026-10-09T00:00:00.000Z" },
        finalDocument: { uploadedAt: "2026-10-09T01:00:00.000Z" },
      })
    );
    expect(byKey(view.rows, "final").status).toBe("done");
  });

  it("shows an applied seal as done and carries the approving manager", () => {
    const view = buildAdminStages(
      input({
        stamp: {
          ...input().stamp,
          applied: true,
          appliedAt: "2026-10-10T00:00:00.000Z",
          approvedByLabelFa: "مدیر ارشد",
          canRequest: false,
        },
      })
    );
    const row = byKey(view.rows, "stamp");
    expect(row.status).toBe("done");
    expect(row.responsibleFa).toBe("مدیر ارشد");
  });

  it("flags a stale open request as needs_fix", () => {
    const view = buildAdminStages(
      input({
        stamp: {
          ...input().stamp,
          pending: true,
          staleRequest: true,
          requestedAt: "2026-10-09T00:00:00.000Z",
        },
      })
    );
    const row = byKey(view.rows, "stamp");
    expect(row.status).toBe("needs_fix");
    expect(row.noteFa).toContain("نسخهٔ دیگری");
  });

  it("carries the server's blocking reason onto the stamp action", () => {
    const view = buildAdminStages(input());
    const row = byKey(view.rows, "stamp");
    expect(row.status).toBe("blocked");
    expect(row.actions[0]!.enabled).toBe(false);
    expect(row.detailFa).toContain("تأیید بررسی داخلی");
  });
});

describe("admin stages — current stage pointer and progress", () => {
  it("points at the first row needing attention", () => {
    const view = buildAdminStages(input());
    // «parties» is done; «property» is the first needs_fix row.
    expect(view.currentKey).toBe("section:property");
  });

  it("counts done and skipped rows toward progress", () => {
    const view = buildAdminStages(
      input({
        sections: [],
        registration: {
          path: "self_final",
          createdAt: "2026-10-02T00:00:00.000Z",
          actorLabelFa: "ادمین",
          reasonFa: "بدون بررسی",
        },
      })
    );
    // review (skipped) + authorisation (done) = 2 of 5.
    expect(view.doneCount).toBe(2);
    expect(view.totalCount).toBe(5);
  });

  it("falls back to the last row when every other stage is terminal", () => {
    const view = buildAdminStages(
      input({
        sections: [],
        review: {
          status: "APPROVED",
          submittedAt: "2026-10-03T00:00:00.000Z",
          decidedAt: "2026-10-04T00:00:00.000Z",
          reasonFa: "",
          reviewerLabelFa: "بررسی‌کننده",
          validForCurrentVersion: true,
        },
        signatures: {
          status: "COMPLETED",
          createdAt: "2026-10-06T00:00:00.000Z",
          completedAt: "2026-10-08T00:00:00.000Z",
          participants: [
            { roleFa: "موجر", status: "SIGNED", signedAt: "2026-10-07T00:00:00.000Z" },
            { roleFa: "مستأجر", status: "SIGNED", signedAt: "2026-10-07T00:00:00.000Z" },
          ],
        },
        finalVersion: { versionNumber: 1, finalizedAt: "2026-10-09T00:00:00.000Z" },
        finalDocument: { uploadedAt: "2026-10-09T01:00:00.000Z" },
        stamp: {
          ...input().stamp,
          applied: true,
          appliedAt: "2026-10-10T00:00:00.000Z",
        },
      })
    );
    expect(view.currentKey).toBe("stamp");
  });
});
