// ============================================================
// LEGALIR — Calculator rule versions (server-only)
// ============================================================
// The DB-backed, versioned, admin-managed override layer for calculator
// rate datasets. The versioned CODE datasets (`lib/calculators/datasets*.ts`)
// remain the verified seed and the fallback; this module lets an authorized
// manager layer a *schema-validated, versioned* patch on top of one dataset.
//
// Guarantees this module enforces (matching the platform's admin rules):
//   • A DRAFT never affects users. Only a `published` version whose
//     `effectiveFrom` date has arrived is applied — and it is applied in the
//     BACKEND (the run endpoint primes the overlay before the synchronous
//     compute), never by trusting the client.
//   • A version stores a SPARSE patch of `rates` (only changed keys) plus
//     provenance and a validity window; nothing is ever deleted or mutated.
//   • The patch is validated against a structure-aware schema DERIVED from the
//     seed — never arbitrary JSON, never executable code, never SQL.
//   • Every publish edits a NEW version; history is append-only and a rollback
//     is a new draft that copies an older version's figures.
//
// Pure-ish module: reads/writes `.data/calculator_rules.json` through the
// shared `readTable`/`writeTable` primitive. No I/O beyond that, no network.

import type {
  CalculatorRuleDetail,
  CalculatorRuleRef,
  CalculatorRuleSourceOverride,
  CalculatorRuleSummary,
  CalculatorRuleVersion,
  CalculatorSourceView,
  RateDataset,
  RuleField,
  RulePublishPreview,
  RuleSampleResult,
  RuleValidationIssue,
  RuleValidationResult,
} from "@legalir/types";
import { readTable, writeTable } from "@/lib/db";
import {
  RATE_DATASETS,
  clearRuleOverrides,
  listCalculators,
  primeRuleOverride,
  runCalculator,
} from "@/lib/calculators";
import type { CalculatorInput } from "@/lib/calculators";

const TABLE = "calculator_rules";

