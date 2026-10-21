// ============================================================
// LEGALIR — SLA engine (pure, dependency-free)
// ============================================================
// Everything here is a pure function over the declarative policy types in
// `@legalir/types`. No IO: the store (`./store.ts`) is the only writer.
//
// Two clocks exist:
//   CALENDAR       — wall-clock hours; nights, weekends and holidays count.
//   BUSINESS_HOURS — only minutes inside `PlatformWorkCalendar.hours` on
//                    working days count.
//
// Deadlines are stored as absolute ISO instants, so `remainingMs` is always
// simply `dueAt - now`. The working-hours math happens once, when the
// deadline is computed (`addClock`) or extended (`resumeClock`).
//
// Iran has observed no DST since 2022, but the timezone helpers below are
// written generically so a regulator change needs no code edit.
// ============================================================

import {
  DEFAULT_SLA_SERVICE_KEY,
  SLA_HEALTH_FA,
  type LegalRequestSla,
  type LegalRequestState,
  type PlatformWorkCalendar,
  type ServiceSlaPolicy,
  type SlaClockMode,
  type SlaHealth,
  type SlaOverride,
  type SlaPhase,
  type SlaSnapshot,
} from "@legalir/types";
import { toPersianDigits } from "../persian-utils";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Fallback calendar used before an operator has saved one. Saturday–Wednesday,
 * 09:00–17:00 Tehran, no holidays. The admin settings page edits the stored
 * copy; this value is only the seed and the read-time default.
 */
export const DEFAULT_WORK_CALENDAR: PlatformWorkCalendar = {
  timezone: "Asia/Tehran",
  // 0 = Saturday … 6 = Friday (Iranian week starts Saturday).
  workingDays: [0, 1, 2, 3, 4],
  hours: { startTime: "09:00", endTime: "17:00" },
  holidays: [],
  updatedAt: "1970-01-01T00:00:00.000Z",
  updatedBy: null,
};

/** The policy created for a service an operator has not configured yet. */
export function defaultPolicy(serviceKey: string, labelFa: string): ServiceSlaPolicy {
  return {
    id: `sla-${serviceKey}`,
    serviceKey,
    labelFa,
    audience: "both",
    priority: "NORMAL",
    responseHours: 24,
    completionHours: 72,
    clock: "BUSINESS_HOURS",
    pauseBehavior: "PAUSE",
    warnBeforeHours: 6,
    status: "active",
    updatedAt: "1970-01-01T00:00:00.000Z",
    updatedBy: null,
  };
}

/**
 * Whether a policy starts a NEW clock.
 *
 * Rows written before the lifecycle existed carry `enabled` and no `status`;
 * they are read as active only when `enabled !== false`, so an old disabled
 * row keeps behaving as disabled without a migration rewriting the table.
 */
export function isPolicyActive(
  policy: ServiceSlaPolicy | null | undefined
): policy is ServiceSlaPolicy {
  if (!policy) return false;
  const legacy = policy as ServiceSlaPolicy & { enabled?: boolean };
  if (policy.status) return policy.status === "active";
  return legacy.enabled !== false;
}

// ---------------------------------------------------------------------------
// Timezone primitives
// ---------------------------------------------------------------------------

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface Ymd {
  year: number;
  month: number;
  day: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** The civil (wall-clock) time in `timeZone` for an absolute instant. */
function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const out: ZonedParts = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    const n = Number(part.value);
    if (!Number.isFinite(n)) continue;
    switch (part.type) {
      case "year":
        out.year = n;
        break;
      case "month":
        out.month = n;
        break;
      case "day":
        out.day = n;
        break;
      case "hour":
        out.hour = n;
        break;
      case "minute":
        out.minute = n;
        break;
      case "second":
        out.second = n;
        break;
    }
  }
  return out;
}

