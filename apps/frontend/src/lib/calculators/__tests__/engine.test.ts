import { describe, it, expect } from "vitest";
import {
  coerceInput,
  CalculatorInputError,
  listCalculators,
  getCalculator,
  runCalculator,
} from "@/lib/calculators";
import type { CalculatorField } from "@legalir/types";

const fields: CalculatorField[] = [
  { key: "amount", labelFa: "مبلغ", type: "money", unit: "IRT", required: true, min: 0 },
  {
    key: "count",
    labelFa: "تعداد",
    type: "number",
    required: false,
    defaultValue: 3,
    min: 1,
    max: 10,
  },
  {
    key: "mode",
    labelFa: "حالت",
    type: "select",
    required: true,
    defaultValue: "a",
    options: [
      { value: "a", labelFa: "الف" },
      { value: "b", labelFa: "ب" },
    ],
  },
  { key: "flag", labelFa: "پرچم", type: "boolean", required: false, defaultValue: false },
];

describe("calculator engine — coerceInput", () => {
  it("applies defaults for omitted optional fields", () => {
    const out = coerceInput(fields, { amount: 100 });
    expect(out["amount"]).toBe(100);
    expect(out["count"]).toBe(3);
    expect(out["mode"]).toBe("a");
    expect(out["flag"]).toBe(false);
  });

  it("parses numeric strings with Persian separators", () => {
    const out = coerceInput(fields, { amount: "۱٬۲۰۰٬۰۰۰" });
    expect(out["amount"]).toBe(1200000);
  });

  it("clamps values above max", () => {
    const out = coerceInput(fields, { amount: 1, count: 999 });
    expect(out["count"]).toBe(10);
  });

  it("throws for a missing required field", () => {
    expect(() => coerceInput(fields, {})).toThrow(CalculatorInputError);
  });

  it("throws for an out-of-range required field", () => {
    expect(() => coerceInput(fields, { amount: -5 })).toThrow(CalculatorInputError);
  });

  it("rejects an unknown select option", () => {
    expect(() => coerceInput(fields, { amount: 1, mode: "zzz" })).toThrow(
      CalculatorInputError
    );
  });

  it("reports the offending field keys", () => {
    try {
      coerceInput(fields, {});
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CalculatorInputError);
      expect((e as CalculatorInputError).fields).toContain("amount");
    }
  });
});

describe("calculator engine — registry", () => {
  it("registers all eight V1 calculators in catalog order", () => {
    const slugs = listCalculators().map((c) => c.def.slug);
    expect(slugs).toEqual([
      "court-fee",
      "diyeh",
      "delayed-payment",
      "dowry",
      "bonus",
      "severance",
      "leave-buyback",
      "salary",
    ]);
  });

  it("exposes every calculator as available", () => {
    for (const calc of listCalculators()) {
      expect(calc.def.available).toBe(true);
    }
  });

  it("returns undefined for an unknown slug", () => {
    expect(getCalculator("nope")).toBeUndefined();
  });

  it("throws when running an unknown slug", () => {
    expect(() => runCalculator("nope", {})).toThrow(/Calculator not found/);
  });

  it("is deterministic — same input yields identical output", () => {
    const input = {
      claimType: "monetary",
      claimValue: 500_000_000,
      stage: "first",
    };
    expect(runCalculator("court-fee", input)).toEqual(
      runCalculator("court-fee", input)
    );
  });
});
