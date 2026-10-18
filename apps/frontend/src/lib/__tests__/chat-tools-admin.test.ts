// ============================================================
// LEGALIR — Admin control of the contextual chat tools (§12)
// ============================================================
// Locks in the rules that make the admin switch real, bounded and honest:
//
//   • the surface is permission-gated (anonymous 401, plain user 403);
//   • `GET /admin/ai/tools` lists exactly the registered tools — never a
//     tool that does not exist;
//   • a toggle has a REAL effect: the very next user-facing projection
//     drops the tool, and the change is written to the audit trail with a
//     before/after snapshot;
//   • an admin switch can never conjure a source: enabling «آراء قضایی»
//     while the library holds no published precedent still reports
//     `available: false` with the server's own reason;
//   • `allowedServiceTypes` really narrows where a tool may be used.
//
// `lib/db` resolves `.data` from `process.cwd()` at module load, so every
// module is dynamically imported AFTER chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NextRequest } from "next/server";
import type * as dbModule from "@/lib/db";
import type { ChatToolAdminView } from "@legalir/types";

type Db = typeof dbModule;
type AdminHandler = (
  request: NextRequest,
  context: { params: Promise<{ segments?: string[] }> }
) => Promise<Response>;

let db: Db;
let adminGet: AdminHandler;
let adminPost: AdminHandler;
let tmpDir: string;
let originalCwd: string;
let superSession: string;
let userSession: string;
let superId: string;

const BASE = "http://localhost/api/v1/admin";

function segments(...parts: string[]): { params: Promise<{ segments: string[] }> } {
  return { params: Promise.resolve({ segments: parts }) };
}

function reqWith(session: string | null, url: string, init?: RequestInit): NextRequest {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: `legalir-session=${session}` } : {}),
      ...(init?.headers ?? {}),
    },
  }) as unknown as NextRequest;
}

async function listTools(session: string): Promise<ChatToolAdminView[]> {
  const res = await adminGet(reqWith(session, `${BASE}/ai/tools`), segments("ai", "tools"));
  expect(res.status).toBe(200);
  const { data } = (await res.json()) as { data: { items: ChatToolAdminView[] } };
  return data.items;
}

