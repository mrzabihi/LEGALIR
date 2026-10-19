// ============================================================
// LEGALIR — Contextual chat tools: registry, honesty & validation
// ============================================================
// Pins the guarantees §7 and §12 depend on:
//   1. `available` is a REAL capability verdict — enabling a tool whose
//      source does not exist never makes it available.
//   2. An admin toggle / per-service allowlist is enforced server-side.
//   3. A tampered selection is rejected with a Persian reason, never applied.
//   4. A selected tool actually changes the retrieval plan.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const tables = new Map<string, unknown[]>();

vi.mock("@/lib/db", () => ({
  readTable: (name: string) => tables.get(name) ?? [],
  writeTable: (name: string, data: unknown[]) => {
    tables.set(name, data);
  },
}));

interface LibItem {
  id: string;
  title: string;
  sourceType: string;
  status?: string;
}

let libraryItems: LibItem[] = [];

vi.mock("@/lib/legal-library-db", () => ({
  readLegalLibrary: () => ({
    items: libraryItems,
    topics: [],
    details: {},
  }),
  isPubliclyVisible: (item: LibItem) => (item.status ?? "PUBLISHED") === "PUBLISHED",
}));

import {
  CHAT_TOOL_DEFINITIONS,
  isChatToolId,
  judicialOpinionsCapability,
  listToolSettings,
  listToolsForAdmin,
  normalizeToolIds,
  resolveChatTools,
  toolRetrievalPlan,
  updateToolSetting,
  validateToolSelection,
} from "../ai/chat-tools";

beforeEach(() => {
  tables.clear();
  libraryItems = [];
});

// ============================================================
// Definitions
// ============================================================

describe("CHAT_TOOL_DEFINITIONS", () => {
  it("defines the three product tools in a stable order", () => {
    expect(CHAT_TOOL_DEFINITIONS.map((d) => d.id)).toEqual([
      "deep_analysis",
      "legal_research",
      "judicial_opinions",
    ]);
    expect(CHAT_TOOL_DEFINITIONS.map((d) => d.order)).toEqual([1, 2, 3]);
    expect(isChatToolId("deep_analysis")).toBe(true);
    expect(isChatToolId("nope")).toBe(false);
  });

  it("marks only «آراء قضایی» as source-dependent", () => {
    const bySource = CHAT_TOOL_DEFINITIONS.filter((d) => d.requiresSource);
    expect(bySource.map((d) => d.id)).toEqual(["judicial_opinions"]);
  });
});

// ============================================================
// Capability honesty
// ============================================================

describe("judicialOpinionsCapability", () => {
  it("reports unavailable with a reason when no precedent source exists", () => {
    const cap = judicialOpinionsCapability();
    expect(cap.available).toBe(false);
    expect(cap.sourceCount).toBe(0);
    expect(cap.reasonFa).toContain("رأی قضایی");
  });

  it("counts only published precedent rows", () => {
    libraryItems = [
      { id: "a", title: "رأی وحدت رویه", sourceType: "UNIFICATION_RULING" },
      { id: "b", title: "تصمیم", sourceType: "JUDICIAL_DECISION", status: "DRAFT" },
      { id: "c", title: "قانون", sourceType: "LAW" },
    ];
    const cap = judicialOpinionsCapability();
    expect(cap.available).toBe(true);
    expect(cap.sourceCount).toBe(1);
    expect(cap.reasonFa).toBeNull();
  });
});

// ============================================================
// resolveChatTools — the honest projection
// ============================================================

describe("resolveChatTools", () => {
  it("keeps judicial opinions unavailable even though it is enabled by default", () => {
    const { tools } = resolveChatTools("legal_consultation");
    const judicial = tools.find((t) => t.id === "judicial_opinions")!;
    expect(judicial.enabled).toBe(true);
    expect(judicial.available).toBe(false);
    expect(judicial.unavailableReasonFa).toBeTruthy();
  });

  it("makes judicial opinions available once a real source exists", () => {
    libraryItems = [{ id: "a", title: "رأی", sourceType: "UNIFICATION_RULING" }];
    const { tools } = resolveChatTools("legal_consultation");
    expect(tools.find((t) => t.id === "judicial_opinions")!.available).toBe(true);
  });

  it("drops selected tools that are no longer available instead of erroring", () => {
    const { selected } = resolveChatTools("legal_consultation", [
      "deep_analysis",
      "judicial_opinions",
      "unknown_tool",
    ]);
    expect(selected).toEqual(["deep_analysis"]);
  });

  it("respects the enabled toggle", () => {
    updateToolSetting("deep_analysis", { enabled: false }, "admin");
    const { tools, selected } = resolveChatTools("legal_consultation", ["deep_analysis"]);
    const tool = tools.find((t) => t.id === "deep_analysis")!;
    expect(tool.enabled).toBe(false);
    expect(tool.available).toBe(false);
    expect(tool.unavailableReasonFa).toContain("غیرفعال");
    expect(selected).toEqual([]);
  });

  it("respects the per-service allowlist", () => {
    updateToolSetting("legal_research", { allowedServiceTypes: ["law_search"] }, "admin");
    const forConsult = resolveChatTools("legal_consultation").tools;
    const forLaw = resolveChatTools("law_search").tools;
    expect(forConsult.find((t) => t.id === "legal_research")!.available).toBe(false);
    expect(forLaw.find((t) => t.id === "legal_research")!.available).toBe(true);
  });
});

