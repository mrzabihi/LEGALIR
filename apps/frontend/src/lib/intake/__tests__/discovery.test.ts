// ============================================================
// LEGALIR — Legal path discovery: analysis-contract tests
// ============================================================
// The discovery contract is the safety spine of «از کجا شروع کنم؟». These
// tests pin the two invariants that make the feature trustworthy:
//
//   1. It NEVER fabricates a route. Every path is clamped to one of the real,
//      capability-enabled intents; an unknown/disabled intent is dropped, and
//      a payload that leaves nothing is rejected outright.
//   2. The user's request is NEVER lost. A provider failure degrades to the
//      deterministic rules analysis, which always carries the description
//      forward and always offers at least one real path.
//
// They also pin the small pure helpers the UI relies on (title, text
// sanitisation, JSON extraction) and the persisted-record schema the API
// validates before writing a `discovery` field onto a request.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  buildAnalysisFromModel,
  buildRulesAnalysis,
  discoveryModelOutputSchema,
  discoveryRecordSchema,
  discoveryTitle,
  markSelectedPath,
  parseDiscoveryJson,
  summarizeDescription,
  cleanText,
  asDiscoveryIntent,
  DISCOVERY_INTENTS,
  DISCOVERY_MAX_PATHS,
  DISCOVERY_VERSION,
  type DiscoveryInput,
} from "../discovery";
import { INTENT_FLAG_KEY, type IntakeIntent } from "../start-request";

/** A gate that keeps every intent's backing capability on. */
const allOn = () => true;
/** A gate with a given set of flag keys switched off. */
const off = (...keys: string[]) => (flagKey: string) => !keys.includes(flagKey);

function input(over: Partial<DiscoveryInput> = {}): DiscoveryInput {
  return { text: "", intent: null, category: null, hasDocument: false, ...over };
}

// ---------------------------------------------------------------------------
// Sanitisation helpers
// ---------------------------------------------------------------------------

describe("cleanText", () => {
  it("strips control characters and collapses whitespace", () => {
    expect(cleanText("  سلام\u0000  دنیا\n\nچطوری  ", 100)).toBe("سلام دنیا چطوری");
  });

  it("clamps to the maximum length", () => {
    expect(cleanText("abcdefghij", 4)).toBe("abcd");
  });
});