/** The admin client submits a tool edit as a POST (`lib/api/admin.ts`). */
async function editTool(
  session: string,
  toolId: string,
  body: Record<string, unknown>
): Promise<Response> {
  return adminPost(
    reqWith(session, `${BASE}/ai/tools/${toolId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    segments("ai", "tools", toolId)
  );
}

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-tools-admin-"));
  process.chdir(tmpDir);

  db = await import("@/lib/db");
  const route = await import("@/app/api/v1/admin/[[...segments]]/route");
  adminGet = route.GET as unknown as AdminHandler;
  adminPost = route.POST as unknown as AdminHandler;

  superId = db.createUser({ mobile: "09122000001", passwordHash: "x" }).id;
  db.setUserRole(superId, "SUPER_ADMIN");
  superSession = db.createSession(superId).id;

  const userId = db.createUser({ mobile: "09122000002", passwordHash: "x" }).id;
  userSession = db.createSession(userId).id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================
// Access control
// ============================================================

describe("admin chat tools — access", () => {
  it("refuses an anonymous caller", async () => {
    const res = await adminGet(reqWith(null, `${BASE}/ai/tools`), segments("ai", "tools"));
    expect(res.status).toBe(401);
  });

  it("refuses a plain user — hiding the UI is not the security boundary", async () => {
    const res = await adminGet(reqWith(userSession, `${BASE}/ai/tools`), segments("ai", "tools"));
    expect(res.status).toBe(403);
  });

  it("refuses a plain user's write", async () => {
    const res = await editTool(userSession, "deep_analysis", { enabled: false });
    expect(res.status).toBe(403);
  });
});

// ============================================================
// The projection lists the registry — nothing invented
// ============================================================

describe("admin chat tools — projection", () => {
  it("lists exactly the three registered tools, in product order", async () => {
    const items = await listTools(superSession);
    expect(items.map((t) => t.toolId)).toEqual([
      "deep_analysis",
      "legal_research",
      "judicial_opinions",
    ]);
  });

  it("carries the REAL availability verdict, not just the toggle", async () => {
    const items = await listTools(superSession);
    const deep = items.find((t) => t.toolId === "deep_analysis")!;
    const judicial = items.find((t) => t.toolId === "judicial_opinions")!;
    expect(deep.enabled).toBe(true);
    expect(deep.available).toBe(true);
    // The seeded library genuinely holds a published precedent here.
    expect(judicial.available).toBe(judicial.unavailableReasonFa === null);
  });
});

// ============================================================
// A toggle is real — and audited
// ============================================================

describe("admin chat tools — toggling", () => {
  it("disabling a tool really withdraws it from the user-facing projection", async () => {
    const res = await editTool(superSession, "legal_research", { enabled: false });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: ChatToolAdminView };
    expect(data.enabled).toBe(false);

    const { resolveChatTools } = await import("@/lib/ai/chat-tools");
    const { resolveServiceType } = await import("@/lib/ai/service-context");
    const projection = resolveChatTools(
      resolveServiceType("legal_consultation").serviceType,
      []
    );
    const research = projection.tools.find((t) => t.id === "legal_research")!;
    expect(research.enabled).toBe(false);
    expect(research.available).toBe(false);
    expect(research.unavailableReasonFa).toBeTruthy();

    await editTool(superSession, "legal_research", { enabled: true });
  });

  it("records the change in the append-only audit trail with before/after", async () => {
    await editTool(superSession, "legal_research", { enabled: false });
    try {
      const { listAudit } = await import("@/lib/admin/audit");
      const trail = listAudit({
        action: "ai.tool.update",
        resourceType: "chat_tool",
        resourceId: "legal_research",
      });
      const entry = trail.items[0]!;
      expect(entry.actorUserId).toBe(superId);
      expect(entry.after!["enabled"]).toBe(false);
      expect(entry.before!["enabled"]).toBe(true);
    } finally {
      await editTool(superSession, "legal_research", { enabled: true });
    }
  });

  it("audits a denied write for an unknown tool id", async () => {
    const res = await editTool(superSession, "make_coffee", { enabled: true });
    expect(res.status).toBe(404);
    const { listAudit } = await import("@/lib/admin/audit");
    const trail = listAudit({
      action: "ai.tool.update",
      resourceId: "make_coffee",
      result: "denied",
    });
    expect(trail.total).toBeGreaterThan(0);
  });

  it("never lets a switch conjure a source that does not exist", async () => {
    const lib = await import("@/lib/legal-library-db");
    const original = lib.readLegalLibrary();
    lib.writeLegalLibrary({
      ...original,
      items: original.items.filter(
        (i) => i.sourceType !== "UNIFICATION_RULING" && i.sourceType !== "JUDICIAL_DECISION"
      ),
    });
    try {
      const res = await editTool(superSession, "judicial_opinions", { enabled: true });
      expect(res.status).toBe(200);
      const { data } = (await res.json()) as { data: ChatToolAdminView };
      // Enabled is not available: the toggle cannot invent a precedent bank.
      expect(data.enabled).toBe(true);
      expect(data.available).toBe(false);
      expect(data.unavailableReasonFa).toContain("رأی قضایی");
    } finally {
      lib.writeLegalLibrary(original);
    }
  });

  it("narrows a tool to named services through allowedServiceTypes", async () => {
    const res = await editTool(superSession, "deep_analysis", {
      allowedServiceTypes: ["contract_review"],
    });
    expect(res.status).toBe(200);
    try {
      const { resolveChatTools } = await import("@/lib/ai/chat-tools");
      const { resolveServiceType } = await import("@/lib/ai/service-context");

      const contract = resolveChatTools(
        resolveServiceType("contract_review").serviceType,
        []
      ).tools.find((t) => t.id === "deep_analysis")!;
      const consultation = resolveChatTools(
        resolveServiceType("legal_consultation").serviceType,
        []
      ).tools.find((t) => t.id === "deep_analysis")!;

      expect(contract.allowedForService).toBe(true);
      expect(consultation.allowedForService).toBe(false);
      // A narrowed-away tool is honestly unavailable, with a reason.
      expect(consultation.available).toBe(false);
      expect(consultation.unavailableReasonFa).toBeTruthy();
    } finally {
      await editTool(superSession, "deep_analysis", { allowedServiceTypes: [] });
    }
  });
});
