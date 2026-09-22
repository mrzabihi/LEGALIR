import { describe, it, expect } from "vitest";
import { runCalculator } from "@/lib/calculators";

// ============================================================
// Golden fixtures — hand-computed expected values
// ============================================================
// Each case states the input, the arithmetic performed by hand, and
// the expected headline in Rial. If a rate dataset changes, these
// tests fail loudly, which is exactly the intent: a rate change must
// be a deliberate, reviewed act.

describe("golden — هزینه دادرسی (court-fee)", () => {
  it("computes a cumulative ad-valorem fee on a 500,000,000 Toman claim", () => {
    // Claim = 500,000,000 Toman = 5,000,000,000 Rial.
    // Bracket 1: 100,000,000 Rial @ 3%   = 3,000,000
    // Bracket 2: 900,000,000 Rial @ 4%   = 36,000,000
    // Bracket 3: 1,000,000,000 Rial @ 5% = 50,000,000
    // Bracket 4: 3,000,000,000 Rial @ 6% = 180,000,000
    // Bracket 5: nothing left (claim exhausted at the 5bn ceiling)
    // Total = 269,000,000 Rial
    const r = runCalculator("court-fee", {
      claimType: "monetary",
      claimValue: 500_000_000,
      stage: "first",
    });
    expect(r.headlineValue).toBe(269_000_000);
    expect(r.unit).toBe("IRT");
  });

  it("halves the fee for the appeal stage", () => {
    // 269,000,000 / 2 = 134,500,000 Rial
    const r = runCalculator("court-fee", {
      claimType: "monetary",
      claimValue: 500_000_000,
      stage: "appeal",
    });
    expect(r.headlineValue).toBe(134_500_000);
  });

  it("charges the flat fee for a non-monetary claim", () => {
    const r = runCalculator("court-fee", {
      claimType: "non_monetary",
      claimValue: 0,
      stage: "first",
    });
    expect(r.headlineValue).toBe(2_000_000);
  });
});

describe("golden — دیه (diyeh)", () => {
  it("returns the full diyeh for a full injury in a normal month", () => {
    const r = runCalculator("diyeh", { injuryType: "full", sacredMonth: false });
    expect(r.headlineValue).toBe(1_200_000_000_000);
  });

  it("halves the diyeh for a single eye", () => {
    const r = runCalculator("diyeh", { injuryType: "one_eye", sacredMonth: false });
    expect(r.headlineValue).toBe(600_000_000_000);
  });

  it("adds one third during a sacred month", () => {
    // 1,200,000,000,000 × 4/3 = 1,600,000,000,000
    const r = runCalculator("diyeh", { injuryType: "full", sacredMonth: true });
    expect(r.headlineValue).toBe(1_600_000_000_000);
  });
});

describe("golden — خسارت تأخیر تأدیه (delayed-payment)", () => {
  it("scales the principal by the index ratio minus one", () => {
    // 100,000,000 Toman = 1,000,000,000 Rial; ratio 168/100 = 1.68
    // damages = 1,000,000,000 × 0.68 = 680,000,000 Rial
    const r = runCalculator("delayed-payment", {
      principal: 100_000_000,
      indexAtDue: 100,
      indexAtPayment: 168,
    });
    expect(r.headlineValue).toBe(680_000_000);
  });

  it("awards nothing when the index has not risen", () => {
    const r = runCalculator("delayed-payment", {
      principal: 100_000_000,
      indexAtDue: 168,
      indexAtPayment: 100,
    });
    expect(r.headlineValue).toBe(0);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });
});

describe("golden — مهریه به نرخ روز (dowry)", () => {
  it("revalues the dowry by the index ratio", () => {
    // 114,000,000 Toman = 1,140,000,000 Rial; ratio 152/42
    // 1,140,000,000 × (152/42) = 4,125,714,285.71 → 4,125,714,286
    const r = runCalculator("dowry", {
      nominalDowry: 114_000_000,
      indexAtMarriage: 42,
      indexAtClaim: 152,
    });
    expect(r.headlineValue).toBe(4_125_714_286);
  });
});

