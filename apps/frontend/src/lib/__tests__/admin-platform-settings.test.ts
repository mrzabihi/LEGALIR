// ============================================================
// LEGALIR — Display timezone setting (hermetic)
// ============================================================
// Pins the behaviour the Settings page depends on:
//   • an invalid IANA zone is REJECTED (never stored, never echoed);
//   • a valid zone round-trips and carries who/when;
//   • the default applies before anything is saved;
//   • the SERVER zone is reported separately and never confused with the
//     display preference.
//
// `@/lib/db` is mocked so the suite is hermetic (same pattern as
// admin-calculator-settings.test.ts) — no real .data table is touched.
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  writes: 0,
}));

vi.mock("@/lib/db", () => ({
  readTable: () => state.rows,
  writeTable: (_name: string, data: unknown) => {
    state.rows = data as Record<string, unknown>[];
    state.writes += 1;
  },
}));

import {
  DEFAULT_DISPLAY_TIMEZONE,
  getDisplaySettings,
  isValidTimeZone,
  offsetLabelFa,
  saveDisplaySettings,
  serverTimeZone,
  timeZoneOptions,
} from "@/lib/admin/platform-settings";

beforeEach(() => {
  state.rows = [];
  state.writes = 0;
});

describe("isValidTimeZone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimeZone("Asia/Tehran")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects junk, empty and over-long values", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("x".repeat(65))).toBe(false);
  });
});

describe("getDisplaySettings", () => {
  it("returns the default before anything is saved", () => {
    expect(getDisplaySettings()).toEqual({
      displayTimezone: DEFAULT_DISPLAY_TIMEZONE,
      updatedAt: "",
      updatedBy: null,
    });
  });

  it("ignores a stored zone the runtime cannot resolve", () => {
    state.rows = [
      { id: "display", displayTimezone: "Not/AZone", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(getDisplaySettings().displayTimezone).toBe(DEFAULT_DISPLAY_TIMEZONE);
  });
});

describe("saveDisplaySettings", () => {
  it("rejects an invalid zone without writing", () => {
    const res = saveDisplaySettings({ displayTimezone: "  Mars/Base  " }, "staff-1");
    expect(res).toEqual({ error: "INVALID_TIMEZONE" });
    expect(state.writes).toBe(0);
  });

  it("stores a valid zone with actor and UTC timestamp, and reports before/after", () => {
    state.rows = [
      { id: "display", displayTimezone: "Asia/Tehran", updatedAt: "", updatedBy: null },
    ];

    const res = saveDisplaySettings({ displayTimezone: " UTC " }, "staff-1");
    expect("error" in res).toBe(false);
    if ("error" in res) return;

    expect(res.before.displayTimezone).toBe("Asia/Tehran");
    expect(res.after.displayTimezone).toBe("UTC");
    expect(res.after.updatedBy).toBe("staff-1");
    // Stored instants are ISO-8601 UTC — the display setting never changes that.
    expect(new Date(res.after.updatedAt).toISOString()).toBe(res.after.updatedAt);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ id: "display", displayTimezone: "UTC" });
  });
});

describe("timeZoneOptions", () => {
  it("offers Tehran first, each option with a live offset", () => {
    const options = timeZoneOptions();
    expect(options[0]?.value).toBe("Asia/Tehran");
    for (const o of options) expect(o.offsetFa).toMatch(/^UTC/);
  });

  it("keeps an out-of-list saved zone selectable", () => {
    const options = timeZoneOptions(["Asia/Kathmandu"]);
    expect(options.some((o) => o.value === "Asia/Kathmandu")).toBe(true);
  });

  it("drops invalid extras instead of offering them", () => {
    const options = timeZoneOptions(["Mars/Base"]);
    expect(options.some((o) => o.value === "Mars/Base")).toBe(false);
  });
});

describe("offsetLabelFa", () => {
  it("renders Tehran as UTC+03:30 (no DST since 2022)", () => {
    expect(offsetLabelFa("Asia/Tehran", new Date("2026-10-20T12:00:00.000Z"))).toBe(
      "UTC+03:30"
    );
  });

  it("renders UTC without a signed offset", () => {
    expect(offsetLabelFa("UTC", new Date("2026-10-20T12:00:00.000Z"))).toBe("UTC");
  });
});

describe("serverTimeZone", () => {
  it("reports a resolvable zone and names its source", () => {
    const res = serverTimeZone();
    expect(isValidTimeZone(res.timeZone)).toBe(true);
    expect(["TZ", "runtime"]).toContain(res.source);
  });
});
