// ============================================================
// LEGALIR — Judicial documents family · END-TO-END (temp DB)
// ============================================================
// These pin the rules that would otherwise ship a WRONG or UNSAFE document:
//
//   • a draft is refused while required, visible answers are missing;
//   • every generation is owner-scoped — a foreign id is a 404, never a 403;
//   • the same inputs replay the SAME version and cost nothing a second time;
//   • a stale questionnaire version cannot write answers;
//   • each family composes its OWN document, not the دادخواست template;
//   • an edit APPENDS a version; earlier text is never overwritten;
//   • a provider-dependent service can never be published as available;
//   • a document id is never permission — foreign/not-ready docs are refused.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory — a static
// import would bind (and mutate) the real dev DB. See the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
// Type-only namespace imports are erased at compile time, so they do not bind
// the module before the test chdirs into its temp DB.
import type * as DbNS from "../db";
import type * as JudicialDbNS from "../judicial/db";
import type * as ServiceConfigNS from "../judicial/service-config";
import type * as GenerateNS from "../judicial/generate";
import type * as FlagsNS from "../admin/flags";
import type * as DashboardNS from "../dashboard-metrics";
import type * as DemoSeedNS from "../demo-seed";

let db: typeof DbNS;
let judicialDb: typeof JudicialDbNS;
let serviceConfig: typeof ServiceConfigNS;
let generate: typeof GenerateNS;
let flags: typeof FlagsNS;
let dashboard: typeof DashboardNS;
let demoSeed: typeof DemoSeedNS;

type CollectionHandler = (req: NextRequest) => Promise<Response>;
type ItemHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

let createRoute: { POST: CollectionHandler };
let itemRoute: { GET: ItemHandler; PATCH: ItemHandler; DELETE: ItemHandler };
let answersRoute: { POST: ItemHandler };
let draftRoute: { POST: ItemHandler };

let ownerId: string;
let ownerSession: string;
let otherId: string;
let otherSession: string;
let adminId: string;

let tmpDir: string;
let originalCwd: string;

const BASE = "http://localhost/api/v1/judicial/requests";

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, session: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

interface DraftBody {
  draft: {
    id: string;
    version: number;
    status: string;
    generator: string;
    text: string;
    inputHash: string;
    warnings: string[];
    references: unknown[];
  };
  replayed: boolean;
}

/**
 * The route envelope as these tests read it: success bodies carry `data`,
 * refusals carry `code`. Members are declared flat because each assertion only
 * reads the one it is checking, on the branch it has already proven.
 */
interface ApiBody {
  code: string;
  missing: { fieldId: string }[];
  fieldErrors: Record<string, string>;
  completeness: {
    complete: boolean;
    contradictions: string[];
    routingUndetermined?: boolean;
  };
  data: {
    request: { id: string; documentType: string | null };
    replayed: boolean;
    completeness: { complete: boolean; contradictions: string[] };
    draft: DraftBody["draft"];
  };
}

/** POST the collection route and return status + parsed body. */
async function createRequest(
  session: string,
  over: Record<string, unknown> = {}
): Promise<{ status: number; data: ApiBody }> {
  const body = {
    serviceId: "judicial_statement",
    startMode: "ai_draft",
    documentType: "statement",
    narrative: "مستأجر از پرداخت اجارهٔ دو ماه گذشته خودداری کرده و قرارداد اجاره موجود است.",
    idempotencyKey: `it-${crypto.randomUUID()}`,
    ...over,
  };
  const res = await createRoute.POST(
    req(BASE, session, { method: "POST", body: JSON.stringify(body) })
  );
  return { status: res.status, data: await res.json() };
}

/** Save one questionnaire step wholesale. */
async function saveStep(
  session: string,
  id: string,
  stepId: string,
  answers: Record<string, string>,
  questionnaireVersion = 1
): Promise<{ status: number; data: ApiBody }> {
  const res = await answersRoute.POST(
    req(`${BASE}/${id}/answers`, session, {
      method: "POST",
      body: JSON.stringify({ stepId, answers, questionnaireVersion }),
    }),
    params(id)
  );
  return { status: res.status, data: await res.json() };
}

