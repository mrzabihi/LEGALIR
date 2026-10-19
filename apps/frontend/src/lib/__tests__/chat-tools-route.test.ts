// ============================================================
// LEGALIR — Chat tool endpoints (ownership + server authority)
// ============================================================
// Locks in the §7/§15 rules that the UI relies on:
//
//   • GET /api/v1/chat/tools is authenticated and only ever reflects the
//     CALLER's own conversation — a foreign id yields no selection.
//   • The conversation's persisted service wins over a tampered URL.
//   • PATCH /api/v1/conversations/:id rejects a tool the backend would
//     refuse (unknown, disabled, or not allowed for the service) and
//     persists only what it validated.
//   • A foreign conversation is a 404, never a silent success.
//
// `lib/db` resolves `.data` from `process.cwd()` at module load, so every
// module is dynamically imported AFTER chdir into a throwaway directory.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type * as dbModule from "@/lib/db";
import type * as toolsRoute from "@/app/api/v1/chat/tools/route";
import type * as convRoute from "@/app/api/v1/conversations/[id]/route";

type Db = typeof dbModule;

let db: Db;
let toolsGET: typeof toolsRoute.GET;
let convGET: typeof convRoute.GET;
let convPATCH: typeof convRoute.PATCH;
let tmpDir: string;
let originalCwd: string;

const OWNER = "u-tools-owner";
const STRANGER = "u-tools-stranger";
let ownerSession: string;
let strangerSession: string;
let convId: string;

const CONVERSATION = {
  id: "conv-tools-1",
  userId: OWNER,
  title: "گفتگو",
  category: "real_estate",
  status: "active",
  riskLevel: null,
  messageCount: 0,
  createdAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
  serviceType: "contract_review",
};