describe("summarizeDescription", () => {
  it("keeps the first sentence only", () => {
    expect(summarizeDescription("قرارداد من فسخ شده. نمی‌دانم چه کنم.")).toBe("قرارداد من فسخ شده");
  });

  it("appends an ellipsis when the sentence is longer than the limit", () => {
    const out = summarizeDescription("یک متن بسیار طولانی که باید کوتاه شود و به حد مجاز برسد", 10);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it("returns an empty string for blank input", () => {
    expect(summarizeDescription("   ")).toBe("");
  });
});

describe("discoveryTitle", () => {
  it("uses the first non-empty line, collapsed", () => {
    expect(discoveryTitle("\n\n  اختلاف ملکی با همسایه  \nبند دوم")).toBe("اختلاف ملکی با همسایه");
  });

  it("falls back to a stable title when the text is empty", () => {
    expect(discoveryTitle("   ")).toBe("مسیر پیشنهادی حقوقی");
  });

  it("clamps a long title with an ellipsis", () => {
    const out = discoveryTitle("ا".repeat(120));
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("asDiscoveryIntent", () => {
  it("accepts a known intent and rejects anything else", () => {
    expect(asDiscoveryIntent("lawyer")).toBe("lawyer");
    expect(asDiscoveryIntent("bogus")).toBeNull();
    expect(asDiscoveryIntent(42)).toBeNull();
    expect(asDiscoveryIntent(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

describe("parseDiscoveryJson", () => {
  it("parses a bare JSON object", () => {
    expect(parseDiscoveryJson('{"summaryFa":"خ"}')).toEqual({ summaryFa: "خ" });
  });

  it("parses through a fenced code block", () => {
    const raw = "```json\n{\"a\":1}\n```";
    expect(parseDiscoveryJson(raw)).toEqual({ a: 1 });
  });

  it("parses through surrounding prose", () => {
    expect(parseDiscoveryJson('در اینجا: {"a":1} پایان.')).toEqual({ a: 1 });
  });

  it("returns null when nothing parses", () => {
    expect(parseDiscoveryJson("هیچ‌چیزی اینجا نیست")).toBeNull();
    expect(parseDiscoveryJson("{ ناقص")).toBeNull();
    expect(parseDiscoveryJson('{ "a": 1, }')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The model-output contract
// ---------------------------------------------------------------------------

describe("discoveryModelOutputSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = discoveryModelOutputSchema.safeParse({
      summaryFa: "خلاصه",
      paths: [{ intent: "legal_question" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invented intent", () => {
    const parsed = discoveryModelOutputSchema.safeParse({
      summaryFa: "خلاصه",
      paths: [{ intent: "make_me_a_sandwich" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty path list", () => {
    const parsed = discoveryModelOutputSchema.safeParse({ summaryFa: "خ", paths: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing summary", () => {
    const parsed = discoveryModelOutputSchema.safeParse({ paths: [{ intent: "lawyer" }] });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rules fallback — the user's request is never lost
// ---------------------------------------------------------------------------

describe("buildRulesAnalysis (deterministic fallback)", () => {
  it("always returns a valid analysis carrying the description, even for gibberish", () => {
    const result = buildRulesAnalysis(input({ text: "کمک" }), allOn);
    expect(result.source).toBe("rules");
    expect(result.version).toBe(DISCOVERY_VERSION);
    expect(result.description).toBe("کمک");
    expect(result.confidence).toBeNull(); // rules never estimate confidence
    expect(result.paths.length).toBeGreaterThan(0);
    // Every offered path is a REAL, known intent.
    for (const p of result.paths) {
      expect(DISCOVERY_INTENTS).toContain(p.intent);
      expect(p.titleFa.length).toBeGreaterThan(0);
      expect(p.rationaleFa.length).toBeGreaterThan(0);
    }
  });

  it("routes a calculation signal to the calculation path first", () => {
    const result = buildRulesAnalysis(
      input({ text: "می‌خواهم مهریه‌ام را به نرخ روز حساب کنم" }),
      allOn
    );
    expect(result.paths[0]!.intent).toBe("calculation");
    expect(result.paths[0]!.primary).toBe(true);
  });

  it("respects the user's explicit pick when its capability is enabled", () => {
    const result = buildRulesAnalysis(input({ text: "چه کار کنم", intent: "lawyer" }), allOn);
    expect(result.paths[0]!.intent).toBe("lawyer");
    expect(result.needsLawyer).toBe(true);
  });

  it("drops a path whose backing capability is switched off (never a dead route)", () => {
    const result = buildRulesAnalysis(
      input({ text: "می‌خواهم مهریه‌ام را به نرخ روز حساب کنم" }),
      off(INTENT_FLAG_KEY.calculation)
    );
    expect(result.paths.map((p) => p.intent)).not.toContain("calculation");
    expect(result.paths.length).toBeGreaterThan(0); // a legal question remains
  });

  it("never keeps more than the maximum number of paths", () => {
    const result = buildRulesAnalysis(
      input({ text: "وکیل، بررسی سند، محاسبه، تنظیم قرارداد و قدم بعدی", hasDocument: true }),
      allOn
    );
    expect(result.paths.length).toBeLessThanOrEqual(DISCOVERY_MAX_PATHS);
  });
});

// ---------------------------------------------------------------------------
// Model → validated analysis (clamping is the safety net)
// ---------------------------------------------------------------------------

describe("buildAnalysisFromModel", () => {
  const baseInput = input({ text: "قرارداد اجاره‌ام را بررسی کن", hasDocument: true });

  it("returns a valid analysis from a well-formed payload", () => {
    const result = buildAnalysisFromModel(
      {
        summaryFa: "کاربر می‌خواهد یک قرارداد اجاره بررسی شود",
        goalFa: "فهمیدن ریسک‌های قرارداد",
        inferredCategory: "real_estate",
        paths: [{ intent: "document_review", rationaleFa: "چون سند پیوست کرده‌ای." }],
        confidence: 78,
      },
      baseInput,
      allOn
    );
    expect(result).not.toBeNull();
    expect(result!.source).toBe("ai");
    expect(result!.confidence).toBe(78);
    expect(result!.paths[0]!.intent).toBe("document_review");
    expect(result!.paths[0]!.rationaleFa).toBe("چون سند پیوست کرده‌ای.");
    expect(result!.inferredCategory).toBe("real_estate");
  });

  it("clamps the model's paths to the enabled capabilities", () => {
    const result = buildAnalysisFromModel(
      {
        summaryFa: "خلاصه",
        paths: [{ intent: "document_review" }, { intent: "legal_question" }],
      },
      baseInput,
      off(INTENT_FLAG_KEY.document_review)
    );
    expect(result).not.toBeNull();
    expect(result!.paths.map((p) => p.intent)).toEqual(["legal_question"]);
  });

  it("returns null when the model settled on paths that are all switched off", () => {
    const result = buildAnalysisFromModel(
      {
        summaryFa: "خلاصه",
        paths: [{ intent: "document_review" }],
      },
      baseInput,
      off(INTENT_FLAG_KEY.document_review, INTENT_FLAG_KEY.legal_question)
    );
    expect(result).toBeNull(); // → the caller falls back to the rules
  });

  it("returns null (never invents) when the payload is schema-invalid", () => {
    expect(
      buildAnalysisFromModel({ summaryFa: "خ", paths: [{ intent: "not_real" }] }, baseInput, allOn)
    ).toBeNull();
    expect(buildAnalysisFromModel({ paths: [] }, baseInput, allOn)).toBeNull();
    expect(buildAnalysisFromModel("نص", baseInput, allOn)).toBeNull();
  });

  it("makes the user's surviving explicit pick the primary path", () => {
    const result = buildAnalysisFromModel(
      {
        summaryFa: "خلاصه",
        paths: [{ intent: "legal_question" }],
      },
      input({ text: "وکیل می‌خواهم", intent: "lawyer" }),
      allOn
    );
    expect(result!.paths[0]!.intent).toBe("lawyer");
    expect(result!.paths[0]!.primary).toBe(true);
  });

  it("falls back to a suggested category when the model names an unknown one", () => {
    const result = buildAnalysisFromModel(
      {
        summaryFa: "خلاصه",
        inferredCategory: "totally_made_up",
        paths: [{ intent: "legal_question" }],
      },
      input({ text: "چک من برگشت خورده" }),
      allOn
    );
    expect(result!.inferredCategory).toBe("checks"); // from the deterministic keyword table
  });

  it("caps the analysis at the maximum path count", () => {
    const result = buildAnalysisFromModel(
      {
        summaryFa: "خلاصه",
        paths: [
          { intent: "legal_question" },
          { intent: "document_review" },
          { intent: "draft_document" },
          { intent: "calculation" },
          { intent: "next_step" },
          { intent: "lawyer" },
        ],
      },
      input({ text: "یک موضوع پیچیده با چند زاویه" }),
      allOn
    );
    expect(result!.paths.length).toBeLessThanOrEqual(DISCOVERY_MAX_PATHS);
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe("markSelectedPath", () => {
  it("flags exactly the chosen intent as selected", () => {
    const paths = buildRulesAnalysis(input({ text: "می‌خواهم مهریه‌ام را حساب کنی" }), allOn).paths;
    const marked = markSelectedPath(paths, "calculation");
    expect(marked.find((p) => p.intent === "calculation")!.selected).toBe(true);
    for (const p of marked.filter((p) => p.intent !== "calculation")) {
      expect(p.selected).toBe(false);
    }
  });

  it("does not mutate the input list", () => {
    const paths = buildRulesAnalysis(input({ text: "کمک" }), allOn).paths;
    const before = paths.map((p) => p.selected);
    markSelectedPath(paths, "legal_question");
    expect(paths.map((p) => p.selected)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Persisted-record schema (the API's gate before writing `discovery`)
// ---------------------------------------------------------------------------

describe("discoveryRecordSchema", () => {
  const record = buildRulesAnalysis(input({ text: "چک برگشتی دارم و نمی‌دانم چه کنم" }), allOn);

  it("accepts a real analysis record produced by the engine", () => {
    expect(discoveryRecordSchema.safeParse(record).success).toBe(true);
  });

  it("rejects a record with an over-long summary", () => {
    const bad = { ...record, summaryFa: "ا".repeat(700) };
    expect(discoveryRecordSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a record with a tampered intent", () => {
    const bad = {
      ...record,
      paths: [{ ...record.paths[0]!, intent: "definitely_not_real" }],
    };
    expect(discoveryRecordSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a record with an unknown source", () => {
    expect(discoveryRecordSchema.safeParse({ ...record, source: "wishful" }).success).toBe(false);
  });

  it("rejects a record with too many paths", () => {
    const many = Array.from({ length: DISCOVERY_MAX_PATHS + 1 }, () => record.paths[0]!);
    expect(discoveryRecordSchema.safeParse({ ...record, paths: many }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Safety net: every flag key referenced is one the app actually gates on
// ---------------------------------------------------------------------------

describe("intent → flag mapping", () => {
  it("maps every discovery intent to a real feature-flag key", () => {
    for (const intent of DISCOVERY_INTENTS) {
      expect(typeof INTENT_FLAG_KEY[intent as IntakeIntent]).toBe("string");
      expect(INTENT_FLAG_KEY[intent as IntakeIntent].length).toBeGreaterThan(0);
    }
  });
});
