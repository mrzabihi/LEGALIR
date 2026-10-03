// ============================================================
// LEGALIR — History action model tests (pure)
// ============================================================
// These lock the per-status action rules that the UI renders and the API
// enforces: draft→continue, completed→view+edit, processing→progress,
// failed→error+retry, archived→view+restore.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  classifyStatus,
  canEdit,
  canResumeFailed,
  deriveActions,
  primaryAction,
  historyItemHref,
} from "@/lib/history/actions";
import type { V1HistoryItem } from "@legalir/types";

function item(overrides: Partial<V1HistoryItem>): V1HistoryItem {
  return {
    id: "h1",
    userId: "u1",
    type: "conversation",
    title: "t",
    category: "other",
    categoryFa: "سایر",
    status: "active",
    statusFa: "فعال",
    description: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    archived: false,
    ...overrides,
  };
}

describe("classifyStatus", () => {
  it("treats a draft as draft", () => {
    expect(classifyStatus(item({ status: "draft" }))).toBe("draft");
  });

  it("treats 'active' as draft for a conversation but completed for a subscription", () => {
    expect(classifyStatus(item({ type: "conversation", status: "active" }))).toBe("draft");
    expect(classifyStatus(item({ type: "subscription", status: "active" }))).toBe("completed");
  });

  it("classifies processing, failed and completed statuses", () => {
    expect(classifyStatus(item({ status: "under_review" }))).toBe("processing");
    expect(classifyStatus(item({ status: "failed" }))).toBe("failed");
    expect(classifyStatus(item({ status: "completed" }))).toBe("completed");
  });
});

describe("canEdit", () => {
  it("allows editing only completed conversation/contract/case items", () => {
    expect(canEdit(item({ type: "conversation", status: "completed" }))).toBe(true);
    expect(canEdit(item({ type: "contract", status: "generated" }))).toBe(true);
    expect(canEdit(item({ type: "case", status: "closed" }))).toBe(true);
  });

  it("refuses editing a draft, an ongoing case, a document, or a subscription", () => {
    expect(canEdit(item({ type: "conversation", status: "draft" }))).toBe(false);
    expect(canEdit(item({ type: "case", status: "active" }))).toBe(false);
    expect(canEdit(item({ type: "document", status: "ready" }))).toBe(false);
    expect(canEdit(item({ type: "subscription", status: "active" }))).toBe(false);
  });
});

describe("canResumeFailed", () => {
  it("excludes subscriptions (nothing to resume)", () => {
    expect(canResumeFailed(item({ type: "subscription" }))).toBe(false);
    expect(canResumeFailed(item({ type: "conversation" }))).toBe(true);
  });
});

describe("deriveActions", () => {
  it("draft → continue (primary) + archive + delete", () => {
    const actions = deriveActions(item({ status: "draft" }));
    expect(actions.map((a) => a.key)).toEqual(["continue", "archive", "delete"]);
    expect(actions[0]!.primary).toBe(true);
    expect(actions[0]!.href).toBe("/chat/h1");
  });

  it("processing → view progress (primary), never a continuable draft", () => {
    const actions = deriveActions(item({ status: "under_review" }));
    expect(actions[0]!.key).toBe("view_progress");
    expect(actions.some((a) => a.key === "continue")).toBe(false);
  });

  it("completed → view result (primary) + edit + archive + delete", () => {
    const actions = deriveActions(item({ status: "completed" }));
    expect(actions.map((a) => a.key)).toEqual(["view_result", "edit", "archive", "delete"]);
    const edit = actions.find((a) => a.key === "edit")!;
    expect(edit.hintFa).toContain("فرایند جدید");
  });

  it("failed → view error (primary) + retry + archive + delete", () => {
    const actions = deriveActions(item({ status: "failed" }));
    expect(actions.map((a) => a.key)).toEqual(["view_error", "continue", "archive", "delete"]);
  });

  it("archived draft → view (primary) + continue + restore + delete", () => {
    const actions = deriveActions(item({ status: "draft", archived: true }));
    expect(actions.map((a) => a.key)).toEqual(["view", "continue", "restore", "delete"]);
    expect(actions[0]!.primary).toBe(true);
  });

  it("archived completed → view + edit + restore + delete", () => {
    const actions = deriveActions(item({ status: "completed", archived: true }));
    expect(actions.map((a) => a.key)).toEqual(["view", "edit", "restore", "delete"]);
  });

  it("delete is always destructive and never primary", () => {
    for (const status of ["draft", "completed", "failed", "under_review"]) {
      const actions = deriveActions(item({ status }));
      const del = actions.find((a) => a.key === "delete")!;
      expect(del.destructive).toBe(true);
      expect(del.primary).toBeUndefined();
    }
  });
});

describe("primaryAction / historyItemHref", () => {
  it("returns the first action as primary", () => {
    expect(primaryAction(item({ status: "draft" }))!.key).toBe("continue");
  });

  it("maps each type to its detail route", () => {
    expect(historyItemHref(item({ type: "conversation" }))).toBe("/chat/h1");
    expect(historyItemHref(item({ type: "document" }))).toBe("/documents/h1");
    expect(historyItemHref(item({ type: "contract" }))).toBe("/contracts/h1");
    expect(historyItemHref(item({ type: "case" }))).toBe("/cases/h1");
    expect(historyItemHref(item({ type: "subscription" }))).toBe("/subscription");
  });
});