/** Gregorian date (YYYY-MM-DD) used when a caller supplies none. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================
// Persian labels for known rate keys (fallback = the raw key)
// ============================================================

const RATE_LABELS_FA: Record<string, string> = {
  // diyeh
  fullDiyehRial: "دیه کامل (ریال)",
  sacredMonthMultiplier: "ضریب ماه حرام",
  // court fee / tariffs
  brackets: "پله‌های تعرفه",
  nonMonetaryFlatRial: "هزینه مقطوع غیرمالی (ریال)",
  appealMultiplier: "ضریب مرحله تجدیدنظر",
  roundingStepRial: "گام گرد کردن (ریال)",
  // price index
  baseYear: "سال پایه",
  monthlyIndex: "شاخص ماهانه",
  annualIndex: "شاخص سالانه",
  // labor
  minimumMonthlyWageRial: "حداقل مزد ماهانه (ریال)",
  bonusMinDays: "کف عیدی (روز)",
  bonusMaxDays: "سقف عیدی (روز)",
  bonusCapMultipleOfMinWage: "سقف عیدی (ضریب حداقل مزد)",
  daysPerMonth: "روزهای ماه",
  annualLeaveDays: "مرخصی سالانه (روز)",
  monthsPerYear: "ماه‌های سال",
  overtimeMultiplier: "ضریب اضافه‌کاری",
  nightWorkPremiumRate: "فوق‌العاده شب‌کاری",
  fridayWorkPremiumRate: "فوق‌العاده جمعه‌کاری",
  holidayWorkPremiumRate: "فوق‌العاده تعطیل‌کاری",
  childAllowanceMultipleOfMinDailyWage: "حق اولاد (ضریب مزد روزانه)",
  standardDailyHours: "ساعات کار روزانه",
  standardWeeklyHours: "ساعات کار هفتگی",
  // payroll tax
  annualExemptionRial: "معافیت سالانه (ریال)",
  employeeInsuranceRate: "سهم بیمهٔ کارگر",
  employeeRate: "سهم کارگر",
  employerRate: "سهم کارفرما",
  unemploymentRate: "نرخ بیمهٔ بیکاری",
  totalRate: "نرخ کل",
  minInsurableMonthlyWageRial: "حداقل مزد مشمول بیمه (ریال)",
  maxInsurableMultipleOfMinWage: "سقف مشمول (ضریب حداقل مزد)",
  // lawyer / expert / arbitration
  minimumMonetaryRial: "کف تعرفهٔ مالی (ریال)",
  stageMultiplier: "ضرایب مرحلهٔ رسیدگی",
  minimumRial: "حداقل (ریال)",
  maximumRial: "حداکثر (ریال)",
  // execution
  enforcementRate: "نرخ هزینهٔ اجرا",
  // real-estate commission
  saleRatePerParty: "نرخ کمیسیون فروش (هر طرف)",
  rentRatePerParty: "نرخ کمیسیون اجاره (هر طرف)",
  depositRatePerParty: "نرخ کمیسیون رهن (هر طرف)",
  vatRate: "نرخ مالیات بر ارزش افزوده",
  minimumPerPartyRial: "حداقل کمیسیون هر طرف (ریال)",
  // rent conversion
  defaultDepositPerRentRial: "ضریب تبدیل پیش‌فرض",
  alternativeDepositPerRentRial: "ضریب تبدیل جایگزین",
  // property transfer tax
  landTransferTaxRate: "نرخ مالیات عرصه",
  buildingTransferTaxRate: "نرخ مالیات اعیان",
  // notary
  fixedStampDutyRial: "حق‌التمبر ثابت (ریال)",
  // inheritance tax
  perHeirExemptionRial: "معافیت هر وارث (ریال)",
  taxRate: "نرخ مالیات",
  // alimony / mahr-service / estimate bands
  adultMonthlyBaselineRial: "پایهٔ ماهانهٔ هر بزرگسال (ریال)",
  childMonthlyBaselineRial: "پایهٔ ماهانهٔ هر کودک (ریال)",
  lowerBandFactor: "ضریب کران پایین",
  upperBandFactor: "ضریب کران بالا",
  cityFactor: "ضریب شهر",
  monthlyServiceBaselineRial: "پایهٔ ماهانهٔ خدمات (ریال)",
  // vehicle depreciation
  baseRatePerPart: "نرخ پایهٔ هر قطعه",
  severityFactor: "ضریب شدت",
  replacementFactor: "ضریب تعویض",
  paintFactor: "ضریب رنگ",
  // goodwill
  lowerMultipleOfRent: "کران پایین (ضریب اجاره)",
  upperMultipleOfRent: "کران بالا (ضریب اجاره)",
};

/** Labels for the members of a bracket/list element. */
const ITEM_LABELS_FA: Record<string, string> = {
  upToRial: "سقف پله (ریال)",
  rate: "نرخ پله",
};

function labelFor(key: string): string {
  return RATE_LABELS_FA[key] ?? ITEM_LABELS_FA[key] ?? key;
}

// ============================================================
// Seed access + version storage
// ============================================================

function seedFor(datasetId: string): RateDataset | undefined {
  return RATE_DATASETS.find((d) => d.id === datasetId);
}

function readRows(): CalculatorRuleVersion[] {
  return readTable<CalculatorRuleVersion>(TABLE);
}

function writeRows(rows: CalculatorRuleVersion[]): void {
  writeTable(TABLE, rows);
}

/** All versions of one dataset, newest first (by seq). */
export function listRuleVersions(datasetId: string): CalculatorRuleVersion[] {
  return readRows()
    .filter((r) => r.datasetId === datasetId)
    .sort((a, b) => b.seq - a.seq);
}

