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
import { inheritanceCalculator } from "./calculators/inheritance";
import { regionalPropertyValueCalculator } from "./calculators/regional-property-value";
import { overtimeCalculator } from "./calculators/overtime";
import { salaryBenefitsCalculator } from "./calculators/salary-benefits";
import { insuranceCalculator } from "./calculators/insurance";
import { payrollTaxCalculator } from "./calculators/payroll-tax";
import { rentConverterCalculator } from "./calculators/rent-converter";
import { realEstateCommissionCalculator } from "./calculators/real-estate-commission";
import { lawyerFeeCalculator } from "./calculators/lawyer-fee";
import { checkDamagesCalculator } from "./calculators/check-damages";
import { propertyTransferTaxCalculator } from "./calculators/property-transfer-tax";
import { notaryFeesCalculator } from "./calculators/notary-fees";
import { propertyTransactionCostCalculator } from "./calculators/property-transaction-cost";
import { coOwnershipShareCalculator } from "./calculators/co-ownership-share";
import { goodwillCalculator } from "./calculators/goodwill";
import { executionFeeCalculator } from "./calculators/execution-fee";
import { expertFeeCalculator } from "./calculators/expert-fee";
import { arbitrationFeeCalculator } from "./calculators/arbitration-fee";
import { inheritanceTaxCalculator } from "./calculators/inheritance-tax";
import { alimonyCalculator } from "./calculators/alimony";
import { mahrServiceCalculator } from "./calculators/mahr-service";
import { vehicleDepreciationCalculator } from "./calculators/vehicle-depreciation";
import { diyehAdvancedCalculator } from "./calculators/diyeh-advanced";
import { contractPenaltyCalculator } from "./calculators/contract-penalty";

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
  inheritanceCalculator,
  regionalPropertyValueCalculator,
  overtimeCalculator,
  salaryBenefitsCalculator,
  insuranceCalculator,
  payrollTaxCalculator,
  rentConverterCalculator,
  realEstateCommissionCalculator,
  lawyerFeeCalculator,
  checkDamagesCalculator,
  propertyTransferTaxCalculator,
  notaryFeesCalculator,
  propertyTransactionCostCalculator,
  coOwnershipShareCalculator,
  goodwillCalculator,
  executionFeeCalculator,
  expertFeeCalculator,
  arbitrationFeeCalculator,
  inheritanceTaxCalculator,
  alimonyCalculator,
  mahrServiceCalculator,
  vehicleDepreciationCalculator,
  diyehAdvancedCalculator,
  contractPenaltyCalculator,
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
export { inheritanceCalculator } from "./calculators/inheritance";
export { regionalPropertyValueCalculator } from "./calculators/regional-property-value";
export { overtimeCalculator } from "./calculators/overtime";
export { salaryBenefitsCalculator } from "./calculators/salary-benefits";
export { insuranceCalculator } from "./calculators/insurance";
export { payrollTaxCalculator } from "./calculators/payroll-tax";
export { rentConverterCalculator } from "./calculators/rent-converter";
export { realEstateCommissionCalculator } from "./calculators/real-estate-commission";
export { lawyerFeeCalculator } from "./calculators/lawyer-fee";
export { checkDamagesCalculator } from "./calculators/check-damages";
export { propertyTransferTaxCalculator } from "./calculators/property-transfer-tax";
export { notaryFeesCalculator } from "./calculators/notary-fees";
export { propertyTransactionCostCalculator } from "./calculators/property-transaction-cost";
export { coOwnershipShareCalculator } from "./calculators/co-ownership-share";
export { goodwillCalculator } from "./calculators/goodwill";
export { executionFeeCalculator } from "./calculators/execution-fee";
export { expertFeeCalculator } from "./calculators/expert-fee";
export { arbitrationFeeCalculator } from "./calculators/arbitration-fee";
export { inheritanceTaxCalculator } from "./calculators/inheritance-tax";
export { alimonyCalculator } from "./calculators/alimony";
export { mahrServiceCalculator } from "./calculators/mahr-service";
export { vehicleDepreciationCalculator } from "./calculators/vehicle-depreciation";
export { diyehAdvancedCalculator } from "./calculators/diyeh-advanced";
export { contractPenaltyCalculator } from "./calculators/contract-penalty";

// ---- Catalog metadata (UI-facing) ----
export const CALCULATOR_CATEGORY_FA: Record<string, string> = {
  judicial: "قضایی",
  employment: "کار و استخدام",
  family: "خانوادگی",
  civil: "مدنی",
  property: "ملک و اجاره",
  injury: "تصادف و صدمات",
  contracts: "قرارداد و تعهدات",
};

export const CALCULATOR_CONFIDENCE_FA: Record<string, string> = {
  high: "اعتبار بالا",
  medium: "اعتبار متوسط",
  low: "نیازمند بازبینی",
};

/** Legal standing of a calculator's output, shown as a badge. */
export const CALCULATOR_STATUS_FA: Record<string, string> = {
  legal_basis: "مبنای قانونی",
  official_tariff: "تعرفه رسمی",
  estimate: "برآورد اولیه",
  not_determinable: "قابل تعیین نیست",
};
