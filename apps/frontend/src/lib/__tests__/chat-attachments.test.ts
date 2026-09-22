// ============================================================
// LEGALIR — Chat document attachment tests
// ============================================================
// Pins the two guarantees of the attach flow:
//   1. A document is only REFERENCED, never copied — attaching writes a
//      single MessageAttachment join row and leaves the document untouched.
//   2. Ownership is enforced SERVER-SIDE — a document id the requesting user
//      does not own is rejected and never linked.
//
// `@/lib/db` and `@/lib/demo-seed` are mocked so the tests are deterministic
// and independent of the on-disk seed.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { V1DocumentDetail, RiskLevel } from "@legalir/types";

// --- In-memory table store backing the mocked db ---
const tables = new Map<string, unknown[]>();

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => tables.get(name) ?? [],
  writeTable: (name: string, data: unknown[]) => {
    tables.set(name, data);
  },
}));

// --- Documents owned by each user (ownership is scoped by userId) ---
const documents: V1DocumentDetail[] = [];

vi.mock("@/lib/demo-seed", () => ({
  getDemoDocument: (userId: string, id: string) =>
    documents.find((d) => d.id === id && d.userId === userId),
}));

import {
  linkAttachmentsToMessage,
  getMessageAttachments,
  getMessageAttachmentRefs,
  getAttachmentRefsByMessage,
  deleteConversationAttachments,
  listRecentDocuments,
  resolveAttachmentContext,
} from "../ai/attachments";
import { MAX_CHAT_ATTACHMENTS } from "@legalir/types";

const USER_A = "user-a";
const USER_B = "user-b";

function doc(
  overrides: Partial<V1DocumentDetail> & { id: string; userId: string }
): V1DocumentDetail {
  return {
    name: "سند نمونه.pdf",
    mime: "application/pdf",
    sizeBytes: 1024,
    status: "ready",
    storageKey: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    jobs: [],
    report: null,
    extractedText: null,
    previewUrl: null,
    ...overrides,
  };
}

function withFindings(severities: RiskLevel[]): V1DocumentDetail["report"] {
  return {
    documentId: "doc-a2",
    summary: "خلاصه",
    generatedAt: "2026-09-01T00:00:00.000Z",
    confidence: 0.9,
    findings: severities.map((severity, i) => ({
      id: `f${i}`,
      documentId: "doc-a2",
      title: "یافته",
      severity,
      locator: "",
      reason: "",
      recommendation: "",
      citation: null,
      confidence: 0.9,
    })),
  };
}

beforeEach(() => {
  tables.clear();
  documents.length = 0;
  documents.push(
    doc({ id: "doc-a1", userId: USER_A, name: "الف-۱.pdf", extractedText: "متن سند الف یک" }),
    doc({ id: "doc-a2", userId: USER_A, name: "الف-۲.pdf", report: withFindings(["high"]) }),
    doc({ id: "doc-b1", userId: USER_B, name: "ب-۱.pdf" })
  );
  // `listRecentDocuments` reads the `documents` table directly (not via
  // getDemoDocument), so expose the same array through the mocked db.
  tables.set("documents", documents);
});

describe("linkAttachmentsToMessage", () => {
  it("links a document the user owns", () => {
    const result = linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    expect(result.linked).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.linked[0]!.documentId).toBe("doc-a1");
    expect(result.linked[0]!.messageId).toBe("msg-1");
    expect(result.linked[0]!.userId).toBe(USER_A);
  });

  it("rejects a document owned by another user", () => {
    const result = linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-b1"],
    });
    expect(result.linked).toHaveLength(0);
    expect(result.rejected).toEqual(["doc-b1"]);
    expect(getMessageAttachments("msg-1")).toHaveLength(0);
  });

  it("links owned ids and rejects foreign ids in the same request", () => {
    const result = linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1", "doc-b1", "doc-a2"],
    });
    expect(result.linked.map((a) => a.documentId)).toEqual(["doc-a1", "doc-a2"]);
    expect(result.rejected).toEqual(["doc-b1"]);
  });

  it("is idempotent — re-linking the same document is a no-op", () => {
    const first = linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    const second = linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    expect(second.linked[0]!.id).toBe(first.linked[0]!.id);
    expect(getMessageAttachments("msg-1")).toHaveLength(1);
  });

  it("caps the number of attachments at MAX_CHAT_ATTACHMENTS", () => {
    // Give user-a more documents than the cap allows.
    for (let i = 0; i < MAX_CHAT_ATTACHMENTS + 3; i++) {
      documents.push(doc({ id: `doc-extra-${i}`, userId: USER_A }));
    }
    const ids = documents.filter((d) => d.userId === USER_A).map((d) => d.id);
    const result = linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ids,
    });
    expect(result.linked).toHaveLength(MAX_CHAT_ATTACHMENTS);
    expect(result.rejected).toHaveLength(ids.length - MAX_CHAT_ATTACHMENTS);
  });

  it("never copies the document — the document row is unchanged", () => {
    const before = JSON.stringify(documents.find((d) => d.id === "doc-a1"));
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    const after = JSON.stringify(documents.find((d) => d.id === "doc-a1"));
    expect(after).toBe(before);
  });
});

