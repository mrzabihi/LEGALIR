import { describe, it, expect } from "vitest";
import {
  RATE_DATASETS,
  getDataset,
  requireDataset,
  listCalculators,
} from "@/lib/calculators";

// ============================================================
// Dataset integrity — provenance + year isolation
// ============================================================
// Two guarantees are enforced here:
//
//  1) SOURCE CONSISTENCY — every dataset carries complete, non-empty
//     provenance, and every dataset a calculator declares actually
//     exists. A calculator can never silently read a missing dataset.
//
//  2) YEAR ISOLATION — a dataset's `calculationYear` must match the
//     year embedded in its id and in its `source.calculationYear`.
//     This is what stops a 1404 rate from being served under a 1403
//     label (or vice versa) after an annual update.

describe("datasets — source consistency", () => {
  it("ships at least one dataset", () => {
    expect(RATE_DATASETS.length).toBeGreaterThan(0);
  });

  it("gives every dataset a unique id", () => {
    const ids = RATE_DATASETS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every dataset complete provenance", () => {
    for (const ds of RATE_DATASETS) {
      const s = ds.source;
      expect(s.sourceTitle, `${ds.id} sourceTitle`).toBeTruthy();
      expect(s.sourceAuthority, `${ds.id} sourceAuthority`).toBeTruthy();
      expect(s.publicationDate, `${ds.id} publicationDate`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.effectiveFrom, `${ds.id} effectiveFrom`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.jurisdiction, `${ds.id} jurisdiction`).toBeTruthy();
      expect(s.version, `${ds.id} version`).toBeTruthy();
      expect(s.verifiedAt, `${ds.id} verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.calculationYear, `${ds.id} source.calculationYear`).toBeGreaterThan(1300);
    }
  });

  it("requires a note on every dataset so caveats reach the user", () => {
    for (const ds of RATE_DATASETS) {
      expect(ds.source.notes, `${ds.id} notes`).toBeTruthy();
    }
  });

  it("returns undefined for an unknown dataset id", () => {
    expect(getDataset("does-not-exist")).toBeUndefined();
  });

  it("throws from requireDataset for an unknown id", () => {
    expect(() => requireDataset("does-not-exist")).toThrow(/not found/);
  });

  it("resolves every dataset a calculator declares", () => {
    for (const calc of listCalculators()) {
      expect(
        calc.def.datasetIds.length,
        `${calc.def.slug} declares no dataset`
      ).toBeGreaterThan(0);
      for (const id of calc.def.datasetIds) {
        expect(getDataset(id), `${calc.def.slug} → ${id}`).toBeDefined();
      }
    }
  });
});

describe("datasets — year isolation", () => {
  it("matches the year in the id, the dataset and the source", () => {
    for (const ds of RATE_DATASETS) {
      const idYear = Number(ds.id.match(/(\d{4})$/)?.[1]);
      expect(Number.isFinite(idYear), `${ds.id} has no year suffix`).toBe(true);
      expect(ds.calculationYear, `${ds.id} calculationYear`).toBe(idYear);
      expect(ds.source.calculationYear, `${ds.id} source.calculationYear`).toBe(idYear);
    }
  });

  it("keeps the effective window internally consistent", () => {
    for (const ds of RATE_DATASETS) {
      if (ds.source.effectiveTo) {
        expect(
          ds.source.effectiveFrom < ds.source.effectiveTo,
          `${ds.id} effective window inverted`
        ).toBe(true);
      }
    }
  });

  it("never serves two datasets for the same id", () => {
    const byId = new Map(RATE_DATASETS.map((d) => [d.id, d]));
    expect(byId.size).toBe(RATE_DATASETS.length);
  });
});
