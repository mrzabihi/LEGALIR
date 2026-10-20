// ============================================================
// LEGALIR — Lawyer referral visibility · END-TO-END (temp DB)
// ============================================================
// The brief: «ارجاعات وکیل … در بخش‌های «پرونده‌ها»، «قراردادها»، «مشاوره‌ها»
// و «وکالت» برای همان وکیل قابل مشاهده باشد؛ دسترسی بر اساس مجوز و دامنهٔ
// ارجاع مدیریت شود؛ به موارد ارجاع‌نشده دسترسی نباشد؛ موارد تکراری نمایش
// داده نشود.»
//
// This drives the REAL route handlers against an isolated temp DB and
// asserts the four rules that sentence contains:
//
//   1. VISIBLE   — a contract referred to a lawyer is readable/listable by
//                  that lawyer, and the lawyer workspace surfaces it.
//   2. SCOPED    — a lawyer gets 404 for a contract they were never
//                  referred to (never 403: no existence leak).
//   3. READ-ONLY — the referral opens reads only; every mutation is 404.
//   4. DEDUPED   — two review rows for the same contract are ONE referral.
//
// `db.ts` resolves its store from the cwd at import time, so every module
// is imported DYNAMICALLY after chdir. A static value import would bind the
// real dev DB — see the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  LawyerProfile,
  LawyerReviewRequest,
  PropertyContract,
} from "@legalir/types";
import type * as DbModule from "../db";
import type * as ContractDbModule from "../contracts/db";
import type * as ReviewDbModule from "../contracts/review-db";

type Db = typeof DbModule;
type ContractDb = typeof ContractDbModule;
type ReviewDb = typeof ReviewDbModule;

let db: Db;
let contractDb: ContractDb;
let reviewDb: ReviewDb;

let ownerId: string;
let ownerSession: string;
let lawyerUserId: string;
let lawyerProfileId: string;
let lawyerSession: string;
let otherLawyerSession: string;
let otherLawyerUserId: string;

const CONTRACT_ID = "cnt-referral-1";
const OTHER_CONTRACT_ID = "cnt-referral-2";

let tmpDir: string;
let originalCwd: string;

