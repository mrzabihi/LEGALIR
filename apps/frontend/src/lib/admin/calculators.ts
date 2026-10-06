// ============================================================
// LEGALIR — Admin calculators & legal-data inventory (server-only)
// ============================================================
// READ-ONLY. Every rate a legal calculator multiplies by lives in a
// versioned dataset module (`lib/calculators/datasets*.ts`), not in a
// database row — so the annual update is a code change with full
// provenance, never an ad-hoc admin edit. This module therefore exposes
// an inventory + a review checklist, and never a write path.
//
// Honesty: a dataset whose `calculationYear` trails the newest year on
// the platform is flagged as "needs annual update" — derived from the
// data, not asserted.
// ============================================================

import { listCalculators, RATE_DATASETS } from "@/lib/calculators";
import type { RateDataset } from "@legalir/types";

export interface AdminCalculatorRow {
  id: string;
  slug: string;
  titleFa: string;
  category: string;
  legalBasisFa: string;
  confidence: string;
  available: boolean;
  datasetIds: string[];
  /** Data-quality flags derived from the calculator + its datasets. */
  warningsFa: string[];
}

export interface AdminDatasetRow {
  id: string;
  titleFa: string;
  calculationYear: number;
  version: string;
  sourceAuthority: string;
  sourceTitle: string;
  sourceUrl: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  verifiedAt: string;
  jurisdiction: string;
  /** True when this dataset's year trails the platform's newest dataset year. */
  needsAnnualUpdate: boolean;
  /** True when the platform has no newer year than this one. */
  isCurrentYear: boolean;
  notes: string | null;
}

export interface CalculatorsInventory {
  calculators: AdminCalculatorRow[];
  datasets: AdminDatasetRow[];
  /** The newest calculation year present across all datasets. */
  currentYear: number;
  totalCalculators: number;
  availableCalculators: number;
  /** Datasets whose year trails the current year. */
  staleDatasets: string[];
}

/** Build the read-only calculators + datasets inventory. */
export function buildCalculatorsInventory(): CalculatorsInventory {
  const datasources = RATE_DATASETS as RateDataset[];
  const years = datasources.map((d) => d.calculationYear);
  const currentYear = years.length > 0 ? Math.max(...years) : 0;

  const datasets: AdminDatasetRow[] = datasources.map((d) => ({
    id: d.id,
    titleFa: d.titleFa,
    calculationYear: d.calculationYear,
    version: d.source.version,
    sourceAuthority: d.source.sourceAuthority,
    sourceTitle: d.source.sourceTitle,
    sourceUrl: d.source.sourceUrl,
    effectiveFrom: d.source.effectiveFrom,
    effectiveTo: d.source.effectiveTo,
    verifiedAt: d.source.verifiedAt,
    jurisdiction: d.source.jurisdiction,
    needsAnnualUpdate: currentYear > 0 && d.calculationYear < currentYear,
    isCurrentYear: d.calculationYear === currentYear,
    notes: d.source.notes ?? null,
  }));

  const byId = new Map(datasets.map((d) => [d.id, d]));
  const calculators: AdminCalculatorRow[] = listCalculators().map((c) => {
    const warnings: string[] = [];
    if (!c.def.available) warnings.push("پیاده‌سازی کامل نشده است");
    const stale = c.def.datasetIds.filter((id) => byId.get(id)?.needsAnnualUpdate);
    if (stale.length > 0) warnings.push(`مجموعه‌داده قدیمی: ${stale.join("، ")}`);
    const missing = c.def.datasetIds.filter((id) => !byId.has(id));
    if (missing.length > 0) warnings.push(`مجموعه‌داده یافت‌نشده: ${missing.join("، ")}`);
    return {
      id: c.def.id,
      slug: c.def.slug,
      titleFa: c.def.titleFa,
      category: c.def.category,
      legalBasisFa: c.def.legalBasisFa,
      confidence: c.def.confidence,
      available: c.def.available,
      datasetIds: c.def.datasetIds,
      warningsFa: warnings,
    };
  });

  return {
    calculators: calculators.sort(
      (a, b) => a.category.localeCompare(b.category) || a.titleFa.localeCompare(b.titleFa, "fa")
    ),
    datasets: datasets.sort(
      (a, b) => b.calculationYear - a.calculationYear || a.titleFa.localeCompare(b.titleFa, "fa")
    ),
    currentYear,
    totalCalculators: calculators.length,
    availableCalculators: calculators.filter((c) => c.available).length,
    staleDatasets: datasets.filter((d) => d.needsAnnualUpdate).map((d) => d.id),
  };
}
