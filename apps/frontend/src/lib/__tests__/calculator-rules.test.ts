// ============================================================
// LEGALIR — Calculator rule versions (§5-rules, hermetic)
// ============================================================
// Covers the DB-backed, versioned rate-override layer that sits on top of the
// versioned CODE datasets:
//
//   • the code seed is the fallback and is NEVER mutated;
//   • a DRAFT never affects users — only a PUBLISHED version whose effective
//     date has arrived is applied, and it is applied in the BACKEND;
//   • validation is structural (unknown keys / bad numbers / bad brackets);
//   • history is append-only (publish archives the prior version; rollback is a
//     new draft that copies an older version — nothing is destroyed);
//   • equivalence: with no active rule the result equals the code seed; a
//     published rule changes the result exactly as its patch dictates.
//
// `@/lib/db` is mocked to an in-memory table so the suite is hermetic; the REAL
// calculator engine + datasets are used so the equivalence assertions are
// meaningful (not tautologies over a mock).
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/db", () => ({
  readTable: () => state.rows,
  writeTable: (_name: string, data: unknown) => {
    state.rows = data as Record<string, unknown>[];
  },
}));

import {
  listRuleVersions,
  getRuleVersion,
  listRuleSummaries,
  getRuleDetail,
  buildRuleSchema,
  validateDraftRates,
  saveRuleDraft,
  publishDraft,
  deleteDraft,
  rollbackToVersion,
  previewDraft,
  primeActiveRules,
  activeRuleRefs,
  activeRuleOverrides,
} from "@/lib/admin/calculator-rules";
import {
  getDataset,
  runCalculator,
  runCalculatorWithRules,
  clearRuleOverrides,
} from "@/lib/calculators";

const DS = "court-fee-1405";
const SLUG = "court-fee";

/** Non-monetary court fee with no active rule — the code-seed baseline. */
function nonMonetaryRun(): number {
  const r = runCalculator(SLUG, { claimType: "non_monetary", stage: "first" });
  return r.headlineValue ?? 0;
}

beforeEach(() => {
  state.rows = [];
  clearRuleOverrides();
});

describe("seed baseline (before any rule)", () => {
  it("runs the calculator from the code seed", () => {
    // court-fee-1405 seed: nonMonetaryFlatRial = 2,000,000 Rial.
    expect(nonMonetaryRun()).toBe(2_000_000);
    expect(getDataset(DS)!.rates["nonMonetaryFlatRial"]).toBe(2_000_000);
  });

  it("reports no active rule, no draft, and lists the dataset", () => {
    const s = listRuleSummaries().find((x) => x.datasetId === DS)!;
    expect(s.active).toBeNull();
    expect(s.draft).toBeNull();
    expect(s.seedVersion).toBe("court-fee-1405.1");
    expect(s.needsReview).toBe(true); // 1405 figures are `pending`
    expect(activeRuleRefs([DS])).toEqual([]);
  });
});

describe("validation — structural, never executable", () => {
  it("accepts a valid sparse patch", () => {
    const v = validateDraftRates(DS, { nonMonetaryFlatRial: 3_000_000, appealMultiplier: 0.4 });
    expect(v.ok).toBe(true);
  });

  it("rejects an unknown key", () => {
    const v = validateDraftRates(DS, { nope: 1 });
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.severity === "error" && i.fieldPath === "nope")).toBe(true);
  });

  it("rejects a negative or non-finite number", () => {
    expect(validateDraftRates(DS, { nonMonetaryFlatRial: -1 }).ok).toBe(false);
    expect(validateDraftRates(DS, { nonMonetaryFlatRial: Number.NaN }).ok).toBe(false);
  });

  it("rejects a bracket rate outside 0..1", () => {
    const bad = [
      { upToRial: 100, rate: 1.5 },
      { upToRial: null, rate: 0.08 },
    ];
    expect(validateDraftRates(DS, { brackets: bad }).ok).toBe(false);
  });

  it("rejects non-ascending bracket caps", () => {
    const bad = [
      { upToRial: 500, rate: 0.03 },
      { upToRial: 100, rate: 0.04 },
      { upToRial: null, rate: 0.08 },
    ];
    const v = validateDraftRates(DS, { brackets: bad });
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.messageFa.includes("صعودی"))).toBe(true);
  });

  it("rejects an open top bracket that is not last", () => {
    const bad = [
      { upToRial: null, rate: 0.03 },
      { upToRial: 500, rate: 0.08 },
    ];
    expect(validateDraftRates(DS, { brackets: bad }).ok).toBe(false);
  });
});

