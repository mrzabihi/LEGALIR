// ============================================================
// LEGALIR — Deterministic calculator engine
// ============================================================
// The engine owns input validation and dispatch. It performs NO
// arithmetic itself — each calculator implements `compute` using the
// Money helpers and the versioned rate datasets. No LLM is involved
// anywhere in this path: the same input always yields the same output.
//
// Pure module — no React, no I/O, no network.

import type {
  CalculationResult,
  CalculatorDef,
  CalculatorField,
} from "@legalir/types";
import { fromPersianDigits } from "@/lib/persian-utils";

/** Raw, unvalidated input as it arrives from a form. */
export type CalculatorInput = Record<string, number | string | boolean | undefined>;

/** Thrown when the caller supplies input the calculator cannot use. */
export class CalculatorInputError extends Error {
  constructor(
    message: string,
    /** Field keys that failed validation. */
    public readonly fields: string[]
  ) {
    super(message);
    this.name = "CalculatorInputError";
  }
}

/** A calculator: metadata plus a pure compute function. */
export interface Calculator {
  def: CalculatorDef;
  compute(input: CalculatorInput): CalculationResult;
}

// ============================================================
// Input coercion
// ============================================================

/**
 * Coerce a raw value to a finite number, or undefined when unusable.
 * Accepts Persian/Arabic-Indic digits and thousands separators so a
 * value pasted straight from a Persian document parses correctly.
 */
function toNumber(raw: number | string | boolean | undefined): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const cleaned = fromPersianDigits(String(raw)).replace(/[,٬\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Validate and normalise raw input against a calculator's field list.
 * Returns a plain object of coerced values, applying defaults and
 * clamping to declared min/max. Throws `CalculatorInputError` when a
 * required field is missing or a value is out of range.
 */
export function coerceInput(
  fields: CalculatorField[],
  raw: CalculatorInput
): CalculatorInput {
  const out: CalculatorInput = {};
  const bad: string[] = [];

  for (const field of fields) {
    const value = raw[field.key];

    if (field.type === "boolean") {
      out[field.key] = value === undefined ? Boolean(field.defaultValue) : Boolean(value);
      continue;
    }

    if (field.type === "select") {
      const allowed = (field.options ?? []).map((o) => o.value);
      const chosen = value === undefined || value === "" ? field.defaultValue : value;
      if (chosen === undefined || !allowed.includes(String(chosen))) {
        if (field.required) bad.push(field.key);
        continue;
      }
      out[field.key] = String(chosen);
      continue;
    }

    // money | number | percent
    let n = toNumber(value);
    if (n === undefined) {
      const fallback = toNumber(field.defaultValue as number | string | undefined);
      if (fallback === undefined) {
        if (field.required) bad.push(field.key);
        continue;
      }
      n = fallback;
    }

    if (field.min !== undefined && n < field.min) {
      if (field.required) bad.push(field.key);
      n = field.min;
    }
    if (field.max !== undefined && n > field.max) {
      n = field.max;
    }

    out[field.key] = n;
  }

  if (bad.length > 0) {
    throw new CalculatorInputError(`ورودی نامعتبر برای: ${bad.join("، ")}`, bad);
  }

  return out;
}

// ============================================================
// Registry
// ============================================================

const REGISTRY = new Map<string, Calculator>();

/** Register a calculator. Called once per calculator module at import time. */
export function registerCalculator(calc: Calculator): void {
  REGISTRY.set(calc.def.slug, calc);
}

/** All registered calculators, in registration order. */
export function listCalculators(): Calculator[] {
  return Array.from(REGISTRY.values());
}

/** Look up a calculator by slug. */
export function getCalculator(slug: string): Calculator | undefined {
  return REGISTRY.get(slug);
}

/**
 * Run a calculator by slug. Validates input first, then delegates to
 * the calculator's pure `compute`. Throws `CalculatorInputError` for
 * bad input and a plain `Error` for an unknown slug.
 */
export function runCalculator(slug: string, raw: CalculatorInput): CalculationResult {
  const calc = getCalculator(slug);
  if (!calc) throw new Error(`Calculator not found: ${slug}`);
  const input = coerceInput(calc.def.fields, raw);
  return calc.compute(input);
}

/** Read a coerced numeric input, defaulting to 0. */
export function num(input: CalculatorInput, key: string): number {
  const v = input[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Read a coerced string input, defaulting to "". */
export function str(input: CalculatorInput, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

/** Read a coerced boolean input, defaulting to false. */
export function bool(input: CalculatorInput, key: string): boolean {
  return input[key] === true;
}
