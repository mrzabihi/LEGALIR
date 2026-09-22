// ============================================================
// LEGALIR — Intake schema tests (PART 5)
// ============================================================
// Schemas are versioned data, not UI. These tests pin the version, the
// shared step count, and the per-category field injection.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  INTAKE_SCHEMA_VERSION,
  INTAKE_CATEGORIES,
  buildIntakeSchema,
  isSupportedCategory,
} from "../intake-schemas";

describe("intake schemas", () => {
  it("stamps the current schema version", () => {
    expect(buildIntakeSchema("family").version).toBe(INTAKE_SCHEMA_VERSION);
  });

  it("builds the nine shared steps for every category", () => {
    for (const category of INTAKE_CATEGORIES) {
      expect(buildIntakeSchema(category).steps).toHaveLength(9);
    }
  });

  it("gives every step a stable id; all but the review step have fields", () => {
    for (const step of buildIntakeSchema("family").steps) {
      expect(step.id).toBeTruthy();
      if (step.id === "review") {
        expect(step.fields).toHaveLength(0);
      } else {
        expect(step.fields.length).toBeGreaterThan(0);
      }
    }
  });

  it("injects category-specific fields into the subject step only", () => {
    const family = buildIntakeSchema("family");
    const other = buildIntakeSchema("other");
    const familySubject = family.steps.find((s) => s.id === "subject")!;
    const otherSubject = other.steps.find((s) => s.id === "subject")!;
    expect(familySubject.fields.length).toBeGreaterThan(otherSubject.fields.length);
  });

  it("recognises supported categories and rejects unknown ones", () => {
    expect(isSupportedCategory("family")).toBe(true);
    expect(isSupportedCategory("not_a_category")).toBe(false);
  });

  it("still returns a schema for an unknown category (no throw)", () => {
    expect(() => buildIntakeSchema("not_a_category")).not.toThrow();
  });
});
