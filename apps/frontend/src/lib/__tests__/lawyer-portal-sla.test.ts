// ============================================================
// LEGALIR — Lawyer portal SLA engine (pure)
// ============================================================
// §5 of the lawyer-panel brief: deadlines are computed from the service's
// policy over the configured WORKING calendar (timezone, working days,
// holidays, hours), or over plain wall-clock time, per service.
//
// Every case below is anchored to absolute instants in Asia/Tehran (UTC+03:30
// since Iran dropped DST in 2022), so a regression in the window walk, the
// pause credit or the health precedence fails here rather than in the panel.
//
// Reference week used throughout:
//   2026-10-14 Wed · 2026-10-15 Thu · 2026-10-16 Fri · 2026-10-17 Sat
// Working days (Iranian index 0..6 = Sat..Fri) are Sat–Wed.
// ============================================================

import { describe, it, expect } from "vitest";
import type { LegalRequestSla, PlatformWorkCalendar, ServiceSlaPolicy } from "@legalir/types";
import {
  DEFAULT_WORK_CALENDAR,
  activeDueAt,
  addClock,
  applyOverride,
  completionDeadline,
  defaultPolicy,
  elapsedClock,
  formatRemaining,
  hoursToMs,
  initializeSla,
  isPolicyActive,
  markAccepted,
  markBreached,
  markCompleted,
  markDeclined,
  markInfoRequested,
  markStarted,
  markViewed,
  pauseClock,
  resumeClock,
  responseDeadline,
  slaPhase,
  slaSnapshot,
} from "../lawyer-portal/sla";

// 09:00 and 17:00 local on Wednesday 2026-10-14.
const WED_0900 = "2026-10-14T05:30:00.000Z";
const WED_1700 = "2026-10-14T13:30:00.000Z";
// 20:00 local Wednesday (outside the 09:00–17:00 window).
const WED_2000 = "2026-10-14T16:30:00.000Z";
// 09:00 local Thursday (a non-working day: Iranian index 5).
const THU_0900 = "2026-10-15T05:30:00.000Z";

function calendar(overrides: Partial<PlatformWorkCalendar> = {}): PlatformWorkCalendar {
  return { ...DEFAULT_WORK_CALENDAR, ...overrides };
}

function policy(overrides: Partial<ServiceSlaPolicy> = {}): ServiceSlaPolicy {
  return { ...defaultPolicy("family-consultation", "مشاورهٔ خانواده"), ...overrides };
}