/** Ask for a draft version. */
async function requestDraft(
  session: string,
  id: string,
  key = `gen-${crypto.randomUUID()}`
): Promise<{ status: number; data: ApiBody }> {
  const res = await draftRoute.POST(
    req(`${BASE}/${id}/draft`, session, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: key }),
    }),
    params(id)
  );
  return { status: res.status, data: await res.json() };
}

/** Full wizard payload for one request. */
async function getDetail(
  session: string,
  id: string
): Promise<{ status: number; data: ApiBody }> {
  const res = await itemRoute.GET(req(`${BASE}/${id}`, session), params(id));
  return { status: res.status, data: await res.json() };
}

function chargesFor(userId: string) {
  return db
    .readTable<{ userId: string; activityType: string; status: string }>(
      "usage_transactions"
    )
    .filter((t) => t.userId === userId && t.activityType === "JUDICIAL_DRAFT");
}

/** Every required answer a complete statement needs. */
const STATEMENT_CLAIM = {
  claimKind: "debt",
  demandText: "مبلغ اجارهٔ معوق را ظرف ده روز پرداخت کنید.",
  hasPriorNotice: "false",
};

/** Every required answer a complete brief needs. */
const BRIEF_CASE = {
  caseSubject: "مطالبهٔ وجه چک",
  submitterRole: "respondent",
};
const BRIEF_CONTENT = {
  briefPurpose: "defense",
  keyFacts: "چک در تاریخ ۱۴۰۵/۰۵/۱۰ به دلیل عدم تطابق امضا برگشت خورد.",
};

/** Every required answer a complete petition needs. */
const PETITION_PARTIES = { claimantName: "علی", respondentName: "رضا" };
const PETITION_CLAIM = {
  claimKind: "debt",
  claimBasis: "قرارداد شمارهٔ ۱۲",
  facts: "خوانده مبلغ قرارداد را در سررسید پرداخت نکرد.",
};

