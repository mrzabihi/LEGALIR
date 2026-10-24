// ============================================================
// LEGALIR — Lawyer portal store · write paths (temp DB)
// ============================================================
// The store is the ONLY writer for the SLA policy/calendar, the workflow log,
// the published rates and the settlement account. The brief requires that each
// of those writes is validated, attributable and append-only where the history
// matters (§5, §6, §7, §12):
//
//   §5  the work calendar and the per-service SLA policy are admin-editable,
//       but an invalid window can never replace a working one;
//   §6  a lawyer publishes prices, every change is recorded, and a request
//       accepted earlier keeps the price it was accepted at;
//   §7  the settlement account is validated, submitted for review, and every
//       state change carries actor + reason + masked destination;
//   §12 the admin override and the re-referral keep previous/new values and
//       write an internal action row, never a silent rewrite.
//
// `db.ts` binds its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir (team convention).
// ============================================================

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DEFAULT_SLA_SERVICE_KEY,
  type LegalRequest,
  type PlatformWorkCalendar,
} from "@legalir/types";
import { DEFAULT_WORK_CALENDAR, responseDeadline } from "../lawyer-portal/sla";
import type * as LegalRequestDbModule from "../legal-request-db";
import type * as StoreModule from "../lawyer-portal/store";
import type * as AuditModule from "../admin/audit";
import type * as CaseDbModule from "../case-db";
import type * as CaseAccessModule from "../cases/access";

type LegalRequestDb = typeof LegalRequestDbModule;
type Store = typeof StoreModule;

let legalRequestDb: LegalRequestDb;
let store: Store;
let audit: typeof AuditModule;
let caseDb: typeof CaseDbModule;
let caseAccess: typeof CaseAccessModule;

let tmpDir: string;
let originalCwd: string;

const CLIENT_ID = "user-store-client";
const LAWYER_A = "law-store-A";
const LAWYER_B = "law-store-B";

const ADMIN: StoreModule.CommandActor = { userId: "user-store-admin", role: "SUPER_ADMIN" };
const LAWYER_A_ACTOR: StoreModule.CommandActor = { userId: "user-store-lawyer-a", role: "LAWYER" };
const LAWYER_B_ACTOR: StoreModule.CommandActor = { userId: "user-store-lawyer-b", role: "LAWYER" };

/** A fixed instant to anchor a clock on — comfortably before "now". */
const ANCHOR = "2026-01-01T00:00:00.000Z";
const LONG_AGO = "2020-01-01T00:00:00.000Z";
const NOW = "2026-10-19T09:00:00.000Z";

