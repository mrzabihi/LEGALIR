import { describe, it, expect } from "vitest";
import { tehranDayStartUtc, tehranDayEndUtc } from "../dashboard-metrics";

// Asia/Tehran is a fixed UTC+03:30 offset (Iran dropped DST in 2022).
const TEHRAN_UTC_OFFSET_MS = 210 * 60 * 1000;

describe("tehranDayStartUtc / tehranDayEndUtc — Asia/Tehran business day", () => {
  it("returns the UTC instant of Tehran midnight for a given date", () => {
    // 2026-08-22 00:00 in Tehran == 2026-08-21 20:30 UTC.
    const start = tehranDayStartUtc(new Date("2026-08-22T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-21T20:30:00.000Z");
  });

  it("spans exactly 24 hours", () => {
    const start = tehranDayStartUtc(new Date("2026-08-22T12:00:00Z"));
    const end = tehranDayEndUtc(new Date("2026-08-22T12:00:00Z"));
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("is stable for any instant within the same Tehran day", () => {
    const morning = tehranDayStartUtc(new Date("2026-08-22T03:00:00Z"));
    const evening = tehranDayStartUtc(new Date("2026-08-22T20:00:00Z"));
    expect(morning.toISOString()).toBe(evening.toISOString());
  });

  it("rolls the boundary at Tehran midnight, not UTC midnight", () => {
    // 20:30 UTC == 00:00 Tehran (next day).
    const beforeMidnight = tehranDayStartUtc(new Date("2026-08-21T20:29:00Z"));
    const afterMidnight = tehranDayStartUtc(new Date("2026-08-21T20:30:00Z"));
    expect(beforeMidnight.toISOString()).toBe("2026-08-20T20:30:00.000Z");
    expect(afterMidnight.toISOString()).toBe("2026-08-21T20:30:00.000Z");
  });

  it("honors the fixed +03:30 offset (no DST shift)", () => {
    const start = tehranDayStartUtc(new Date("2026-08-22T12:00:00Z"));
    expect(start.getTime() % (24 * 60 * 60 * 1000)).toBe(
      (24 * 60 * 60 * 1000 - TEHRAN_UTC_OFFSET_MS) % (24 * 60 * 60 * 1000)
    );
  });
});