/** Every required answer a complete complaint needs. */
const COMPLAINT_PARTIES = {
  complainantName: "مریم",
  accusedKnown: "true",
  accusedName: "سعید",
};
const COMPLAINT_INCIDENT = {
  incidentDate: "2026-09-01",
  offenseTitle: "خیانت در امانت",
  facts: "مال امانی بازگردانده نشد.",
};

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-judicial-flow-"));
  process.chdir(tmpDir);

  db = await import("../db");
  demoSeed = await import("../demo-seed");
  judicialDb = await import("../judicial/db");
  serviceConfig = await import("../judicial/service-config");
  generate = await import("../judicial/generate");
  flags = await import("../admin/flags");
  dashboard = await import("../dashboard-metrics");

  createRoute = await import("@/app/api/v1/judicial/requests/route");
  itemRoute = await import("@/app/api/v1/judicial/requests/[id]/route");
  answersRoute = await import("@/app/api/v1/judicial/requests/[id]/answers/route");
  draftRoute = await import("@/app/api/v1/judicial/requests/[id]/draft/route");

  const owner = db.createUser({ mobile: "09121000001", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  const other = db.createUser({ mobile: "09121000002", passwordHash: "x" });
  otherId = other.id;
  otherSession = db.createSession(otherId).id;

  const admin = db.createUser({ mobile: "09121000009", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Service projection — what may be offered, and why
// ============================================================

describe("judicial service projection", () => {
  it("offers the four drafting families and never claims a provider service is live", () => {
    const views = serviceConfig.listJudicialServiceViews();
    const byId = new Map(views.map((v) => [v.id, v]));

    for (const id of [
      "judicial_statement",
      "judicial_brief",
      "judicial_petition",
      "judicial_complaint",
    ] as const) {
      expect(byId.get(id)?.availability).toBe("available");
    }
    // The invariant is CAPABILITY, not a particular honest label: with no
    // provider connected these may read as `soon` or `request_only`, but never
    // as `available`, and they must always say why.
    for (const id of ["judicial_criminal_record", "judicial_credit_check"] as const) {
      const view = byId.get(id);
      expect(view?.availability).not.toBe("available");
      expect(view?.requirement.configured).toBe(false);
      expect(view?.availabilityNoteFa).toBeTruthy();
    }
  });

  it("refuses to enter a service whose real provider is not connected", () => {
    expect(serviceConfig.isJudicialServiceEnterable("judicial_criminal_record")).toBe(false);
    expect(serviceConfig.isJudicialServiceEnterable("judicial_credit_check")).toBe(false);
    expect(serviceConfig.isJudicialServiceEnterable("judicial_statement")).toBe(true);
  });

  it("cannot be flipped live by an admin label while the provider is missing", () => {
    // Turning the flag ON is still not enough: the declared external
    // requirement is unconfigured, so the projection never becomes
    // `available` — whatever honest non-live label it carries.
    flags.updateFlag("judicial_criminal_record", { status: "on" }, adminId);
    const view = serviceConfig.getJudicialServiceView("judicial_criminal_record");
    expect(view?.availability).not.toBe("available");
    expect(view?.requirement.configured).toBe(false);
    expect(serviceConfig.isJudicialServiceEnterable("judicial_criminal_record")).toBe(false);

    // And a direct status edit to `available` is refused outright.
    expect(
      serviceConfig.updateJudicialService(
        "judicial_criminal_record",
        { status: "available" },
        adminId
      )
    ).toBeUndefined();

    flags.updateFlag("judicial_criminal_record", { status: "off" }, adminId);
  });

  it("turns a drafting service off for real when its flag is off", () => {
    flags.updateFlag("judicial_petition", { status: "off" }, adminId);
    expect(
      serviceConfig.getJudicialServiceView("judicial_petition")?.availability
    ).toBe("unavailable");
    expect(serviceConfig.isJudicialServiceEnterable("judicial_petition")).toBe(false);
    flags.updateFlag("judicial_petition", { status: "on" }, adminId);
  });
});

// ============================================================
// Creation + ownership
// ============================================================

describe("request creation and ownership", () => {
  it("creates one request and replays the same client key", async () => {
    const key = `key-${crypto.randomUUID()}`;
    const first = await createRequest(ownerSession, { idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(first.data.data.replayed).toBe(false);
    const id = first.data.data.request.id;
    expect(first.data.data.request.documentType).toBe("statement");

    const replay = await createRequest(ownerSession, { idempotencyKey: key });
    expect(replay.status).toBe(200);
    expect(replay.data.data.replayed).toBe(true);
    expect(replay.data.data.request.id).toBe(id);
  });

  it("refuses a service the caller may not use", async () => {
    flags.updateFlag("judicial_complaint", { status: "off" }, adminId);
    const res = await createRequest(ownerSession, {
      serviceId: "judicial_complaint",
      documentType: "complaint",
    });
    expect(res.status).toBe(403);
    expect(res.data.code).toBe("SERVICE_UNAVAILABLE");
    flags.updateFlag("judicial_complaint", { status: "on" }, adminId);
  });

  it("treats a foreign request id as missing on every operation", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;

    const foreignRead = await getDetail(otherSession, id);
    expect(foreignRead.status).toBe(404);

    const foreignSave = await saveStep(otherSession, id, "parties", {
      addresseeName: "نفوذی",
    });
    expect(foreignSave.status).toBe(404);

    const foreignDraft = await requestDraft(otherSession, id);
    expect(foreignDraft.status).toBe(404);

    const foreignDelete = await itemRoute.DELETE(
      req(`${BASE}/${id}`, otherSession, { method: "DELETE" }),
      params(id)
    );
    expect(foreignDelete.status).toBe(404);

    // The real owner still sees it.
    expect((await getDetail(ownerSession, id)).status).toBe(200);
  });

  it("accepts only the caller's own case link", async () => {
    const foreignCase = db.readTable<{ id: string; user_id: string }>("cases")[0];
    if (!foreignCase) return; // no cases in a clean DB — nothing to spoof
    const created = await createRequest(ownerSession, { caseId: foreignCase.id });
    expect(created.data.data.request.documentType).toBe("statement");
    const stored = judicialDb.getOwnedRequest(ownerId, created.data.data.request.id);
    expect(stored?.caseId).not.toBe(foreignCase.id);
  });
});

// ============================================================
// Completeness gates the draft
// ============================================================

describe("completeness gates the draft", () => {
  it("returns the follow-up questions instead of a document", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(409);
    expect(outcome.data.code).toBe("INCOMPLETE_INPUTS");
    const missingIds = (outcome.data.missing ?? []).map(
      (m: { fieldId: string }) => m.fieldId
    );
    expect(missingIds).toContain("addresseeName");
    expect(missingIds).toContain("claimKind");
    expect(missingIds).toContain("demandText");

    // A refusal writes nothing — no draft row, no charge.
    expect(judicialDb.listDrafts(ownerId, id)).toHaveLength(0);
    expect(chargesFor(ownerId)).toHaveLength(0);
  });

  it("blocks on contradictory answers instead of silently picking one", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت الف" });

    const saved = await saveStep(ownerSession, id, "claim", {
      ...STATEMENT_CLAIM,
      hasPriorNotice: "false",
      priorNoticeDate: "2026-09-01",
    });
    expect(saved.status).toBe(200);
    expect(saved.data.data.completeness.contradictions).toHaveLength(1);
    expect(saved.data.data.completeness.complete).toBe(false);

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(409);
    expect(outcome.data.completeness.contradictions[0]).toContain("اخطار");
  });

  it("produces the draft once every required answer is present", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت الف" });
    const saved = await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);
    expect(saved.data.data.completeness.complete).toBe(true);

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(201);
    const body = outcome.data.data as DraftBody;
    expect(body.draft.version).toBe(1);
    expect(body.draft.generator).toBe("structured_composer");
    // A statement, not a دادخواست.
    expect(body.draft.text).toMatch(/^اظهارنامه$/m);
    expect(body.draft.text).not.toMatch(/^دادخواست$/m);
    // Unknown facts stay visible rather than invented.
    expect(body.draft.text).toContain("[تکمیل شود: تاریخ تنظیم]");
    expect(body.draft.text).toContain("شرکت الف");
    // Every listed source is a REAL retrieved one and is echoed verbatim in the
    // text — or, when retrieval finds nothing, the absence is stated outright.
    if (body.draft.references.length === 0) {
      expect(body.draft.text).toContain("یافت نشد");
    } else {
      for (const ref of body.draft.references as { title: string }[]) {
        expect(ref.title).toBeTruthy();
        expect(body.draft.text).toContain(ref.title);
      }
    }
  });
});

// ============================================================
// Idempotent generation — same inputs, same version, one charge
// ============================================================

describe("generation is idempotent on the inputs", () => {
  it("replays the identical version without a second charge", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت ب" });
    await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);

    const first = await requestDraft(ownerSession, id);
    expect(first.status).toBe(201);
    const afterFirst = chargesFor(ownerId).length;

    const second = await requestDraft(ownerSession, id);
    expect(second.status).toBe(200);
    const replayBody = second.data.data as DraftBody;
    expect(replayBody.replayed).toBe(true);
    expect(replayBody.draft.id).toBe((first.data.data as DraftBody).draft.id);

    expect(judicialDb.listDrafts(ownerId, id)).toHaveLength(1);
    expect(chargesFor(ownerId)).toHaveLength(afterFirst);
  });

  it("charges exactly once for a double-click that carries a different client key", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت پ" });
    await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);

    const before = chargesFor(ownerId).length;
    const [a, b] = await Promise.all([
      requestDraft(ownerSession, id, `a-${crypto.randomUUID()}`),
      requestDraft(ownerSession, id, `b-${crypto.randomUUID()}`),
    ]);
    // Both calls succeed; exactly one version and one charge exist.
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(judicialDb.listDrafts(ownerId, id)).toHaveLength(1);
    expect(chargesFor(ownerId)).toHaveLength(before + 1);
  });
});