describe("draft lifecycle", () => {
  it("saves a draft and keeps exactly one open draft per dataset", () => {
    const d1 = saveRuleDraft(DS, { rates: { nonMonetaryFlatRial: 3_000_000 } }, "admin-1");
    if ("error" in d1) throw new Error("unexpected error");
    const d2 = saveRuleDraft(DS, { rates: { nonMonetaryFlatRial: 4_000_000 } }, "admin-1");
    if ("error" in d2) throw new Error("unexpected error");
    expect(d2.id).toBe(d1.id); // same open draft, edited
    expect(d2.rates["nonMonetaryFlatRial"]).toBe(4_000_000);
    expect(listRuleVersions(DS).filter((r) => r.status === "draft")).toHaveLength(1);
  });

  it("refuses to save an invalid patch", () => {
    const res = saveRuleDraft(DS, { rates: { bogusKey: 1 } }, "admin-1");
    expect("error" in res && res.error).toBe("INVALID_RATES");
    expect(state.rows).toHaveLength(0);
  });

  it("refuses an unknown dataset", () => {
    const res = saveRuleDraft("nope", { rates: {} });
    expect("error" in res && res.error).toBe("DATASET_NOT_FOUND");
  });

  it("refuses a malformed effectiveFrom", () => {
    const res = saveRuleDraft(DS, {
      rates: { nonMonetaryFlatRial: 1 },
      effectiveFrom: "2026/01/01",
    });
    expect("error" in res && res.error).toBe("INVALID_EFFECTIVE_FROM");
  });

  it("discards only a draft — never published history", () => {
    const d = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "x" },
      "admin-1"
    );
    if ("error" in d) throw new Error("unexpected error");
    expect(publishDraft(d.id, "admin-1")).not.toHaveProperty("error");
    expect(deleteDraft(d.id)).toEqual({ error: "NOT_A_DRAFT" });
    expect(getRuleVersion(d.id)!.status).toBe("published");
  });
});

describe("publish — a published version activates; a draft does not", () => {
  it("a saved draft alone leaves user results on the seed", () => {
    saveRuleDraft(DS, { rates: { nonMonetaryFlatRial: 3_000_000 } }, "admin-1");
    primeActiveRules();
    try {
      // No published version yet → users still get the seed figure.
      expect(nonMonetaryRun()).toBe(2_000_000);
      expect(getDataset(DS)!.rates["nonMonetaryFlatRial"]).toBe(2_000_000);
    } finally {
      clearRuleOverrides();
    }
  });

  it("publishing requires a change note and non-empty rates", () => {
    const d = saveRuleDraft(DS, { rates: { nonMonetaryFlatRial: 3_000_000 } }, "admin-1");
    if ("error" in d) throw new Error("unexpected error");
    // no change note yet
    expect(publishDraft(d.id, "admin-1")).toEqual({ error: "CHANGE_NOTE_REQUIRED" });

    saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "به‌روزرسانی مقطوع غیرمالی" },
      "admin-1"
    );
    const empty = saveRuleDraft(DS, { rates: {}, changeNoteFa: "بی‌اثر" }, "admin-1");
    if ("error" in empty) throw new Error("unexpected error");
    expect(publishDraft(empty.id, "admin-1")).toEqual({ error: "EMPTY_DRAFT" });
  });

  it("applies the published figure in the backend (equivalence after migration)", () => {
    const d = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "افزایش مقطوع غیرمالی ۱۴۰۵" },
      "admin-1"
    );
    if ("error" in d) throw new Error("unexpected error");
    const pub = publishDraft(d.id, "admin-1");
    if ("error" in pub) throw new Error("unexpected error");
    expect(pub.status).toBe("published");
    expect(pub.version).toBe("court-fee-1405.2");

    primeActiveRules();
    try {
      expect(getDataset(DS)!.rates["nonMonetaryFlatRial"]).toBe(3_000_000);
      expect(nonMonetaryRun()).toBe(3_000_000);
    } finally {
      clearRuleOverrides();
    }
    // And the overlay is gone once cleared.
    expect(getDataset(DS)!.rates["nonMonetaryFlatRial"]).toBe(2_000_000);
  });

  it("does NOT activate a version whose effective date is in the future", () => {
    const d = saveRuleDraft(
      DS,
      {
        rates: { nonMonetaryFlatRial: 9_000_000 },
        changeNoteFa: "نسخهٔ آینده",
        effectiveFrom: "2999-01-01",
      },
      "admin-1"
    );
    if ("error" in d) throw new Error("unexpected error");
    publishDraft(d.id, "admin-1");
    primeActiveRules();
    try {
      expect(nonMonetaryRun()).toBe(2_000_000); // still the seed
    } finally {
      clearRuleOverrides();
    }
  });

  it("surfaces the active rule ref for the run response", () => {
    const d = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "x" },
      "admin-1"
    );
    if ("error" in d) throw new Error("unexpected error");
    publishDraft(d.id, "admin-1");
    const refs = activeRuleRefs([DS]);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.datasetId).toBe(DS);
    expect(refs[0]!.version).toBe("court-fee-1405.2");
    expect(refs[0]!.verificationStatus).toBe("pending");
  });
});

