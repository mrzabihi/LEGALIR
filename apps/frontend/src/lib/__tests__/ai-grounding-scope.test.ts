// ============================================================
// LEGALIR — Grounding knowledge-scope isolation (hermetic)
// ============================================================
// A capability binding can restrict which sources may be cited. That
// restriction is enforced inside `retrieveGroundedSources` — the single
// retrieval entry point — so it holds for BOTH retrieval passes:
//   • `null` / `undefined` → unrestricted (pre-binding behaviour);
//   • `[]`                 → retrieval off, an honest empty answer;
//   • `[id, …]`            → only those sources survive.
//
// The retriever and the contract builder are mocked so this suite tests the
// scope gate, not the ranking engine.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RetrievalHit } from "@legalir/types";

const state = vi.hoisted(() => ({
  base: [] as unknown[],
  precedent: [] as unknown[],
  baseCalls: 0,
  precedentCalls: 0,
  contractCalls: [] as unknown[][],
}));

vi.mock("@/lib/knowledge/retriever", () => ({
  retrieveHybrid: () => {
    state.baseCalls += 1;
    return { hits: state.base, tokens: [] };
  },
  retrievePrecedentSources: () => {
    state.precedentCalls += 1;
    return { hits: state.precedent, tokens: [] };
  },
}));

vi.mock("@/lib/knowledge/answer-contract", () => ({
  buildAnswerContract: (hits: unknown[]) => {
    state.contractCalls.push(hits);
    return {
      grounded: hits.length > 0,
      sourceCount: hits.length,
      topTier: hits.length > 0 ? "STATUTE" : null,
      topTierFa: hits.length > 0 ? "قانون" : null,
      contextBlock: hits.length > 0 ? `SOURCES:${hits.length}` : "",
    };
  },
}));

vi.mock("@/lib/demo-seed", () => ({ getDemoDocument: () => null }));

import { retrieveGroundedSources } from "@/lib/ai/grounding";

function hit(id: string): RetrievalHit {
  return {
    id,
    title: `منبع ${id}`,
    sourceType: "law",
    sourceTypeFa: "قانون",
    summary: `خلاصهٔ ${id}`,
    excerpt: `متن ${id}`,
    score: 0.9,
    signals: { lexical: 1, authority: 1, verification: 1, popularity: 0 },
    provenance: {
      tier: "STATUTE",
      tierFa: "قانون",
      authority: "مجلس شورای اسلامی",
      locator: "ماده ۲۳۰",
      verificationStatus: "VERIFIED_OFFICIAL",
      status: "valid",
      textHash: null,
      origin: "LIBRARY",
    },
  };
}

beforeEach(() => {
  state.base = [hit("law-civil"), hit("law-labor")];
  state.precedent = [hit("precedent-1")];
  state.baseCalls = 0;
  state.precedentCalls = 0;
  state.contractCalls = [];
});

describe("retrieveGroundedSources — scope", () => {
  it("is unrestricted when no scope is supplied", () => {
    const out = retrieveGroundedSources("اجاره", 3);
    expect(out.sources.map((s) => s.id)).toEqual(["law-civil", "law-labor"]);
    expect(out.contract.grounded).toBe(true);
    expect(state.baseCalls).toBe(1);
    expect(state.precedentCalls).toBe(0);
  });

  it("treats null as unrestricted", () => {
    const out = retrieveGroundedSources("اجاره", 3, { allowedSourceIds: null });
    expect(out.sources).toHaveLength(2);
    expect(state.baseCalls).toBe(1);
  });

  it("turns retrieval OFF for an explicit empty scope — without calling the engine", () => {
    const out = retrieveGroundedSources("اجاره", 3, { allowedSourceIds: [] });
    expect(out.sources).toEqual([]);
    expect(out.references).toEqual([]);
    expect(out.contract.grounded).toBe(false);
    expect(state.baseCalls).toBe(0);
    expect(state.precedentCalls).toBe(0);
  });

  it("keeps only the granted sources", () => {
    const out = retrieveGroundedSources("اجاره", 3, { allowedSourceIds: ["law-labor"] });
    expect(out.sources.map((s) => s.id)).toEqual(["law-labor"]);
    expect(out.contract.sourceCount).toBe(1);
  });

  it("filters AFTER the precedent pass, so an ungranted precedent cannot slip in", () => {
    const out = retrieveGroundedSources("اجاره", 3, {
      allowedSourceIds: ["law-civil"],
      includePrecedentPass: true,
    });
    expect(state.precedentCalls).toBe(1);
    expect(out.sources.map((s) => s.id)).toEqual(["law-civil"]);
  });

  it("de-duplicates a precedent hit already returned by the base pass", () => {
    state.precedent = [hit("law-civil"), hit("precedent-1")];
    const out = retrieveGroundedSources("اجاره", 3, { includePrecedentPass: true });
    expect(out.sources.map((s) => s.id)).toEqual(["law-civil", "law-labor", "precedent-1"]);
  });

  it("builds the contract from the FILTERED hits, not the raw retrieval", () => {
    retrieveGroundedSources("اجاره", 3, { allowedSourceIds: ["law-labor"] });
    const last = state.contractCalls.at(-1)!;
    expect(last).toHaveLength(1);
    expect((last[0] as RetrievalHit).id).toBe("law-labor");
  });

  it("emits references only for citable (in-scope) sources", () => {
    const out = retrieveGroundedSources("اجاره", 3, { allowedSourceIds: ["law-civil"] });
    expect(out.references).toHaveLength(1);
    expect(out.references[0]).toMatchObject({
      sourceId: "law-civil",
      locator: "ماده ۲۳۰",
      section: "منابع مرتبط",
    });
    expect(out.references[0]!.quote.length).toBeLessThanOrEqual(160);
  });
});