/** One version by id, or undefined. */
export function getRuleVersion(id: string): CalculatorRuleVersion | undefined {
  return readRows().find((r) => r.id === id);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The published version of a dataset in force on `onDate` — the latest
 * published version whose window contains the date. Returns null when the
 * code seed is (still) the effective source.
 */
function activeVersion(datasetId: string, onDate: string = today()): CalculatorRuleVersion | null {
  const published = listRuleVersions(datasetId).filter(
    (r) =>
      r.status === "published" &&
      r.effectiveFrom <= onDate &&
      (!r.effectiveTo || onDate < r.effectiveTo)
  );
  return published[0] ?? null; // list is newest-first
}

/** The single open draft of a dataset, or null. */
function openDraft(datasetId: string): CalculatorRuleVersion | null {
  return listRuleVersions(datasetId).find((r) => r.status === "draft") ?? null;
}

// ============================================================
// Effective rates + provenance
// ============================================================

function sourceView(ds: RateDataset, rule: CalculatorRuleVersion | null): CalculatorSourceView {
  const over = rule?.source ?? {};
  const s = ds.source;
  return {
    sourceTitle: over.sourceTitle ?? s.sourceTitle,
    sourceAuthority: over.sourceAuthority ?? s.sourceAuthority,
    sourceUrl: over.sourceUrl !== undefined ? over.sourceUrl : s.sourceUrl,
    publicationDate: over.publicationDate ?? s.publicationDate,
    effectiveFrom: over.effectiveFrom ?? rule?.effectiveFrom ?? s.effectiveFrom,
    effectiveTo: over.effectiveTo !== undefined ? over.effectiveTo : s.effectiveTo,
    jurisdiction: over.jurisdiction ?? s.jurisdiction,
    calculationYear: over.calculationYear ?? s.calculationYear,
    version: rule?.version ?? s.version,
    verifiedAt: over.verifiedAt ?? s.verifiedAt,
    verificationStatus: rule?.verificationStatus ?? s.verificationStatus ?? "verified",
    notes: over.notes !== undefined ? over.notes : s.notes,
  };
}

interface EffectiveRateSet {
  rule: CalculatorRuleVersion | null;
  version: string;
  rates: Record<string, unknown>;
  source: CalculatorSourceView;
  fromRule: boolean;
}

/** The figures in force for a dataset right now (seed merged with the active version). */
function effectiveFor(datasetId: string, onDate?: string): EffectiveRateSet | null {
  const ds = seedFor(datasetId);
  if (!ds) return null;
  const rule = activeVersion(datasetId, onDate);
  const rates = rule ? { ...ds.rates, ...rule.rates } : { ...ds.rates };
  return {
    rule,
    version: rule?.version ?? ds.source.version,
    rates,
    source: sourceView(ds, rule),
    fromRule: Boolean(rule),
  };
}

// ============================================================
// Schema derivation (structure-aware, from the seed)
// ============================================================

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isBracketArray(arr: unknown[]): boolean {
  if (arr.length === 0) return false;
  return arr.every(
    (el) =>
      isPlainObject(el) &&
      Object.keys(el).every((k) => k === "upToRial" || k === "rate") &&
      "rate" in el
  );
}

/** The scalar node kind for a leaf value. */
function leafField(key: string, value: unknown): RuleField {
  if (typeof value === "number") {
    return { key, labelFa: labelFor(key), kind: "number", min: 0, value };
  }
  if (typeof value === "boolean") {
    return { key, labelFa: labelFor(key), kind: "boolean", value };
  }
  return { key, labelFa: labelFor(key), kind: "string", value };
}

function fieldFor(key: string, value: unknown, depth: number): RuleField {
  const label = labelFor(key);
  if (Array.isArray(value)) {
    if (isBracketArray(value)) {
      const sample = (value[0] ?? {}) as Record<string, unknown>;
      return {
        key,
        labelFa: label,
        kind: "brackets",
        itemFields: Object.keys(sample).map((k) => leafField(k, sample[k])),
        value,
      };
    }
    const first = value[0];
    if (isPlainObject(first)) {
      return {
        key,
        labelFa: label,
        kind: "list",
        itemFields: Object.keys(first).map((k) => fieldFor(k, first[k], depth + 1)),
        value,
      };
    }
    return { key, labelFa: label, kind: "list", itemFields: [], value };
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (depth < 4 && entries.length > 0) {
      // A map of scalars (e.g. cityFactor, monthlyIndex) vs. a free group.
      const allScalar = entries.every(([, v]) => !isPlainObject(v) && !Array.isArray(v));
      if (allScalar) {
        const sampleKey = entries[0]![0];
        return {
          key,
          labelFa: label,
          kind: "map",
          valueField: leafField(sampleKey, entries[0]![1]),
          value,
        };
      }
      return {
        key,
        labelFa: label,
        kind: "group",
        children: entries.map(([k, v]) => fieldFor(k, v, depth + 1)),
        value,
      };
    }
    return { key, labelFa: label, kind: "map", valueField: leafField("value", 0), value };
  }
  return leafField(key, value);
}

/**
 * The structure-aware schema of a dataset's rate set. Derived from the
 * EFFECTIVE rates so the editor shows the figures currently in force while
 * keeping the structural shape of the seed.
 */
export function buildRuleSchema(datasetId: string): RuleField[] {
  const eff = effectiveFor(datasetId);
  if (!eff) return [];
  return Object.entries(eff.rates).map(([k, v]) => fieldFor(k, v, 0));
}

// ============================================================
// Validation (against the seed's structure — no code, ever)
// ============================================================

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Validate a bracket list: cumulative, increasing, single open-ended top. */
function validateBrackets(path: string, value: unknown): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ fieldPath: path, messageFa: "فهرست پله‌ها باید حداقل یک عضو داشته باشد.", severity: "error" });
    return issues;
  }
  let sawNull = false;
  let prevCap = -Infinity;
  value.forEach((el, i) => {
    const at = `${path}[${i}]`;
    if (!isPlainObject(el)) {
      issues.push({ fieldPath: at, messageFa: "هر پله باید یک شیء باشد.", severity: "error" });
      return;
    }
    const { upToRial, rate } = el as { upToRial?: unknown; rate?: unknown };
    if (!isFiniteNumber(rate) || rate < 0 || rate > 1) {
      issues.push({ fieldPath: `${at}.rate`, messageFa: "نرخ پله باید عددی بین ۰ و ۱ باشد.", severity: "error" });
    }
    if (upToRial === null) {
      if (sawNull) {
        issues.push({ fieldPath: `${at}.upToRial`, messageFa: "فقط آخرین پله می‌تواند سقف باز داشته باشد.", severity: "error" });
      }
      if (i !== value.length - 1) {
        issues.push({ fieldPath: `${at}.upToRial`, messageFa: "سقف باز باید در آخرین پله باشد.", severity: "error" });
      }
      sawNull = true;
    } else if (isFiniteNumber(upToRial)) {
      if (upToRial <= prevCap) {
        issues.push({ fieldPath: `${at}.upToRial`, messageFa: "سقف پله‌ها باید صعودی باشد.", severity: "error" });
      }
      prevCap = upToRial;
    } else {
      issues.push({ fieldPath: `${at}.upToRial`, messageFa: "سقف پله باید عدد یا null باشد.", severity: "error" });
    }
  });
  if (!sawNull) {
    issues.push({
      fieldPath: path,
      messageFa: "آخرین پله باید سقف باز (null) داشته باشد تا همهٔ مقادیر پوشش داده شوند.",
      severity: "warning",
    });
  }
  return issues;
}