describe("golden — عیدی (bonus)", () => {
  it("caps a high-wage bonus at three times the minimum wage", () => {
    // wage 150,000,000 Toman = 1,500,000,000 Rial
    // daily = 1,500,000,000 / 30 = 50,000,000 Rial
    // 90 days = 4,500,000,000 Rial
    // cap = 104,000,000 × 3 = 312,000,000 Rial  → capped
    const r = runCalculator("bonus", {
      monthlyWage: 150_000_000,
      monthsWorked: 12,
      bonusDays: 90,
    });
    expect(r.headlineValue).toBe(312_000_000);
    expect(r.warningsFa.length).toBeGreaterThan(0);
  });

  it("pro-rates for a partial year without hitting the cap", () => {
    // wage 20,000,000 Toman = 200,000,000 Rial; daily = 6,666,666.67
    // 60 days = 400,000,000 Rial; × 6/12 = 200,000,000 Rial
    // cap = 312,000,000 → not capped
    const r = runCalculator("bonus", {
      monthlyWage: 20_000_000,
      monthsWorked: 6,
      bonusDays: 60,
    });
    expect(r.headlineValue).toBe(200_000_000);
    expect(r.warningsFa).toHaveLength(0);
  });
});

describe("golden — سنوات (severance)", () => {
  it("pays one month's wage per completed year", () => {
    // 150,000,000 Toman = 1,500,000,000 Rial × 5 years
    const r = runCalculator("severance", {
      lastMonthlyWage: 150_000_000,
      yearsOfService: 5,
      extraMonths: 0,
    });
    expect(r.headlineValue).toBe(7_500_000_000);
  });

  it("pro-rates partial years by month", () => {
    // 1,500,000,000 × (5 + 6/12) = 1,500,000,000 × 5.5
    const r = runCalculator("severance", {
      lastMonthlyWage: 150_000_000,
      yearsOfService: 5,
      extraMonths: 6,
    });
    expect(r.headlineValue).toBe(8_250_000_000);
  });
});

describe("golden — بازخرید مرخصی (leave-buyback)", () => {
  it("values unused days at the daily wage", () => {
    // 150,000,000 Toman = 1,500,000,000 Rial; daily = 50,000,000
    // 15 days = 750,000,000 Rial
    const r = runCalculator("leave-buyback", {
      monthlyWage: 150_000_000,
      unusedDays: 15,
      premiumPercent: 0,
    });
    expect(r.headlineValue).toBe(750_000_000);
  });

  it("applies a contractual premium", () => {
    // 750,000,000 × 1.5 = 1,125,000,000
    const r = runCalculator("leave-buyback", {
      monthlyWage: 150_000_000,
      unusedDays: 15,
      premiumPercent: 50,
    });
    expect(r.headlineValue).toBe(1_125_000_000);
  });
});

describe("golden — حقوق خالص و ناخالص (salary)", () => {
  it("computes net from gross", () => {
    // gross annual = 150,000,000 Toman × 12 = 18,000,000,000 Rial
    // insurance = 18,000,000,000 × 7% = 1,260,000,000
    // taxable = 18,000,000,000 − 1,260,000,000 − 240,000,000 = 16,500,000,000
    // tax: 400,000,000@10% = 40,000,000
    //      400,000,000@15% = 60,000,000
    //      400,000,000@20% = 80,000,000
    //      15,300,000,000@30% = 4,590,000,000
    //      total = 4,770,000,000
    // net annual = 18,000,000,000 − 1,260,000,000 − 4,770,000,000 = 11,970,000,000
    // monthly net = 997,500,000 Rial
    const r = runCalculator("salary", {
      direction: "gross_to_net",
      amount: 150_000_000,
    });
    expect(r.headlineValue).toBe(997_500_000);
  });

  it("round-trips net → gross back to the original gross", () => {
    const forward = runCalculator("salary", {
      direction: "gross_to_net",
      amount: 150_000_000,
    });
    // Feed the resulting monthly net back in and recover the gross.
    // headlineValue is Rial; the input field is Toman.
    const inverse = runCalculator("salary", {
      direction: "net_to_gross",
      amount: forward.headlineValue / 10,
    });
    // Allow 1 Toman of rounding slack from the monthly division.
    expect(Math.abs(inverse.headlineValue - 1_500_000_000)).toBeLessThanOrEqual(10);
  });
});
