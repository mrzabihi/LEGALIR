// ============================================================
// LEGALIR — Authorization (IDOR / BOLA) test suite (PART 15 + PART 24)
// ============================================================
// The spec is explicit:
//   • A user must NEVER access another user's case / document / contract.
//   • A lawyer must NEVER reach another lawyer's client by changing an id.
//   • An org member must NEVER reach another organization's resources.
//   • An unverified lawyer must NEVER receive a case requiring verification.
//
// Every route handler is exercised directly with a forged session cookie
// belonging to a DIFFERENT user than the resource owner. The expected
// answer is always 404 (never 403) so the existence of a foreign resource
// is not leaked.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Session + user layer (auth)
// ---------------------------------------------------------------------------

const sessions = new Map<string, { id: string; userId: string }>();
const users = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/db", () => ({
  findSessionById: (id: string) => sessions.get(id),
  findUserById: (id: string) => users.get(id),
  readTable: () => [],
  getAccountType: () => "individual",
  recordActivity: vi.fn(),
  removeActivity: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Case layer — two cases owned by two different users
// ---------------------------------------------------------------------------

const CASE_A = "case-owned-by-A";
const CASE_B = "case-owned-by-B";

const cases = new Map<string, Record<string, unknown>>([
  [CASE_A, { id: CASE_A, user_id: "user-A", title: "پرونده الف", description: "…", category: "family", status: "ACTIVE", priority: "medium", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }],
  [CASE_B, { id: CASE_B, user_id: "user-B", title: "پرونده ب", description: "…", category: "family", status: "ACTIVE", priority: "medium", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }],
]);

const caseDocuments = new Map<string, Record<string, unknown>[]>([
  [CASE_A, [{ id: "link-1", case_id: CASE_A, document_id: "doc-A", added_by_user_id: "user-A", created_at: "2026-08-01T00:00:00Z" }]],
  [CASE_B, [{ id: "link-2", case_id: CASE_B, document_id: "doc-B", added_by_user_id: "user-B", created_at: "2026-08-01T00:00:00Z" }]],
]);

const caseDeadlines = new Map<string, Record<string, unknown>[]>([
  [CASE_A, [{ id: "dl-A", case_id: CASE_A, title: "مهلت الف", due_at: "2026-09-01T00:00:00Z", source: "user", source_ref: null, needs_confirmation: false, completed: false, created_at: "2026-08-01T00:00:00Z" }]],
  [CASE_B, [{ id: "dl-B", case_id: CASE_B, title: "مهلت ب", due_at: "2026-09-01T00:00:00Z", source: "user", source_ref: null, needs_confirmation: false, completed: false, created_at: "2026-08-01T00:00:00Z" }]],
]);