/**
 * Validate a SPARSE rate patch against the seed's schema. Unknown keys, type
 * mismatches, out-of-range or non-finite numbers are rejected. This is the
 * ONLY gate a draft must pass before it may be published — it accepts data,
 * never code.
 */
export function validateDraftRates(datasetId: string, rates: unknown): RuleValidationResult {
  const ds = seedFor(datasetId);
  if (!ds) {
    return { ok: false, issues: [{ fieldPath: "", messageFa: "مجموعه‌داده یافت نشد.", severity: "error" }] };
  }
  if (!isPlainObject(rates)) {
    return { ok: false, issues: [{ fieldPath: "", messageFa: "ساختار نرخ‌ها نامعتبر است.", severity: "error" }] };
  }
  const issues: RuleValidationIssue[] = [];
  for (const [key, value] of Object.entries(rates)) {
    if (!Object.prototype.hasOwnProperty.call(ds.rates, key)) {
      issues.push({ fieldPath: key, messageFa: `کلید ناشناخته «${key}» در این مجموعه‌داده وجود ندارد.`, severity: "error" });
      continue;
    }
    const seedValue = ds.rates[key];
    if (Array.isArray(seedValue)) {
      if (isBracketArray(seedValue)) issues.push(...validateBrackets(key, value));
      else if (!Array.isArray(value)) {
        issues.push({ fieldPath: key, messageFa: "این مقدار باید یک فهرست باشد.", severity: "error" });
      }
    } else if (isPlainObject(seedValue)) {
      if (!isPlainObject(value)) {
        issues.push({ fieldPath: key, messageFa: "این مقدار باید یک نگاشت کلید–مقدار باشد.", severity: "error" });
      } else {
        for (const [mk, mv] of Object.entries(value)) {
          if (typeof seedValue[mk] === "number" && (!isFiniteNumber(mv) || mv < 0)) {
            issues.push({ fieldPath: `${key}.${mk}`, messageFa: "مقدار باید عددی نامنفی باشد.", severity: "error" });
          }
        }
      }
    } else if (typeof seedValue === "number") {
      if (!isFiniteNumber(value) || value < 0) {
        issues.push({ fieldPath: key, messageFa: "مقدار باید عددی نامنفی باشد.", severity: "error" });
      }
    } else if (typeof seedValue === "boolean") {
      if (typeof value !== "boolean") {
        issues.push({ fieldPath: key, messageFa: "مقدار باید بولی باشد.", severity: "error" });
      }
    }
  }
  return { ok: issues.every((i) => i.severity !== "error"), issues };
}

