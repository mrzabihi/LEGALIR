// ============================================================
// LEGALIR — Admin organizations register · END-TO-END (temp DB)
// ============================================================
// The page is titled «کاربران و سازمان‌ها», so the legal entities must be a
// real, inspectable and operable surface. This suite drives the live admin
// dispatcher against an isolated temp DB and proves:
//
//   · the list carries REAL member/signatory counts and the owner's name —
//     never a synthesised number;
//   · the summary is computed over the WHOLE register, so a filtered page
//     still reports the true shape of the book of business;
//   · search matches the national id and the owner's name, not just the title;
//   · the dossier joins members to their real user identity (publicId,
//     display name, full E.164 mobile, Persian role label) and lists the
//     authorized signatories;
//   · a status change is validated against the seven product statuses,
//     written to the row, and audited with actor + before → after;
//   · an invalid status is refused AND audited as denied;
//   · a non-admin cannot read or mutate the register.
//
// `db.ts` resolves its store from the cwd at import time, so every module is
// imported DYNAMICALLY after chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type { Organization, OrganizationAuthorizedSignatory } from "@legalir/types";
import type * as DbModule from "../db";
import type * as OrgDbModule from "../org-db";
import type * as AuditModule from "../admin/audit";

type Db = typeof DbModule;
type OrgDb = typeof OrgDbModule;
type Audit = typeof AuditModule;

let db: Db;
let orgDb: OrgDb;
let audit: Audit;

type AdminHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ segments: string[] }> }
) => Promise<Response>;

let adminGet: AdminHandler;
let adminPatch: AdminHandler;

let adminId: string;
let adminSession: string;
let ownerUserId: string;

const ORG_A = "org-test-alpha";
const ORG_B = "org-test-beta";
const BASE = "http://localhost/api/v1/admin/organizations";

let tmpDir: string;
let originalCwd: string;

function segments(...parts: string[]): { params: Promise<{ segments: string[] }> } {
  return { params: Promise.resolve({ segments: parts }) };
}

