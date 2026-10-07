import { describe, it, expect } from "vitest";
import { runCalculator, CalculatorInputError } from "@/lib/calculators";

// ============================================================
// Extended calculators — property / judicial / family / injury /
// contracts. Expected values are hand-computed from the 1405
// datasets so a rate change fails loudly.
// ============================================================

// ------------------------------------------------------------
// مالیات نقل‌وانتقال ملک (property-transfer-tax)
// ------------------------------------------------------------
describe("property-transfer-tax — مالیات نقل‌وانتقال ملک", () => {
  it("happy path: land + building + VAT on the building", () => {
    // land 2bn Toman = 20bn Rial @ 5% = 1,000,000,000
    // building 3bn Toman = 30bn Rial @ 5% = 1,500,000,000
    // vat = 1,500,000,000 × 10% = 150,000,000
    // total = 2,650,000,000 Rial
    const r = runCalculator("property-transfer-tax", {
      landValue: 2_000_000_000,
      buildingValue: 3_000_000_000,
    });
    expect(r.headlineValue).toBe(2_650_000_000);
    expect(r.status).toBe("legal_basis");
  });

  it("zero: no assessed value yields no tax with a warning", () => {
    const r = runCalculator("property-transfer-tax", {
      landValue: 0,
      buildingValue: 0,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("property-transfer-tax", {});
    expect(r.headlineValue).toBe(2_650_000_000);
  });

  it("boundary: a negative optional land value is clamped to zero", () => {
    // Optional field with min:0 → clamped, not rejected.
    const r = runCalculator("property-transfer-tax", {
      landValue: -1,
      buildingValue: 0,
    });
    expect(r.headlineValue).toBe(0);
  });

  it("VAT applies only to the building component", () => {
    const r = runCalculator("property-transfer-tax", {
      landValue: 1_000_000_000,
      buildingValue: 0,
    });
    // land 10bn Rial @ 5% = 500,000,000; no VAT
    expect(r.headlineValue).toBe(500_000_000);
  });
});

// ------------------------------------------------------------
// هزینه‌های دفترخانه و ثبت (notary-fees)
// ------------------------------------------------------------
describe("notary-fees — هزینه‌های دفترخانه و ثبت", () => {
  it("happy path: cumulative brackets + fixed stamp duty", () => {
    // 5bn Toman = 50bn Rial
    // 100M@1% = 1,000,000
    // 900M@0.7% = 6,300,000
    // 4,000M@0.5% = 20,000,000
    // 45,000M@0.3% = 135,000,000
    // notary = 162,300,000 + stamp 2,000,000 = 164,300,000 Rial
    const r = runCalculator("notary-fees", { transactionValue: 5_000_000_000 });
    expect(r.headlineValue).toBe(164_300_000);
    expect(r.status).toBe("official_tariff");
  });

  it("zero: no value still charges the fixed stamp duty", () => {
    const r = runCalculator("notary-fees", { transactionValue: 0 });
    expect(r.headlineValue).toBe(2_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted value falls back to the default", () => {
    const r = runCalculator("notary-fees", {});
    expect(r.headlineValue).toBe(164_300_000);
  });

  it("invalid: negative value is rejected", () => {
    expect(() => runCalculator("notary-fees", { transactionValue: -1 })).toThrow(
      CalculatorInputError
    );
  });
});

// ------------------------------------------------------------
// هزینه کامل معامله ملک (property-transaction-cost)
// ------------------------------------------------------------
describe("property-transaction-cost — هزینه کامل معامله ملک", () => {
  it("happy path: transfer tax + notary + commission", () => {
    // transfer = 2,650,000,000
    // notary   = 164,300,000
    // commission = 50bn × 0.25% = 125,000,000 + 10% vat = 137,500,000
    // total = 2,951,800,000 Rial
    const r = runCalculator("property-transaction-cost", {
      transactionValue: 5_000_000_000,
      landValue: 2_000_000_000,
      buildingValue: 3_000_000_000,
    });
    expect(r.headlineValue).toBe(2_951_800_000);
    expect(r.status).toBe("estimate");
  });

  it("always emits an estimate warning", () => {
    const r = runCalculator("property-transaction-cost", {});
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("property-transaction-cost", {});
    expect(r.headlineValue).toBe(2_951_800_000);
  });

  it("invalid: negative transaction value is rejected", () => {
    expect(() =>
      runCalculator("property-transaction-cost", { transactionValue: -1 })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// سهم مشاعی (co-ownership-share)
// ------------------------------------------------------------
describe("co-ownership-share — سهم مشاعی ملک", () => {
  it("happy path: 2 of 6 dangs is one third", () => {
    // 6bn Toman = 60bn Rial × (2/6) = 20,000,000,000 Rial
    const r = runCalculator("co-ownership-share", {
      propertyValue: 6_000_000_000,
      ownedDangs: 2,
      totalDangs: 6,
    });
    expect(r.headlineValue).toBe(20_000_000_000);
    expect(r.status).toBe("legal_basis");
  });

  it("zero: zero property value yields zero with a warning", () => {
    const r = runCalculator("co-ownership-share", {
      propertyValue: 0,
      ownedDangs: 2,
      totalDangs: 6,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted total dangs defaults to six", () => {
    const r = runCalculator("co-ownership-share", {
      propertyValue: 6_000_000_000,
      ownedDangs: 2,
    });
    expect(r.headlineValue).toBe(20_000_000_000);
  });

  it("invalid: negative property value is rejected", () => {
    expect(() =>
      runCalculator("co-ownership-share", { propertyValue: -1, ownedDangs: 1 })
    ).toThrow(CalculatorInputError);
  });

  it("boundary: full ownership equals the whole property", () => {
    const r = runCalculator("co-ownership-share", {
      propertyValue: 6_000_000_000,
      ownedDangs: 6,
      totalDangs: 6,
    });
    expect(r.headlineValue).toBe(60_000_000_000);
  });
});

// ------------------------------------------------------------
// سرقفلی (goodwill)
// ------------------------------------------------------------
describe("goodwill — سرقفلی (برآورد)", () => {
  it("happy path: range is 12×–36× the monthly rent", () => {
    // rent 50M Toman = 500M Rial → lower 6bn, upper 18bn, mid 12bn Rial
    const r = runCalculator("goodwill", { monthlyRent: 50_000_000 });
    expect(r.headlineValue).toBe(12_000_000_000);
    expect(r.status).toBe("estimate");
  });

  it("zero: zero rent yields zero with a warning", () => {
    const r = runCalculator("goodwill", { monthlyRent: 0 });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted rent falls back to the default", () => {
    const r = runCalculator("goodwill", {});
    expect(r.headlineValue).toBe(12_000_000_000);
  });

  it("invalid: negative rent is rejected", () => {
    expect(() => runCalculator("goodwill", { monthlyRent: -1 })).toThrow(
      CalculatorInputError
    );
  });

  it("always emits an estimate warning", () => {
    const r = runCalculator("goodwill", { monthlyRent: 50_000_000 });
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
// هزینه اجرای حکم (execution-fee)
// ------------------------------------------------------------
describe("execution-fee — هزینه اجرای حکم", () => {
  it("happy path: 5% of the amount recovered", () => {
    // 500M Toman = 5bn Rial × 5% = 250,000,000 Rial
    const r = runCalculator("execution-fee", { amountRecovered: 500_000_000 });
    expect(r.headlineValue).toBe(250_000_000);
    expect(r.status).toBe("official_tariff");
  });

  it("zero: zero recovered falls back to the statutory minimum", () => {
    const r = runCalculator("execution-fee", { amountRecovered: 0 });
    expect(r.headlineValue).toBe(1_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted amount falls back to the default", () => {
    const r = runCalculator("execution-fee", {});
    expect(r.headlineValue).toBe(250_000_000);
  });

  it("invalid: negative amount is rejected", () => {
    expect(() => runCalculator("execution-fee", { amountRecovered: -1 })).toThrow(
      CalculatorInputError
    );
  });
});

// ------------------------------------------------------------
// حق‌الزحمه کارشناسی (expert-fee)
// ------------------------------------------------------------
describe("expert-fee — حق‌الزحمه کارشناسی رسمی", () => {
  it("happy path: cumulative brackets on a 1bn Toman subject", () => {
    // 10bn Rial: 100M@5% + 900M@3% + 4,000M@2% + 5,000M@1%
    // = 5,000,000 + 27,000,000 + 80,000,000 + 50,000,000 = 162,000,000
    const r = runCalculator("expert-fee", { subjectValue: 1_000_000_000 });
    expect(r.headlineValue).toBe(162_000_000);
    expect(r.status).toBe("official_tariff");
  });

  it("multiplies by the number of experts", () => {
    const r = runCalculator("expert-fee", {
      subjectValue: 1_000_000_000,
      expertCount: 3,
    });
    expect(r.headlineValue).toBe(486_000_000);
  });

  it("zero: zero subject falls back to the statutory minimum", () => {
    const r = runCalculator("expert-fee", { subjectValue: 0 });
    expect(r.headlineValue).toBe(5_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("expert-fee", {});
    expect(r.headlineValue).toBe(162_000_000);
  });

  it("invalid: negative subject value is rejected", () => {
    expect(() => runCalculator("expert-fee", { subjectValue: -1 })).toThrow(
      CalculatorInputError
    );
  });
});

// ------------------------------------------------------------
// حق‌الزحمه داوری (arbitration-fee)
// ------------------------------------------------------------
describe("arbitration-fee — حق‌الزحمه داوری", () => {
  it("happy path: cumulative brackets on a 1bn Toman dispute", () => {
    const r = runCalculator("arbitration-fee", { disputeAmount: 1_000_000_000 });
    expect(r.headlineValue).toBe(162_000_000);
    expect(r.status).toBe("official_tariff");
  });

  it("zero: zero dispute falls back to the statutory minimum", () => {
    const r = runCalculator("arbitration-fee", { disputeAmount: 0 });
    expect(r.headlineValue).toBe(10_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted amount falls back to the default", () => {
    const r = runCalculator("arbitration-fee", {});
    expect(r.headlineValue).toBe(162_000_000);
  });

  it("invalid: negative dispute amount is rejected", () => {
    expect(() => runCalculator("arbitration-fee", { disputeAmount: -1 })).toThrow(
      CalculatorInputError
    );
  });
});

// ------------------------------------------------------------
// مالیات ارث (inheritance-tax)
// ------------------------------------------------------------
describe("inheritance-tax — مالیات ارث", () => {
  it("happy path: per-heir exemption then 10% tax", () => {
    // 10bn Toman = 100bn Rial / 3 heirs = 33,333,333,333.33
    // − 300,000,000 exemption = 33,033,333,333.33 × 10% = 3,303,333,333.33
    // × 3 heirs = 9,910,000,000 Rial
    const r = runCalculator("inheritance-tax", {
      inheritedValue: 10_000_000_000,
      heirCount: 3,
    });
    expect(r.headlineValue).toBe(9_910_000_000);
    expect(r.status).toBe("legal_basis");
  });

  it("zero: no estate yields no tax with a warning", () => {
    const r = runCalculator("inheritance-tax", {
      inheritedValue: 0,
      heirCount: 3,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("boundary: share below the exemption yields no tax", () => {
    // 200M Toman = 2bn Rial / 10 heirs = 200M Rial < 300M → no tax
    const r = runCalculator("inheritance-tax", {
      inheritedValue: 200_000_000,
      heirCount: 10,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("inheritance-tax", {});
    expect(r.headlineValue).toBe(9_910_000_000);
  });

  it("invalid: negative estate value is rejected", () => {
    expect(() =>
      runCalculator("inheritance-tax", { inheritedValue: -1, heirCount: 1 })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// نفقه (alimony)
// ------------------------------------------------------------
describe("alimony — نفقه (برآورد)", () => {
  it("happy path: Tehran baseline with no children", () => {
    // adult 30M × 1.4 = 42,000,000 Rial point estimate
    const r = runCalculator("alimony", { city: "tehran", childrenCount: 0 });
    expect(r.headlineValue).toBe(42_000_000);
    expect(r.status).toBe("estimate");
  });

  it("adds child costs at the child baseline", () => {
    // adult 42M + 2 × (15M × 1.4) = 42M + 42M = 84,000,000 Rial
    const r = runCalculator("alimony", { city: "tehran", childrenCount: 2 });
    expect(r.headlineValue).toBe(84_000_000);
  });

  it("other cities use the base factor of 1", () => {
    const r = runCalculator("alimony", { city: "other", childrenCount: 0 });
    expect(r.headlineValue).toBe(30_000_000);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("alimony", {});
    expect(r.headlineValue).toBe(42_000_000);
  });

  it("invalid: unknown city is rejected", () => {
    expect(() => runCalculator("alimony", { city: "zzz" })).toThrow(
      CalculatorInputError
    );
  });

  it("always emits an estimate warning", () => {
    const r = runCalculator("alimony", {});
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
// اجرت‌المثل ایام زوجیت (mahr-service)
// ------------------------------------------------------------
describe("mahr-service — اجرت‌المثل ایام زوجیت", () => {
  it("happy path: 10 years of marriage", () => {
    // 20M × 120 months = 2,400,000,000 Rial point estimate
    const r = runCalculator("mahr-service", { marriageYears: 10 });
    expect(r.headlineValue).toBe(2_400_000_000);
    expect(r.status).toBe("estimate");
  });

  it("zero: zero years yields zero with a warning", () => {
    const r = runCalculator("mahr-service", { marriageYears: 0 });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted years fall back to the default", () => {
    const r = runCalculator("mahr-service", {});
    expect(r.headlineValue).toBe(2_400_000_000);
  });

  it("invalid: negative years are rejected", () => {
    expect(() => runCalculator("mahr-service", { marriageYears: -1 })).toThrow(
      CalculatorInputError
    );
  });

  it("always emits an estimate warning", () => {
    const r = runCalculator("mahr-service", {});
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------
// افت قیمت خودرو (vehicle-depreciation)
// ------------------------------------------------------------
describe("vehicle-depreciation — افت قیمت خودرو", () => {
  it("happy path: 3 medium repaired parts on a 2bn Toman car", () => {
    // 20bn Rial × 1% × 3 × 1 × 1 = 600,000,000 Rial point estimate
    const r = runCalculator("vehicle-depreciation", {
      vehicleValue: 2_000_000_000,
      damagedParts: 3,
      severity: "medium",
      treatment: "repaired",
    });
    expect(r.headlineValue).toBe(600_000_000);
    expect(r.status).toBe("estimate");
  });

  it("severe replaced parts raise the estimate", () => {
    // 20bn × 1% × 3 × 1.6 × 1.3 = 1,248,000,000 Rial
    const r = runCalculator("vehicle-depreciation", {
      vehicleValue: 2_000_000_000,
      damagedParts: 3,
      severity: "severe",
      treatment: "replaced",
    });
    expect(r.headlineValue).toBe(1_248_000_000);
  });

  it("zero: no damaged parts yields zero with a warning", () => {
    const r = runCalculator("vehicle-depreciation", {
      vehicleValue: 2_000_000_000,
      damagedParts: 0,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("vehicle-depreciation", {});
    expect(r.headlineValue).toBe(600_000_000);
  });

  it("invalid: unknown severity is rejected", () => {
    expect(() =>
      runCalculator("vehicle-depreciation", { severity: "catastrophic" })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// دیه پیشرفته و ارش (diyeh-advanced)
// ------------------------------------------------------------
describe("diyeh-advanced — دیه پیشرفته و ارش", () => {
  it("happy path: full diyeh with no arsh", () => {
    const r = runCalculator("diyeh-advanced", {
      injuryType: "full",
      injuryCount: 1,
      sacredMonth: false,
      arshAmount: 0,
    });
    expect(r.headlineValue).toBe(1_200_000_000_000);
    expect(r.status).toBe("legal_basis");
  });

  it("adds the arsh amount to the diyeh", () => {
    // 1.2e12 + 100M Toman (1bn Rial) = 1,201,000,000,000 Rial
    const r = runCalculator("diyeh-advanced", {
      injuryType: "full",
      injuryCount: 1,
      sacredMonth: false,
      arshAmount: 100_000_000,
    });
    expect(r.headlineValue).toBe(1_201_000_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("sacred month raises the diyeh by one third", () => {
    // 1.2e12 × 4/3 = 1,600,000,000,000 Rial
    const r = runCalculator("diyeh-advanced", {
      injuryType: "full",
      injuryCount: 1,
      sacredMonth: true,
      arshAmount: 0,
    });
    expect(r.headlineValue).toBe(1_600_000_000_000);
  });

  it("multiplies by the injury count", () => {
    // one_eye = 0.5 × 1.2e12 = 600bn; × 2 = 1,200,000,000,000 Rial
    const r = runCalculator("diyeh-advanced", {
      injuryType: "one_eye",
      injuryCount: 2,
      sacredMonth: false,
      arshAmount: 0,
    });
    expect(r.headlineValue).toBe(1_200_000_000_000);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("diyeh-advanced", {});
    expect(r.headlineValue).toBe(1_200_000_000_000);
  });

  it("invalid: unknown injury type is rejected", () => {
    expect(() =>
      runCalculator("diyeh-advanced", { injuryType: "zzz" })
    ).toThrow(CalculatorInputError);
  });
});

// ------------------------------------------------------------
// وجه التزام قراردادی (contract-penalty)
// ------------------------------------------------------------
describe("contract-penalty — وجه التزام قراردادی", () => {
  it("happy path: 2% monthly over 3 months", () => {
    // 1bn Toman = 10bn Rial × 2% × 3 = 600,000,000 Rial
    const r = runCalculator("contract-penalty", {
      contractAmount: 1_000_000_000,
      monthlyPenaltyRate: 2,
      delayMonths: 3,
    });
    expect(r.headlineValue).toBe(600_000_000);
    expect(r.status).toBe("legal_basis");
  });

  it("zero: no delay yields no penalty with a warning", () => {
    const r = runCalculator("contract-penalty", {
      contractAmount: 1_000_000_000,
      monthlyPenaltyRate: 2,
      delayMonths: 0,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("empty: omitted fields fall back to defaults", () => {
    const r = runCalculator("contract-penalty", {});
    expect(r.headlineValue).toBe(600_000_000);
  });

  it("invalid: negative contract amount is rejected", () => {
    expect(() =>
      runCalculator("contract-penalty", { contractAmount: -1 })
    ).toThrow(CalculatorInputError);
  });

  it("always emits a contractual-basis warning", () => {
    const r = runCalculator("contract-penalty", {});
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});