// ============================================================
// Draft / publish / rollback
// ============================================================

export interface SaveRuleDraftInput {
  rates: Record<string, unknown>;
  source?: CalculatorRuleSourceOverride;
  changeNoteFa?: string;
  effectiveFrom?: string;
  verificationStatus?: "verified" | "pending";
}

/**
 * Create or update the single open draft of a dataset. Editing an existing
 * draft keeps its `seq`/`id`/`version` (history is append-only — a draft is
 * one work-in-progress until it is published or discarded).
 */
export function saveRuleDraft(
  datasetId: string,
  input: SaveRuleDraftInput,
  actorId?: string
): CalculatorRuleVersion | { error: string } {
  const ds = seedFor(datasetId);
  if (!ds) return { error: "DATASET_NOT_FOUND" };

  const validation = validateDraftRates(datasetId, input.rates ?? {});
  if (!validation.ok) return { error: "INVALID_RATES" };

  if (input.effectiveFrom && !DATE_RE.test(input.effectiveFrom)) {
    return { error: "INVALID_EFFECTIVE_FROM" };
  }

  const rows = readRows();
  const existing = rows.find((r) => r.datasetId === datasetId && r.status === "draft");
  const now = new Date().toISOString();

  if (existing) {
    existing.rates = input.rates ?? {};
    if (input.source !== undefined) existing.source = input.source;
    if (input.changeNoteFa !== undefined) existing.changeNoteFa = input.changeNoteFa;
    if (input.effectiveFrom !== undefined) existing.effectiveFrom = input.effectiveFrom;
    if (input.verificationStatus !== undefined) existing.verificationStatus = input.verificationStatus;
    writeRows(rows);
    return existing;
  }

  const seq =
    rows.filter((r) => r.datasetId === datasetId).reduce((m, r) => Math.max(m, r.seq), 1) + 1;
  const draft: CalculatorRuleVersion = {
    id: `${datasetId}@${seq}`,
    datasetId,
    seq,
    version: `${datasetId}.${seq}`,
    status: "draft",
    effectiveFrom: input.effectiveFrom ?? today(),
    effectiveTo: null,
    rates: input.rates ?? {},
    source: input.source ?? {},
    changeNoteFa: input.changeNoteFa ?? "",
    verificationStatus: input.verificationStatus ?? ds.source.verificationStatus ?? "pending",
    createdBy: actorId ?? null,
    createdAt: now,
    publishedBy: null,
    publishedAt: null,
    archivedAt: null,
  };
  rows.push(draft);
  writeRows(rows);
  return draft;
}

