// ============================================================
// LEGALIR — Admin live report polling policy
// ============================================================
// The live block is the panel's first live surface, so its request cadence must
// be provable: it stops when paused, stops in a hidden tab, backs off after a
// failure (capped), and otherwise polls at a steady base rate — never hammering
// the endpoint, never making a request the operator did not ask for.
// ============================================================

import { describe, it, expect } from "vitest";
import { liveRefetchInterval, LIVE_REFRESH_MS, LIVE_MAX_BACKOFF_MS } from "@/hooks/useAdmin";

describe("liveRefetchInterval", () => {
  it("stops the poll while paused", () => {
    expect(liveRefetchInterval({ paused: true, hidden: false, failures: 0 })).toBe(false);
    // Paused outranks a prior failure — no polling at all.
    expect(liveRefetchInterval({ paused: true, hidden: false, failures: 3 })).toBe(false);
  });

  it("stops the poll while the tab is hidden (no background requests)", () => {
    expect(liveRefetchInterval({ paused: false, hidden: true, failures: 0 })).toBe(false);
  });

  it("polls at the base cadence after a success", () => {
    expect(liveRefetchInterval({ paused: false, hidden: false, failures: 0 })).toBe(LIVE_REFRESH_MS);
  });

  it("backs off monotonically after failures and caps the wait", () => {
    const f1 = liveRefetchInterval({ paused: false, hidden: false, failures: 1 }) as number;
    const f2 = liveRefetchInterval({ paused: false, hidden: false, failures: 2 }) as number;
    expect(f1).toBe(LIVE_REFRESH_MS * 2);
    expect(f2).toBe(LIVE_REFRESH_MS * 3);
    expect(f2).toBeGreaterThan(f1);
    // A long outage settles on the ceiling, not unbounded growth.
    expect(liveRefetchInterval({ paused: false, hidden: false, failures: 99 })).toBe(
      LIVE_MAX_BACKOFF_MS
    );
  });

  it("honours an explicit base interval", () => {
    expect(liveRefetchInterval({ paused: false, hidden: false, failures: 0, base: 5_000 })).toBe(
      5_000
    );
    expect(liveRefetchInterval({ paused: false, hidden: false, failures: 1, base: 5_000 })).toBe(
      10_000
    );
  });
});
