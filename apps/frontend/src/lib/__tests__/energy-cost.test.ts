// ============================================================
// LEGALIR — Energy cost model tests
// ============================================================
// Covers the pure `computeUsageCost` core: base + per-1k token/context charges,
// auxiliary unit charges, the documented rule-engine examples (message-index
// bands, token thresholds, RAG/lawyer-review deltas), rule multiplication and
// the per-model multiplier applied last.
// ============================================================

import { describe, it, expect } from "vitest";
import { computeUsageCost } from "@/lib/usage/energy";
import type { ServiceCostProfile, ServiceCostRule } from "@legalir/types";

const NOW = "2026-10-06T00:00:00.000Z";

function profile(over: Partial<ServiceCostProfile> = {}): ServiceCostProfile {
  return {
    id: "scp-test",
    serviceKey: "ai-legal-assistant",
    nameFa: "دستیار حقوقی هوشمند",
    descriptionFa: "",
    activity: "AI_MESSAGE",
    enabled: true,
    baseRequestCost: 1,
    inputTokenPer1k: 0,
    outputTokenPer1k: 0,
    contextTokenPer1k: 0,
    unitCosts: {},
    modelMultipliers: {},
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: null,
    ...over,
  };
}

function rule(over: Partial<ServiceCostRule> = {}): ServiceCostRule {
  return {
    id: `scr-${Math.random().toString(36).slice(2)}`,
    profileId: "scp-test",
    activity: "AI_MESSAGE",
    labelFa: "قاعده",
    enabled: true,
    priority: 1,
    condition: "MESSAGE_INDEX_RANGE",
    min: null,
    max: null,
    models: [],
    addEnergy: 0,
    multiply: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe("computeUsageCost", () => {
  it("charges only the base request cost when nothing else applies", () => {
    const b = computeUsageCost(profile({ baseRequestCost: 5 }), [], {});
    expect(b.baseCost).toBe(5);
    expect(b.tokenCost).toBe(0);
    expect(b.unitCost).toBe(0);
    expect(b.ruleCost).toBe(0);
    expect(b.modelMultiplier).toBe(1);
    expect(b.total).toBe(5);
  });

  it("charges input/output tokens per 1,000 and context tokens per 1,000", () => {
    const b = computeUsageCost(
      profile({ baseRequestCost: 0, inputTokenPer1k: 3, outputTokenPer1k: 6, contextTokenPer1k: 2 }),
      [],
      { inputTokens: 2_000, outputTokens: 500, contextTokens: 3_000 }
    );
    // 2 * 3 = 6 ; 0.5 * 6 = 3 ; 3 * 2 = 6 → 15
    expect(b.tokenCost).toBe(9);
    expect(b.contextCost).toBe(6);
    expect(b.total).toBe(15);
  });

  it("charges each auxiliary unit and treats ragUsed as one RAG retrieval", () => {
    const b = computeUsageCost(
      profile({
        baseRequestCost: 0,
        unitCosts: { TOOL_CALL: 2, RAG_RETRIEVAL: 1, FILE: 3, IMAGE: 4 },
      }),
      [],
      { toolCalls: 2, ragUsed: true, fileCount: 1, imageCount: 2 }
    );
    // tools 2*2=4 + rag 1 + file 3 + images 2*4=8 = 16
    expect(b.unitCost).toBe(16);
    expect(b.total).toBe(16);
  });

  it("applies the documented message-band + threshold + review rules in priority order", () => {
    const rules = [
      rule({ id: "r1", priority: 10, condition: "MESSAGE_INDEX_RANGE", min: 1, max: 1, addEnergy: 1 }),
      rule({ id: "r2", priority: 20, condition: "MESSAGE_INDEX_RANGE", min: 2, max: 5, addEnergy: 2 }),
      rule({ id: "r3", priority: 30, condition: "MESSAGE_INDEX_RANGE", min: 6, max: null, addEnergy: 3 }),
      rule({ id: "r4", priority: 40, condition: "INPUT_TOKENS_GT", min: 5_000, addEnergy: 2 }),
      rule({ id: "r5", priority: 50, condition: "OUTPUT_TOKENS_GT", min: 2_000, addEnergy: 2 }),
      rule({ id: "r6", priority: 60, condition: "RAG_USED", addEnergy: 1 }),
      rule({ id: "r7", priority: 70, condition: "LAWYER_REVIEW", addEnergy: 10 }),
    ];

    // First message, nothing else.
    const first = computeUsageCost(profile({ baseRequestCost: 1 }), rules, { messageIndex: 1 });
    expect(first.total).toBe(2);
    expect(first.appliedRuleIds).toEqual(["r1"]);

    // Sixth message, long input, RAG used, lawyer review required.
    const sixth = computeUsageCost(profile({ baseRequestCost: 1 }), rules, {
      messageIndex: 6,
      inputTokens: 6_000,
      ragUsed: true,
      lawyerReview: true,
    });
    // base 1 + 3 (message≥6) + 2 (input) + 1 (rag) + 10 (review) = 17
    expect(sixth.total).toBe(17);
    expect(sixth.appliedRuleIds).toEqual(["r3", "r4", "r6", "r7"]);
  });

  it("ignores disabled rules", () => {
    const b = computeUsageCost(
      profile({ baseRequestCost: 1 }),
      [rule({ condition: "MESSAGE_INDEX_RANGE", min: 1, max: null, addEnergy: 9, enabled: false })],
      { messageIndex: 1 }
    );
    expect(b.total).toBe(1);
    expect(b.appliedRuleIds).toEqual([]);
  });

  it("applies MODEL_IS only for the listed model and contributes addEnergy once", () => {
    const rules = [
      rule({ condition: "MODEL_IS", models: ["gpt-4o"], addEnergy: 4 }),
    ];
    const hit = computeUsageCost(profile({ baseRequestCost: 1 }), rules, { model: "gpt-4o" });
    expect(hit.total).toBe(5);

    const miss = computeUsageCost(profile({ baseRequestCost: 1 }), rules, { model: "gpt-4o-mini" });
    expect(miss.total).toBe(1);
  });

  it("applies rule multiply to the running subtotal", () => {
    const b = computeUsageCost(
      profile({ baseRequestCost: 4 }),
      [rule({ condition: "MESSAGE_INDEX_RANGE", min: 1, max: null, addEnergy: 1, multiply: 2 })],
      { messageIndex: 1 }
    );
    // (4 + 1) * 2 = 10 ; ruleCost = running(10) - preRule(4) = 6
    expect(b.subtotal).toBe(10);
    expect(b.ruleCost).toBe(6);
    expect(b.total).toBe(10);
  });

  it("applies the model multiplier last, after rule deltas", () => {
    const b = computeUsageCost(
      profile({ baseRequestCost: 3, modelMultipliers: { "gpt-4o": 2 } }),
      [rule({ condition: "MESSAGE_INDEX_RANGE", min: 1, max: null, addEnergy: 2 })],
      { messageIndex: 1, model: "gpt-4o" }
    );
    // (3 + 2) * 2 = 10
    expect(b.subtotal).toBe(5);
    expect(b.modelMultiplier).toBe(2);
    expect(b.total).toBe(10);
  });

  it("never returns a negative total even with a negative delta", () => {
    const b = computeUsageCost(
      profile({ baseRequestCost: 1 }),
      [rule({ condition: "MESSAGE_INDEX_RANGE", min: 1, max: null, addEnergy: -50 })],
      { messageIndex: 1 }
    );
    expect(b.total).toBe(0);
  });
});