function blankSla(overrides: Partial<LegalRequestSla> = {}): LegalRequestSla {
  const base = initializeSla({
    policy: policy(),
    assignedAt: WED_0900,
    calendar: calendar(),
  });
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Clock math
// ---------------------------------------------------------------------------

describe("addClock — CALENDAR mode", () => {
  it("adds wall-clock time across nights and weekends", () => {
    // Friday 22:00 → Saturday 04:00 is six plain wall-clock hours.
    expect(addClock("2026-10-16T18:30:00.000Z", hoursToMs(6), calendar(), "CALENDAR")).toBe(
      "2026-10-17T00:30:00.000Z"
    );
  });

  it("returns the instant unchanged for a zero or negative duration", () => {
    expect(addClock(WED_0900, 0, calendar(), "CALENDAR")).toBe(WED_0900);
    expect(addClock(WED_0900, -1000, calendar(), "CALENDAR")).toBe(WED_0900);
  });

  it("leaves an unparseable instant alone instead of inventing one", () => {
    expect(addClock("not-a-date", hoursToMs(4), calendar(), "CALENDAR")).toBe("not-a-date");
  });
});

describe("addClock — BUSINESS_HOURS mode", () => {
  it("consumes exactly one day's window and lands on the closing hour", () => {
    // 09:00 Wed + 8 business hours = 17:00 Wed.
    expect(addClock(WED_0900, hoursToMs(8), calendar(), "BUSINESS_HOURS")).toBe(WED_1700);
  });

  it("rolls overflow past a non-working day into the next working day", () => {
    // 09:00 Wed + 10 business hours = 8h to 17:00, then 2h — but Thursday is
    // a non-working day, so the remainder goes to Saturday.
    expect(addClock(WED_0900, hoursToMs(10), calendar(), "BUSINESS_HOURS")).toBe(
      "2026-10-17T07:30:00.000Z" // Saturday 11:00 local
    );
  });

  it("starts counting at the next opening when the clock starts after hours", () => {
    // 20:00 Wed + 1 business hour → Thursday 10:00, except Thursday is off,
    // so it lands at 10:00 Saturday.
    expect(addClock(WED_2000, hoursToMs(1), calendar(), "BUSINESS_HOURS")).toBe(
      "2026-10-17T06:30:00.000Z" // Saturday 10:00 local
    );
  });

  it("skips a configured holiday", () => {
    const withHoliday = calendar({ holidays: ["2026-10-14"] });
    // Wednesday is now a holiday: 09:00 Wed + 1h → 10:00 Sat.
    expect(addClock(WED_0900, hoursToMs(1), withHoliday, "BUSINESS_HOURS")).toBe(
      "2026-10-17T06:30:00.000Z"
    );
  });

  it("degrades to wall-clock when the calendar has no usable window", () => {
    const broken = calendar({ hours: { startTime: "17:00", endTime: "09:00" } });
    expect(addClock(WED_0900, hoursToMs(4), broken, "BUSINESS_HOURS")).toBe(
      "2026-10-14T09:30:00.000Z"
    );
  });
});

describe("elapsedClock", () => {
  it("counts only the in-window overlap", () => {
    // 15:00 → 19:00 local leaves two business hours.
    expect(
      elapsedClock("2026-10-14T11:30:00.000Z", "2026-10-14T15:30:00.000Z", calendar(), "BUSINESS_HOURS")
    ).toBe(hoursToMs(2));
  });

  it("credits zero for a pause that spans only the weekend", () => {
    // Thursday 18:00 → Saturday 08:00 touches no working window.
    expect(
      elapsedClock("2026-10-15T14:30:00.000Z", "2026-10-17T04:30:00.000Z", calendar(), "BUSINESS_HOURS")
    ).toBe(0);
  });

  it("is plain subtraction in CALENDAR mode", () => {
    expect(elapsedClock(WED_0900, THU_0900, calendar(), "CALENDAR")).toBe(hoursToMs(24));
  });

  it("never returns a negative duration", () => {
    expect(elapsedClock(THU_0900, WED_0900, calendar(), "CALENDAR")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Deadlines and snapshot precedence
// ---------------------------------------------------------------------------

describe("responseDeadline / completionDeadline", () => {
  it("projects both deadlines from their own anchor", () => {
    const p = policy({ responseHours: 8, completionHours: 16 });
    expect(responseDeadline(p, WED_0900, calendar())).toBe(WED_1700);
    // Completion is anchored on acceptance, not on referral.
    expect(completionDeadline(p, WED_0900, calendar())).toBe(
      addClock(WED_0900, hoursToMs(16), calendar(), "BUSINESS_HOURS")
    );
  });

  it("returns null for an inactive or archived policy — a paused service has no obligation", () => {
    for (const status of ["inactive", "archived"] as const) {
      const off = policy({ status });
      expect(responseDeadline(off, WED_0900, calendar())).toBeNull();
      expect(completionDeadline(off, WED_0900, calendar())).toBeNull();
    }
  });

  it("still recognises a legacy row that only carries `enabled: false`", () => {
    // Rows written before the lifecycle existed must keep behaving as paused;
    // `isPolicyActive` reads `enabled` only when `status` is absent.
    const legacy = { ...policy(), status: undefined, enabled: false } as unknown as ServiceSlaPolicy;
    expect(isPolicyActive(legacy)).toBe(false);
    expect(responseDeadline(legacy, WED_0900, calendar())).toBeNull();
  });
});

describe("slaSnapshot — health precedence", () => {
  const p = policy({ responseHours: 8, warnBeforeHours: 2 });

  it("is ON_TRACK well before the deadline", () => {
    const snap = slaSnapshot({
      state: blankSla({ responseDueAt: WED_1700 }),
      policy: p,
      calendar: calendar(),
      now: "2026-10-14T06:30:00.000Z", // 10:00 local, 7h left
    });
    expect(snap.health).toBe("ON_TRACK");
    expect(snap.atRisk).toBe(false);
    expect(snap.breached).toBe(false);
  });

  it("is AT_RISK inside the warning window", () => {
    const snap = slaSnapshot({
      state: blankSla({ responseDueAt: WED_1700 }),
      policy: p,
      calendar: calendar(),
      now: "2026-10-14T12:00:00.000Z", // 15:30 local, 2h left, warn is 2h
    });
    expect(snap.health).toBe("AT_RISK");
    expect(snap.atRisk).toBe(true);
  });

  it("is BREACHED once the deadline passes, even before the sticky marker is written", () => {
    const snap = slaSnapshot({
      state: blankSla({ responseDueAt: WED_1700 }),
      policy: p,
      calendar: calendar(),
      now: "2026-10-14T14:00:00.000Z",
    });
    expect(snap.health).toBe("BREACHED");
    expect(snap.remainingMs).toBeLessThan(0);
  });

  it("keeps BREACHED sticky after the marker is written", () => {
    const state = markBreached(blankSla({ responseDueAt: WED_1700 }), "2026-10-14T14:00:00.000Z");
    const snap = slaSnapshot({ state, policy: p, calendar: calendar(), now: WED_0900 });
    expect(snap.health).toBe("BREACHED");
    expect(snap.breached).toBe(true);
  });

  it("freezes the countdown while paused", () => {
    const state = blankSla({
      responseDueAt: WED_1700,
      paused: true,
      pausedAt: "2026-10-14T11:30:00.000Z", // 15:00 local, 2h left
    });
    const snap = slaSnapshot({
      state,
      policy: p,
      calendar: calendar(),
      now: "2026-10-14T16:00:00.000Z", // long past the deadline
    });
    expect(snap.health).toBe("PAUSED");
    expect(snap.paused).toBe(true);
    expect(snap.remainingMs).toBe(hoursToMs(2));
  });

  it("reports NONE when there is no policy or no deadline", () => {
    const snap = slaSnapshot({
      state: blankSla({ responseDueAt: null }),
      policy: null,
      calendar: calendar(),
    });
    expect(snap.health).toBe("NONE");
    expect(snap.remainingMs).toBeNull();
  });

  it("judges a completed request against its completion deadline", () => {
    const state = blankSla({
      acceptedAt: WED_0900,
      completionDueAt: WED_1700,
      completedAt: "2026-10-14T12:30:00.000Z",
    });
    const met = slaSnapshot({ state, policy: p, calendar: calendar() });
    expect(met.phase).toBe("DONE");
    expect(met.health).toBe("MET");
    expect(met.done).toBe(true);

    const late = slaSnapshot({
      state: { ...state, completedAt: "2026-10-15T12:30:00.000Z" },
      policy: p,
      calendar: calendar(),
    });
    expect(late.health).toBe("MISSED");
    expect(late.breached).toBe(true);
  });

  it("judges a declined request against its response deadline", () => {
    const state = blankSla({ responseDueAt: WED_1700, declinedAt: "2026-10-14T07:30:00.000Z" });
    const snap = slaSnapshot({ state, policy: p, calendar: calendar() });
    expect(snap.phase).toBe("DONE");
    expect(snap.health).toBe("MET");
  });

  it("closes the obligation for a cancelled request that has no outcome instant", () => {
    const snap = slaSnapshot({
      state: blankSla({ responseDueAt: WED_1700 }),
      policy: p,
      calendar: calendar(),
      requestState: "CANCELLED",
    });
    expect(snap.done).toBe(true);
    expect(snap.health).toBe("NONE");
  });
});

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

describe("transition helpers", () => {
  const p = policy({ responseHours: 8, completionHours: 16 });

  it("records the first view once and never rewrites it", () => {
    const first = markViewed(blankSla(), "2026-10-14T06:00:00.000Z");
    const second = markViewed(first, "2026-10-14T07:00:00.000Z");
    expect(second.viewedAt).toBe("2026-10-14T06:00:00.000Z");
  });

  it("does not record a view after the lawyer has already responded", () => {
    const responded = markDeclined(blankSla(), "2026-10-14T06:00:00.000Z");
    expect(markViewed(responded, "2026-10-14T08:00:00.000Z").viewedAt).toBeNull();
  });

  it("acceptance closes the response phase and starts the completion clock", () => {
    const accepted = markAccepted({
      state: blankSla({ responseDueAt: WED_1700 }),
      policy: p,
      calendar: calendar(),
      at: "2026-10-14T07:30:00.000Z",
    });
    expect(slaPhase(accepted)).toBe("COMPLETION");
    expect(accepted.respondedAt).toBe("2026-10-14T07:30:00.000Z");
    expect(accepted.completionDueAt).toBe(
      addClock("2026-10-14T07:30:00.000Z", hoursToMs(16), calendar(), p.clock)
    );
    expect(activeDueAt(accepted)).toBe(accepted.completionDueAt);
  });

  it("decline stops the clock and is idempotent", () => {
    const declined = markDeclined(blankSla(), "2026-10-14T06:00:00.000Z");
    expect(declined.declinedAt).toBe("2026-10-14T06:00:00.000Z");
    expect(markDeclined(declined, "2026-10-14T09:00:00.000Z").declinedAt).toBe(
      "2026-10-14T06:00:00.000Z"
    );
    expect(slaPhase(declined)).toBe("DONE");
  });

  it("start and info-request timestamps are recorded separately", () => {
    const started = markStarted(markInfoRequested(blankSla(), THU_0900), WED_1700);
    expect(started.infoRequestedAt).toBe(THU_0900);
    expect(started.startedAt).toBe(WED_1700);
  });
});

describe("pause / resume", () => {
  const p = policy({ pauseBehavior: "PAUSE" });

  it("pauses only when the policy says PAUSE", () => {
    const keepRunning = policy({ pauseBehavior: "CONTINUE" });
    expect(pauseClock(blankSla(), keepRunning, WED_0900).paused).toBe(false);
    expect(pauseClock(blankSla(), p, WED_0900).paused).toBe(true);
  });

  it("credits only business time back to the deadlines on resume", () => {
    const state = pauseClock(
      blankSla({ responseDueAt: WED_1700, completionDueAt: WED_1700 }),
      p,
      "2026-10-14T11:30:00.000Z" // 15:00 local
    );
    const resumed = resumeClock(state, p, calendar(), "2026-10-14T15:30:00.000Z"); // 19:00 local
    // Two business hours elapsed during the pause → both deadlines move 2h.
    expect(resumed.pausedMs).toBe(hoursToMs(2));
    expect(resumed.responseDueAt).toBe("2026-10-14T15:30:00.000Z");
    expect(resumed.completionDueAt).toBe("2026-10-14T15:30:00.000Z");
    expect(resumed.paused).toBe(false);
    expect(resumed.pausedAt).toBeNull();
  });

  it("credits zero across a weekend-long pause", () => {
    const state = pauseClock(blankSla({ responseDueAt: WED_1700 }), p, "2026-10-15T14:30:00.000Z");
    const resumed = resumeClock(state, p, calendar(), "2026-10-17T04:30:00.000Z");
    expect(resumed.pausedMs).toBe(0);
    expect(resumed.responseDueAt).toBe(WED_1700);
  });

  it("resuming a clock that is not paused is a no-op", () => {
    const state = blankSla({ responseDueAt: WED_1700 });
    expect(resumeClock(state, p, calendar(), THU_0900)).toEqual(state);
  });

  it("completion clears the pause", () => {
    const state = pauseClock(blankSla(), p, WED_0900);
    const done = markCompleted(state, WED_1700);
    expect(done.paused).toBe(false);
    expect(done.pausedAt).toBeNull();
  });
});

describe("applyOverride", () => {
  it("records the previous and next instant with actor and reason", () => {
    const { state, override } = applyOverride({
      state: blankSla({ responseDueAt: WED_1700 }),
      phase: "RESPONSE",
      nextDueAt: THU_0900,
      actorId: "admin-1",
      reason: "توافق تلفنی با طرفین",
      at: "2026-10-14T08:00:00.000Z",
    });
    expect(override.previousDueAt).toBe(WED_1700);
    expect(override.nextDueAt).toBe(THU_0900);
    expect(override.actorId).toBe("admin-1");
    expect(override.phase).toBe("RESPONSE");
    expect(state.responseDueAt).toBe(THU_0900);
    expect(state.overrides).toHaveLength(1);
  });

  it("clears a sticky breach when the new deadline is still in the future", () => {
    const breached = markBreached(blankSla({ responseDueAt: WED_1700 }), "2026-10-14T14:00:00.000Z");
    const { state } = applyOverride({
      state: breached,
      phase: "RESPONSE",
      nextDueAt: "2026-10-15T17:00:00.000Z",
      actorId: "admin-1",
      reason: "تمدید رسمی",
      at: "2026-10-14T15:00:00.000Z",
    });
    expect(state.breachedAt).toBeNull();
  });

  it("keeps the breach marker when the new deadline is already in the past", () => {
    const breached = markBreached(blankSla({ responseDueAt: WED_1700 }), "2026-10-14T14:00:00.000Z");
    const { state } = applyOverride({
      state: breached,
      phase: "RESPONSE",
      nextDueAt: "2026-10-14T13:00:00.000Z",
      actorId: "admin-1",
      reason: "اصلاح به عقب",
      at: "2026-10-14T15:00:00.000Z",
    });
    expect(state.breachedAt).toBe("2026-10-14T14:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

describe("formatRemaining", () => {
  it("renders a remaining span in Persian digits", () => {
    expect(formatRemaining(hoursToMs(50))).toBe("۲ روز و ۲ ساعت باقی‌مانده");
  });

  it("renders an overdue span as lateness", () => {
    expect(formatRemaining(-hoursToMs(4))).toBe("۴ ساعت تأخیر");
  });

  it("handles minutes and the sub-minute case", () => {
    expect(formatRemaining(90_000)).toBe("۱ دقیقه باقی‌مانده");
    expect(formatRemaining(5_000)).toBe("کمتر از یک دقیقه باقی‌مانده");
  });

  it("renders an em dash for an absent duration", () => {
    expect(formatRemaining(null)).toBe("—");
    expect(formatRemaining(undefined)).toBe("—");
  });
});