describe("history is append-only — publish archives, rollback copies", () => {
  it("publishing a newer version archives the prior one without deleting it", () => {
    const v2 = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "v2" },
      "a"
    );
    if ("error" in v2) throw new Error();
    publishDraft(v2.id, "a");

    const v3 = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 5_000_000 }, changeNoteFa: "v3" },
      "a"
    );
    if ("error" in v3) throw new Error();
    publishDraft(v3.id, "a");

    expect(getRuleVersion(v2.id)!.status).toBe("archived");
    expect(getRuleVersion(v3.id)!.status).toBe("published");
    expect(listRuleVersions(DS)).toHaveLength(2); // two stored versions (v2, v3)
  });

  it("rollback creates a NEW draft that copies a prior version's figures", () => {
    const v2 = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "v2" },
      "a"
    );
    if ("error" in v2) throw new Error();
    publishDraft(v2.id, "a");

    const rb = rollbackToVersion(DS, v2.id, "b");
    if ("error" in rb) throw new Error();
    expect(rb.status).toBe("draft");
    expect(rb.id).not.toBe(v2.id);
    expect(rb.rates["nonMonetaryFlatRial"]).toBe(3_000_000);
    expect(rb.changeNoteFa).toContain("بازگردانی");
    // The source version is untouched.
    expect(getRuleVersion(v2.id)!.status).toBe("published");
  });

  it("refuses to roll back a version from another dataset", () => {
    const v2 = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "v2" },
      "a"
    );
    if ("error" in v2) throw new Error();
    const res = rollbackToVersion("diyeh-1404", v2.id);
    expect("error" in res && res.error).toBe("VERSION_NOT_FOUND");
  });
});

describe("preview — validate + test with sample inputs before publish", () => {
  it("returns the effect on consumers and never leaks the draft overlay", () => {
    // The court-fee default sample input is a MONETARY claim, so patch a
    // bracket rate (not the non-monetary flat) to move the sample headline.
    const preview = previewDraft(DS, { brackets: [{ upToRial: null, rate: 0.5 }] });
    expect(preview.validation.ok).toBe(true);
    const sample = preview.samples.find((s) => s.slug === SLUG)!;
    expect(sample.beforeHeadlineFa).not.toBe(sample.afterHeadlineFa);
    expect(sample.changed).toBe(true);
    expect(preview.changedCount).toBeGreaterThanOrEqual(1);

    // The draft overlay created for the preview must be gone afterwards.
    expect(getDataset(DS)!.rates["nonMonetaryFlatRial"]).toBe(2_000_000);
    expect(nonMonetaryRun()).toBe(2_000_000);
  });

  it("flags an invalid patch without running the sample", () => {
    const preview = previewDraft(DS, { bogus: 1 });
    expect(preview.validation.ok).toBe(false);
  });
});

