// ============================================================
// LEGALIR — Sale payment schedule tests
// ============================================================
// The spec calls out one arithmetic invariant explicitly:
//
//   «مجموع پرداخت‌ها باید با ثمن معامله مطابقت داشته باشد»
//
// The sale step shows a running sum against the price; these tests
// pin the comparison the UI relies on, so a schedule that does not
// add up can never be presented as balanced.
// ============================================================

import { describe, it, expect } from "vitest";
import { toman, sumMoney, moneyEquals, isZeroMoney } from "../money";

/** The three-instalment schedule used in the sale journey. */
const SCHEDULE = [toman(5_000_000_000), toman(6_500_000_000), toman(7_000_000_000)];
const PRICE = toman(18_500_000_000);

describe("sale payments — sum matches price", () => {
  it("sums the schedule to the total price", () => {
    expect(moneyEquals(sumMoney(SCHEDULE), PRICE)).toBe(true);
  });

  it("detects a schedule that is short of the price", () => {
    const short = [toman(5_000_000_000), toman(6_000_000_000)];
    expect(moneyEquals(sumMoney(short), PRICE)).toBe(false);
  });

  it("detects a schedule that exceeds the price", () => {
    const over = [...SCHEDULE, toman(1_000_000)];
    expect(moneyEquals(sumMoney(over), PRICE)).toBe(false);
  });

  it("treats an empty schedule as zero, not as matching a real price", () => {
    expect(isZeroMoney(sumMoney([]))).toBe(true);
    expect(moneyEquals(sumMoney([]), PRICE)).toBe(false);
  });

  it("ignores null rows when summing", () => {
    expect(moneyEquals(sumMoney([...SCHEDULE, null]), PRICE)).toBe(true);
  });

  it("keeps the sum exact in rial (no float drift)", () => {
    // 18.5 billion toman = 185 billion rial, an exact integer.
    expect(sumMoney(SCHEDULE).amount).toBe(185_000_000_000);
    expect(Number.isInteger(sumMoney(SCHEDULE).amount)).toBe(true);
  });
});