describe("hydrate / read", () => {
  it("returns metadata-only refs (no file bytes)", () => {
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a2"],
    });
    const refs = getMessageAttachmentRefs("msg-1");
    expect(refs).toHaveLength(1);
    const ref = refs[0]!;
    expect(ref.documentId).toBe("doc-a2");
    expect(ref.name).toBe("الف-۲.pdf");
    expect(ref.riskLevel).toBe("high");
    expect(ref.findingCount).toBe(1);
    // No storage key / extracted text leaks into the client ref.
    expect(ref).not.toHaveProperty("storageKey");
    expect(ref).not.toHaveProperty("extractedText");
  });

  it("groups refs by message id for a conversation", () => {
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-2",
      documentIds: ["doc-a2"],
    });
    const grouped = getAttachmentRefsByMessage("conv-1");
    expect(grouped["msg-1"]).toHaveLength(1);
    expect(grouped["msg-2"]).toHaveLength(1);
  });

  it("drops a ref when the underlying document is deleted", () => {
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    // Simulate deletion of the document.
    const idx = documents.findIndex((d) => d.id === "doc-a1");
    documents.splice(idx, 1);
    expect(getMessageAttachmentRefs("msg-1")).toHaveLength(0);
  });

  it("deleteConversationAttachments removes every link for the conversation", () => {
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-1",
      documentIds: ["doc-a1"],
    });
    linkAttachmentsToMessage({
      userId: USER_A,
      conversationId: "conv-1",
      messageId: "msg-2",
      documentIds: ["doc-a2"],
    });
    deleteConversationAttachments("conv-1");
    expect(getMessageAttachments("msg-1")).toHaveLength(0);
    expect(getMessageAttachments("msg-2")).toHaveLength(0);
  });
});

describe("listRecentDocuments", () => {
  it("returns only the user's documents, newest first", () => {
    documents.push(
      doc({ id: "doc-a3", userId: USER_A, updatedAt: "2026-09-10T00:00:00.000Z" })
    );
    const items = listRecentDocuments(USER_A);
    expect(items.every((d) => d.id.startsWith("doc-a"))).toBe(true);
    expect(items[0]!.id).toBe("doc-a3");
    expect(items.some((d) => d.id === "doc-b1")).toBe(false);
  });

  it("respects the limit", () => {
    for (let i = 0; i < 20; i++) {
      documents.push(doc({ id: `doc-many-${i}`, userId: USER_A }));
    }
    expect(listRecentDocuments(USER_A, 5)).toHaveLength(5);
  });
});

describe("resolveAttachmentContext", () => {
  it("includes only owned documents and their extracted text", () => {
    const ctx = resolveAttachmentContext(USER_A, ["doc-a1", "doc-b1"]);
    expect(ctx.documentIds).toEqual(["doc-a1"]);
    expect(ctx.texts).toHaveLength(1);
    expect(ctx.texts[0]!.documentId).toBe("doc-a1");
    expect(ctx.texts[0]!.text).toBe("متن سند الف یک");
  });

  it("returns an empty context when the user owns none of the ids", () => {
    const ctx = resolveAttachmentContext(USER_A, ["doc-b1"]);
    expect(ctx.documentIds).toHaveLength(0);
    expect(ctx.texts).toHaveLength(0);
  });

  it("omits documents that have no extracted text yet", () => {
    const ctx = resolveAttachmentContext(USER_A, ["doc-a2"]);
    expect(ctx.documentIds).toEqual(["doc-a2"]);
    expect(ctx.texts).toHaveLength(0);
  });
});
