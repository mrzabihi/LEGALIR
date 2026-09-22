// ============================================================
// حقوق خالص و ناخالص — net/gross salary
// ============================================================
// Governing instruments: قانون کار (مزد) + قانون مالیات‌های مستقیم
// (ماده ۸۴ و ۸۵) + قانون تأمین اجتماعی (سهم کارگر).
//
// Forward (gross → net):
//   insurance = gross × employeeInsuranceRate
//   taxable   = max(0, gross − insurance − annualExemption)
//   tax       = Σ over brackets of (slice of taxable × bracket rate)
//   net       = gross − insurance − tax
//
// Inverse (net → gross) has no closed form because the tax brackets
// are piecewise, so we solve it numerically with a monotonic binary
// search on gross. `net(gross)` is strictly increasing, so bisection
// converges reliably; we stop at 1 Rial precision.

import type { CalculationResult, CalculatorDef } from "@legalir/types";
import { money, scaleMoney, type Money } from "../money";
import { formatMoney, formatPercentFa } from "../format";
import { requireDataset } from "../datasets";
import { num, str, type Calculator, type CalculatorInput } from "../engine";

interface Bracket {
  upToRial: number | null;
  rate: number;
}

interface PayrollTaxRates {
  annualExemptionRial: number;
  brackets: Bracket[];
  employeeInsuranceRate: number;
  monthsPerYear: number;
}

/** Cumulative tax on a taxable annual amount. */
function annualTax(taxableRial: number, rates: PayrollTaxRates): number {
  let remaining = taxableRial;
  let lowerBound = 0;
  let total = 0;
  for (const bracket of rates.brackets) {
    if (remaining <= 0) break;
    const upper = bracket.upToRial ?? Infinity;
    const slice = Math.min(remaining, upper - lowerBound);
    if (slice > 0) {
      total += slice * bracket.rate;
      remaining -= slice;
    }
    lowerBound = upper;
  }
  return total;
}

/** Net annual pay for a given gross annual pay. */
function netFromGross(grossRial: number, rates: PayrollTaxRates): number {
  const insurance = grossRial * rates.employeeInsuranceRate;
  const taxable = Math.max(0, grossRial - insurance - rates.annualExemptionRial);
  const tax = annualTax(taxable, rates);
  return grossRial - insurance - tax;
}

/**
 * Solve for the gross annual pay that yields `targetNetRial`.
 * Bisection on [0, hi] where hi is grown until net(hi) ≥ target.
 */
function grossFromNet(targetNetRial: number, rates: PayrollTaxRates): number {
  if (targetNetRial <= 0) return 0;
  let hi = Math.max(targetNetRial, 1);
  // Grow the upper bound until it brackets the target.
  for (let i = 0; i < 64 && netFromGross(hi, rates) < targetNetRial; i++) {
    hi *= 2;
  }
  let lo = 0;
  // 1 Rial precision: log2(hi) iterations suffice, cap for safety.
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (netFromGross(mid, rates) < targetNetRial) lo = mid;
    else hi = mid;
    if (hi - lo < 1) break;
  }
  return Math.round(hi);
}

const def: CalculatorDef = {
  id: "calc-salary",
  slug: "salary",
  titleFa: "حقوق خالص و ناخالص",
  subtitleFa: "تبدیل حقوق خالص به ناخالص و برعکس",
  descriptionFa:
    "با کسر سهم بیمه تأمین اجتماعی کارگر و مالیات بر درآمد حقوق، حقوق خالص از ناخالص (یا ناخالص از خالص) محاسبه می‌شود. محاسبه معکوس با روش عددی انجام می‌گیرد.",
  category: "employment",
  icon: "💰",
  gradient: "from-indigo-600 to-blue-500",
  legalBasisFa: "ماده ۸۴ و ۸۵ قانون مالیات‌های مستقیم و قانون تأمین اجتماعی",
  datasetIds: ["payroll-tax-1404"],
  confidence: "medium",
  available: true,
  fields: [
    {
      key: "direction",
      labelFa: "جهت محاسبه",
      type: "select",
      required: true,
      defaultValue: "gross_to_net",
      options: [
        { value: "gross_to_net", labelFa: "از ناخالص به خالص" },
        { value: "net_to_gross", labelFa: "از خالص به ناخالص" },
      ],
    },
    {
      key: "amount",
      labelFa: "مبلغ ماهانه",
      type: "money",
      unit: "IRT",
      required: true,
      defaultValue: 150_000_000,
      min: 0,
    },
  ],
};

function compute(input: CalculatorInput): CalculationResult {
  const ds = requireDataset("payroll-tax-1404");
  const rates = ds.rates as unknown as PayrollTaxRates;

  const direction = str(input, "direction");
  const monthly = money(num(input, "amount"), "IRT");
  const annual = scaleMoney(monthly, rates.monthsPerYear);

  const steps: CalculationResult["steps"] = [];
  const warningsFa: string[] = [];

  let grossAnnual: number;
  let netAnnual: number;

  if (direction === "net_to_gross") {
    netAnnual = annual.rial;
    grossAnnual = grossFromNet(netAnnual, rates);
    steps.push({
      labelFa: "حقوق خالص سالانه (هدف)",
      valueFa: formatMoney(money(netAnnual, "IRR"), "IRT"),
    });
    steps.push({
      labelFa: "حقوق ناخالص سالانه (محاسبه معکوس)",
      valueFa: formatMoney(money(grossAnnual, "IRR"), "IRT"),
      noteFa: "حل عددی معادله مالیات پله‌ای",
    });
  } else {
    grossAnnual = annual.rial;
    netAnnual = netFromGross(grossAnnual, rates);
    steps.push({
      labelFa: "حقوق ناخالص سالانه",
      valueFa: formatMoney(money(grossAnnual, "IRR"), "IRT"),
    });
  }

  const insurance = grossAnnual * rates.employeeInsuranceRate;
  const taxable = Math.max(0, grossAnnual - insurance - rates.annualExemptionRial);
  const tax = annualTax(taxable, rates);

  steps.push({
    labelFa: `بیمه تأمین اجتماعی (${formatPercentFa(rates.employeeInsuranceRate)})`,
    valueFa: formatMoney(money(Math.round(insurance), "IRR"), "IRT"),
  });
  steps.push({
    labelFa: "درآمد مشمول مالیات",
    valueFa: formatMoney(money(Math.round(taxable), "IRR"), "IRT"),
    noteFa: "پس از کسر بیمه و معافیت سالانه",
  });
  steps.push({
    labelFa: "مالیات بر درآمد حقوق",
    valueFa: formatMoney(money(Math.round(tax), "IRR"), "IRT"),
  });

  const monthlyNet = money(Math.round(netAnnual / rates.monthsPerYear), "IRR");
  const monthlyGross = money(Math.round(grossAnnual / rates.monthsPerYear), "IRR");

  steps.push({
    labelFa: "حقوق ناخالص ماهانه",
    valueFa: formatMoney(monthlyGross, "IRT"),
  });
  steps.push({
    labelFa: "حقوق خالص ماهانه",
    valueFa: formatMoney(monthlyNet, "IRT"),
  });

  const headline: Money = direction === "net_to_gross" ? monthlyGross : monthlyNet;

  return {
    headlineFa: formatMoney(headline, "IRT"),
    headlineValue: headline.rial,
    unit: "IRT",
    steps,
    warningsFa,
    source: ds.source,
  };
}

export const salaryCalculator: Calculator = { def, compute };