beforeAll(async () => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legalir-tools-"));
  process.chdir(tmpDir);

  db = await import("@/lib/db");
  toolsGET = (await import("@/app/api/v1/chat/tools/route")).GET;
  convGET = (await import("@/app/api/v1/conversations/[id]/route")).GET;
  convPATCH = (await import("@/app/api/v1/conversations/[id]/route")).PATCH;

  ownerSession = db.createSession(OWNER).id;
  strangerSession = db.createSession(STRANGER).id;

  db.writeConversations([{ ...CONVERSATION }]);
  convId = CONVERSATION.id;
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function toolsRequest(sessionId: string | null, query: string): Request {
  return new Request(`http://localhost/api/v1/chat/tools${query}`, {
    headers: sessionId ? { cookie: `legalir-session=${sessionId}` } : {},
  });
}

function patchRequest(sessionId: string | null, body: unknown): Request {
  return new Request(`http://localhost/api/v1/conversations/${convId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { cookie: `legalir-session=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Next 15 hands the handler a promise; build it per call, after beforeAll. */
const paramsFor = () => Promise.resolve({ id: convId });

// ============================================================
// GET /api/v1/chat/tools
// ============================================================

describe("GET /api/v1/chat/tools", () => {
  it("rejects an unauthenticated caller", async () => {
    const res = await toolsGET(toolsRequest(null, "?service=legal_consultation"));
    expect(res.status).toBe(401);
  });

  it("projects the three tools with the honest availability verdict", async () => {
    const res = await toolsGET(
      toolsRequest(ownerSession, `?service=contract_review&conversationId=${convId}`)
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data.tools.map((t: { id: string }) => t.id)).toEqual([
      "deep_analysis",
      "legal_research",
      "judicial_opinions",
    ]);
    // The seeded library genuinely carries a published precedent, so the
    // precedent tool is honestly AVAILABLE — availability tracks the corpus.
    const judicial = data.tools.find((t: { id: string }) => t.id === "judicial_opinions");
    expect(judicial.requiresSource).toBe(true);
    expect(judicial.available).toBe(judicial.unavailableReasonFa === null);
    // Deep analysis needs no external corpus → always available when enabled.
    const deep = data.tools.find((t: { id: string }) => t.id === "deep_analysis");
    expect(deep.available).toBe(true);
  });

  it("makes the precedent tool unavailable when the corpus has no precedent", async () => {
    const lib = await import("@/lib/legal-library-db");
    const original = lib.readLegalLibrary();
    // Remove every precedent row through the real writer — the capability
    // check reads the same file, so this is the honest source of truth.
    lib.writeLegalLibrary({
      ...original,
      items: original.items.filter(
        (i) => i.sourceType !== "UNIFICATION_RULING" && i.sourceType !== "JUDICIAL_DECISION"
      ),
    });
    try {
      const res = await toolsGET(toolsRequest(ownerSession, "?service=contract_review"));
      const { data } = await res.json();
      const judicial = data.tools.find((t: { id: string }) => t.id === "judicial_opinions");
      expect(judicial.available).toBe(false);
      expect(judicial.unavailableReasonFa).toContain("رأی قضایی");
    } finally {
      lib.writeLegalLibrary(original);
    }
  });

  it("lets the conversation's persisted service win over a tampered URL", async () => {
    const res = await toolsGET(
      toolsRequest(ownerSession, `?service=legal_calculation&conversationId=${convId}`)
    );
    const { data } = await res.json();
    expect(data.serviceType).toBe("contract_review");
  });

  it("falls back to the URL service for a foreign conversation, with no selection", async () => {
    db.writeConversations([
      { ...CONVERSATION, toolIds: ["deep_analysis", "legal_research"] },
    ]);
    const res = await toolsGET(
      toolsRequest(strangerSession, `?service=law_search&conversationId=${convId}`)
    );
    const { data } = await res.json();
    expect(data.serviceType).toBe("law_search");
    expect(data.selected).toEqual([]);
  });

  it("restores the caller's own persisted selection", async () => {
    db.writeConversations([
      { ...CONVERSATION, toolIds: ["deep_analysis", "legal_research"] },
    ]);
    const res = await toolsGET(
      toolsRequest(ownerSession, `?service=contract_review&conversationId=${convId}`)
    );
    const { data } = await res.json();
    expect(data.selected).toEqual(["deep_analysis", "legal_research"]);
  });

  it("drops a persisted selection that is no longer valid", async () => {
    db.writeConversations([
      // `judicial_opinions` becomes unavailable once the corpus loses every
      // precedent — a stale selection must then degrade, not error.
      { ...CONVERSATION, toolIds: ["deep_analysis", "judicial_opinions"] },
    ]);
    const lib = await import("@/lib/legal-library-db");
    const original = lib.readLegalLibrary();
    lib.writeLegalLibrary({
      ...original,
      items: original.items.filter(
        (i) => i.sourceType !== "UNIFICATION_RULING" && i.sourceType !== "JUDICIAL_DECISION"
      ),
    });
    try {
      const res = await toolsGET(
        toolsRequest(ownerSession, `?service=contract_review&conversationId=${convId}`)
      );
      const { data } = await res.json();
      expect(data.selected).toEqual(["deep_analysis"]);
    } finally {
      lib.writeLegalLibrary(original);
    }
  });

  it("never claims metered cost without a real energy profile", async () => {
    const res = await toolsGET(toolsRequest(ownerSession, "?service=legal_consultation"));
    const { data } = await res.json();
    expect(data.meteredByEnergyProfile).toBe(false);
  });
});

// ============================================================
// PATCH /api/v1/conversations/:id  { toolIds }
// ============================================================

describe("PATCH /api/v1/conversations/:id — tool selection", () => {
  it("rejects an unauthenticated caller", async () => {
    const res = await convPATCH(patchRequest(null, { toolIds: ["deep_analysis"] }), { params: paramsFor() });
    expect(res.status).toBe(401);
  });

  it("answers 404 for another user's conversation", async () => {
    const res = await convPATCH(patchRequest(strangerSession, { toolIds: ["deep_analysis"] }), {
      params: paramsFor(),
    });
    expect(res.status).toBe(404);
  });

  it("persists a valid selection", async () => {
    db.writeConversations([{ ...CONVERSATION }]);
    const res = await convPATCH(patchRequest(ownerSession, { toolIds: ["deep_analysis"] }), {
      params: paramsFor(),
    });
    expect(res.status).toBe(200);
    expect(db.readConversations()[0]!.toolIds).toEqual(["deep_analysis"]);
  });

  it("rejects a disabled tool and keeps the old selection", async () => {
    db.writeConversations([{ ...CONVERSATION, toolIds: ["deep_analysis"] }]);
    const { updateToolSetting } = await import("@/lib/ai/chat-tools");
    updateToolSetting("legal_research", { enabled: false }, null);
    try {
      const res = await convPATCH(
        patchRequest(ownerSession, { toolIds: ["legal_research"] }),
        { params: paramsFor() }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("INVALID_TOOL_SELECTION");
      expect(db.readConversations()[0]!.toolIds).toEqual(["deep_analysis"]);
    } finally {
      updateToolSetting("legal_research", { enabled: true }, null);
    }
  });

  it("rejects the precedent tool when the corpus has no precedent", async () => {
    db.writeConversations([{ ...CONVERSATION, toolIds: ["deep_analysis"] }]);
    const lib = await import("@/lib/legal-library-db");
    const original = lib.readLegalLibrary();
    lib.writeLegalLibrary({
      ...original,
      items: original.items.filter(
        (i) => i.sourceType !== "UNIFICATION_RULING" && i.sourceType !== "JUDICIAL_DECISION"
      ),
    });
    try {
      const res = await convPATCH(
        patchRequest(ownerSession, { toolIds: ["judicial_opinions"] }),
        { params: paramsFor() }
      );
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_TOOL_SELECTION");
      expect(db.readConversations()[0]!.toolIds).toEqual(["deep_analysis"]);
    } finally {
      lib.writeLegalLibrary(original);
    }
  });

  it("rejects an unknown tool id", async () => {
    const res = await convPATCH(
      patchRequest(ownerSession, { toolIds: ["delete_everything"] }),
      { params: paramsFor() }
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-array payload", async () => {
    const res = await convPATCH(patchRequest(ownerSession, { toolIds: "deep_analysis" }), {
      params: paramsFor(),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_TOOL_SELECTION");
  });

  it("never persists a duplicate tool id", async () => {
    db.writeConversations([{ ...CONVERSATION }]);
    const res = await convPATCH(
      patchRequest(ownerSession, { toolIds: ["deep_analysis", "deep_analysis"] }),
      { params: paramsFor() }
    );
    expect(res.status).toBe(200);
    expect(db.readConversations()[0]!.toolIds).toEqual(["deep_analysis"]);
  });

  it("clears the selection with an empty list", async () => {
    db.writeConversations([{ ...CONVERSATION, toolIds: ["deep_analysis"] }]);
    const res = await convPATCH(patchRequest(ownerSession, { toolIds: [] }), { params: paramsFor() });
    expect(res.status).toBe(200);
    expect(db.readConversations()[0]!.toolIds).toEqual([]);
  });

  it("leaves the selection alone when the patch does not mention tools", async () => {
    db.writeConversations([{ ...CONVERSATION, toolIds: ["legal_research"] }]);
    const res = await convPATCH(patchRequest(ownerSession, { title: "عنوان تازه" }), { params: paramsFor() });
    expect(res.status).toBe(200);
    expect(db.readConversations()[0]!.toolIds).toEqual(["legal_research"]);
    expect(db.readConversations()[0]!.title).toBe("عنوان تازه");
  });
});

// ============================================================
// GET /api/v1/conversations/:id — refresh restores the context
// ============================================================

describe("GET /api/v1/conversations/:id — restored context", () => {
  function detailRequest(sessionId: string | null): Request {
    return new Request(`http://localhost/api/v1/conversations/${convId}`, {
      headers: sessionId ? { cookie: `legalir-session=${sessionId}` } : {},
    });
  }

  it("rejects an unauthenticated caller", async () => {
    const res = await convGET(detailRequest(null), { params: paramsFor() });
    expect(res.status).toBe(401);
  });

  it("answers 404 for another user's conversation — never leaks its content", async () => {
    db.writeConversations([{ ...CONVERSATION }]);
    const res = await convGET(detailRequest(strangerSession), { params: paramsFor() });
    expect(res.status).toBe(404);
    expect((await res.json()).data).toBeUndefined();
  });

  it("restores the persisted service, tool selection and open follow-ups", async () => {
    const pendingFollowUps = [
      {
        id: "amount",
        questionFa: "مبلغ مورد اختلاف چقدر است؟",
        whyFa: "مبلغ، صلاحیت مرجع رسیدگی را تعیین می‌کند.",
        required: true,
        quickOptionsFa: [],
      },
    ];
    db.writeConversations([
      {
        ...CONVERSATION,
        serviceType: "contract_review",
        toolIds: ["deep_analysis", "legal_research"],
        workflow: {
          phase: "DATA_COLLECTION",
          domain: "contract",
          pendingFollowUps,
          suggestCaseCreation: false,
        },
      } as (typeof CONVERSATION) & Record<string, unknown>,
    ]);

    const res = await convGET(detailRequest(ownerSession), { params: paramsFor() });
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data.serviceType).toBe("contract_review");
    expect(data.toolIds).toEqual(["deep_analysis", "legal_research"]);
    expect(data.workflow.phase).toBe("DATA_COLLECTION");
    expect(data.workflow.domain).toBe("contract");
    // The structured questions survive the round trip verbatim — a refresh
    // must not degrade them back to unanswerable plain text (§8).
    expect(data.workflow.pendingFollowUps).toEqual(pendingFollowUps);
  });

  it("degrades a legacy conversation honestly instead of inventing a context", async () => {
    // A row written before the service/tool columns existed.
    const {
      serviceType: _serviceType,
      ...withoutService
    } = CONVERSATION as typeof CONVERSATION & Record<string, unknown>;
    db.writeConversations([withoutService as typeof CONVERSATION]);
    const res = await convGET(detailRequest(ownerSession), { params: paramsFor() });
    const { data } = await res.json();
    // No persisted service → null (the entry URL decides), never a guess.
    expect(data.serviceType).toBeNull();
    expect(data.toolIds).toEqual([]);
    expect(data.workflow).toBeNull();
  });

  it("drops a malformed workflow projection rather than trusting it", async () => {
    db.writeConversations([
      {
        ...CONVERSATION,
        workflow: { phase: "DATA_COLLECTION", pendingFollowUps: "not-an-array" },
      } as (typeof CONVERSATION) & Record<string, unknown>,
    ]);
    const res = await convGET(detailRequest(ownerSession), { params: paramsFor() });
    const { data } = await res.json();
    expect(data.workflow.pendingFollowUps).toEqual([]);
  });
});