function seedRequest(overrides: Partial<LegalRequest> = {}): LegalRequest {
  const now = new Date().toISOString();
  const row: LegalRequest = {
    id: `lreq-store-${crypto.randomUUID()}`,
    userId: CLIENT_ID,
    caseId: null,
    conversationId: null,
    title: "مشاورهٔ حقوقی",
    category: "family",
    state: "WAITING_FOR_ACCEPTANCE",
    intakeAnswers: {},
    analysisId: null,
    selectedLawyerId: LAWYER_A,
    orgId: null,
    serviceKey: "family-consultation",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  legalRequestDb.createRequest(row);
  return row;
}

function calendar(overrides: Partial<PlatformWorkCalendar> = {}): PlatformWorkCalendar {
  return { ...DEFAULT_WORK_CALENDAR, ...overrides };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-lawyer-store-"));
  process.chdir(tmpDir);

  legalRequestDb = await import("../legal-request-db");
  store = await import("../lawyer-portal/store");
  audit = await import("../admin/audit");
  caseDb = await import("../case-db");
  caseAccess = await import("../cases/access");
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// §5 — working calendar
// ---------------------------------------------------------------------------

describe("work calendar", () => {
  it("falls back to the seeded default before any row is saved", () => {
    expect(store.getWorkCalendar()).toEqual(DEFAULT_WORK_CALENDAR);
  });

  it("refuses every malformed shape with a Persian reason", () => {
    const invalid = [
      calendar({ timezone: "Mars/Olympus" }),
      calendar({ workingDays: [] }),
      calendar({ workingDays: [7] }),
      calendar({ workingDays: [-1] }),
      calendar({ hours: { startTime: "9:00", endTime: "17:00" } }),
      calendar({ hours: { startTime: "18:00", endTime: "09:00" } }),
      calendar({ holidays: ["2026/10/14"] }),
    ];
    for (const input of invalid) {
      const error = store.validateWorkCalendar(input);
      expect(error).toBeTruthy();
      expect(error!.length).toBeGreaterThan(5);
    }
    expect(store.validateWorkCalendar(DEFAULT_WORK_CALENDAR)).toBeNull();
  });

  it("normalizes duplicate days/holidays and stamps the actor", () => {
    const result = store.saveWorkCalendar(
      calendar({
        workingDays: [5, 1, 1, 3],
        holidays: ["2026-10-20", "2026-10-14", "2026-10-14"],
      }),
      ADMIN
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calendar.workingDays).toEqual([1, 3, 5]);
    expect(result.calendar.holidays).toEqual(["2026-10-14", "2026-10-20"]);
    expect(result.calendar.updatedBy).toBe(ADMIN.userId);
    expect(store.getWorkCalendar().workingDays).toEqual([1, 3, 5]);
  });

  it("never lets an invalid window replace the stored one", () => {
    const before = store.getWorkCalendar();
    const result = store.saveWorkCalendar(
      { ...before, hours: { startTime: "20:00", endTime: "08:00" } },
      ADMIN
    );
    expect(result.ok).toBe(false);
    expect(store.getWorkCalendar()).toEqual(before);
  });

  it("round-trips through the table", () => {
    const before = store.getWorkCalendar();
    expect(store.getWorkCalendar().updatedAt).toBe(before.updatedAt);
  });
});

// ---------------------------------------------------------------------------
// §5 — SLA policies
// ---------------------------------------------------------------------------

describe("SLA policies", () => {
  const familyPolicy: StoreModule.SlaPolicyInput = {
    serviceKey: "family-consultation",
    labelFa: "مشاورهٔ خانواده",
    responseHours: 8,
    completionHours: 24,
    clock: "BUSINESS_HOURS",
    pauseBehavior: "PAUSE",
    warnBeforeHours: 2,
    status: "active",
  };

  it("seeds the default policy once and sorts it first", () => {
    const first = store.listSlaPolicies();
    expect(first[0]?.serviceKey).toBe(DEFAULT_SLA_SERVICE_KEY);
    const second = store.listSlaPolicies();
    expect(second.filter((p) => p.serviceKey === DEFAULT_SLA_SERVICE_KEY)).toHaveLength(1);
  });

  it("creates a policy, then updates it in place instead of duplicating", () => {
    const created = store.saveSlaPolicy(familyPolicy, ADMIN);
    expect(created.ok).toBe(true);
    expect(store.getSlaPolicyForService("family-consultation").responseHours).toBe(8);

    const updated = store.saveSlaPolicy({ ...familyPolicy, responseHours: 4 }, ADMIN);
    expect(updated.ok).toBe(true);
    const rows = store.listSlaPolicies().filter((p) => p.serviceKey === "family-consultation");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.responseHours).toBe(4);
    expect(rows[0]?.updatedBy).toBe(ADMIN.userId);
  });

  it("refuses out-of-range or mis-typed policies", () => {
    const bad: Partial<StoreModule.SlaPolicyInput>[] = [
      { responseHours: 0 },
      { completionHours: 0 },
      { responseHours: 24 * 60 + 1 },
      { warnBeforeHours: -1 },
      { labelFa: "   " },
      { serviceKey: "" },
      { clock: "WEEKLY" as StoreModule.SlaPolicyInput["clock"] },
      { pauseBehavior: "IGNORE" as StoreModule.SlaPolicyInput["pauseBehavior"] },
    ];
    for (const patch of bad) {
      const result = store.saveSlaPolicy({ ...familyPolicy, ...patch }, ADMIN);
      expect(result.ok).toBe(false);
    }
    // Nothing above reached the table.
    expect(store.getSlaPolicyForService("family-consultation").responseHours).toBe(4);
  });

  it("hides archived rows from the default list but keeps them reviewable", () => {
    const archived = store.saveSlaPolicy({ ...familyPolicy, status: "archived" }, ADMIN);
    expect(archived.ok).toBe(true);
    expect(store.listSlaPolicies().some((p) => p.serviceKey === "family-consultation")).toBe(false);
    expect(store.listSlaPolicies(true).some((p) => p.serviceKey === "family-consultation")).toBe(true);
    // A service whose own policy is archived does not silently inherit the
    // default's live deadline — it returns its own archived row.
    expect(store.getSlaPolicyForService("family-consultation").status).toBe("archived");
    expect(responseDeadline(store.getSlaPolicyForService("family-consultation"), "2026-10-14T05:30:00.000Z", DEFAULT_WORK_CALENDAR)).toBeNull();
  });

  it("records a lifecycle transition under its own audit action", () => {
    store.saveSlaPolicy(familyPolicy, ADMIN);
    store.saveSlaPolicy({ ...familyPolicy, status: "inactive" }, ADMIN);
    store.saveSlaPolicy({ ...familyPolicy, status: "active" }, ADMIN);
    const { items } = audit.listAudit({ resourceType: "sla_policy", pageSize: 50 });
    const actions = items.map((r) => r.action);
    expect(actions).toContain("sla.policy.deactivate");
    expect(actions).toContain("sla.policy.activate");
  });

  it("does not re-activate a paused policy when a save omits the lifecycle", () => {
    store.saveSlaPolicy({ ...familyPolicy, status: "inactive" }, ADMIN);
    // A partial save (hours only) must keep the policy paused.
    store.saveSlaPolicy(
      {
        serviceKey: familyPolicy.serviceKey,
        labelFa: familyPolicy.labelFa,
        responseHours: 6,
        completionHours: familyPolicy.completionHours,
        clock: "BUSINESS_HOURS",
        pauseBehavior: "PAUSE",
        warnBeforeHours: 2,
      },
      ADMIN
    );
    expect(store.getSlaPolicyForService("family-consultation").status).toBe("inactive");
  });

  it("refuses to archive the default policy but allows deactivating it", () => {
    const archived = store.saveSlaPolicy(
      { ...familyPolicy, serviceKey: DEFAULT_SLA_SERVICE_KEY, status: "archived" },
      ADMIN
    );
    expect(archived.ok).toBe(false);
    const deactivated = store.saveSlaPolicy(
      { ...familyPolicy, serviceKey: DEFAULT_SLA_SERVICE_KEY, status: "inactive" },
      ADMIN
    );
    expect(deactivated.ok).toBe(true);
  });

  it("falls back to the default row for a service with no policy of its own", () => {
    const fallback = store.getSlaPolicyForService("unknown-service");
    expect(fallback.serviceKey).toBe("unknown-service");
    const seeded = store.listSlaPolicies()[0]!;
    expect(fallback.responseHours).toBe(seeded.responseHours);
    expect(fallback.clock).toBe(seeded.clock);
  });

  it("protects the default row from deletion and refuses a missing one", () => {
    expect(store.deleteSlaPolicy(DEFAULT_SLA_SERVICE_KEY, ADMIN).ok).toBe(false);
    expect(store.deleteSlaPolicy("no-such-service", ADMIN).ok).toBe(false);
  });

  it("deletes a real policy", () => {
    const result = store.deleteSlaPolicy("family-consultation", ADMIN);
    expect(result.ok).toBe(true);
    expect(store.listSlaPolicies().some((p) => p.serviceKey === "family-consultation")).toBe(false);
    // Re-create it for the workflow tests below.
    store.saveSlaPolicy(familyPolicy, ADMIN);
  });
});

// ---------------------------------------------------------------------------
// §12 — SLA snapshot migration
// ---------------------------------------------------------------------------

describe("ensureRequestSla", () => {
  it("anchors the clock on the first assignment event, not on createdAt", () => {
    const row = seedRequest({ state: "MATCHING" });
    legalRequestDb.appendRequestEvent({
      id: `lre-${crypto.randomUUID()}`,
      requestId: row.id,
      fromState: "LAWYER_SELECTED",
      toState: "WAITING_FOR_ACCEPTANCE",
      actorId: ADMIN.userId,
      actorRole: "SUPER_ADMIN",
      note: null,
      createdAt: ANCHOR,
    });

    const migrated = store.ensureRequestSla(legalRequestDb.getRequestById(row.id)!);
    expect(migrated.sla?.assignedAt).toBe(ANCHOR);
    expect(migrated.sla?.responseDueAt).toBe(
      responseDeadline(
        store.getSlaPolicyForService("family-consultation"),
        ANCHOR,
        store.getWorkCalendar()
      )
    );
  });

  it("is idempotent — a second read does not write again", () => {
    const row = seedRequest();
    const first = store.ensureRequestSla(legalRequestDb.getRequestById(row.id)!);
    expect(first.sla).toBeTruthy();
    const stamped = legalRequestDb.getRequestById(row.id)!.updatedAt;

    const second = store.ensureRequestSla(legalRequestDb.getRequestById(row.id)!);
    expect(second.sla).toEqual(first.sla);
    expect(legalRequestDb.getRequestById(row.id)!.updatedAt).toBe(stamped);
  });

  it("gives a legacy request without a service the default policy", () => {
    const row = seedRequest({ serviceKey: undefined });
    const migrated = store.ensureRequestSla(row);
    expect(migrated.serviceKey).toBe(DEFAULT_SLA_SERVICE_KEY);
    expect(migrated.sla?.serviceKey).toBe(DEFAULT_SLA_SERVICE_KEY);
    expect(legalRequestDb.getRequestById(row.id)?.serviceKey).toBe(DEFAULT_SLA_SERVICE_KEY);
  });
});

describe("observeSla", () => {
  it("writes the breach marker once and keeps it sticky", () => {
    const row = seedRequest();
    const withSla = store.startReferralClock({ requestId: row.id, assignedAt: LONG_AGO })!;

    const breached = store.observeSla(withSla, NOW);
    expect(breached.sla?.breachedAt).toBe(NOW);

    const later = store.observeSla(
      legalRequestDb.getRequestById(row.id)!,
      "2031-01-01T00:00:00.000Z"
    );
    expect(later.sla?.breachedAt).toBe(NOW);
  });

  it("leaves a finished request alone", () => {
    const row = seedRequest();
    const withSla = store.startReferralClock({ requestId: row.id, assignedAt: LONG_AGO })!;
    const done = legalRequestDb.updateRequest(row.id, {
      sla: { ...withSla.sla!, completedAt: NOW },
    })!;
    expect(store.observeSla(done, "2031-01-01T00:00:00.000Z").sla?.breachedAt).toBeNull();
  });
});

describe("startReferralClock", () => {
  it("never restarts a clock that already exists", () => {
    const row = seedRequest();
    const first = store.startReferralClock({ requestId: row.id, assignedAt: ANCHOR })!;
    const second = store.startReferralClock({
      requestId: row.id,
      assignedAt: "2027-01-01T00:00:00.000Z",
    })!;
    expect(second.sla?.assignedAt).toBe(first.sla?.assignedAt);
    expect(second.sla?.assignedAt).toBe(ANCHOR);
  });

  it("returns null for a request that does not exist", () => {
    expect(store.startReferralClock({ requestId: "missing-request" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §6 — professional rates
// ---------------------------------------------------------------------------

describe("lawyer rates", () => {
  it("publishes a price and appends the change history", () => {
    const first = store.setLawyerRate({
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
      serviceKey: "family-consultation",
      amountToman: 700_000,
      unit: "FIXED",
      noteFa: "  شامل یک جلسه  ",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.rate.noteFa).toBe("شامل یک جلسه");

    const second = store.setLawyerRate({
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
      serviceKey: "family-consultation",
      amountToman: 990_000,
      unit: "FIXED",
    });
    expect(second.ok).toBe(true);

    expect(store.listLawyerRates(LAWYER_A)).toHaveLength(1);
    expect(store.getLawyerRate(LAWYER_A, "family-consultation")?.amountToman).toBe(990_000);

    const changes = store.listLawyerRateChanges(LAWYER_A);
    expect(changes).toHaveLength(2);
    // Newest first.
    expect(changes[0]).toMatchObject({
      previousAmountToman: 700_000,
      nextAmountToman: 990_000,
      actorId: LAWYER_A_ACTOR.userId,
    });
    expect(changes[1]).toMatchObject({ previousAmountToman: null, nextAmountToman: 700_000 });
  });

  // Pins the tie-break, not the clock. Two writes in the same millisecond both
  // carry the same `createdAt`, so comparing that field alone leaves the pair in
  // table order — oldest first — and this list is read as "newest first" (the
  // admin slices the first 30). The freezer is what makes the collision certain
  // instead of one-run-in-a-hundred; CI hit it twice before the fix.
  it("keeps two same-millisecond changes in newest-first order", () => {
    const frozen = new Date("2026-10-24T12:00:00.000Z");
    const spy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue(frozen.toISOString());
    try {
      const base = store.setLawyerRate({
        lawyerId: LAWYER_B,
        actor: LAWYER_B_ACTOR,
        serviceKey: "same-ms",
        amountToman: 100_000,
        unit: "FIXED",
      });
      expect(base.ok).toBe(true);
      const bumped = store.setLawyerRate({
        lawyerId: LAWYER_B,
        actor: LAWYER_B_ACTOR,
        serviceKey: "same-ms",
        amountToman: 250_000,
        unit: "FIXED",
      });
      expect(bumped.ok).toBe(true);
    } finally {
      spy.mockRestore();
    }

    const changes = store.listLawyerRateChanges(LAWYER_B);
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.createdAt === "2026-10-24T12:00:00.000Z")).toBe(true);
    expect(changes[0]).toMatchObject({ previousAmountToman: 100_000, nextAmountToman: 250_000 });
    expect(changes[1]).toMatchObject({ previousAmountToman: null, nextAmountToman: 100_000 });
  });

  it("refuses a price that is not a sane integer Toman amount", () => {
    const bad = [
      { amountToman: 1.5 },
      { amountToman: -1 },
      { amountToman: 100_000_000_001 },
      { unit: "WEEKLY" as "FIXED" },
      { serviceKey: " " },
    ];
    for (const patch of bad) {
      const result = store.setLawyerRate({
        lawyerId: LAWYER_A,
        actor: LAWYER_A_ACTOR,
        serviceKey: "family-consultation",
        amountToman: 500_000,
        unit: "FIXED",
        ...patch,
      });
      expect(result.ok).toBe(false);
    }
    expect(store.getLawyerRate(LAWYER_A, "family-consultation")?.amountToman).toBe(990_000);
  });

  it("never reprices a request that was already accepted", () => {
    const row = seedRequest();
    store.startReferralClock({ requestId: row.id, assignedAt: ANCHOR });

    const accepted = store.acceptRequest({
      requestId: row.id,
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.request.agreedRate?.amountToman).toBe(990_000);
    expect(accepted.request.caseId).toBeTruthy();

    store.setLawyerRate({
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
      serviceKey: "family-consultation",
      amountToman: 1_500_000,
      unit: "FIXED",
    });

    expect(
      legalRequestDb.getRequestById(row.id)?.agreedRate?.amountToman
    ).toBe(990_000);
    expect(store.getLawyerRate(LAWYER_A, "family-consultation")?.amountToman).toBe(1_500_000);
  });

  it("clears a price and records the removal as a nulled history row", () => {
    const result = store.clearLawyerRate({
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
      serviceKey: "family-consultation",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.change.nextAmountToman).toBeNull();
    expect(store.getLawyerRate(LAWYER_A, "family-consultation")).toBeNull();

    const missing = store.clearLawyerRate({
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
      serviceKey: "family-consultation",
    });
    expect(missing.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §7 — settlement account
// ---------------------------------------------------------------------------

describe("settlement account masking", () => {
  it("masks the IBAN, the account number and the card", () => {
    const maskedIban = store.maskIban("IR123456789012345678901234");
    expect(maskedIban.startsWith("IR12")).toBe(true);
    expect(maskedIban.endsWith("1234")).toBe(true);
    expect(maskedIban).toContain("•");
    expect(maskedIban).not.toContain("3456789012");

    expect(store.maskAccountNumber("1234567890")).toBe("••••••7890");
    expect(store.maskAccountNumber(null)).toBeNull();
    expect(store.maskIban("IR12")).toBe("••••");

    expect(
      store.maskBankAccount({
        holderName: "علی رضایی",
        bankName: "بانک ملت",
        iban: "IR123456789012345678901234",
        accountNumber: "1234567890",
        cardLast4: "1234",
      })
    ).toEqual({
      holderName: "علی رضایی",
      bankName: "بانک ملت",
      iban: maskedIban,
      accountNumber: "••••••7890",
      cardLast4: "••••1234",
      // The projection is already masks-only, so it passes through unchanged.
      cardMasked: null,
    });
  });

  it("passes the card projection through without un-masking it", () => {
    const masked = store.maskBankAccount({
      holderName: "سارا محمدی",
      bankName: "بانک پاسارگاد",
      iban: "IR123456789012345678901234",
      accountNumber: null,
      cardLast4: "1111",
      cardMasked: "411111 •••• •••• 1111",
    });
    expect(masked.cardMasked).toBe("411111 •••• •••• 1111");
  });

  it("validates the Iranian IBAN and its canonical form", () => {
    expect(store.normalizeAndValidateIban(" ir12 3456 7890 1234 5678 9012 34 ")).toBe(
      "IR123456789012345678901234"
    );
    expect(store.normalizeAndValidateIban("IR123")).toBeNull();
    expect(store.normalizeAndValidateIban("DE123456789012345678901234")).toBeNull();
  });
});

describe("settlement account lifecycle", () => {
  it("starts at NOT_SET and refuses an invalid submission without writing", () => {
    expect(store.getBankRecord(LAWYER_B).status).toBe("NOT_SET");

    const bad = [
      { holderName: "ع", bankName: "ملت", iban: "IR123" },
      { holderName: "علی رضایی", bankName: "م", iban: "IR123456789012345678901234" },
      { holderName: "علی رضایی", bankName: "ملت", iban: "IR12345678901234567890123" },
      {
        holderName: "علی رضایی",
        bankName: "ملت",
        iban: "IR123456789012345678901234",
        accountNumber: "12ab",
      },
      {
        holderName: "علی رضایی",
        bankName: "ملت",
        iban: "IR123456789012345678901234",
        cardLast4: "12",
      },
    ];
    for (const submission of bad) {
      const result = store.submitBankAccount({
        lawyerId: LAWYER_B,
        actor: LAWYER_B_ACTOR,
        submission,
      });
      expect(result.ok).toBe(false);
    }
    expect(store.getBankRecord(LAWYER_B).status).toBe("NOT_SET");
    expect(store.listBankEvents(LAWYER_B)).toHaveLength(0);
  });

  it("refuses to review an account that was never submitted", () => {
    const result = store.reviewBankAccount({
      lawyerId: "law-store-ghost",
      actor: ADMIN,
      review: { action: "VERIFY" },
    });
    expect(result.ok).toBe(false);
  });

  it("submits a normalized account for review with a masked event", () => {
    const result = store.submitBankAccount({
      lawyerId: LAWYER_B,
      actor: LAWYER_B_ACTOR,
      submission: {
        holderName: "  علی رضایی  ",
        bankName: " بانک ملت ",
        iban: " ir12 3456 7890 1234 5678 9012 34 ",
        accountNumber: " 1234567890 ",
        cardLast4: "card 1234",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.record.status).toBe("PENDING_REVIEW");
    expect(result.record.account?.iban).toBe("IR123456789012345678901234");
    expect(result.record.account?.holderName).toBe("علی رضایی");
    expect(result.record.account?.cardLast4).toBe("1234");
    expect(result.record.submittedAt).toBeTruthy();

    const events = store.listBankEvents(LAWYER_B);
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("SUBMITTED");
    expect(events[0]?.actorId).toBe(LAWYER_B_ACTOR.userId);
    expect(events[0]?.destinationMasked).toContain("•");
  });

  it("requires a recorded reason to send an account back for correction", () => {
    const result = store.reviewBankAccount({
      lawyerId: LAWYER_B,
      actor: ADMIN,
      review: { action: "REQUEST_CORRECTION", reason: "کم" },
    });
    expect(result.ok).toBe(false);
    expect(store.getBankRecord(LAWYER_B).status).toBe("PENDING_REVIEW");
  });

  it("verifies an account with the reviewer stamped", () => {
    const result = store.reviewBankAccount({
      lawyerId: LAWYER_B,
      actor: ADMIN,
      review: { action: "VERIFY" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.status).toBe("VERIFIED");
    expect(result.record.reviewedBy).toBe(ADMIN.userId);
    expect(result.record.reviewedAt).toBeTruthy();
    expect(store.listBankEvents(LAWYER_B)[0]?.action).toBe("VERIFIED");
  });

  it("returns an account for correction with the reason preserved", () => {
    const reason = "نام صاحب حساب با نام وکیل مطابقت ندارد.";
    const result = store.reviewBankAccount({
      lawyerId: LAWYER_B,
      actor: ADMIN,
      review: { action: "REQUEST_CORRECTION", reason },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.status).toBe("NEEDS_CORRECTION");
    expect(result.record.reviewNote).toBe(reason);

    const event = store.listBankEvents(LAWYER_B)[0]!;
    expect(event.action).toBe("CORRECTION_REQUESTED");
    expect(event.reason).toBe(reason);
    expect(event.actorRole).toBe("SUPER_ADMIN");
  });

  it("refuses an unknown review action", () => {
    const result = store.reviewBankAccount({
      lawyerId: LAWYER_B,
      actor: ADMIN,
      review: { action: "APPROVE" as "VERIFY" },
    });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §7 — the full settlement card
// ---------------------------------------------------------------------------
// A card is entered in full so the Luhn checksum can reject a typo, then
// reduced to BIN + last four. The PAN itself must never be persisted.

describe("settlement card", () => {
  // The canonical Luhn-valid test number (Visa's 4111…1111); not a real card.
  const VALID_CARD = "4111111111111111";
  const LUHN_BREAKING_CARD = "4111111111111112";
  const CARD_LAWYER = "law-store-card";

  it("projects a full card to BIN + bullets + last four", () => {
    expect(store.maskCardNumber(VALID_CARD)).toBe("411111 •••• •••• 1111");
    expect(store.maskCardNumber("4111 1111 1111 1111")).toBe("411111 •••• •••• 1111");
    expect(store.maskCardNumber("41111111")).toBe("••••1111");
  });

  it("rejects a card that fails the checksum without writing anything", () => {
    const result = store.submitBankAccount({
      lawyerId: CARD_LAWYER,
      actor: LAWYER_B_ACTOR,
      submission: {
        holderName: "سارا محمدی",
        bankName: "بانک پاسارگاد",
        iban: "IR123456789012345678901234",
        cardNumber: LUHN_BREAKING_CARD,
      },
    });
    expect(result.ok).toBe(false);
    expect(store.getBankRecord(CARD_LAWYER).status).toBe("NOT_SET");
    expect(store.listBankEvents(CARD_LAWYER)).toHaveLength(0);
  });

  it("rejects a card that is not 16 digits", () => {
    const result = store.submitBankAccount({
      lawyerId: CARD_LAWYER,
      actor: LAWYER_B_ACTOR,
      submission: {
        holderName: "سارا محمدی",
        bankName: "بانک پاسارگاد",
        iban: "IR123456789012345678901234",
        cardNumber: "411111111111",
      },
    });
    expect(result.ok).toBe(false);
  });

  it("stores only the projection, never the PAN", () => {
    const result = store.submitBankAccount({
      lawyerId: CARD_LAWYER,
      actor: LAWYER_B_ACTOR,
      submission: {
        holderName: "سارا محمدی",
        bankName: "بانک پاسارگاد",
        iban: "IR123456789012345678901234",
        cardNumber: VALID_CARD,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const account = result.record.account!;
    expect(account.cardLast4).toBe("1111");
    expect(account.cardMasked).toBe("411111 •••• •••• 1111");
    // The middle digits must not survive anywhere on the stored record.
    expect(JSON.stringify(account)).not.toContain(VALID_CARD);
  });
});

// ---------------------------------------------------------------------------
// §7 — an operator replacing the account on the lawyer's behalf
// ---------------------------------------------------------------------------

describe("admin bank replacement", () => {
  const REPLACE_LAWYER = "law-store-replace";
  const SUBMISSION = {
    holderName: "مریم کاظمی",
    bankName: "بانک صادرات",
    iban: "IR123456789012345678901234",
    accountNumber: "1234567890",
  };

  it("requires a real reason and writes nothing without one", () => {
    for (const reason of ["", "کم", "   "]) {
      const result = store.replaceBankAccountAsAdmin({
        lawyerId: REPLACE_LAWYER,
        actor: ADMIN,
        submission: SUBMISSION,
        reason,
      });
      expect(result.ok).toBe(false);
    }
    expect(store.getBankRecord(REPLACE_LAWYER).status).toBe("NOT_SET");
    expect(store.listBankEvents(REPLACE_LAWYER)).toHaveLength(0);
  });

  it("records ADMIN_UPDATED — not SUBMITTED — and returns to PENDING_REVIEW", () => {
    const before = store.submitBankAccount({
      lawyerId: REPLACE_LAWYER,
      actor: LAWYER_B_ACTOR,
      submission: { ...SUBMISSION, holderName: "نام قدیمی" },
    });
    expect(before.ok).toBe(true);
    store.reviewBankAccount({
      lawyerId: REPLACE_LAWYER,
      actor: ADMIN,
      review: { action: "VERIFY" },
    });
    expect(store.getBankRecord(REPLACE_LAWYER).status).toBe("VERIFIED");

    const reason = "وکیل تلفنی شمارهٔ شبا را اصلاح کرد.";
    const result = store.replaceBankAccountAsAdmin({
      lawyerId: REPLACE_LAWYER,
      actor: ADMIN,
      submission: SUBMISSION,
      reason,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A correction is never a self-approval: it goes back to review.
    expect(result.record.status).toBe("PENDING_REVIEW");
    expect(result.record.account?.holderName).toBe("مریم کاظمی");

    const events = store.listBankEvents(REPLACE_LAWYER);
    // The lawyer's own SUBMITTED row survives; the operator's row is distinct.
    expect(events.filter((e) => e.action === "ADMIN_UPDATED")).toHaveLength(1);
    expect(events.filter((e) => e.action === "SUBMITTED")).toHaveLength(1);
    const adminEvent = events.find((e) => e.action === "ADMIN_UPDATED")!;
    expect(adminEvent.actorId).toBe(ADMIN.userId);
    expect(adminEvent.reason).toBe(reason);
    expect(adminEvent.destinationMasked).toContain("•");
    expect(adminEvent.destinationMasked).not.toBe(SUBMISSION.iban);
  });

  it("keeps the whole log append-only across repeated operator edits", () => {
    const before = store.listBankEvents(REPLACE_LAWYER).length;
    const result = store.replaceBankAccountAsAdmin({
      lawyerId: REPLACE_LAWYER,
      actor: ADMIN,
      submission: { ...SUBMISSION, holderName: "مریم کاظمی‌نژاد" },
      reason: "اصلاح املاک نام صاحب حساب.",
    });
    expect(result.ok).toBe(true);
    const after = store.listBankEvents(REPLACE_LAWYER);
    expect(after).toHaveLength(before + 1);
    expect(after.filter((e) => e.action === "ADMIN_UPDATED")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// §5/§8 — admin deadline override
// ---------------------------------------------------------------------------

describe("overrideRequestDeadline", () => {
  function seeded(): { id: string; previousDueAt: string | null } {
    const row = seedRequest();
    const withSla = store.startReferralClock({ requestId: row.id, assignedAt: ANCHOR })!;
    return { id: row.id, previousDueAt: withSla.sla?.responseDueAt ?? null };
  }

  it("records previous and next values, the actor and the reason", () => {
    const { id, previousDueAt } = seeded();
    const nextDueAt = "2027-01-01T00:00:00.000Z";
    const result = store.overrideRequestDeadline({
      requestId: id,
      actor: ADMIN,
      phase: "RESPONSE",
      nextDueAt,
      reason: "تمدید رسمی مهلت پاسخ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sla = legalRequestDb.getRequestById(id)!.sla!;
    expect(sla.responseDueAt).toBe(nextDueAt);
    expect(sla.overrides.at(-1)).toMatchObject({
      phase: "RESPONSE",
      previousDueAt,
      nextDueAt,
      actorId: ADMIN.userId,
      reason: "تمدید رسمی مهلت پاسخ",
    });

    const action = store.listRequestActions(id).find((a) => a.kind === "SLA_OVERRIDDEN");
    expect(action?.visibility).toBe("internal");
    expect(action?.note).toBe("تمدید رسمی مهلت پاسخ");
    expect(action?.metadata).toMatchObject({ previousDueAt, nextDueAt });
  });

  it("refuses a short reason, an unparseable deadline and a finished phase", () => {
    const { id } = seeded();
    const base = {
      requestId: id,
      actor: ADMIN,
      phase: "RESPONSE" as const,
      nextDueAt: "2027-01-01T00:00:00.000Z",
      reason: "تمدید رسمی مهلت",
    };
    expect(store.overrideRequestDeadline({ ...base, reason: "کم" }).ok).toBe(false);
    expect(
      store.overrideRequestDeadline({ ...base, nextDueAt: "not-a-date" }).ok
    ).toBe(false);
    expect(store.overrideRequestDeadline({ ...base, phase: "DONE" }).ok).toBe(false);
  });

  it("returns not_found for a request that does not exist", () => {
    const result = store.overrideRequestDeadline({
      requestId: "missing-request",
      actor: ADMIN,
      phase: "RESPONSE",
      nextDueAt: null,
      reason: "تمدید رسمی مهلت",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// §8 — re-referral
// ---------------------------------------------------------------------------

describe("reassignRequest", () => {
  it("requires a reason", () => {
    const row = seedRequest();
    const result = store.reassignRequest({
      requestId: row.id,
      actor: ADMIN,
      lawyerId: LAWYER_B,
      reason: "کم",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_input");
  });

  it("refuses an in-flight engagement", () => {
    const row = seedRequest({ state: "IN_PROGRESS" });
    const result = store.reassignRequest({
      requestId: row.id,
      actor: ADMIN,
      lawyerId: LAWYER_B,
      reason: "ارجاع مجدد به وکیل دیگر",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("illegal_state");
      expect(result.messageFa).toContain("در حال انجام");
    }
    expect(legalRequestDb.getRequestById(row.id)?.selectedLawyerId).toBe(LAWYER_A);
  });

  it("re-refers a declined request with a fresh clock and no carried result", () => {
    const row = seedRequest();
    store.startReferralClock({ requestId: row.id, assignedAt: ANCHOR });
    const declined = store.declineRequest({
      requestId: row.id,
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
      reason: "تعارض منافع با موکل قبلی",
    });
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.request.state).toBe("DECLINED");
    expect(declined.request.sla?.declinedAt).toBeTruthy();
    expect(declined.request.sla?.assignedAt).toBe(ANCHOR);

    const reason = "ارجاع مجدد به وکیل دیگر پس از رد";
    const result = store.reassignRequest({
      requestId: row.id,
      actor: ADMIN,
      lawyerId: LAWYER_B,
      reason,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = legalRequestDb.getRequestById(row.id)!;
    expect(stored.state).toBe("WAITING_FOR_ACCEPTANCE");
    expect(stored.selectedLawyerId).toBe(LAWYER_B);
    expect(stored.agreedRate).toBeNull();
    expect(stored.result).toBeNull();
    // A fresh obligation: the old decline/view stamps are gone, the anchor moved.
    expect(stored.sla?.declinedAt).toBeNull();
    expect(stored.sla?.viewedAt).toBeNull();
    expect(stored.sla?.assignedAt).not.toBe(ANCHOR);

    const action = store.listRequestActions(row.id).find((a) => a.kind === "REASSIGNED");
    expect(action?.visibility).toBe("internal");
    expect(action?.note).toBe(reason);
    expect(action?.metadata).toMatchObject({
      lawyerId: LAWYER_B,
      previousLawyerId: LAWYER_A,
    });
  });

  it("refuses a request that is already closed", () => {
    const row = seedRequest({ state: "CLOSED" });
    const result = store.reassignRequest({
      requestId: row.id,
      actor: ADMIN,
      lawyerId: LAWYER_B,
      reason: "ارجاع مجدد به وکیل دیگر",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("illegal_state");
      expect(result.messageFa).toContain("بسته");
    }
  });
});

// ---------------------------------------------------------------------------
// Acceptance grants case access
// ---------------------------------------------------------------------------
// Accepting a referral is what creates the Case AND what grants the lawyer the
// `case_members` row every `/api/v1/cases/**` route authorizes against. Without
// it a lawyer would create a case and then be unable to open it (the routes
// answer 404, never 403).

describe("acceptRequest grants case access", () => {
  it("adds an ACTIVE lawyer member keyed on the actor's user id", () => {
    const row = seedRequest();
    store.startReferralClock({ requestId: row.id, assignedAt: ANCHOR });

    const accepted = store.acceptRequest({
      requestId: row.id,
      lawyerId: LAWYER_A,
      actor: LAWYER_A_ACTOR,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const caseId = accepted.request.caseId!;
    expect(caseId).toBeTruthy();

    const members = caseDb.getCaseMembers(caseId);
    const member = members.find((m) => m.account_id === LAWYER_A_ACTOR.userId);
    expect(member).toBeDefined();
    expect(member?.role).toBe("lawyer");
    expect(member?.status).toBe("active");
    expect(member?.granted_by_user_id).toBe(LAWYER_A_ACTOR.userId);

    // The SAME gate the case routes call resolves write access for the lawyer.
    const access = caseAccess.resolveCaseAccess(LAWYER_A_ACTOR.userId, caseId);
    expect(access).not.toBeNull();
    expect(access?.role).toBe("lawyer");
    expect(access?.isOwner).toBe(false);
    expect(access?.canWrite).toBe(true);

    // A stranger still resolves to null — the existence of the case is not leaked.
    expect(caseAccess.resolveCaseAccess("user-store-stranger", caseId)).toBeNull();
  });
});