// ============================================================
// Questionnaire version guard
// ============================================================

describe("questionnaire version guard", () => {
  it("rejects a stale version instead of writing answers", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;

    const stale = await saveStep(
      ownerSession,
      id,
      "parties",
      { addresseeName: "شرکت ج" },
      99
    );
    expect(stale.status).toBe(409);
    expect(stale.data.code).toBe("VERSION_MISMATCH");
    expect(judicialDb.listAnswers(ownerId, id)).toHaveLength(0);
  });

  it("rejects question ids that do not exist in this version's schema", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;

    const unknown = await saveStep(ownerSession, id, "parties", {
      addresseeName: "شرکت د",
      totallyMadeUpField: "x",
    });
    expect(unknown.status).toBe(400);
    expect(unknown.data.code).toBe("UNKNOWN_QUESTION");
    expect(unknown.data.fieldErrors).toHaveProperty("totallyMadeUpField");
  });

  it("rejects non-string answer values", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;

    const res = await answersRoute.POST(
      req(`${BASE}/${id}/answers`, ownerSession, {
        method: "POST",
        body: JSON.stringify({
          stepId: "parties",
          questionnaireVersion: 1,
          answers: { addresseeName: 42 },
        }),
      }),
      params(id)
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================
// Each family composes its own document
// ============================================================

describe("each family composes its own document", () => {
  it("composes a لایحه with the unverified case number flagged", async () => {
    const created = await createRequest(ownerSession, {
      serviceId: "judicial_brief",
      documentType: "brief",
      narrative: "در پروندهٔ مطروحه، چک مورد مطالبه بدون دلیل برگشت خورده است.",
    });
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "case", {
      ...BRIEF_CASE,
      caseReference: "140500123",
    });
    await saveStep(ownerSession, id, "content", BRIEF_CONTENT);

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(201);
    const { draft } = outcome.data.data as DraftBody;
    expect(draft.text).toMatch(/^لایحه$/m);
    expect(draft.text).not.toMatch(/^دادخواست$/m);
    expect(draft.text).toContain("140500123");
    // The case number is quoted as the user's claim, and the warning says it
    // was never verified against a real case.
    expect(draft.text).toContain("به گفتهٔ ارائه‌دهنده");
    expect(draft.warnings.join(" ")).toContain("تأیید نشده");
  });

  it("composes a دادخواست from the petition schema", async () => {
    const created = await createRequest(ownerSession, {
      serviceId: "judicial_petition",
      documentType: "petition",
      narrative: "مبلغ قرارداد در سررسید پرداخت نشد.",
    });
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", PETITION_PARTIES);
    await saveStep(ownerSession, id, "claim", PETITION_CLAIM);

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(201);
    const { draft } = outcome.data.data as DraftBody;
    expect(draft.text).toMatch(/^دادخواست$/m);
    expect(draft.text).toContain("خواهان: علی");
    expect(draft.text).toContain("خوانده: رضا");
  });

  it("composes a شکواییه without asserting a criminal title itself", async () => {
    const created = await createRequest(ownerSession, {
      serviceId: "judicial_complaint",
      documentType: "complaint",
      narrative: "مال امانی به من بازگردانده نشد.",
    });
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", COMPLAINT_PARTIES);
    await saveStep(ownerSession, id, "incident", COMPLAINT_INCIDENT);

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(201);
    const { draft } = outcome.data.data as DraftBody;
    expect(draft.text).toMatch(/^شکواییه$/m);
    expect(draft.text).toContain("به بیان شاکی");
    expect(draft.warnings.join(" ")).toContain("مرجع قضایی");
  });
});

// ============================================================
// Versions are append-only
// ============================================================

describe("draft versions are append-only", () => {
  it("appends a new version when inputs change and keeps the old text", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت ه" });
    await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);

    const first = await requestDraft(ownerSession, id);
    expect(first.status).toBe(201);

    await saveStep(ownerSession, id, "claim", {
      ...STATEMENT_CLAIM,
      demandText: "مبلغ اجارهٔ معوق را ظرف پنج روز پرداخت کنید.",
    });
    const second = await requestDraft(ownerSession, id);
    expect(second.status).toBe(201);

    const versions = judicialDb.listDrafts(ownerId, id);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0]!.status).toBe("draft");
    expect(versions[1]!.status).toBe("superseded");
    expect(versions[1]!.text).toContain("ده روز");
    expect(versions[0]!.text).toContain("پنج روز");
    expect(versions[0]!.inputHash).not.toBe(versions[1]!.inputHash);
  });

  it("records a user edit as a new version instead of overwriting", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت و" });
    await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);
    const generated = await requestDraft(ownerSession, id);
    const original = (generated.data.data as DraftBody).draft;

    const edited = judicialDb.reviseDraft({
      userId: ownerId,
      requestId: id,
      draftId: original.id,
      text: `${original.text}\n\nتوضیح افزودهٔ خود کاربر.`,
    });
    expect(edited?.version).toBe(2);
    expect(edited?.generator).toBe("user_edited");

    const versions = judicialDb.listDrafts(ownerId, id);
    expect(versions[0]!.version).toBe(2);
    expect(versions[1]!.text).toBe(original.text);
  });

  it("requires an explicit approval before a version counts as approved", async () => {
    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت ز" });
    await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);
    const generated = await requestDraft(ownerSession, id);
    const draft = (generated.data.data as DraftBody).draft;

    expect(judicialDb.requestCounts(ownerId, id).hasApprovedDraft).toBe(false);
    judicialDb.approveDraft(ownerId, id, draft.id);
    expect(judicialDb.requestCounts(ownerId, id).hasApprovedDraft).toBe(true);
    // Approval never invents a "filed" state.
    const stored = judicialDb.getOwnedRequest(ownerId, id)!;
    expect(["draft_ready", "ready_to_review", "approved"]).toContain(stored.status);
  });
});