/** The UTC offset of `timeZone` at `instantMs`, in milliseconds east of UTC. */
function offsetMs(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The absolute instant of a civil time in `timeZone`. The second pass handles
 * an offset change (DST boundary) between the naive guess and the answer.
 */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = naive - offsetMs(naive, timeZone);
  const second = naive - offsetMs(first, timeZone);
  return second;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateKey(p: ZonedParts | Ymd): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function addDaysYmd(y: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(y.year, y.month - 1, y.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** `0 = Saturday … 6 = Friday`, the index `workingDays` uses. */
function iranianDayOfWeek(y: Ymd): number {
  const jsDow = new Date(Date.UTC(y.year, y.month - 1, y.day)).getUTCDay();
  return (jsDow + 1) % 7;
}

function parseHm(value: string): [number, number] {
  const [h, m] = value.split(":").map((v) => Number(v));
  return [Number.isFinite(h) ? h! : 0, Number.isFinite(m) ? m! : 0];
}

function windowBounds(calendar: PlatformWorkCalendar, p: Ymd): { start: number; end: number } {
  const [sh, sm] = parseHm(calendar.hours.startTime);
  const [eh, em] = parseHm(calendar.hours.endTime);
  const start = zonedToUtc(p.year, p.month, p.day, sh, sm, calendar.timezone);
  const end = zonedToUtc(p.year, p.month, p.day, eh, em, calendar.timezone);
  return { start, end };
}

function isWorkingDay(calendar: PlatformWorkCalendar, p: Ymd): boolean {
  if (!calendar.workingDays.includes(iranianDayOfWeek(p))) return false;
  if (calendar.holidays.includes(dateKey(p))) return false;
  return true;
}

function calendarUsable(calendar: PlatformWorkCalendar): boolean {
  if (calendar.workingDays.length === 0) return false;
  const [sh, sm] = parseHm(calendar.hours.startTime);
  const [eh, em] = parseHm(calendar.hours.endTime);
  return eh * 60 + em > sh * 60 + sm;
}

// ---------------------------------------------------------------------------
// Clock math
// ---------------------------------------------------------------------------

/**
 * Add `durationMs` of *clock time* to an instant.
 * CALENDAR: plain wall-clock addition. BUSINESS_HOURS: walks forward window by
 * window, skipping non-working days. A calendar with no usable window degrades
 * to wall-clock so a broken config never freezes a deadline.
 */
export function addClock(
  fromIso: string,
  durationMs: number,
  calendar: PlatformWorkCalendar,
  mode: SlaClockMode
): string {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return fromIso;
  if (durationMs <= 0) return new Date(from).toISOString();
  if (mode === "CALENDAR" || !calendarUsable(calendar)) {
    return new Date(from + durationMs).toISOString();
  }

  let remaining = durationMs;
  let cursor = from;
  for (let guard = 0; guard < 3700 && remaining > 0; guard++) {
    const parts = zonedParts(cursor, calendar.timezone);
    const today: Ymd = { year: parts.year, month: parts.month, day: parts.day };
    if (isWorkingDay(calendar, today)) {
      const { start, end } = windowBounds(calendar, today);
      const usableFrom = Math.max(cursor, start);
      if (usableFrom < end) {
        const available = end - usableFrom;
        if (available >= remaining) return new Date(usableFrom + remaining).toISOString();
        remaining -= available;
      }
    }
    const next = addDaysYmd(today, 1);
    cursor = zonedToUtc(next.year, next.month, next.day, 0, 0, calendar.timezone);
  }
  return new Date(cursor).toISOString();
}

/**
 * How much *clock time* elapsed between two instants. Used to credit a pause
 * back to the deadline: in BUSINESS_HOURS mode a pause that spans the weekend
 * credits zero, exactly as it consumed zero business minutes.
 */
export function elapsedClock(
  fromIso: string,
  toIso: string,
  calendar: PlatformWorkCalendar,
  mode: SlaClockMode
): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  if (mode === "CALENDAR" || !calendarUsable(calendar)) return to - from;

  let total = 0;
  let cursor = from;
  for (let guard = 0; guard < 3700 && cursor < to; guard++) {
    const parts = zonedParts(cursor, calendar.timezone);
    const today: Ymd = { year: parts.year, month: parts.month, day: parts.day };
    if (isWorkingDay(calendar, today)) {
      const { start, end } = windowBounds(calendar, today);
      const overlapsFrom = Math.max(cursor, start);
      const overlapsTo = Math.min(to, end);
      if (overlapsTo > overlapsFrom) total += overlapsTo - overlapsFrom;
    }
    const next = addDaysYmd(today, 1);
    cursor = zonedToUtc(next.year, next.month, next.day, 0, 0, calendar.timezone);
  }
  return total;
}

export function hoursToMs(hours: number): number {
  return Math.max(0, hours) * 3_600_000;
}

// ---------------------------------------------------------------------------
// Deadline projection
// ---------------------------------------------------------------------------

export function responseDeadline(
  policy: ServiceSlaPolicy,
  assignedAt: string,
  calendar: PlatformWorkCalendar
): string | null {
  if (!isPolicyActive(policy)) return null;
  return addClock(assignedAt, hoursToMs(policy.responseHours), calendar, policy.clock);
}

export function completionDeadline(
  policy: ServiceSlaPolicy,
  acceptedAt: string,
  calendar: PlatformWorkCalendar
): string | null {
  if (!isPolicyActive(policy)) return null;
  return addClock(acceptedAt, hoursToMs(policy.completionHours), calendar, policy.clock);
}

/** The blank state written at referral. */
export function initializeSla(params: {
  policy: ServiceSlaPolicy | null;
  assignedAt: string;
  calendar: PlatformWorkCalendar;
}): LegalRequestSla {
  const { policy, assignedAt, calendar } = params;
  return {
    policyId: policy?.id ?? null,
    serviceKey: policy?.serviceKey ?? DEFAULT_SLA_SERVICE_KEY,
    assignedAt,
    responseDueAt: policy ? responseDeadline(policy, assignedAt, calendar) : null,
    completionDueAt: null,
    viewedAt: null,
    respondedAt: null,
    acceptedAt: null,
    declinedAt: null,
    startedAt: null,
    infoRequestedAt: null,
    completedAt: null,
    paused: false,
    pausedAt: null,
    pausedMs: 0,
    breachedAt: null,
    overrides: [],
  };
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export function slaPhase(state: LegalRequestSla): SlaPhase {
  if (state.completedAt || state.declinedAt) return "DONE";
  if (state.acceptedAt) return "COMPLETION";
  return "RESPONSE";
}

function isTerminalRequestState(state: LegalRequestState | null | undefined): boolean {
  return state === "CLOSED" || state === "CANCELLED";
}

const EMPTY_SNAPSHOT: SlaSnapshot = {
  phase: "RESPONSE",
  health: "NONE",
  dueAt: null,
  remainingMs: null,
  paused: false,
  healthFa: SLA_HEALTH_FA.NONE,
  atRisk: false,
  breached: false,
  done: false,
};

/**
 * The one place the health precedence is decided:
 *   DONE phases  → MET / MISSED (judged against the phase's own deadline)
 *   breachedAt   → BREACHED (sticky even if a later pause would stop the clock)
 *   paused       → PAUSED (remaining frozen at the pause instant)
 *   no policy    → NONE
 *   past due     → BREACHED
 *   inside warn  → AT_RISK
 *   else         → ON_TRACK
 */
export function slaSnapshot(params: {
  state: LegalRequestSla | null;
  policy: ServiceSlaPolicy | null;
  calendar: PlatformWorkCalendar;
  requestState?: LegalRequestState | null;
  now?: string;
}): SlaSnapshot {
  const { state, policy, requestState } = params;
  if (!state) return EMPTY_SNAPSHOT;

  const nowMs = Date.parse(params.now ?? new Date().toISOString());
  const phase = slaPhase(state);

  // Finished: judge the outcome instant against the deadline of that phase.
  const outcomeAt = state.completedAt ?? state.declinedAt;
  if (outcomeAt) {
    const outcomeDue = state.completedAt ? state.completionDueAt : state.responseDueAt;
    if (!outcomeDue || !isPolicyActive(policy)) {
      return { ...EMPTY_SNAPSHOT, phase: "DONE", done: true };
    }
    const met = Date.parse(outcomeAt) <= Date.parse(outcomeDue);
    const remainingMs = Date.parse(outcomeDue) - Date.parse(outcomeAt);
    return {
      phase: "DONE",
      health: met ? "MET" : "MISSED",
      dueAt: outcomeDue,
      remainingMs,
      paused: false,
      healthFa: SLA_HEALTH_FA[met ? "MET" : "MISSED"],
      atRisk: false,
      breached: !met,
      done: true,
    };
  }

  // Terminal without a delivery/decline instant (cancelled): the obligation
  // ends with the request, so there is nothing left to judge.
  if (isTerminalRequestState(requestState)) {
    return { ...EMPTY_SNAPSHOT, phase: "DONE", done: true };
  }

  const dueAt = phase === "COMPLETION" ? state.completionDueAt : state.responseDueAt;
  const paused = phase !== "DONE" && state.paused;
  const referenceMs = paused && state.pausedAt ? Date.parse(state.pausedAt) : nowMs;
  const remainingMs = dueAt ? Date.parse(dueAt) - referenceMs : null;

  if (!isPolicyActive(policy) || !dueAt) {
    return {
      ...EMPTY_SNAPSHOT,
      phase,
      paused,
      remainingMs,
      healthFa: SLA_HEALTH_FA.NONE,
    };
  }

  const warnMs = hoursToMs(policy.warnBeforeHours);

  if (state.breachedAt) {
    return {
      phase,
      health: "BREACHED",
      dueAt,
      remainingMs,
      paused,
      healthFa: SLA_HEALTH_FA.BREACHED,
      atRisk: false,
      breached: true,
      done: false,
    };
  }

  if (paused) {
    return {
      phase,
      health: "PAUSED",
      dueAt,
      remainingMs,
      paused: true,
      healthFa: SLA_HEALTH_FA.PAUSED,
      atRisk: remainingMs !== null && remainingMs > 0 && remainingMs <= warnMs,
      breached: false,
      done: false,
    };
  }

  if (remainingMs !== null && remainingMs <= 0) {
    return {
      phase,
      health: "BREACHED",
      dueAt,
      remainingMs,
      paused: false,
      healthFa: SLA_HEALTH_FA.BREACHED,
      atRisk: false,
      breached: true,
      done: false,
    };
  }

  const atRisk = remainingMs !== null && remainingMs <= warnMs;
  return {
    phase,
    health: atRisk ? "AT_RISK" : "ON_TRACK",
    dueAt,
    remainingMs,
    paused: false,
    healthFa: SLA_HEALTH_FA[atRisk ? "AT_RISK" : "ON_TRACK"],
    atRisk,
    breached: false,
    done: false,
  };
}

/** Short Persian countdown, e.g. «۲ روز و ۳ ساعت باقی‌مانده» / «۴ ساعت تأخیر». */
export function formatRemaining(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const overdue = ms < 0;
  const minutes = Math.floor(Math.abs(ms) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${toPersianDigits(days)} روز`);
  if (hours > 0) parts.push(`${toPersianDigits(hours)} ساعت`);
  if (days === 0 && hours === 0 && mins > 0) parts.push(`${toPersianDigits(mins)} دقیقه`);
  const body = parts.join(" و ") || "کمتر از یک دقیقه";
  return overdue ? `${body} تأخیر` : `${body} باقی‌مانده`;
}

// ---------------------------------------------------------------------------
// Transitions (immutable)
// ---------------------------------------------------------------------------

function shift(iso: string | null, ms: number): string | null {
  if (!iso || ms === 0) return iso;
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function markViewed(state: LegalRequestSla, at: string): LegalRequestSla {
  if (state.viewedAt || state.respondedAt) return state;
  return { ...state, viewedAt: at };
}

/**
 * Acceptance closes the response clock and starts the completion clock. A
 * request that is paused at acceptance stays paused: a later resume extends
 * the fresh completion deadline by the credited pause.
 */
export function markAccepted(params: {
  state: LegalRequestSla;
  policy: ServiceSlaPolicy | null;
  calendar: PlatformWorkCalendar;
  at: string;
}): LegalRequestSla {
  const { state, policy, calendar, at } = params;
  return {
    ...state,
    respondedAt: state.respondedAt ?? at,
    acceptedAt: at,
    declinedAt: null,
    completionDueAt: policy ? completionDeadline(policy, at, calendar) : null,
  };
}

export function markDeclined(state: LegalRequestSla, at: string): LegalRequestSla {
  if (state.declinedAt) return state;
  return {
    ...state,
    respondedAt: state.respondedAt ?? at,
    declinedAt: at,
    paused: false,
    pausedAt: null,
  };
}

export function markStarted(state: LegalRequestSla, at: string): LegalRequestSla {
  if (state.startedAt) return state;
  return { ...state, startedAt: at };
}

export function markInfoRequested(state: LegalRequestSla, at: string): LegalRequestSla {
  return { ...state, infoRequestedAt: at };
}

/** Stops the clock while the request waits on the client, when the policy says so. */
export function pauseClock(
  state: LegalRequestSla,
  policy: ServiceSlaPolicy | null,
  at: string
): LegalRequestSla {
  if (!isPolicyActive(policy) || policy.pauseBehavior !== "PAUSE") return state;
  if (state.paused || state.completedAt || state.declinedAt) return state;
  return { ...state, paused: true, pausedAt: at };
}

/** Credits the paused clock time back to both deadlines and resumes. */
export function resumeClock(
  state: LegalRequestSla,
  policy: ServiceSlaPolicy | null,
  calendar: PlatformWorkCalendar,
  at: string
): LegalRequestSla {
  if (!state.paused || !state.pausedAt) return state;
  const extra = elapsedClock(state.pausedAt, at, calendar, policy?.clock ?? "BUSINESS_HOURS");
  return {
    ...state,
    paused: false,
    pausedAt: null,
    pausedMs: state.pausedMs + extra,
    responseDueAt: shift(state.responseDueAt, extra),
    completionDueAt: shift(state.completionDueAt, extra),
  };
}

export function markCompleted(state: LegalRequestSla, at: string): LegalRequestSla {
  if (state.completedAt) return state;
  return { ...state, completedAt: at, paused: false, pausedAt: null };
}

/** Sticky breach marker written by the store the first time a deadline is crossed. */
export function markBreached(state: LegalRequestSla, at: string): LegalRequestSla {
  if (state.breachedAt) return state;
  return { ...state, breachedAt: at };
}

/**
 * An admin deadline change. Records who/when/why plus the replaced value, and
 * clears a breach marker when the new deadline is still in the future.
 */
export function applyOverride(params: {
  state: LegalRequestSla;
  phase: SlaPhase;
  nextDueAt: string | null;
  actorId: string;
  reason: string;
  at: string;
}): { state: LegalRequestSla; override: SlaOverride } {
  const { state, phase, nextDueAt, actorId, reason, at } = params;
  const previousDueAt = phase === "COMPLETION" ? state.completionDueAt : state.responseDueAt;
  const override: SlaOverride = { at, actorId, reason, previousDueAt, nextDueAt, phase };
  const next: LegalRequestSla = { ...state, overrides: [...state.overrides, override] };
  if (phase === "COMPLETION") next.completionDueAt = nextDueAt;
  else if (phase === "RESPONSE") next.responseDueAt = nextDueAt;
  if (nextDueAt && Date.parse(nextDueAt) > Date.parse(at)) next.breachedAt = null;
  return { state: next, override };
}

/** The deadline the current phase is judged against. */
export function activeDueAt(state: LegalRequestSla): string | null {
  return slaPhase(state) === "COMPLETION" ? state.completionDueAt : state.responseDueAt;
}

export type { SlaHealth, SlaPhase, SlaSnapshot };