vi.mock("@/lib/case-db", () => ({
  getCaseById: (id: string) => cases.get(id),
  updateCase: vi.fn(),
  getCaseTimeline: () => [],
  getCaseTasks: () => [],
  getCaseDocuments: (caseId: string) => caseDocuments.get(caseId) ?? [],
  getCaseDeadlines: (caseId: string) => caseDeadlines.get(caseId) ?? [],
  linkCaseDocument: vi.fn(),
  unlinkCaseDocument: vi.fn(),
  createCaseDeadline: vi.fn(),
  updateCaseDeadline: vi.fn(),
  deleteCaseDeadline: vi.fn(),
  addCaseTimelineEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Document layer — each document belongs to exactly one user
// ---------------------------------------------------------------------------

const documents = new Map<string, { id: string; userId: string; name: string; mime: string; sizeBytes: number; status: string; createdAt: string; updatedAt: string }>([
  ["doc-A", { id: "doc-A", userId: "user-A", name: "سند الف.pdf", mime: "application/pdf", sizeBytes: 1000, status: "ready", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" }],
  ["doc-B", { id: "doc-B", userId: "user-B", name: "سند ب.pdf", mime: "application/pdf", sizeBytes: 1000, status: "ready", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" }],
]);

vi.mock("@/lib/demo-seed", () => ({
  getDemoDocument: (userId: string, id: string) => {
    const doc = documents.get(id);
    return doc && doc.userId === userId ? doc : undefined;
  },
  deleteDemoDocument: vi.fn(),
  deleteDemoRelationshipsFor: vi.fn(),
}));

vi.mock("@/lib/document-storage", () => ({
  deleteDocumentFile: vi.fn(),
  documentFileReference: () => null,
}));

// ---------------------------------------------------------------------------
// Contract layer
// ---------------------------------------------------------------------------

vi.mock("@/lib/contracts/db", () => ({
  listContractsForUser: (userId: string) =>
    userId === "user-A"
      ? [{ id: "ct-A", caseId: CASE_A, referenceCode: "R-1", title: "قرارداد الف", typeFa: "اجاره", state: "draft", progress: 10, updatedAt: "2026-08-01T00:00:00Z" }]
      : [{ id: "ct-B", caseId: CASE_B, referenceCode: "R-2", title: "قرارداد ب", typeFa: "اجاره", state: "draft", progress: 10, updatedAt: "2026-08-01T00:00:00Z" }],
}));

// ---------------------------------------------------------------------------
// Lawyer layer
// ---------------------------------------------------------------------------

vi.mock("@/lib/lawyer-db", () => ({
  setVerificationStatus: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Route handlers under test
// ---------------------------------------------------------------------------

import { GET as getCase, PATCH as patchCase } from "@/app/api/v1/cases/[id]/route";
import {
  GET as getCaseDocs,
  POST as postCaseDoc,
  DELETE as deleteCaseDoc,
} from "@/app/api/v1/cases/[id]/documents/route";
import {
  GET as getCaseDeadlines,
  POST as postCaseDeadline,
  PATCH as patchCaseDeadline,
  DELETE as deleteCaseDeadline,
} from "@/app/api/v1/cases/[id]/deadlines/route";
import { GET as getDocument, DELETE as deleteDocument } from "@/app/api/v1/documents/[id]/route";
import { POST as verifyLawyer } from "@/app/api/v1/admin/lawyers/[id]/verification/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signIn(sessionId: string, userId: string) {
  sessions.set(sessionId, { id: sessionId, userId });
}

function req(url: string, sessionId: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: { cookie: `legalir-session=${sessionId}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  }) as unknown as NextRequest;
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  sessions.clear();
  users.clear();
  users.set("user-A", { id: "user-A", role: "USER", platformAccountType: "PERSONAL" });
  users.set("user-B", { id: "user-B", role: "USER", platformAccountType: "PERSONAL" });
  users.set("admin", { id: "admin", role: "ADMIN", platformAccountType: "PERSONAL" });
  signIn("sess-A", "user-A");
  signIn("sess-B", "user-B");
  signIn("sess-admin", "admin");
});

// ============================================================
// 1. Unauthenticated callers are rejected everywhere
// ============================================================

describe("unauthenticated access", () => {
  it("case GET returns 401 without a session", async () => {
    const res = await getCase(new Request(`http://localhost/api/v1/cases/${CASE_A}`) as unknown as NextRequest, params(CASE_A));
    expect(res.status).toBe(401);
  });

  it("case documents GET returns 401 without a session", async () => {
    const res = await getCaseDocs(new Request(`http://localhost/api/v1/cases/${CASE_A}/documents`) as unknown as NextRequest, params(CASE_A));
    expect(res.status).toBe(401);
  });

  it("case deadlines GET returns 401 without a session", async () => {
    const res = await getCaseDeadlines(new Request(`http://localhost/api/v1/cases/${CASE_A}/deadlines`) as unknown as NextRequest, params(CASE_A));
    expect(res.status).toBe(401);
  });

  it("document GET returns 401 without a session", async () => {
    const res = await getDocument(new Request("http://localhost/api/v1/documents/doc-A") as unknown as NextRequest, params("doc-A"));
    expect(res.status).toBe(401);
  });
});

// ============================================================
// 2. Cross-user case access (BOLA on the case id)
// ============================================================

describe("case ownership (BOLA)", () => {
  it("user B cannot read user A's case — 404, not 403", async () => {
    const res = await getCase(req(`http://localhost/api/v1/cases/${CASE_A}`, "sess-B"), params(CASE_A));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("user B cannot patch user A's case", async () => {
    const res = await patchCase(
      req(`http://localhost/api/v1/cases/${CASE_A}`, "sess-B", { method: "PATCH", body: JSON.stringify({ title: "hijacked" }) }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
  });

  it("the owner can read their own case", async () => {
    const res = await getCase(req(`http://localhost/api/v1/cases/${CASE_A}`, "sess-A"), params(CASE_A));
    expect(res.status).toBe(200);
    expect((await res.json()).data.case.id).toBe(CASE_A);
  });
});

// ============================================================
// 3. Case documents — the DOUBLE ownership check
// ============================================================

describe("case documents (double IDOR guard)", () => {
  it("user B cannot list documents of user A's case", async () => {
    const res = await getCaseDocs(req(`http://localhost/api/v1/cases/${CASE_A}/documents`, "sess-B"), params(CASE_A));
    expect(res.status).toBe(404);
  });

  it("user B cannot attach a document to user A's case", async () => {
    const res = await postCaseDoc(
      req(`http://localhost/api/v1/cases/${CASE_A}/documents`, "sess-B", { method: "POST", body: JSON.stringify({ documentId: "doc-B" }) }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
  });

  it("user A cannot attach user B's document to their OWN case", async () => {
    // The case belongs to A, but the document belongs to B — the second
    // ownership check must reject it.
    const res = await postCaseDoc(
      req(`http://localhost/api/v1/cases/${CASE_A}/documents`, "sess-A", { method: "POST", body: JSON.stringify({ documentId: "doc-B" }) }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("user B cannot detach a document from user A's case", async () => {
    const res = await deleteCaseDoc(
      req(`http://localhost/api/v1/cases/${CASE_A}/documents?documentId=doc-A`, "sess-B", { method: "DELETE" }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
  });

  it("the owner sees only documents they still own", async () => {
    const res = await getCaseDocs(req(`http://localhost/api/v1/cases/${CASE_A}/documents`, "sess-A"), params(CASE_A));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("doc-A");
  });
});

// ============================================================
// 4. Case deadlines
// ============================================================

describe("case deadlines (BOLA)", () => {
  it("user B cannot list user A's deadlines", async () => {
    const res = await getCaseDeadlines(req(`http://localhost/api/v1/cases/${CASE_A}/deadlines`, "sess-B"), params(CASE_A));
    expect(res.status).toBe(404);
  });

  it("user B cannot create a deadline on user A's case", async () => {
    const res = await postCaseDeadline(
      req(`http://localhost/api/v1/cases/${CASE_A}/deadlines`, "sess-B", { method: "POST", body: JSON.stringify({ title: "x", dueAt: "2026-09-01T00:00:00Z" }) }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
  });

  it("user B cannot complete user A's deadline", async () => {
    const res = await patchCaseDeadline(
      req(`http://localhost/api/v1/cases/${CASE_A}/deadlines`, "sess-B", { method: "PATCH", body: JSON.stringify({ deadlineId: "dl-A", completed: true }) }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
  });

  it("user B cannot delete user A's deadline", async () => {
    const res = await deleteCaseDeadline(
      req(`http://localhost/api/v1/cases/${CASE_A}/deadlines?deadlineId=dl-A`, "sess-B", { method: "DELETE" }),
      params(CASE_A)
    );
    expect(res.status).toBe(404);
  });
});

// ============================================================
// 5. Documents — direct id access
// ============================================================

describe("document ownership (IDOR)", () => {
  it("user B cannot read user A's document by id", async () => {
    const res = await getDocument(req("http://localhost/api/v1/documents/doc-A", "sess-B"), params("doc-A"));
    expect(res.status).toBe(404);
  });

  it("user B cannot delete user A's document by id", async () => {
    const res = await deleteDocument(req("http://localhost/api/v1/documents/doc-A", "sess-B", { method: "DELETE" }), params("doc-A"));
    expect(res.status).toBe(404);
  });

  it("the owner can read their own document", async () => {
    const res = await getDocument(req("http://localhost/api/v1/documents/doc-A", "sess-A"), params("doc-A"));
    expect(res.status).toBe(200);
  });
});

// ============================================================
// 6. Contracts are scoped to the session user
// ============================================================

describe("contract scoping", () => {
  it("a case response only ever contains the caller's own contracts", async () => {
    const resA = await getCase(req(`http://localhost/api/v1/cases/${CASE_A}`, "sess-A"), params(CASE_A));
    const bodyA = await resA.json();
    expect(bodyA.data.contracts.every((c: { id: string }) => c.id === "ct-A")).toBe(true);

    const resB = await getCase(req(`http://localhost/api/v1/cases/${CASE_B}`, "sess-B"), params(CASE_B));
    const bodyB = await resB.json();
    expect(bodyB.data.contracts.every((c: { id: string }) => c.id === "ct-B")).toBe(true);
  });
});

// ============================================================
// 7. RBAC — lawyer verification is staff-only
// ============================================================

describe("lawyer verification (RBAC)", () => {
  it("a plain USER cannot verify a lawyer — 403", async () => {
    const res = await verifyLawyer(
      req("http://localhost/api/v1/admin/lawyers/law-1/verification", "sess-A", { method: "POST", body: JSON.stringify({ status: "VERIFIED" }) }),
      params("law-1")
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });

  it("an unauthenticated caller cannot verify a lawyer — 401", async () => {
    const res = await verifyLawyer(
      new Request("http://localhost/api/v1/admin/lawyers/law-1/verification", { method: "POST", body: JSON.stringify({ status: "VERIFIED" }) }) as unknown as NextRequest,
      params("law-1")
    );
    expect(res.status).toBe(401);
  });

  it("an ADMIN passes the permission gate", async () => {
    const res = await verifyLawyer(
      req("http://localhost/api/v1/admin/lawyers/law-1/verification", "sess-admin", { method: "POST", body: JSON.stringify({ status: "VERIFIED" }) }),
      params("law-1")
    );
    // The mocked setVerificationStatus returns undefined → 404, which proves
    // the request cleared the 401/403 gates and reached the handler body.
    expect(res.status).toBe(404);
  });
});

// ============================================================
// 8. Permission matrix — the source of truth for the gates above
// ============================================================

describe("role permission matrix", () => {
  it("USER holds only own-scoped permissions", async () => {
    const { roleHasPermission } = await import("@legalir/types");
    expect(roleHasPermission("USER", "case:read:own")).toBe(true);
    expect(roleHasPermission("USER", "admin:lawyer:verify")).toBe(false);
    expect(roleHasPermission("USER", "org:case:read:all")).toBe(false);
    expect(roleHasPermission("USER", "lawyer:case:read:assigned")).toBe(false);
  });

  it("LAWYER can read assigned cases but not org-wide ones", async () => {
    const { roleHasPermission } = await import("@legalir/types");
    expect(roleHasPermission("LAWYER", "lawyer:case:read:assigned")).toBe(true);
    expect(roleHasPermission("LAWYER", "org:case:read:all")).toBe(false);
    expect(roleHasPermission("LAWYER", "admin:users:manage")).toBe(false);
  });

  it("COMPANY_MEMBER cannot read org-wide cases; COMPANY_ADMIN can", async () => {
    const { roleHasPermission } = await import("@legalir/types");
    expect(roleHasPermission("COMPANY_MEMBER", "org:case:read:all")).toBe(false);
    expect(roleHasPermission("COMPANY_ADMIN", "org:case:read:all")).toBe(true);
  });

  it("only SUPER_ADMIN holds admin:system:manage", async () => {
    const { roleHasPermission } = await import("@legalir/types");
    expect(roleHasPermission("SUPER_ADMIN", "admin:system:manage")).toBe(true);
    expect(roleHasPermission("ADMIN", "admin:system:manage")).toBe(false);
  });
});

// ============================================================
// 9. canAccessOwnedResource — org boundary
// ============================================================

describe("canAccessOwnedResource", () => {
  it("the owner always has access", async () => {
    const { canAccessOwnedResource } = await import("@/lib/rbac");
    const ctx = { userId: "user-A", role: "USER" as const, accountType: "PERSONAL" as const, orgId: null, orgRole: null };
    expect(canAccessOwnedResource(ctx, "user-A", null, "org:case:read:all")).toBe(true);
  });

  it("a foreign user without org permission is denied", async () => {
    const { canAccessOwnedResource } = await import("@/lib/rbac");
    const ctx = { userId: "user-B", role: "USER" as const, accountType: "PERSONAL" as const, orgId: null, orgRole: null };
    expect(canAccessOwnedResource(ctx, "user-A", null, "org:case:read:all")).toBe(false);
  });

  it("an org admin may reach a resource inside their own org only", async () => {
    const { canAccessOwnedResource } = await import("@/lib/rbac");
    const ctx = { userId: "user-B", role: "COMPANY_ADMIN" as const, accountType: "BUSINESS" as const, orgId: "org-1", orgRole: "COMPANY_ADMIN" as const };
    expect(canAccessOwnedResource(ctx, "user-A", "org-1", "org:case:read:all")).toBe(true);
    expect(canAccessOwnedResource(ctx, "user-A", "org-2", "org:case:read:all")).toBe(false);
  });
});
