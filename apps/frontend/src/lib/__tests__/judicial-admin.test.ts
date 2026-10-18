// ============================================================
// LEGALIR — Judicial service management · admin authorization + release
// ============================================================
// The operator surface is a real control, not a label. This pins the two
// properties that make it safe to expose:
//
//   1. ROLE SEPARATION IS SERVER-SIDE. A plain user and an admin role that
//      does not hold service-management are refused on every `/admin/judicial`
//      endpoint — read AND write. Hiding the nav entry is never the boundary.
//
//   2. THE OPERATOR CANNOT LIE ABOUT CAPABILITY. A provider-dependent service
//      (criminal record, trade credit check) cannot be marked `available`
//      through this endpoint while its provider is unconfigured, the refusal
//      is recorded as a DENIED audit row, and the stored config is unchanged.
//      The same boundary holds for questionnaires: publishing a version never
//      mutates the live one underneath requests that already answered it.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory — a static import
// would bind (and mutate) the real dev DB. See the team convention.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { AdminAuditEntry, JudicialServiceView, JudicialQuestionnaire } from "@legalir/types";
// Type-only namespace imports are erased at compile time, so they do not bind
// the modules before the test chdirs into its temp DB.
import type * as DbNS from "../db";
import type * as AuditNS from "../admin/audit";

type Db = typeof DbNS;
type Audit = typeof AuditNS;

interface AdminCtx {
  params: Promise<{ segments?: string[] }>;
}

type AdminHandler = (req: NextRequest, ctx: AdminCtx) => Promise<Response>;

interface JudicialCatalog {
  services: JudicialServiceView[];
  configs: {
    id: string;
    titleFa: string;
    status: string;
    order: number;
    surfaces: { home: boolean; services: boolean; new: boolean; cases: boolean };
    requirement: { configured: boolean };
  }[];
  questionnaires: JudicialQuestionnaire[];
}

let db: Db;
let audit: Audit;
let adminGet: AdminHandler;
let adminPost: AdminHandler;
let adminPatch: AdminHandler;

let superSession: string;
let adminSession: string;
let contentSession: string;
let userSession: string;

let tmpDir: string;
let originalCwd: string;

const BASE = "http://localhost/api/v1/admin";

function segments(...parts: string[]): AdminCtx {
  return { params: Promise.resolve({ segments: parts }) };
}

