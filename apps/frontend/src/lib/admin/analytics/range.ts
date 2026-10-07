// ============================================================
// LEGALIR — Analytics: window & range resolution (server-only)
// ============================================================
// Pure geometry — no database access. Turns an operator's range choice
// (today / 7d / 30d / current Jalali month / custom) into two ISO
// instants plus the equal-length comparison window that precedes it.
//
// DAY BOUNDARIES ARE TEHRAN. A «امروز» window starts at Tehran midnight,
// not UTC midnight, and the day buckets on every chart are keyed by the
// Tehran civil date. This is what a Persian operator expects, and it keeps
// the axis labels (Jalali) aligned with the buckets they describe.
// ============================================================

import type { AnalyticsRangeKey, AnalyticsWindowInfo, JalaliParts } from "@legalir/types";
import { isoToJalaliParts, jalaliMonthRangeIso } from "@/lib/persian-utils";

/** Tehran is UTC+03:30 year-round (Iran has had no DST since 2022). */
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** ISO instant of Tehran-midnight on the Tehran day that contains `d`. */
export function tehranDayStartIso(d: Date): string {
  const shifted = d.getTime() + TEHRAN_OFFSET_MS;
  const startShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(startShifted - TEHRAN_OFFSET_MS).toISOString();
}

/** ISO instant of the last millisecond of the Tehran day `dayKey` (YYYY-MM-DD). */
export function tehranDayEndIso(dayKey: string): string {
  return new Date(`${dayKey}T23:59:59.999+03:30`).toISOString();
}

/** ISO instant of Tehran-midnight for a `YYYY-MM-DD` Tehran calendar day. */
export function tehranDayStartFromKey(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00+03:30`).toISOString();
}

/** The Tehran civil day key (YYYY-MM-DD) of an ISO instant. */
export function tehranDayKey(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + TEHRAN_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * A `YYYY-MM-DD` Tehran day key shifted by `delta` days. Used to align the
 * previous window's daily series index-for-index with the current window's
 * (both are the same `rangeDays` long), so a previous-period overlay compares
 * like-for-like: day i of this window against the day exactly `rangeDays`
 * earlier — which is day i of the previous window.
 */
export function shiftDayKey(dayKey: string, delta: number): string {
  const base = new Date(`${dayKey}T00:00:00Z`).getTime() + delta * DAY_MS;
  return new Date(base).toISOString().slice(0, 10);
}

export interface ResolveRangeInput {
  preset: AnalyticsRangeKey;
  /** Used by the rolling presets (defaults applied per preset). */
  rangeDays?: number;
  /** For `custom`: inclusive YYYY-MM-DD bounds. */
  from?: string | null;
  to?: string | null;
  /** Injectable "now" for deterministic tests. */
  now?: Date;
}

export interface ResolvedRange {
  preset: AnalyticsRangeKey;
  rangeDays: number;
  fromIso: string;
  toIso: string;
  prevFromIso: string;
  prevToIso: string;
}

/**
 * Resolve a preset (or explicit custom bounds) into concrete ISO instants.
 * The comparison window is always the equal-length span immediately before
 * `fromIso`, so a trend is only ever computed against a genuinely comparable
 * period of the same duration.
 */
export function resolveRange(input: ResolveRangeInput): ResolvedRange {
  const now = input.now ?? new Date();

  if (input.preset === "custom" && input.from && input.to) {
    const fromIso = tehranDayStartFromKey(input.from);
    const toIso = tehranDayEndIso(input.to);
    return withPrevious("custom", fromIso, toIso);
  }

  if (input.preset === "jalali_month") {
    const { jy, jm } = isoToJalaliParts(now);
    const { fromIso: fromKey, toIso: toKey } = jalaliMonthRangeIso(jy, jm);
    const fromIso = tehranDayStartFromKey(fromKey);
    // A Jalali month that includes today must not run into the future.
    const monthEndIso = tehranDayEndIso(toKey);
    const toIso = monthEndIso > now.toISOString() ? now.toISOString() : monthEndIso;
    return withPrevious("jalali_month", fromIso, toIso);
  }

  const days =
    input.rangeDays ??
    (input.preset === "today" ? 1 : input.preset === "7d" ? 7 : 30);
  const fromIso = tehranDayStartIso(new Date(now.getTime() - (days - 1) * DAY_MS));
  const toIso = now.toISOString();
  return withPrevious(input.preset, fromIso, toIso, days);
}

/** Attach the immediately-preceding equal-length window. */
function withPrevious(
  preset: AnalyticsRangeKey,
  fromIso: string,
  toIso: string,
  forcedDays?: number
): ResolvedRange {
  const spanMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
  const rangeDays = forcedDays ?? Math.max(1, Math.round(spanMs / DAY_MS));
  return {
    preset,
    rangeDays,
    fromIso,
    toIso,
    prevFromIso: new Date(new Date(fromIso).getTime() - spanMs).toISOString(),
    prevToIso: fromIso,
  };
}

/**
 * The Tehran day keys spanned by [fromIso, toIso], oldest first. Used to
 * build a zero-filled daily series so a day with no activity is an explicit
 * zero bar — never a missing gap that reads as "no data".
 */
export function tehranDayBuckets(fromIso: string, toIso: string): string[] {
  const start = tehranDayKey(fromIso);
  const end = tehranDayKey(toIso);
  const out: string[] = [];
  let cursor = new Date(tehranDayStartFromKey(start));
  const endMs = new Date(tehranDayStartFromKey(end)).getTime();
  // Guard against an inverted or absurd range.
  let guard = 0;
  while (cursor.getTime() <= endMs && guard < 400) {
    out.push(tehranDayKey(cursor.toISOString()));
    cursor = new Date(cursor.getTime() + DAY_MS);
    guard += 1;
  }
  return out;
}

/**
 * Add the display/quality fields that need data knowledge: whether the
 * previous window is genuinely comparable (the system must hold data
 * reaching back to `prevFromIso`) and the Jalali parts of both bounds.
 */
export function toWindowInfo(
  resolved: ResolvedRange,
  earliestDataIso: string | null
): AnalyticsWindowInfo {
  const comparable =
    earliestDataIso != null && earliestDataIso <= resolved.prevFromIso;
  return {
    ...resolved,
    fromJalali: isoToJalaliParts(resolved.fromIso) as JalaliParts,
    toJalali: isoToJalaliParts(resolved.toIso) as JalaliParts,
    comparable,
  };
}

/** True when `iso` falls inside [from, to) — the standard half-open test. */
export function withinWindow(iso: string | undefined | null, fromIso: string, toIso: string): boolean {
  return Boolean(iso && iso >= fromIso && iso < toIso);
}

/**
 * Percent change of `current` vs `previous`, or `null` when no honest
 * comparison exists (no previous window, or a zero base that would yield a
 * meaningless "+∞"). Mirrors the existing overview helper so the whole
 * admin panel reports trends the same way.
 */
export function changePct(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