describe("admin read models", () => {
  it("getRuleDetail exposes the seed, effective rates, schema and consumers", () => {
    const detail = getRuleDetail(DS)!;
    expect(detail.seed.rates["nonMonetaryFlatRial"]).toBe(2_000_000);
    expect(detail.effective.version).toBe("court-fee-1405.1");
    expect(detail.effective.fromRule).toBe(false);
    expect(detail.usedBy.map((u) => u.slug)).toContain(SLUG);
    const bracketField = detail.schema.find((f) => f.key === "brackets")!;
    expect(bracketField.kind).toBe("brackets");
    const flatField = detail.schema.find((f) => f.key === "nonMonetaryFlatRial")!;
    expect(flatField.kind).toBe("number");
  });

  it("getRuleDetail reflects a published override", () => {
    const d = saveRuleDraft(
      DS,
      { rates: { nonMonetaryFlatRial: 3_000_000 }, changeNoteFa: "x" },
      "a"
    );
    if ("error" in d) throw new Error();
    publishDraft(d.id, "a");
    const detail = getRuleDetail(DS)!;
    expect(detail.effective.fromRule).toBe(true);
    expect(detail.effective.rates["nonMonetaryFlatRial"]).toBe(3_000_000);
    expect(detail.active!.version).toBe("court-fee-1405.2");
    expect(detail.effective.version).toBe("court-fee-1405.2");
  });

  it("returns null for an unknown dataset", () => {
    expect(getRuleDetail("nope")).toBeNull();
    expect(buildRuleSchema("nope")).toEqual([]);
  });
});

describe("free preview parity — the client overlay matches the server", () => {
  // A monetary claim exercises the bracket override the admin editor sends.
  const CLAIM = { claimType: "monetary", claimValue: 500_000_000, stage: "first" };
  const monetaryRun = () => runCalculator(SLUG, CLAIM).headlineValue ?? 0;

  it("exposes no overrides when the code seed is in force", () => {
    expect(activeRuleOverrides([DS])).toEqual([]);
  });

  it("never leaks a DRAFT through the public overrides", () => {
    saveRuleDraft(DS, { rates: { nonMonetaryFlatRial: 5_000_000 }, changeNoteFa: "d" }, "a");
    expect(activeRuleOverrides([DS])).toEqual([]);
  });

  it("a free preview with the published overrides equals the server run", () => {
    const seed = monetaryRun();
    const brackets = [
      { upToRial: 100_000_000, rate: 0.035 },
      { upToRial: 1_000_000_000, rate: 0.04 },
      { upToRial: 2_000_000_000, rate: 0.05 },
      { upToRial: 5_000_000_000, rate: 0.06 },
      { upToRial: 10_000_000_000, rate: 0.07 },
      { upToRial: null, rate: 0.08 },
    ];
    const d = saveRuleDraft(DS, { rates: { brackets }, changeNoteFa: "پلهٔ نخست" }, "a");
    if ("error" in d) throw new Error("unexpected error");
    publishDraft(d.id, "a");

    // SERVER path: prime the overlay, run the synchronous compute, clear it.
    primeActiveRules();
    let server: number;
    try {
      server = monetaryRun();
    } finally {
      clearRuleOverrides();
    }

    // CLIENT preview path: the SAME published overrides around the local compute.
    const client = runCalculatorWithRules(SLUG, CLAIM, activeRuleOverrides([DS]))
      .headlineValue ?? 0;

    expect(server).not.toBe(seed); // the change actually moved the number
    expect(client).toBe(server); // ← the fix: the label and the number agree
  });

  it("with no overrides the preview is identical to the seed run", () => {
    const seed = monetaryRun();
    expect(runCalculatorWithRules(SLUG, CLAIM, []).headlineValue ?? 0).toBe(seed);
  });
});