function reqWith(session: string, url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

async function catalog(session = adminSession): Promise<JudicialCatalog> {
  const res = await adminGet(reqWith(session, `${BASE}/judicial`), segments("judicial"));
  const body = (await res.json()) as { data: JudicialCatalog };
  return body.data;
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-judicial-admin-"));
  process.chdir(tmpDir);

  db = await import("../db");
  audit = await import("../admin/audit");

  const route = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = route.GET as unknown as AdminHandler;
  adminPost = route.POST as unknown as AdminHandler;
  adminPatch = route.PATCH as unknown as AdminHandler;

  const superId = db.createUser({ mobile: "09121000011", passwordHash: "x" }).id;
  db.setUserRole(superId, "SUPER_ADMIN");
  superSession = db.createSession(superId).id;

  const adminId = db.createUser({ mobile: "09121000012", passwordHash: "x" }).id;
  db.setUserRole(adminId, "ADMIN");
  adminSession = db.createSession(adminId).id;

  const contentId = db.createUser({ mobile: "09121000013", passwordHash: "x" }).id;
  db.setUserRole(contentId, "ADMIN_CONTENT");
  contentSession = db.createSession(contentId).id;

  const userId = db.createUser({ mobile: "09121000014", passwordHash: "x" }).id;
  userSession = db.createSession(userId).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// 1. Authorization — the boundary is the server, not the nav
// ============================================================

describe("admin authorization", () => {
  it("refuses a plain user on read and write", async () => {
    const read = await adminGet(
      reqWith(userSession, `${BASE}/judicial`),
      segments("judicial")
    );
    expect(read.status).toBe(403);
    expect(((await read.json()) as { code: string }).code).toBe("FORBIDDEN");

    const write = await adminPatch(
      reqWith(userSession, `${BASE}/judicial/services/judicial_statement`, {
        method: "PATCH",
        body: JSON.stringify({ titleFa: "x" }),
      }),
      segments("judicial", "services", "judicial_statement")
    );
    expect(write.status).toBe(403);
  });

  it("refuses an admin role that holds no service-management permission", async () => {
    const read = await adminGet(
      reqWith(contentSession, `${BASE}/judicial`),
      segments("judicial")
    );
    expect(read.status).toBe(403);

    const publish = await adminPost(
      reqWith(contentSession, `${BASE}/judicial/questionnaires/statement:v1/publish`, {
        method: "POST",
      }),
      segments("judicial", "questionnaires", "statement:v1", "publish")
    );
    expect(publish.status).toBe(403);
  });

  it("allows an operator who holds the service permissions", async () => {
    const data = await catalog();
    expect(data.services).toHaveLength(6);
    expect(data.questionnaires.length).toBeGreaterThan(0);

    // The super-admin holds the same capability and sees the same catalog.
    const asSuper = await catalog(superSession);
    expect(asSuper.services.map((s) => s.id)).toEqual(data.services.map((s) => s.id));
  });
});

// ============================================================
// 2. The effective view tells the operator the truth
// ============================================================

describe("release view", () => {
  it("reports the four drafting services available and the two provider ones soon", async () => {
    const data = await catalog();
    const byId = new Map<string, JudicialServiceView>(
      data.services.map((s) => [s.id as string, s])
    );

    for (const id of [
      "judicial_statement",
      "judicial_brief",
      "judicial_petition",
      "judicial_complaint",
    ]) {
      expect(byId.get(id)?.availability).toBe("available");
    }
    // The invariant is CAPABILITY, not the particular honest label: with no
    // provider configured, neither service may ever read as `available`.
    for (const id of ["judicial_criminal_record", "judicial_credit_check"]) {
      const view = byId.get(id);
      expect(view?.requirement.configured).toBe(false);
      expect(view?.status).not.toBe("available");
      expect(view?.availability).not.toBe("available");
      expect(view?.statusNoteFa ?? view?.availabilityNoteFa).toBeTruthy();
    }
  });

  it("never lets a label change make a provider-dependent service available", async () => {
    const res = await adminPatch(
      reqWith(adminSession, `${BASE}/judicial/services/judicial_criminal_record`, {
        method: "PATCH",
        body: JSON.stringify({ status: "available", titleFa: "گواهی عدم سوءپیشینه" }),
      }),
      segments("judicial", "services", "judicial_criminal_record")
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("PROVIDER_NOT_CONFIGURED");

    // The module refused, and the stored config still says `soon`.
    const data = await catalog();
    const stored = data.configs.find((c) => c.id === "judicial_criminal_record");
    expect(stored?.status).toBe("soon");
    expect(stored?.requirement.configured).toBe(false);

    const denied = audit.listAudit({
      action: "judicial.service.update",
      resourceId: "judicial_criminal_record",
      result: "denied",
    });
    expect(denied.total).toBe(1);
    expect(denied.items[0]?.reason).toBe("UNCONFIGURED_PROVIDER");
  });
});

// ============================================================
// 3. A real edit is applied, audited and reflected on stored state
// ============================================================

describe("service edit", () => {
  it("applies an operator edit and records before → after", async () => {
    const res = await adminPatch(
      reqWith(adminSession, `${BASE}/judicial/services/judicial_brief`, {
        method: "PATCH",
        body: JSON.stringify({ titleFa: "لایحهٔ دفاعیه", order: 3, surfaces: { home: false } }),
      }),
      segments("judicial", "services", "judicial_brief")
    );
    expect(res.status).toBe(200);

    const data = await catalog();
    const stored = data.configs.find((c) => c.id === "judicial_brief")!;
    expect(stored.titleFa).toBe("لایحهٔ دفاعیه");
    expect(stored.order).toBe(3);
    expect(stored.surfaces.home).toBe(false);

    const logged = audit.listAudit({
      action: "judicial.service.update",
      resourceId: "judicial_brief",
    });
    expect(logged.total).toBe(1);
    expect(logged.items[0]?.result).toBe("success");
    expect(logged.items[0]?.actorUserId).toBeTruthy();
    expect(logged.items[0]?.before).toMatchObject({ order: expect.any(Number) });
    expect(logged.items[0]?.after).toMatchObject({ order: 3 });
  });

  it("rejects a malformed field instead of silently ignoring it", async () => {
    const bad = await adminPatch(
      reqWith(adminSession, `${BASE}/judicial/services/judicial_brief`, {
        method: "PATCH",
        body: JSON.stringify({ status: "live" }),
      }),
      segments("judicial", "services", "judicial_brief")
    );
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { code: string }).code).toBe("INVALID_BODY");

    const empty = await adminPatch(
      reqWith(adminSession, `${BASE}/judicial/services/judicial_brief`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      segments("judicial", "services", "judicial_brief")
    );
    expect(empty.status).toBe(400);

    const missing = await adminPatch(
      reqWith(adminSession, `${BASE}/judicial/services/no_such_service`, {
        method: "PATCH",
        body: JSON.stringify({ order: 1 }),
      }),
      segments("judicial", "services", "no_such_service")
    );
    expect(missing.status).toBe(404);
  });
});

// ============================================================
// 4. Questionnaire versions are created, published and never mutated
// ============================================================

describe("questionnaire release", () => {
  it("clones a new DRAFT version without touching the live one", async () => {
    const res = await adminPost(
      reqWith(adminSession, `${BASE}/judicial/questionnaires`, {
        method: "POST",
        body: JSON.stringify({ documentType: "statement" }),
      }),
      segments("judicial", "questionnaires")
    );
    expect(res.status).toBe(201);
    const created = ((await res.json()) as { data: JudicialQuestionnaire }).data;
    expect(created.documentType).toBe("statement");
    expect(created.status).toBe("draft");
    expect(created.version).toBeGreaterThan(1);

    const list = await adminGet(
      reqWith(adminSession, `${BASE}/judicial/questionnaires/statement`),
      segments("judicial", "questionnaires", "statement")
    );
    expect(list.status).toBe(200);
    const versions = ((await list.json()) as { data: { items: JudicialQuestionnaire[] } })
      .data.items;
    // Newest first, and the live version is still the published one.
    expect(versions[0]?.version).toBe(created.version);
    const live = versions.find((v) => v.status === "published");
    expect(live?.version).toBeLessThan(created.version);
  });

  it("refuses an unknown document type", async () => {
    const res = await adminPost(
      reqWith(adminSession, `${BASE}/judicial/questionnaires`, {
        method: "POST",
        body: JSON.stringify({ documentType: "memo" }),
      }),
      segments("judicial", "questionnaires")
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("INVALID_DOCUMENT_TYPE");
  });

  it("publishes the new version and audits both steps", async () => {
    const data = await catalog();
    const draft = data.questionnaires
      .filter((q) => q.documentType === "statement" && q.status === "draft")
      .sort((a, b) => b.version - a.version)[0];
    expect(draft).toBeTruthy();

    const res = await adminPost(
      reqWith(adminSession, `${BASE}/judicial/questionnaires/${draft!.id}/publish`, {
        method: "POST",
      }),
      segments("judicial", "questionnaires", draft!.id, "publish")
    );
    expect(res.status).toBe(200);
    const published = ((await res.json()) as { data: JudicialQuestionnaire }).data;
    expect(published.status).toBe("published");
    expect(published.publishedBy).toBeTruthy();

    expect(audit.listAudit({ action: "judicial.questionnaire.create_version" }).total).toBe(1);
    const publishLog = audit.listAudit({ action: "judicial.questionnaire.publish" });
    expect(publishLog.total).toBe(1);
    expect(publishLog.items[0]?.resourceId).toBe(draft!.id);
  });

  it("retires the previous version but keeps it resolvable for pinned requests", async () => {
    const data = await catalog();
    const statement = data.questionnaires
      .filter((q) => q.documentType === "statement")
      .sort((a, b) => b.version - a.version);
    const live = statement.find((q) => q.status === "published")!;
    const older = statement.filter((q) => q.version < live.version);

    // Every older version is retired — there is exactly one live schema.
    for (const old of older) expect(old.status).toBe("retired");

    // Retirement is a release label, not a deletion: a request pinned to an
    // older version still resolves that exact schema. This is what keeps
    // already-answered drafts reviewable after an operator publishes anew.
    const questionnaires = await import("../judicial/questionnaires");
    const pinned = questionnaires.getQuestionnaireVersion("statement", older[0]!.version);
    expect(pinned?.id).toBe(older[0]!.id);
    expect(pinned?.status).toBe("retired");
    expect(questionnaires.getQuestionnaireVersion("statement", live.version)?.id).toBe(live.id);
  });
});

// ============================================================
// 5. Every sensitive write is attributable
// ============================================================

describe("audit trail", () => {
  it("carries the actor, role and a timestamp on each entry", async () => {
    const rows = audit.listAudit({ resourceType: "judicial_service" })
      .items as AdminAuditEntry[];
    const success = rows.find((r) => r.result === "success");
    expect(success).toBeTruthy();
    expect(success!.actorUserId).toBeTruthy();
    expect(success!.actorRole).toBe("ADMIN");
    expect(Date.parse(success!.createdAt)).not.toBeNaN();
  });
});