/** Publish a draft; archives the previously-active version. */
export function publishDraft(
  versionId: string,
  actorId?: string
): CalculatorRuleVersion | { error: string } {
  const rows = readRows();
  const draft = rows.find((r) => r.id === versionId);
  if (!draft) return { error: "VERSION_NOT_FOUND" };
  if (draft.status !== "draft") return { error: "NOT_A_DRAFT" };

  // A publish MUST change something and carry a change note.
  if (Object.keys(draft.rates).length === 0) return { error: "EMPTY_DRAFT" };
  if (!draft.changeNoteFa.trim()) return { error: "CHANGE_NOTE_REQUIRED" };

  const validation = validateDraftRates(draft.datasetId, draft.rates);
  if (!validation.ok) return { error: "INVALID_RATES" };

  const now = new Date().toISOString();
  const currentActive = activeVersion(draft.datasetId);
  if (currentActive && currentActive.id !== draft.id) {
    currentActive.status = "archived";
    currentActive.archivedAt = now;
  }
  draft.status = "published";
  draft.publishedBy = actorId ?? null;
  draft.publishedAt = now;
  writeRows(rows);
  return draft;
}

/** Discard a draft (only a draft; published history is never removed). */
export function deleteDraft(versionId: string): { ok: true } | { error: string } {
  const rows = readRows();
  const idx = rows.findIndex((r) => r.id === versionId);
  if (idx < 0) return { error: "VERSION_NOT_FOUND" };
  if (rows[idx]!.status !== "draft") return { error: "NOT_A_DRAFT" };
  rows.splice(idx, 1);
  writeRows(rows);
  return { ok: true };
}

/**
 * Create a NEW draft that copies a prior version's figures (rollback). The
 * prior version is untouched — this never destroys history.
 */
export function rollbackToVersion(
  datasetId: string,
  versionId: string,
  actorId?: string
): CalculatorRuleVersion | { error: string } {
  const source = readRows().find((r) => r.id === versionId && r.datasetId === datasetId);
  if (!source) return { error: "VERSION_NOT_FOUND" };
  return saveRuleDraft(
    datasetId,
    {
      rates: { ...source.rates },
      source: { ...source.source },
      changeNoteFa: `بازگردانی به نسخهٔ ${source.version}`,
      verificationStatus: source.verificationStatus,
    },
    actorId
  );
}

// ============================================================
// Preview (validate + test with sample inputs BEFORE publish)
// ============================================================

/** Calculators that consume a dataset. */
function consumersOf(datasetId: string): { slug: string; titleFa: string }[] {
  return listCalculators()
    .filter((c) => c.def.datasetIds.includes(datasetId))
    .map((c) => ({ slug: c.def.slug, titleFa: c.def.titleFa }));
}

/** Run one calculator with its declared field defaults (the sample input). */
function defaultInput(slug: string): CalculatorInput {
  const calc = listCalculators().find((c) => c.def.slug === slug);
  const out: CalculatorInput = {};
  for (const f of calc?.def.fields ?? []) {
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
  }
  return out;
}

function runHeadline(slug: string): { headlineFa: string; errorFa?: string } {
  try {
    const r = runCalculator(slug, defaultInput(slug));
    return { headlineFa: r.unsupportedFa ? r.unsupportedFa : r.headlineFa };
  } catch (e) {
    return { headlineFa: "—", errorFa: e instanceof Error ? e.message : "خطا" };
  }
}

/**
 * Validate a draft and run every consumer calculator under the CURRENT rules
 * vs. the DRAFT rules, so the admin sees the effect before publishing. Runs
 * entirely in-process; the draft overlay is installed and removed inside this
 * single synchronous function, so it can never leak to a user request.
 */
