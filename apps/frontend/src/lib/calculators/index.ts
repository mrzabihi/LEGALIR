// ============================================================
// LEGALIR — Legal Calculators domain (محاسبه‌گرها)
// ============================================================
// Single entry point for the calculator domain. Importing this module
// registers every calculator with the engine, so consumers only ever
// need `import { listCalculators, runCalculator } from "@/lib/calculators"`.
//
// Deterministic by construction: no LLM, no network, no clock. The
// same input always produces the same output for a given dataset
// version.

import { registerCalculator } from "./engine";
import { courtFeeCalculator } from "./calculators/court-fee";
import { diyehCalculator } from "./calculators/diyeh";
import { delayedPaymentCalculator } from "./calculators/delayed-payment";
import { dowryCalculator } from "./calculators/dowry";
import { bonusCalculator } from "./calculators/bonus";
import { severanceCalculator } from "./calculators/severance";
import { leaveBuybackCalculator } from "./calculators/leave-buyback";
import { salaryCalculator } from "./calculators/salary";

// Registration order drives catalog order.
const ALL = [
  courtFeeCalculator,
  diyehCalculator,
  delayedPaymentCalculator,
  dowryCalculator,
  bonusCalculator,
  severanceCalculator,
  leaveBuybackCalculator,
  salaryCalculator,
];

for (const calc of ALL) registerCalculator(calc);

// ---- Engine ----
export {
  registerCalculator,
  listCalculators,
  getCalculator,
  runCalculator,
  coerceInput,
  CalculatorInputError,
  num,
  str,
  bool,
} from "./engine";
export type { Calculator, CalculatorInput } from "./engine";

// ---- Money ----
export {
  money,
  inUnit,
  addMoney,
  subMoney,
  scaleMoney,
  clampMoney,
  compareMoney,
  isNonPositive,
  roundTo,
  RIAL_PER_TOMAN,
} from "./money";
export type { Money } from "./money";

// ---- Formatting ----
export {
  formatMoney,
  formatNumberFa,
  formatPercentFa,
  formatDaysFa,
  formatMonthsFa,
  formatYearsFa,
  formatYearFa,
  UNIT_LABEL_FA,
} from "./format";

// ---- Datasets ----
export {
  RATE_DATASETS,
  getDataset,
  requireDataset,
  DIYEH_FRACTIONS,
} from "./datasets";
export type { DiyehFraction } from "./datasets";

// ---- Individual calculators (for direct use / tests) ----
export { courtFeeCalculator } from "./calculators/court-fee";
export { diyehCalculator } from "./calculators/diyeh";
export { delayedPaymentCalculator } from "./calculators/delayed-payment";
export { dowryCalculator } from "./calculators/dowry";
export { bonusCalculator } from "./calculators/bonus";
export { severanceCalculator } from "./calculators/severance";
export { leaveBuybackCalculator } from "./calculators/leave-buyback";
export { salaryCalculator } from "./calculators/salary";

// ---- Catalog metadata (UI-facing) ----
export const CALCULATOR_CATEGORY_FA: Record<string, string> = {
  judicial: "قضایی",
  employment: "کار و استخدام",
  family: "خانوادگی",
  civil: "مدنی",
};

export const CALCULATOR_CONFIDENCE_FA: Record<string, string> = {
  high: "اعتبار بالا",
  medium: "اعتبار متوسط",
  low: "نیازمند بازبینی",
};