function reqAs(session: string, url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `legalir-session=${session}`,
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

function adminReq(url: string, init?: RequestInit): NextRequest {
  return reqAs(adminSession, url, init);
}

function makeOrg(
  overrides: Partial<Organization> & Pick<Organization, "id" | "name">
): Organization {
  const now = new Date().toISOString();
  return {
    tradeName: null,
    legalType: "LIMITED_LIABILITY",
    nationalId: null,
    registrationNumber: null,
    economicCode: null,
    registrationDate: null,
    industry: null,
    province: null,
    city: null,
    address: null,
    postalCode: null,
    phone: null,
    email: null,
    website: null,
    status: "PROFILE_COMPLETE",
    ownerUserId,
    createdByUserId: ownerUserId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function signatory(
  orgId: string,
  overrides: Partial<OrganizationAuthorizedSignatory> = {}
): OrganizationAuthorizedSignatory {
  const now = new Date().toISOString();
  return {
    id: `sig-${crypto.randomUUID()}`,
    orgId,
    fullName: "رضا کریمی",
    nationalCode: "0012345678",
    position: "مدیرعامل",
    authorityType: "امضای منفرد",
    phone: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-org-admin-"));
  process.chdir(tmpDir);

  db = await import("../db");
  orgDb = await import("../org-db");
  audit = await import("../admin/audit");

  const route = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = route.GET as unknown as AdminHandler;
  adminPatch = route.PATCH as unknown as AdminHandler;

  const admin = db.createUser({ mobile: "09121110000", passwordHash: "x" });
  db.setUserRole(admin.id, "SUPER_ADMIN");
  adminId = admin.id;
  adminSession = db.createSession(adminId).id;

  // The representative who registered the entity — a real user row, so the
  // dossier can join the members to a live identity.
  const owner = db.createUser({ mobile: "09121110001", passwordHash: "x" });
  ownerUserId = owner.id;
  db.upsertProfile(ownerUserId, { displayName: "مریم رستمی" });

  orgDb.createOrganizationWithOwner({
    org: makeOrg({
      id: ORG_A,
      name: "شرکت الف",
      tradeName: "الف‌تک",
      nationalId: "10101010101",
      registrationNumber: "54321",
      province: "تهران",
      city: "تهران",
      status: "PENDING_VERIFICATION",
    }),
    ownerUserId,
    representativeTitle: "مدیرعامل",
  });

  // A second member, so the count is not trivially one.
  const secondUser = db.createUser({ mobile: "09121110002", passwordHash: "x" });
  db.upsertProfile(secondUser.id, { displayName: "حسین نوری" });
  orgDb.addOrgMember({
    id: "member-2",
    orgId: ORG_A,
    userId: secondUser.id,
    role: "COMPANY_ADMIN",
    title: "مدیر مالی",
    status: "active",
    invitedByUserId: ownerUserId,
    joinedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  orgDb.addSignatory(signatory(ORG_A));
  orgDb.addSignatory(signatory(ORG_A, { fullName: "زهرا موسوی", position: "عضو هیئت‌مدیره" }));

  // A second entity in a different status — the summary must count it even
  // while the list is filtered to the first.
  orgDb.createOrganizationWithOwner({
    org: makeOrg({
      id: ORG_B,
      name: "مؤسسه بتا",
      legalType: "INSTITUTE",
      status: "ACTIVE",
    }),
    ownerUserId,
  });
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// List + summary
// ============================================================

describe("GET /admin/organizations — the register", () => {
  it("reports real member/signatory counts and the owner's name, never an estimate", async () => {
    const res = await adminGet(adminReq(BASE), segments("organizations"));
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: {
        items: {
          id: string;
          memberCount: number;
          signatoryCount: number;
          ownerNameFa: string | null;
          legalTypeFa: string | null;
          statusFa: string;
        }[];
        summary: Record<string, number>;
      };
    };

    const row = data.items.find((i) => i.id === ORG_A);
    expect(row).toBeDefined();
    expect(row!.memberCount).toBe(2);
    expect(row!.signatoryCount).toBe(2);
    expect(row!.ownerNameFa).toBe("مریم رستمی");
    expect(row!.legalTypeFa).toBe("با مسئولیت محدود");
    expect(row!.statusFa).toBe("در انتظار تأیید");
  });

  it("summarises the WHOLE register even when the page is filtered", async () => {
    const res = await adminGet(
      adminReq(`${BASE}?status=PENDING_VERIFICATION`),
      segments("organizations")
    );
    const { data } = (await res.json()) as {
      data: { items: { id: string }[]; total: number; summary: Record<string, number> };
    };

    // Only the pending entity is listed…
    expect(data.items.map((i) => i.id)).toEqual([ORG_A]);
    // …but the summary still reports both.
    expect(data.summary["total"]).toBe(2);
    expect(data.summary["PENDING_VERIFICATION"]).toBe(1);
    expect(data.summary["ACTIVE"]).toBe(1);
    expect(data.summary["SUSPENDED"]).toBe(0);
  });

  it("searches the national id and the representative's name, not just the title", async () => {
    const byNationalId = await adminGet(
      adminReq(`${BASE}?search=10101010101`),
      segments("organizations")
    );
    const a = (await byNationalId.json()) as { data: { items: { id: string }[] } };
    expect(a.data.items.map((i) => i.id)).toEqual([ORG_A]);

    const byOwner = await adminGet(adminReq(`${BASE}?search=مریم`), segments("organizations"));
    const b = (await byOwner.json()) as { data: { items: { id: string }[] } };
    // Both entities share the same representative, so both are a match.
    expect(b.data.items.map((i) => i.id).sort()).toEqual([ORG_A, ORG_B]);
  });

  it("ignores an unknown status filter instead of returning an empty page", async () => {
    const res = await adminGet(
      adminReq(`${BASE}?status=NOT_A_STATUS`),
      segments("organizations")
    );
    const { data } = (await res.json()) as { data: { total: number } };
    expect(data.total).toBe(2);
  });
});

// ============================================================
// Dossier
// ============================================================

describe("GET /admin/organizations/:id — the dossier", () => {
  it("joins members to their real user identity", async () => {
    const res = await adminGet(adminReq(`${BASE}/${ORG_A}`), segments("organizations", ORG_A));
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: {
        id: string;
        ownerMobile: string | null;
        members: {
          userId: string;
          publicId: string | null;
          displayNameFa: string | null;
          mobile: string | null;
          roleFa: string;
        }[];
        signatories: { fullName: string }[];
      };
    };

    expect(data.id).toBe(ORG_A);
    // Admin panel shows the full E.164 number by design (team convention).
    expect(data.ownerMobile).toBe("+989121110001");

    const owner = data.members.find((m) => m.userId === ownerUserId);
    expect(owner).toBeDefined();
    expect(owner!.displayNameFa).toBe("مریم رستمی");
    expect(owner!.publicId).toMatch(/^LG-/);
    expect(owner!.mobile).toBe("+989121110001");
    expect(owner!.roleFa).toBe("مالک / نماینده سازمان");

    const second = data.members.find((m) => m.displayNameFa === "حسین نوری");
    expect(second?.roleFa).toBe("مدیر سازمان");

    expect(data.signatories.map((s) => s.fullName)).toEqual(["رضا کریمی", "زهرا موسوی"]);
  });

  it("answers 404 with a Persian message for an unknown id", async () => {
    const res = await adminGet(
      adminReq(`${BASE}/org-missing`),
      segments("organizations", "org-missing")
    );
    expect(res.status).toBe(404);
    // The admin envelope is flat: { code, message } (see lib/admin/http.ts).
    const body = (await res.json()) as { code?: string; message?: string };
    expect(body.code).toBe("ORG_NOT_FOUND");
    expect(body.message).toBe("سازمان یافت نشد");
  });
});

// ============================================================
// Status mutation + audit
// ============================================================

describe("PATCH /admin/organizations/:id — lifecycle", () => {
  it("refuses an unknown status, leaves the row untouched and audits the refusal", async () => {
    const res = await adminPatch(
      adminReq(`${BASE}/${ORG_A}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DELETED" }),
      }),
      segments("organizations", ORG_A)
    );
    expect(res.status).toBe(400);

    expect(orgDb.getOrganizationById(ORG_A)!.status).toBe("PENDING_VERIFICATION");

    const denied = audit.listAudit({
      action: "organization.status.change",
      resourceId: ORG_A,
      result: "denied",
    });
    expect(denied.total).toBeGreaterThan(0);
    expect(denied.items[0]!.reason).toBe("INVALID_STATUS");
  });

  it("writes a valid status and records actor + before → after", async () => {
    const res = await adminPatch(
      adminReq(`${BASE}/${ORG_A}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" }),
      }),
      segments("organizations", ORG_A)
    );
    expect(res.status).toBe(200);

    const { data } = (await res.json()) as {
      data: { status: string; statusFa: string; members: unknown[] };
    };
    expect(data.status).toBe("ACTIVE");
    expect(data.statusFa).toBe("فعال");
    // The mutation returns the FULL refreshed dossier, so the drawer needs no
    // second round-trip after saving.
    expect(data.members.length).toBe(2);

    expect(orgDb.getOrganizationById(ORG_A)!.status).toBe("ACTIVE");

    const ok = audit.listAudit({ action: "organization.status.change", result: "success" });
    const entry = ok.items.find((i) => i.resourceId === ORG_A);
    expect(entry).toBeDefined();
    expect(entry!.actorUserId).toBe(adminId);
    expect(entry!.before).toMatchObject({ status: "PENDING_VERIFICATION" });
    expect(entry!.after).toMatchObject({ status: "ACTIVE" });
  });

  it("refuses a missing status in the body", async () => {
    const res = await adminPatch(
      adminReq(`${BASE}/${ORG_B}`, { method: "PATCH", body: JSON.stringify({}) }),
      segments("organizations", ORG_B)
    );
    expect(res.status).toBe(400);
    expect(orgDb.getOrganizationById(ORG_B)!.status).toBe("ACTIVE");
  });
});

// ============================================================
// Permission boundary
// ============================================================

describe("permissions", () => {
  it("a non-admin cannot read the register", async () => {
    const plain = db.createUser({ mobile: "09121110009", passwordHash: "x" });
    const session = db.createSession(plain.id).id;

    const list = await adminGet(reqAs(session, BASE), segments("organizations"));
    expect(list.status).toBe(403);

    const detail = await adminGet(
      reqAs(session, `${BASE}/${ORG_A}`),
      segments("organizations", ORG_A)
    );
    expect(detail.status).toBe(403);
  });

  it("a non-admin cannot move an entity through its lifecycle", async () => {
    const plain = db.createUser({ mobile: "09121110010", passwordHash: "x" });
    const session = db.createSession(plain.id).id;
    const beforeStatus = orgDb.getOrganizationById(ORG_B)!.status;

    const res = await adminPatch(
      reqAs(session, `${BASE}/${ORG_B}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "SUSPENDED" }),
      }),
      segments("organizations", ORG_B)
    );
    expect(res.status).toBe(403);
    expect(orgDb.getOrganizationById(ORG_B)!.status).toBe(beforeStatus);
  });
});