export function previewDraft(datasetId: string, rates: Record<string, unknown>): RulePublishPreview {
  const validation = validateDraftRates(datasetId, rates);
  const consumers = consumersOf(datasetId);

  const before = consumers.map((c) => ({ ...c, ...runHeadline(c.slug) }));

  const eff = effectiveFor(datasetId);
  const draftRates = eff ? { ...eff.rates, ...rates } : rates;
  try {
    primeRuleOverride("__draft_preview__", datasetId, draftRates);
    const samples: RuleSampleResult[] = consumers.map((c, i) => {
      const after = runHeadline(c.slug);
      return {
        slug: c.slug,
        titleFa: c.titleFa,
        input: defaultInput(c.slug),
        beforeHeadlineFa: before[i]!.headlineFa,
        afterHeadlineFa: after.headlineFa,
        changed: before[i]!.headlineFa !== after.headlineFa,
        errorFa: after.errorFa,
      };
    });
    return { validation, samples, changedCount: samples.filter((s) => s.changed).length };
  } finally {
    clearRuleOverrides();
  }
}

// ============================================================
// Admin read models
// ============================================================

export function listRuleSummaries(): CalculatorRuleSummary[] {
  const rows = readRows();
  return RATE_DATASETS.map((ds) => {
    const eff = effectiveFor(ds.id);
    return {
      datasetId: ds.id,
      titleFa: ds.titleFa,
      calculationYear: ds.calculationYear,
      seedVersion: ds.source.version,
      active: activeVersion(ds.id),
      draft: openDraft(ds.id),
      historyCount: rows.filter((r) => r.datasetId === ds.id).length,
      needsReview: eff?.source.verificationStatus === "pending",
    };
  }).sort(
    (a, b) => b.calculationYear - a.calculationYear || a.datasetId.localeCompare(b.datasetId)
  );
}

export function getRuleDetail(datasetId: string): CalculatorRuleDetail | null {
  const ds = seedFor(datasetId);
  const eff = effectiveFor(datasetId);
  if (!ds || !eff) return null;
  const all = listRuleVersions(datasetId);
  return {
    datasetId,
    titleFa: ds.titleFa,
    calculationYear: ds.calculationYear,
    seed: {
      version: ds.source.version,
      rates: { ...ds.rates },
      source: sourceView(ds, null),
    },
    effective: {
      version: eff.version,
      rates: eff.rates,
      source: eff.source,
      fromRule: eff.fromRule,
    },
    schema: buildRuleSchema(datasetId),
    active: eff.rule,
    drafts: all.filter((r) => r.status === "draft"),
    history: all.filter((r) => r.status !== "draft"),
    usedBy: consumersOf(datasetId),
  };
}

// ============================================================
// Server-side application (priming the overlay for a real run)
// ============================================================

/**
 * Prime the overlay with every active published rule version. MUST be
 * bracketed by `clearRuleOverrides()` around a synchronous compute (see the
 * run route) — never held across an await.
 */
export function primeActiveRules(onDate: string = today()): void {
  for (const ds of RATE_DATASETS) {
    const rule = activeVersion(ds.id, onDate);
    if (rule) primeRuleOverride(rule.id, ds.id, rule.rates);
  }
}

/** The active rule refs for a set of datasets (for the run response). */
export function activeRuleRefs(datasetIds: string[]): CalculatorRuleRef[] {
  const refs: CalculatorRuleRef[] = [];
  for (const id of datasetIds) {
    const rule = activeVersion(id);
    if (!rule) continue;
    refs.push({
      datasetId: id,
      versionId: rule.id,
      version: rule.version,
      effectiveFrom: rule.effectiveFrom,
      verificationStatus: rule.verificationStatus,
    });
  }
  return refs;
}

/** A published, in-force rule version's sparse rate patch. */
export interface ActiveRuleOverride {
  datasetId: string;
  versionId: string;
  rates: Record<string, unknown>;
}

/**
 * The active rule RATE PATCHES for a set of datasets — the same sparse overrides
 * `primeActiveRules` installs server-side, exposed so a client can prime its own
 * overlay and make a FREE calculator's local preview match the server run. Only
 * PUBLISHED versions in force are returned: a draft is never leaked.
 */
export function activeRuleOverrides(datasetIds: string[]): ActiveRuleOverride[] {
  const out: ActiveRuleOverride[] = [];
  for (const id of datasetIds) {
    const rule = activeVersion(id);
    if (!rule) continue;
    out.push({ datasetId: id, versionId: rule.id, rates: rule.rates });
  }
  return out;
}
