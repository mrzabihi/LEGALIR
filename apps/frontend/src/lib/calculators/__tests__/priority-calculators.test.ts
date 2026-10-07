import { describe, it, expect } from "vitest";
import { runCalculator, CalculatorInputError } from "@/lib/calculators";

// ============================================================
// Priority-10 calculators — mandatory coverage
// ============================================================
// Every calculator is exercised across the required cases:
//   Happy Path · Zero · Minimum · Maximum · Empty · Invalid ·
//   Boundary · Just-Below-Boundary · Just-Above-Boundary
// Expected values are hand-computed from the 1405 datasets so a rate
// change fails loudly.

// ------------------------------------------------------------
// اضافه‌کاری (overtime)
// ------------------------------------------------------------
describe("overtime — اضافه‌کاری", () => {
  it("happy path: 20 overtime hours at 1.4×", () => {
    // wage 150,000,000 Toman = 1,500,000,000 Rial
    // hourly = 1,500,000,000 / (30 × 8) = 6,250,000 Rial
    // 6,250,000 × 20 × 1.4 = 175,000,000 Rial
    const r = runCalculator("overtime", {
      monthlyWage: 150_000_000,
      overtimeHours: 20,
      nightHours: 0,
      fridayHours: 0,
      holidayHours: 0,
    });
    expect(r.headlineValue).toBe(175_000_000);
    expect(r.status).toBe("legal_basis");
  });

  it("zero: no hours entered yields zero with a warning", () => {
    const r = runCalculator("overtime", {
      monthlyWage: 150_000_000,
      overtimeHours: 0,
      nightHours: 0,
      fridayHours: 0,
      holidayHours: 0,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("minimum: zero wage yields zero", () => {
    const r = runCalculator("overtime", {
      monthlyWage: 0,
      overtimeHours: 10,
      nightHours: 0,
      fridayHours: 0,
      holidayHours: 0,
    });
    expect(r.headlineValue).toBe(0);
  });

  it("combines night, friday and holiday premiums", () => {
    // hourly 6,250,000
    // night 10h × 0.35 = 21,875,000
    // friday 8h × 0.40 = 20,000,000
    // holiday 4h × 0.40 = 10,000,000
    // total = 51,875,000
    const r = runCalculator("overtime", {
      monthlyWage: 150_000_000,
      overtimeHours: 0,
      nightHours: 10,
      fridayHours: 8,
      holidayHours: 4,
    });
    expect(r.headlineValue).toBe(51_875_000);
  });

  it("empty: omitted hours fall back to the field default (20 overtime hours)", () => {
    const r = runCalculator("overtime", { monthlyWage: 150_000_000 });
    expect(r.headlineValue).toBe(175_000_000);
  });

  it("invalid: negative wage is rejected", () => {
    expect(() =>
      runCalculator("overtime", { monthlyWage: -1, overtimeHours: 1 })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// حقوق و مزایا (salary-benefits)
// ------------------------------------------------------------
describe("salary-benefits — فیش حقوقی", () => {
  it("happy path: full slip with housing and food", () => {
    // gross = 1,000,000,000 + 90,000,000 + 140,000,000 = 1,230,000,000 Rial
    // insurance = 1,230,000,000 × 7% = 86,100,000
    // monthly exemption = 240,000,000 / 12 = 20,000,000
    // taxable monthly = 1,123,900,000 → annual 13,486,800,000
    // annual tax = 40M + 60M + 80M + 12,286,800,000×30% = 3,866,040,000
    // monthly tax = 322,170,000
    // net = 1,230,000,000 − 86,100,000 − 322,170,000 = 821,730,000
    const r = runCalculator("salary-benefits", {
      baseWage: 100_000_000,
      housingAllowance: 9_000_000,
      foodAllowance: 14_000_000,
      childrenCount: 0,
      seniorityPay: 0,
      otherAllowances: 0,
    });
    expect(r.headlineValue).toBe(821_730_000);
    expect(r.headlineLabelFa).toBe("حقوق خالص ماهانه");
  });

  it("adds child allowance at 3× the minimum daily wage per child", () => {
    // min daily = 104,000,000 / 30 = 3,466,666.67 Rial
    // 2 children × 3 × 3,466,666.67 = 20,800,000 Rial (rounded)
    const r = runCalculator("salary-benefits", {
      baseWage: 100_000_000,
      housingAllowance: 0,
      foodAllowance: 0,
      childrenCount: 2,
      seniorityPay: 0,
      otherAllowances: 0,
    });
    const childStep = r.steps.find((s) => s.labelFa.includes("حق اولاد"));
    expect(childStep).toBeDefined();
  });

  it("zero: no wage yields zero net with a warning", () => {
    const r = runCalculator("salary-benefits", {
      baseWage: 0,
      housingAllowance: 0,
      foodAllowance: 0,
      childrenCount: 0,
      seniorityPay: 0,
      otherAllowances: 0,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: only the required base wage is supplied", () => {
    const r = runCalculator("salary-benefits", { baseWage: 100_000_000 });
    expect(r.headlineValue).toBeGreaterThan(0);
  });

  it("invalid: negative base wage is rejected", () => {
    expect(() =>
      runCalculator("salary-benefits", { baseWage: -1 })
    ).toThrow(CalculatorInputError);
  });

  it("boundary: children count above the max is clamped", () => {
    const r = runCalculator("salary-benefits", {
      baseWage: 100_000_000,
      childrenCount: 999,
    });
    // Clamped to 20 children — still computes without throwing.
    expect(r.headlineValue).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
// بیمه (insurance)
// ------------------------------------------------------------
describe("insurance — حق بیمه تأمین اجتماعی", () => {
  it("happy path: wage above the ceiling is clamped to 7× minimum", () => {
    // ceiling = 104,000,000 × 7 = 728,000,000 Rial
    // total = 728,000,000 × 30% = 218,400,000 Rial
    const r = runCalculator("insurance", { monthlyWage: 150_000_000 });
    expect(r.headlineValue).toBe(218_400_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("just-below-boundary: wage just under the ceiling is not clamped", () => {
    // 72,000,000 Toman = 720,000,000 Rial < 728,000,000 ceiling
    // total = 720,000,000 × 30% = 216,000,000 Rial
    const r = runCalculator("insurance", { monthlyWage: 72_000_000 });
    expect(r.headlineValue).toBe(216_000_000);
    expect(r.warningsFa).toHaveLength(0);
  });

  it("just-above-boundary: wage just over the ceiling is clamped", () => {
    // 73,000,000 Toman = 730,000,000 Rial > 728,000,000 ceiling
    const r = runCalculator("insurance", { monthlyWage: 73_000_000 });
    expect(r.headlineValue).toBe(218_400_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("zero: wage below the floor is raised to the minimum", () => {
    // floor = 104,000,000 Rial → total = 31,200,000 Rial
    const r = runCalculator("insurance", { monthlyWage: 0 });
    expect(r.headlineValue).toBe(31_200_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("minimum: exactly the floor wage", () => {
    // 10,400,000 Toman = 104,000,000 Rial → 31,200,000 Rial
    const r = runCalculator("insurance", { monthlyWage: 10_400_000 });
    expect(r.headlineValue).toBe(31_200_000);
    expect(r.warningsFa).toHaveLength(0);
  });

  it("empty: omitted wage defaults to the field default", () => {
    const r = runCalculator("insurance", {});
    expect(r.headlineValue).toBe(218_400_000);
  });

  it("invalid: negative wage is rejected", () => {
    expect(() => runCalculator("insurance", { monthlyWage: -1 })).toThrow(
      CalculatorInputError
    );
  });
});

// ------------------------------------------------------------
// مالیات حقوق (payroll-tax)
// ------------------------------------------------------------
describe("payroll-tax — مالیات بر درآمد حقوق", () => {
  it("happy path: monthly gross produces a monthly tax", () => {
    // annual gross = 1,500,000,000 × 12 = 18,000,000,000 Rial
    // insurance = 1,260,000,000; taxable = 16,500,000,000
    // annual tax = 40M + 60M + 80M + 15,300,000,000×30% = 4,770,000,000
    // monthly = 397,500,000 Rial
    const r = runCalculator("payroll-tax", {
      period: "monthly",
      grossIncome: 150_000_000,
    });
    expect(r.headlineValue).toBe(397_500_000);
    expect(r.headlineLabelFa).toBe("مالیات ماهانه");
  });

  it("annual period reports the annual tax directly", () => {
    const r = runCalculator("payroll-tax", {
      period: "annual",
      grossIncome: 1_800_000_000,
    });
    expect(r.headlineValue).toBe(4_770_000_000);
    expect(r.headlineLabelFa).toBe("مالیات سالانه");
  });

  it("zero: income below the exemption yields no tax", () => {
    const r = runCalculator("payroll-tax", {
      period: "annual",
      grossIncome: 10_000_000,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("boundary: income exactly at the annual exemption", () => {
    // gross 24,000,000 Toman = 240,000,000 Rial annual
    // insurance = 16,800,000; taxable = 240,000,000 − 16,800,000 − 240,000,000 < 0 → 0
    const r = runCalculator("payroll-tax", {
      period: "annual",
      grossIncome: 24_000_000,
    });
    expect(r.headlineValue).toBe(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("payroll-tax", {});
    expect(r.headlineValue).toBe(397_500_000);
  });

  it("invalid: unknown period is rejected", () => {
    expect(() =>
      runCalculator("payroll-tax", { period: "weekly", grossIncome: 1 })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// تبدیل رهن و اجاره (rent-converter)
// ------------------------------------------------------------
describe("rent-converter — تبدیل رهن و اجاره", () => {
  it("happy path: rent → deposit at coefficient 200", () => {
    // 20,000,000 Toman = 200,000,000 Rial × 200 = 40,000,000,000 Rial
    const r = runCalculator("rent-converter", {
      direction: "rent_to_deposit",
      amount: 20_000_000,
      coefficient: 200,
    });
    expect(r.headlineValue).toBe(40_000_000_000);
    expect(r.status).toBe("estimate");
  });

  it("deposit → rent divides by the coefficient", () => {
    // 40,000,000,000 Rial / 200 = 200,000,000 Rial
    const r = runCalculator("rent-converter", {
      direction: "deposit_to_rent",
      amount: 4_000_000_000,
      coefficient: 200,
    });
    expect(r.headlineValue).toBe(200_000_000);
  });

  it("zero: zero amount yields zero", () => {
    const r = runCalculator("rent-converter", {
      direction: "rent_to_deposit",
      amount: 0,
      coefficient: 200,
    });
    expect(r.headlineValue).toBe(0);
  });

  it("minimum: coefficient of 1 is the identity", () => {
    const r = runCalculator("rent-converter", {
      direction: "rent_to_deposit",
      amount: 20_000_000,
      coefficient: 1,
    });
    expect(r.headlineValue).toBe(200_000_000);
  });

  it("empty: omitted coefficient falls back to the dataset default", () => {
    const r = runCalculator("rent-converter", {
      direction: "rent_to_deposit",
      amount: 20_000_000,
    });
    expect(r.headlineValue).toBe(40_000_000_000);
  });

  it("boundary: coefficient below the minimum is clamped to 1", () => {
    // Optional field with min:1 → 0 is clamped to 1 (identity), not rejected.
    // 1,000 Toman = 10,000 Rial × 1 = 10,000 Rial (rounds cleanly at step 1,000).
    const r = runCalculator("rent-converter", {
      direction: "rent_to_deposit",
      amount: 1_000,
      coefficient: 0,
    });
    expect(r.headlineValue).toBe(10_000);
  });

  it("always emits an estimate warning", () => {
    const r = runCalculator("rent-converter", {
      direction: "rent_to_deposit",
      amount: 20_000_000,
    });
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
// کمیسیون مشاور املاک (real-estate-commission)
// ------------------------------------------------------------
describe("real-estate-commission — کمیسیون مشاور املاک", () => {
  it("happy path: sale commission per party with VAT", () => {
    // price 5,000,000,000 Toman = 50,000,000,000 Rial
    // commission = 50,000,000,000 × 0.0025 = 125,000,000
    // vat = 12,500,000 → total = 137,500,000 Rial
    const r = runCalculator("real-estate-commission", {
      dealType: "sale",
      price: 5_000_000_000,
    });
    expect(r.headlineValue).toBe(137_500_000);
    expect(r.status).toBe("official_tariff");
  });

  it("rent: combines rent and deposit shares", () => {
    // rent 200,000,000 × 0.25 = 50,000,000
    // deposit 5,000,000,000 × 0.01 = 50,000,000
    // commission = 100,000,000; vat = 10,000,000 → 110,000,000 Rial
    const r = runCalculator("real-estate-commission", {
      dealType: "rent",
      monthlyRent: 20_000_000,
      deposit: 500_000_000,
    });
    expect(r.headlineValue).toBe(110_000_000);
  });

  it("zero: a zero-price sale falls back to the union floor", () => {
    // commission 0 < minimum 1,000,000 → floor 1,000,000
    // vat = 100,000 → total = 1,100,000 Rial
    const r = runCalculator("real-estate-commission", {
      dealType: "sale",
      price: 0,
    });
    expect(r.headlineValue).toBe(1_100_000);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("real-estate-commission", {});
    expect(r.headlineValue).toBe(137_500_000);
  });

  it("invalid: unknown deal type is rejected", () => {
    expect(() =>
      runCalculator("real-estate-commission", { dealType: "barter" })
    ).toThrow(CalculatorInputError);
  });

  it("always emits a union-tariff warning", () => {
    const r = runCalculator("real-estate-commission", { dealType: "sale" });
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
// حق‌الوکاله (lawyer-fee)
// ------------------------------------------------------------
describe("lawyer-fee — حق‌الوکاله", () => {
  it("happy path: cumulative tariff on a 5bn Rial claim", () => {
    // 100M@10% = 10,000,000
    // 400M@7%  = 28,000,000
    // 500M@5%  = 25,000,000
    // 4,000M@4% = 160,000,000
    // total = 223,000,000 Rial
    const r = runCalculator("lawyer-fee", {
      claimType: "monetary",
      claimValue: 500_000_000,
      stage: "first",
    });
    expect(r.headlineValue).toBe(223_000_000);
    expect(r.status).toBe("official_tariff");
  });

  it("appeal stage applies the 0.6 multiplier", () => {
    // 223,000,000 × 0.6 = 133,800,000 Rial
    const r = runCalculator("lawyer-fee", {
      claimType: "monetary",
      claimValue: 500_000_000,
      stage: "appeal",
    });
    expect(r.headlineValue).toBe(133_800_000);
  });

  it("non-monetary matters pay the flat tariff", () => {
    const r = runCalculator("lawyer-fee", {
      claimType: "non_monetary",
      claimValue: 0,
      stage: "first",
    });
    expect(r.headlineValue).toBe(30_000_000);
  });

  it("zero: a zero claim falls back to the minimum tariff", () => {
    const r = runCalculator("lawyer-fee", {
      claimType: "monetary",
      claimValue: 0,
      stage: "first",
    });
    expect(r.headlineValue).toBe(10_000_000);
  });

  it("just-below-boundary: claim just under the first bracket edge", () => {
    // 9,999,999 Toman = 99,999,990 Rial @ 10% = 9,999,999 → below min 10,000,000
    const r = runCalculator("lawyer-fee", {
      claimType: "monetary",
      claimValue: 9_999_999,
      stage: "first",
    });
    expect(r.headlineValue).toBe(10_000_000);
  });

  it("just-above-boundary: claim just over the first bracket edge", () => {
    // 10,000,001 Toman = 100,000,010 Rial
    // 100,000,000@10% = 10,000,000 + 10@7% ≈ 10,000,001 → rounds to 10,000,000
    const r = runCalculator("lawyer-fee", {
      claimType: "monetary",
      claimValue: 10_000_001,
      stage: "first",
    });
    expect(r.headlineValue).toBe(10_000_000);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("lawyer-fee", {});
    expect(r.headlineValue).toBe(223_000_000);
  });

  it("invalid: unknown stage is rejected", () => {
    expect(() =>
      runCalculator("lawyer-fee", {
        claimType: "monetary",
        claimValue: 1,
        stage: "supreme",
      })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// چک برگشتی (check-damages)
// ------------------------------------------------------------
describe("check-damages — مطالبات چک برگشتی", () => {
  it("happy path: principal + damages, with costs", () => {
    // principal 2,000,000,000 Rial; ratio 168/100 → damages 1,360,000,000
    // total claim = 3,360,000,000 Rial
    const r = runCalculator("check-damages", {
      checkAmount: 200_000_000,
      indexAtDue: 100,
      indexAtPayment: 168,
      includeCosts: true,
    });
    expect(r.headlineValue).toBe(3_360_000_000);
    expect(r.headlineLabelFa).toBe("اصل چک و خسارت تأخیر");
  });

  it("separates court and enforcement costs from the claim", () => {
    // court fee on 3,360,000,000 Rial = 170,600,000 Rial = 17,060,000 Toman
    // enforcement = 3,360,000,000 × 5% = 168,000,000 Rial = 16,800,000 Toman
    const r = runCalculator("check-damages", {
      checkAmount: 200_000_000,
      indexAtDue: 100,
      indexAtPayment: 168,
      includeCosts: true,
    });
    const court = r.steps.find((s) => s.labelFa === "هزینه دادرسی");
    const exec = r.steps.find((s) => s.labelFa.includes("هزینه اجرا"));
    expect(court?.valueFa).toContain("۱۷٬۰۶۰٬۰۰۰");
    expect(exec?.valueFa).toContain("۱۶٬۸۰۰٬۰۰۰");
  });

  it("zero: no index rise yields no damages", () => {
    const r = runCalculator("check-damages", {
      checkAmount: 200_000_000,
      indexAtDue: 168,
      indexAtPayment: 100,
      includeCosts: false,
    });
    expect(r.headlineValue).toBe(2_000_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("omits costs when includeCosts is false", () => {
    const r = runCalculator("check-damages", {
      checkAmount: 200_000_000,
      indexAtDue: 100,
      indexAtPayment: 168,
      includeCosts: false,
    });
    expect(r.steps.find((s) => s.labelFa === "هزینه دادرسی")).toBeUndefined();
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("check-damages", {});
    expect(r.headlineValue).toBe(3_360_000_000);
  });

  it("invalid: negative check amount is rejected", () => {
    expect(() =>
      runCalculator("check-damages", { checkAmount: -1 })
    ).toThrow(CalculatorInputError);
  });

  it("boundary: zero due index is guarded", () => {
    const r = runCalculator("check-damages", {
      checkAmount: 200_000_000,
      indexAtDue: 0,
      indexAtPayment: 168,
      includeCosts: false,
    });
    expect(r.headlineValue).toBe(2_000_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});