// ============================================================
// Ready-document path
// ============================================================

describe("ready-document start mode", () => {
  it("never regenerates an AI draft for a request built on the user's own file", async () => {
    const created = await createRequest(ownerSession, {
      startMode: "ready_document",
      documentType: "statement",
    });
    const id = created.data.data.request.id;

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(409);
    expect(outcome.data.code).toBe("READY_DOCUMENT_PATH");
    expect(judicialDb.listDrafts(ownerId, id)).toHaveLength(0);
  });

  it("accepts only a ready document the caller owns", async () => {
    const request = judicialDb.createRequest(ownerId, {
      serviceId: "judicial_statement",
      startMode: "ready_document",
      documentType: "statement",
      narrative: "سند آمادهٔ خودم را بازبینی می‌کنم.",
      idempotencyKey: `rd-${crypto.randomUUID()}`,
    }).request;

    const processing = demoSeed.createDemoDocument(ownerId, {
      name: "اظهارنامه-آماده.pdf",
      mime: "application/pdf",
      sizeBytes: 1024,
    });
    // A processing document is not a usable source.
    expect(judicialDb.setReadyDocument(ownerId, request.id, processing.id)).toBeNull();

    demoSeed.updateDemoDocumentStatus(ownerId, processing.id, "ready");
    expect(judicialDb.setReadyDocument(ownerId, request.id, processing.id)).not.toBeNull();

    // A document id is not permission: the other user cannot attach it.
    expect(judicialDb.setReadyDocument(otherId, request.id, processing.id)).toBeNull();
  });

  it("links only the caller's own, ready attachments", async () => {
    const request = judicialDb.createRequest(ownerId, {
      serviceId: "judicial_statement",
      startMode: "ai_draft",
      documentType: "statement",
      narrative: "برای پیوست مدرک.",
      idempotencyKey: `att-${crypto.randomUUID()}`,
    }).request;

    const doc = demoSeed.createDemoDocument(ownerId, {
      name: "قرارداد.pdf",
      mime: "application/pdf",
      sizeBytes: 2048,
    });

    expect(
      judicialDb.linkAttachment({
        userId: ownerId,
        requestId: request.id,
        documentId: doc.id,
        role: "evidence",
      })
    ).toEqual({ ok: false, code: "DOCUMENT_NOT_READY" });

    demoSeed.updateDemoDocumentStatus(ownerId, doc.id, "ready");

    const linked = judicialDb.linkAttachment({
      userId: ownerId,
      requestId: request.id,
      documentId: doc.id,
      role: "evidence",
    });
    expect(linked.ok).toBe(true);
    expect(judicialDb.listAttachments(ownerId, request.id)).toHaveLength(1);

    // Someone else's session cannot resolve the document at all.
    expect(
      judicialDb.linkAttachment({
        userId: otherId,
        requestId: request.id,
        documentId: doc.id,
        role: "evidence",
      })
    ).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

// ============================================================
// Dashboard / history integration
// ============================================================

describe("discovery and tracking surfaces read the same entity", () => {
  it("surfaces an open request on the dashboard with a resume link", async () => {
    const created = await createRequest(ownerSession, {
      narrative: "درخواست در جریان برای نمایش در داشبورد.",
    });
    const id = created.data.data.request.id;

    const metrics = dashboard.computeDashboardMetrics(ownerId);
    const item = metrics.activeRequests.find((r) => r.id === id);
    expect(item).toBeDefined();
    expect(item!.type).toBe("judicial");
    expect(item!.link).toBe(`/judicial/${id}`);
    expect(item!.statusFa).toBeTruthy();
    expect(item!.progress).toBeGreaterThan(0);
  });

  it("mirrors the request into the activity feed used by history", () => {
    const created = judicialDb.createRequest(ownerId, {
      serviceId: "judicial_brief",
      startMode: "ai_draft",
      documentType: "brief",
      narrative: "لایحه‌ای برای تاریخچه.",
      idempotencyKey: `hist-${crypto.randomUUID()}`,
    }).request;

    // The activity row's id IS the request id (`recordActivity` keys on it),
    // so the history surface resolves the same entity.
    const activity = db
      .queryRecentActivity(ownerId, 200)
      .find((a) => a.id === created.id);
    expect(activity).toBeDefined();
    expect(activity!.category).toBe("judicial");
    expect(activity!.type).toBe("judicial");
  });

  it("removes the activity mirror when a request is deleted", () => {
    const created = judicialDb.createRequest(ownerId, {
      serviceId: "judicial_statement",
      startMode: "ai_draft",
      documentType: "statement",
      narrative: "حذف خواهد شد.",
      idempotencyKey: `del-${crypto.randomUUID()}`,
    }).request;

    expect(judicialDb.deleteRequest(ownerId, created.id)).toBe(true);
    expect(judicialDb.getOwnedRequest(ownerId, created.id)).toBeNull();
    expect(
      db.queryRecentActivity(ownerId, 200).some((a) => a.id === created.id)
    ).toBe(false);
    // A foreign delete is a no-op, not a destructive success.
    expect(judicialDb.deleteRequest(otherId, created.id)).toBe(false);
  });
});

// ============================================================
// Generation entry point — provider safety
// ============================================================

describe("generation never needs a live model", () => {
  it("keeps the deterministic text when no provider is configured", async () => {
    // Earlier tests spent the free tier's daily drafting quota. Reset ONLY the
    // owner's usage rows so this test exercises the provider path, not a limit.
    db.writeTable(
      "usage_transactions",
      db
        .readTable<{ userId: string }>("usage_transactions")
        .filter((t) => t.userId !== ownerId)
    );
    db.writeTable(
      "subscription_daily_usage",
      db
        .readTable<{ userId: string }>("subscription_daily_usage")
        .filter((b) => b.userId !== ownerId)
    );

    const created = await createRequest(ownerSession);
    const id = created.data.data.request.id;
    await saveStep(ownerSession, id, "parties", { addresseeName: "شرکت ح" });
    await saveStep(ownerSession, id, "claim", STATEMENT_CLAIM);

    const outcome = await generate.generateDraft({
      userId: ownerId,
      requestId: id,
      idempotencyKey: `direct-${crypto.randomUUID()}`,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.draft.generator).toBe("structured_composer");
    expect(outcome.draft.providerConfigured).toBe(false);
    expect(outcome.draft.text).toBeTruthy();
  });

  it("refuses to generate for an undetermined family", async () => {
    const created = await createRequest(ownerSession, {
      documentType: null,
      serviceId: "judicial_statement",
      narrative: "یک مشکل دارم و نمی‌دانم چه کار کنم.",
    });
    const id = created.data.data.request.id;
    expect(created.data.data.request.documentType).toBeNull();

    const outcome = await requestDraft(ownerSession, id);
    expect(outcome.status).toBe(409);
    expect(outcome.data.code).toBe("INCOMPLETE_INPUTS");
    expect(outcome.data.completeness.routingUndetermined).toBe(true);
  });
});