let detailGet: (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let detailPatch: (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let collectionGet: (req: Request) => Promise<Response>;
let lifecycleGet: (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
let pdfGet: (
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
interface ReferralRow {
  id: string;
  kind: string;
  refId: string;
  surfaces: string[];
  titleFa: string;
}
let workspace: (userId: string) => Promise<{ referrals: ReferralRow[] }>;
let dashboard: (params: { userId: string }) => { referrals: ReferralRow[] };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function get(url: string, session?: string): Request {
  return new Request(url, {
    method: "GET",
    headers: session ? { cookie: `legalir-session=${session}` } : {},
  });
}

const BASE = "http://localhost/api/v1/property-contracts";

function seedContract(id: string, title: string): PropertyContract {
  const now = new Date().toISOString();
  return {
    id,
    referenceCode: `LGL-RENT-1405-${id.slice(-1)}00001`,
    userId: ownerId,
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    state: "READY_FOR_REVIEW",
    initiatorRole: "landlord",
    initiatorSide: "first",
    title,
    currentStep: "review",
    progress: 100,
    templateVersion: "1.0.0",
    schemaVersion: 1,
    data: { address: { neighborhood: "پاسداران", city: "تهران" } },
    currentVersionId: null,
    currentVersionNumber: 0,
    finalVersionId: null,
    finalizedAt: null,
    publicVerificationId: `vrf-${id}`,
    caseId: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as PropertyContract;
}

function seedReview(
  id: string,
  contractId: string,
  lawyerId: string | null,
  state: LawyerReviewRequest["state"] = "IN_PROGRESS"
): LawyerReviewRequest {
  const now = new Date().toISOString();
  return {
    id,
    contractId,
    contractVersionId: null,
    documentHash: null,
    requestedBy: ownerId,
    lawyerId,
    lawyerNameFa: lawyerId ? "وکیل آزمون" : null,
    mode: "NON_BLOCKING",
    state,
    category: "property",
    slaHours: 48,
    slaStartedAt: now,
    slaDueAt: null,
    summaryFa: null,
    blocksSigning: false,
    requestedAt: now,
    acceptedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as LawyerReviewRequest;
}

function seedProfile(id: string, userId: string, fullName: string): LawyerProfile {
  return {
    id,
    userId,
    fullName,
    licenseNumber: null,
    licenseYear: null,
    bio: "",
    avatarUrl: null,
    avatarType: "generated",
    professionalTitle: null,
    verificationStatus: "VERIFIED",
    verifiedAt: new Date().toISOString(),
    verificationNote: null,
    specializations: [],
    locations: [],
    languages: [],
    pricing: {},
    availability: [],
    performance: {},
    availabilityStatus: "accepting",
    acceptingRequests: true,
  } as unknown as LawyerProfile;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-referral-"));
  process.chdir(tmpDir);

  db = await import("../db");
  contractDb = await import("../contracts/db");
  reviewDb = await import("../contracts/review-db");

  const owner = db.createUser({ mobile: "09120000201", passwordHash: "x" });
  ownerId = owner.id;
  ownerSession = db.createSession(ownerId).id;

  // The referred lawyer: a real account PLUS a professional profile. The
  // referral row names the PROFILE id; access is resolved through the
  // account's user id — the two-id model this suite pins down.
  const lawyerUser = db.createUser({ mobile: "09120000202", passwordHash: "x" });
  lawyerUserId = lawyerUser.id;
  lawyerProfileId = "law-referral-1";
  db.writeTable("lawyer_profiles", [seedProfile(lawyerProfileId, lawyerUserId, "وکیل آزمون")]);
  lawyerSession = db.createSession(lawyerUserId).id;

  // A lawyer nobody referred anything to.
  const otherLawyer = db.createUser({ mobile: "09120000203", passwordHash: "x" });
  otherLawyerUserId = otherLawyer.id;
  db.writeTable("lawyer_profiles", [
    ...db.readTable<LawyerProfile>("lawyer_profiles"),
    seedProfile("law-referral-2", otherLawyer.id, "وکیل دیگر"),
  ]);
  otherLawyerSession = db.createSession(otherLawyer.id).id;

  contractDb.insertContract(seedContract(CONTRACT_ID, "اجاره‌نامهٔ ارجاع‌شده"));
  contractDb.insertContract(seedContract(OTHER_CONTRACT_ID, "اجاره‌نامهٔ بی‌ارجاع"));

  // One live referral on CONTRACT_ID. The second contract belongs to the
  // same owner but was never referred to anybody.
  reviewDb.insertLawyerReview(seedReview("lrev-1", CONTRACT_ID, lawyerProfileId));

  detailGet = (await import("@/app/api/v1/property-contracts/[id]/route"))
    .GET as typeof detailGet;
  detailPatch = (await import("@/app/api/v1/property-contracts/[id]/route"))
    .PATCH as typeof detailPatch;
  collectionGet = (await import("@/app/api/v1/property-contracts/route"))
    .GET as typeof collectionGet;
  lifecycleGet = (await import("@/app/api/v1/property-contracts/[id]/lifecycle/route"))
    .GET as typeof lifecycleGet;
  pdfGet = (await import("@/app/api/v1/property-contracts/[id]/pdf/route"))
    .GET as typeof pdfGet;
  workspace = (await import("../lawyer-workspace")).buildLawyerWorkspace as never;
  dashboard = (await import("../lawyer-portal/projections")).buildLawyerDashboard as never;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================

describe("rule 1 — the referred contract is visible to that lawyer", () => {
  it("GET detail returns the aggregate and marks the access as assigned", async () => {
    const res = await detailGet(get(`${BASE}/${CONTRACT_ID}`, lawyerSession), params(CONTRACT_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: string; access: string; referral: { id: string } | null; parties: unknown[] };
    };
    expect(body.data.id).toBe(CONTRACT_ID);
    expect(body.data.access).toBe("assigned");
    expect(body.data.referral?.id).toBe("lrev-1");
    // The full aggregate, not a partial body: the client caches it verbatim.
    expect(Array.isArray(body.data.parties)).toBe(true);
  });

  it("the owner still reads their own contract as owner", async () => {
    const res = await detailGet(get(`${BASE}/${CONTRACT_ID}`, ownerSession), params(CONTRACT_ID));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { access: string } };
    expect(body.data.access).toBe("owner");
  });

  it("the collection lists the referred contract alongside the lawyer's own", async () => {
    const res = await collectionGet(get(`${BASE}?pageSize=100`, lawyerSession));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        items: { id: string; access: string; referralId?: string | null }[];
      };
    };
    const referred = body.data.items.find((i) => i.id === CONTRACT_ID);
    expect(referred).toBeDefined();
    expect(referred!.access).toBe("assigned");
    expect(referred!.referralId).toBe("lrev-1");
    // The second, unreferred contract must NOT appear.
    expect(body.data.items.some((i) => i.id === OTHER_CONTRACT_ID)).toBe(false);
  });

  it("the lifecycle view renders for the reviewer, with every action stripped", async () => {
    const res = await lifecycleGet(
      get(`${BASE}/${CONTRACT_ID}/lifecycle`, lawyerSession),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        access: string;
        canPrepareForSignature: boolean;
        canSign: boolean;
        canFinalize: boolean;
        canSubmitForAdminReview: boolean;
        canSelfFinalize: boolean;
      };
    };
    expect(body.data.access).toBe("assigned");
    expect(body.data.canPrepareForSignature).toBe(false);
    expect(body.data.canSign).toBe(false);
    expect(body.data.canFinalize).toBe(false);
    expect(body.data.canSubmitForAdminReview).toBe(false);
    expect(body.data.canSelfFinalize).toBe(false);
  });

  it("the lawyer workspace surfaces the referral with its surface tag", async () => {
    const data = await workspace(lawyerUserId);
    const item = data.referrals.find((r) => r.id === `contract:${CONTRACT_ID}`);
    expect(item).toBeDefined();
    expect(item!.kind).toBe("contract");
    expect(item!.refId).toBe(CONTRACT_ID);
    expect(item!.surfaces).toContain("contract");
    expect(item!.titleFa).toContain("ارجاع‌شده");
  });

  it("the dashboard serves the SAME referral projection, not a second one", async () => {
    const data = dashboard({ userId: lawyerUserId });
    const item = data.referrals.find((r) => r.id === `contract:${CONTRACT_ID}`);
    expect(item).toBeDefined();
    expect(item!.surfaces).toContain("contract");
    // The unreferred contract is absent here too.
    expect(data.referrals.some((r) => r.refId === OTHER_CONTRACT_ID)).toBe(false);
  });
});

describe("rule 2 — nothing unreferred is reachable", () => {
  it("a contract the lawyer was never referred to answers 404", async () => {
    const res = await detailGet(
      get(`${BASE}/${OTHER_CONTRACT_ID}`, lawyerSession),
      params(OTHER_CONTRACT_ID)
    );
    expect(res.status).toBe(404);
  });

  it("an unrelated lawyer gets 404 for the referred contract", async () => {
    const res = await detailGet(
      get(`${BASE}/${CONTRACT_ID}`, otherLawyerSession),
      params(CONTRACT_ID)
    );
    expect(res.status).toBe(404);
  });

  it("an anonymous request is 401, never contract data", async () => {
    const res = await detailGet(get(`${BASE}/${CONTRACT_ID}`), params(CONTRACT_ID));
    expect(res.status).toBe(401);
  });

  it("a declined referral ends access — the same id now 404s", async () => {
    // Seed a THIRD contract so the earlier fixtures stay intact.
    const third = "cnt-referral-3";
    contractDb.insertContract(seedContract(third, "اجاره‌نامهٔ ردشده"));
    reviewDb.insertLawyerReview(seedReview("lrev-declined", third, lawyerProfileId, "DECLINED"));

    const res = await detailGet(get(`${BASE}/${third}`, lawyerSession), params(third));
    expect(res.status).toBe(404);
  });
});

describe("rule 3 — a referral is READ-ONLY", () => {
  it("PATCH on the referred contract answers 404 (owner-only guard)", async () => {
    const req = new Request(`${BASE}/${CONTRACT_ID}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: `legalir-session=${lawyerSession}`,
      },
      body: JSON.stringify({ title: "تلاش برای تغییر" }),
    });
    const res = await detailPatch(req, params(CONTRACT_ID));
    expect(res.status).toBe(404);
    // The stored row is untouched.
    expect(contractDb.getContractById(CONTRACT_ID)!.title).toBe("اجاره‌نامهٔ ارجاع‌شده");
  });

  it("the final PDF is readable by the reviewer (read, not write)", async () => {
    const res = await pdfGet(
      get(`${BASE}/${CONTRACT_ID}/pdf`, lawyerSession),
      params(CONTRACT_ID)
    );
    // With no version yet the route reports NO_VERSION (409); what matters
    // is that the guard PASSED — it is not the 404/401 of a denied read.
    expect([200, 409]).toContain(res.status);
  });
});

// ============================================================
// §5 — all FOUR sections, not just «قراردادها»
// ============================================================
// The brief names four surfaces: «پرونده‌ها»، «قراردادها»، «مشاوره‌ها» و
// «وکالت». Each reads a different source table, so proving one proves only
// one. These seed the other three and assert the SAME projection carries
// them — and that a case with a power of attorney stays ONE row tagged with
// both surfaces instead of two.
describe("§5 — the other three sections reach the same lawyer", () => {
  const CASE_ID = "case-referral-1";
  const CONSULT_ID = "req-referral-1";

  beforeAll(async () => {
    const now = new Date().toISOString();

    // مشاوره‌ها — a consultation the client routed to this lawyer.
    db.writeTable("legal_requests", [
      {
        id: CONSULT_ID,
        userId: ownerId,
        caseId: CASE_ID,
        conversationId: null,
        title: "مشاورهٔ ارجاع‌شده",
        category: "property",
        state: "WAITING_FOR_LAWYER",
        intakeAnswers: {},
        analysisId: null,
        selectedLawyerId: lawyerProfileId,
        orgId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // پرونده‌ها — an active non-owner membership keyed by the lawyer's USER
    // id, the shape the engagement route writes today.
    db.writeTable("cases", [
      {
        id: CASE_ID,
        user_id: ownerId,
        title: "پروندهٔ ارجاع‌شده",
        description: "",
        category: "property",
        status: "ACTIVE",
        priority: "normal",
        created_at: now,
        updated_at: now,
      },
    ]);
    db.writeTable("case_members", [
      {
        id: "cm-referral-1",
        case_id: CASE_ID,
        account_id: lawyerUserId,
        role: "lawyer",
        scopes: ["read"],
        status: "active",
        granted_at: now,
        granted_by_user_id: ownerId,
        revoked_at: null,
      },
    ]);

    // وکالت — a representation on that same case, naming the lawyer's
    // PROFILE id, so one case yields BOTH the «پرونده» and «وکالت» tags.
    db.writeTable("case_representations", [
      {
        id: "rep-referral-1",
        case_id: CASE_ID,
        lawyer_profile_id: lawyerProfileId,
        lawyer_user_id: lawyerUserId,
        document_type: "power_of_attorney",
        document_id: null,
        reference_number: null,
        issued_at: null,
        covered_proceeding_ids: [],
        authority_limits: null,
        valid_until: null,
        terminated_at: null,
        note: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  });

  it("«مشاوره‌ها» — the assigned consultation is listed once", async () => {
    const data = await workspace(lawyerUserId);
    const items = data.referrals.filter((r) => r.id === `consultation:${CONSULT_ID}`);
    expect(items, "the consultation referral is missing").toHaveLength(1);
    expect(items[0]!.kind).toBe("consultation");
    expect(items[0]!.surfaces).toEqual(["consultation"]);
    expect(items[0]!.titleFa).toBe("مشاورهٔ ارجاع‌شده");
  });

  it("«پرونده‌ها» — the shared case is listed once", async () => {
    const data = await workspace(lawyerUserId);
    const items = data.referrals.filter((r) => r.id === `case:${CASE_ID}`);
    expect(items, "the case referral is missing").toHaveLength(1);
    expect(items[0]!.kind).toBe("case");
    expect(items[0]!.surfaces).toContain("case");
  });

  it("«وکالت» — the same case carries the representation tag, still ONE row", async () => {
    const data = await workspace(lawyerUserId);
    const items = data.referrals.filter((r) => r.refId === CASE_ID);
    // One referral row, two surfaces — never two rows for one case.
    expect(items).toHaveLength(1);
    expect(items[0]!.surfaces).toContain("case");
    expect(items[0]!.surfaces).toContain("representation");
  });

  it("the dashboard sees all four surfaces, with no duplicate rows", async () => {
    const data = dashboard({ userId: lawyerUserId });
    const ids = data.referrals.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const surfaces = new Set(data.referrals.flatMap((r) => r.surfaces));
    expect(surfaces).toEqual(
      new Set(["contract", "consultation", "case", "representation"])
    );
  });

  it("a lawyer with no referral on these rows sees none of them", async () => {
    const data = await workspace(otherLawyerUserId);
    expect(data.referrals.some((r) => r.refId === CASE_ID)).toBe(false);
    expect(data.referrals.some((r) => r.refId === CONSULT_ID)).toBe(false);
  });
});

describe("rule 4 — one referral, never duplicated", () => {
  it("two review rows for one contract collapse into a single workspace item", async () => {
    reviewDb.insertLawyerReview(seedReview("lrev-1b", CONTRACT_ID, lawyerProfileId));
    const data = await workspace(lawyerUserId);
    const matches = data.referrals.filter((r) => r.id === `contract:${CONTRACT_ID}`);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.surfaces).toContain("contract");
  });

  it("the collection lists the contract exactly once", async () => {
    const res = await collectionGet(get(`${BASE}?pageSize=100`, lawyerSession));
    const body = (await res.json()) as { data: { items: { id: string }[] } };
    expect(body.data.items.filter((i) => i.id === CONTRACT_ID)).toHaveLength(1);
  });
});