// ============================================================
// Settings persistence
// ============================================================

describe("listToolSettings / updateToolSetting", () => {
  it("seeds defaults idempotently on first read", () => {
    const first = listToolSettings();
    const second = listToolSettings();
    expect(first.map((r) => r.toolId)).toEqual(second.map((r) => r.toolId));
    expect(first).toHaveLength(3);
    expect(first.every((r) => r.enabled)).toBe(true);
  });

  it("returns null for an unknown tool id", () => {
    expect(updateToolSetting("unknown_tool", { enabled: false }, "admin")).toBeNull();
  });

  it("stamps the editor and time on update", () => {
    const updated = updateToolSetting("deep_analysis", { labelFa: "  تحلیل جامع  " }, "admin-1");
    expect(updated?.labelFa).toBe("تحلیل جامع");
    expect(updated?.updatedBy).toBe("admin-1");
    expect(updated?.updatedAt).not.toBe(new Date(0).toISOString());
  });

  it("an admin toggle cannot make a missing capability available", () => {
    const admin = listToolsForAdmin();
    const judicial = admin.find((t) => t.toolId === "judicial_opinions")!;
    expect(judicial.enabled).toBe(true);
    expect(judicial.available).toBe(false);
  });
});

// ============================================================
// Validation (the server's authority)
// ============================================================

describe("validateToolSelection", () => {
  it("accepts available tools and reports ok", () => {
    const result = validateToolSelection("legal_consultation", ["deep_analysis", "legal_research"]);
    expect(result.ok).toBe(true);
    expect(result.valid).toEqual(["deep_analysis", "legal_research"]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects an unknown id with a Persian reason", () => {
    const result = validateToolSelection("legal_consultation", ["hack"]);
    expect(result.ok).toBe(false);
    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([{ id: "hack", reasonFa: "ابزار ناشناخته است." }]);
  });

  it("rejects a source-dependent tool with no source (tampered URL)", () => {
    const result = validateToolSelection("legal_consultation", ["judicial_opinions"]);
    expect(result.ok).toBe(false);
    expect(result.rejected[0]!.reasonFa).toContain("رأی قضایی");
  });

  it("rejects a tool the admin disabled", () => {
    updateToolSetting("deep_analysis", { enabled: false }, "admin");
    const result = validateToolSelection("legal_consultation", ["deep_analysis"]);
    expect(result.ok).toBe(false);
    expect(result.rejected[0]!.reasonFa).toContain("غیرفعال");
  });

  it("dedupes repeated bad ids", () => {
    const result = validateToolSelection("legal_consultation", ["hack", "hack"]);
    expect(result.rejected).toHaveLength(1);
  });

  it("keeps valid tools while reporting the refused ones", () => {
    const result = validateToolSelection("legal_consultation", [
      "deep_analysis",
      "judicial_opinions",
    ]);
    expect(result.ok).toBe(false);
    expect(result.valid).toEqual(["deep_analysis"]);
    expect(result.rejected.map((r) => r.id)).toEqual(["judicial_opinions"]);
  });

  it("rejects a non-string id", () => {
    const result = validateToolSelection("legal_consultation", [42]);
    expect(result.ok).toBe(false);
    expect(result.rejected[0]!.reasonFa).toContain("نامعتبر");
  });
});

describe("normalizeToolIds", () => {
  it("dedupes, drops unknown ids and sorts by product order", () => {
    expect(normalizeToolIds(["legal_research", "deep_analysis", "deep_analysis", "x"])).toEqual([
      "deep_analysis",
      "legal_research",
    ]);
    expect(normalizeToolIds(null)).toEqual([]);
    expect(normalizeToolIds(undefined)).toEqual([]);
  });
});

// ============================================================
// Retrieval effect — selection must mean something
// ============================================================

describe("toolRetrievalPlan", () => {
  it("uses the pre-existing baseline when no tool is selected", () => {
    const plan = toolRetrievalPlan([]);
    expect(plan.maxSources).toBe(3);
    expect(plan.includePrecedentPass).toBe(false);
    expect(plan.promptNotes).toEqual([]);
  });

  it("widens retrieval for deep analysis", () => {
    const plan = toolRetrievalPlan(["deep_analysis"]);
    expect(plan.maxSources).toBe(5);
    expect(plan.promptNotes).toHaveLength(1);
  });

  it("widens retrieval further for legal research", () => {
    expect(toolRetrievalPlan(["legal_research"]).maxSources).toBe(6);
  });

  it("adds a precedent pass only for judicial opinions", () => {
    expect(toolRetrievalPlan(["judicial_opinions"]).includePrecedentPass).toBe(true);
    expect(toolRetrievalPlan(["deep_analysis"]).includePrecedentPass).toBe(false);
  });

  it("merges the effects of combined tools", () => {
    const plan = toolRetrievalPlan(["deep_analysis", "legal_research", "judicial_opinions"]);
    expect(plan.maxSources).toBe(6);
    expect(plan.includePrecedentPass).toBe(true);
    expect(plan.promptNotes).toHaveLength(3);
  });

  it("tells the model to admit when no precedent was found", () => {
    const plan = toolRetrievalPlan(["judicial_opinions"]);
    expect(plan.promptNotes.join(" ")).toContain("رأی مرتبطی موجود نیست");
  });
});
