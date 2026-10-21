// ============================================================
// LEGALIR — Zone-aware display formatting for the admin panel
// ============================================================
// `toPersianDate` renders in the VIEWER's zone. When an operator picks a
// different display zone in Settings, the panel must render in THAT zone
// instead — while the stored value stays the same UTC instant. These helpers
// do exactly that conversion and nothing else: they never produce a timestamp,
// never round a stored value, and never touch the server clock.
// ============================================================

import { toPersianDate } from "@/lib/persian-utils";

/**
 * Format an instant (ISO-8601 UTC or Date) in a specific IANA zone, in the
 * Persian calendar. Falls back to the viewer's zone only when `timeZone` is
 * not resolvable, so a bad saved value degrades instead of throwing.
 */
export function toPersianDateInZone(
  date: Date | number | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const base: Intl.DateTimeFormatOptions = { ...(options ?? {}) };
  const withZone: Intl.DateTimeFormatOptions = { ...base, timeZone };
  try {
    return toPersianDate(date, withZone);
  } catch {
    return toPersianDate(date, base);
  }
}

/** Date + time (hour:minute) of an instant in a zone, Persian calendar. */
export function toPersianDateTimeInZone(
  date: Date | number | string,
  timeZone: string
): string {
  return toPersianDateInZone(date, timeZone, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Time-of-day only (hour:minute:second) in a zone — used by live clocks. */
export function toClockInZone(date: Date | number | string, timeZone: string): string {
  return toPersianDateInZone(date, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
