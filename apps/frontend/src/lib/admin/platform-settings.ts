// ============================================================
// LEGALIR — Platform display settings (server-only)
// ============================================================
// Two DIFFERENT things live near each other here, and the distinction is the
// whole point of this module:
//
//   • the SERVER timezone — where the process runs. It is discovered from the
//     runtime, never configured from the panel, and it is not used to store
//     anything: every timestamp in the store stays an ISO-8601 UTC instant.
//   • the DISPLAY timezone — a presentation preference for the admin panel.
//     Changing it converts instants for reading; it can never move a stored
//     value or a deadline calculation.
//
// The working-calendar timezone (lib/lawyer-portal/store.ts) is a THIRD,
// separate setting: it governs SLA arithmetic on the server. This module must
// never be used for that, and this file deliberately does not touch it.
//
// The store is a single row in `platform_settings`. An absent row means "the
// default", so a fresh install has a working panel without a seed step.
// ============================================================

import { readTable, writeTable } from "@/lib/db";

const TABLE = "platform_settings";
const ROW_ID = "display";

/** What the panel shows before an operator ever saves a choice. */
export const DEFAULT_DISPLAY_TIMEZONE = "Asia/Tehran";

export interface PlatformDisplaySettings {
  /** IANA zone used to RENDER timestamps in the admin panel. */
  displayTimezone: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** Where the server's own zone came from — stated so the UI can be honest. */
export type ServerTimeZoneSource = "TZ" | "runtime";

/** Every instant the platform stores uses this representation. */
export const TIMESTAMP_STORAGE_FORMAT = "ISO-8601 (UTC)" as const;

// ---------------------------------------------------------------------------
// Time zone validation + labels
// ---------------------------------------------------------------------------

/**
 * True when `tz` is an IANA zone the runtime can resolve. `Intl` is the only
 * authority here — a hand-maintained list would drift and would happily accept
 * a zone name that formats nothing.
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The offset of `timeZone` at `at`, worded as «UTC+03:30». Derived from `Intl`
 * so a zone that still observes DST is reported for the actual instant, not a
 * fixed constant.
 */
export function offsetLabelFa(timeZone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // "GMT+03:30" → "UTC+03:30"; bare "GMT"/"GMT+00:00" → "UTC".
    const utc = name.replace(/^GMT/, "UTC");
    return utc === "UTC+00:00" || utc === "UTC-00:00" ? "UTC" : utc || "UTC";
  } catch {
    return "—";
  }
}

/**
 * The zones offered in the panel. A short, curated list beats a 400-entry
 * native select: these are the zones an Iranian legal platform actually
 * operates around. The stored value and the server zone are appended by
 * `timeZoneOptions()` when they fall outside this list, so the select can
 * always represent the truth.
 */
const COMMON_TIMEZONES: { value: string; labelFa: string }[] = [
  { value: "Asia/Tehran", labelFa: "تهران (ایران)" },
  { value: "UTC", labelFa: "UTC (زمان جهانی)" },
  { value: "Asia/Dubai", labelFa: "دبی" },
  { value: "Asia/Istanbul", labelFa: "استانبول" },
  { value: "Asia/Baghdad", labelFa: "بغداد" },
  { value: "Asia/Kabul", labelFa: "کابل" },
  { value: "Asia/Baku", labelFa: "باکو" },
  { value: "Europe/London", labelFa: "لندن" },
  { value: "Europe/Berlin", labelFa: "برلین" },
  { value: "Europe/Paris", labelFa: "پاریس" },
  { value: "America/New_York", labelFa: "نیویورک" },
  { value: "America/Los_Angeles", labelFa: "لس‌آنجلس" },
  { value: "Asia/Tokyo", labelFa: "توکیو" },
];

export interface TimeZoneOption {
  value: string;
  labelFa: string;
  offsetFa: string;
}

/**
 * The selectable zones with their CURRENT offset. `extra` (the stored value)
 * is merged in so a previously saved zone outside the curated list stays
 * selectable instead of silently reverting on the next save.
 */
export function timeZoneOptions(extra: (string | null)[] = []): TimeZoneOption[] {
  const at = new Date();
  const seen = new Set<string>();
  const out: TimeZoneOption[] = [];
  const push = (value: string, labelFa: string) => {
    if (!value || seen.has(value) || !isValidTimeZone(value)) return;
    seen.add(value);
    out.push({ value, labelFa, offsetFa: offsetLabelFa(value, at) });
  };
  for (const z of COMMON_TIMEZONES) push(z.value, z.labelFa);
  for (const z of extra) if (z) push(z, z);
  return out;
}

// ---------------------------------------------------------------------------
// Server time zone (discovered, never configured)
// ---------------------------------------------------------------------------

/**
 * The zone the Node process actually runs in. `process.env.TZ` is reported as
 * the source only when it is set AND resolvable; otherwise the runtime's own
 * resolution is used. This is what the operator sees labelled «سرور» — it is
 * never the panel preference.
 */
export function serverTimeZone(): { timeZone: string; source: ServerTimeZoneSource } {
  const env = process.env["TZ"];
  if (env && isValidTimeZone(env)) return { timeZone: env, source: "TZ" };
  try {
    return {
      timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      source: "runtime",
    };
  } catch {
    return { timeZone: "UTC", source: "runtime" };
  }
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

/** The stored display settings, or the default before one is saved. */
export function getDisplaySettings(): PlatformDisplaySettings {
  const row = readTable<PlatformDisplaySettings & { id?: string }>(TABLE).find(
    (r) => r.id === ROW_ID
  );
  if (!row) {
    return { displayTimezone: DEFAULT_DISPLAY_TIMEZONE, updatedAt: "", updatedBy: null };
  }
  return {
    // A stored value that no longer resolves is ignored rather than echoed —
    // the panel keeps rendering in the default instead of failing to format.
    displayTimezone: isValidTimeZone(row.displayTimezone)
      ? row.displayTimezone
      : DEFAULT_DISPLAY_TIMEZONE,
    updatedAt: row.updatedAt ?? "",
    updatedBy: row.updatedBy ?? null,
  };
}

export interface SaveDisplaySettingsResult {
  before: PlatformDisplaySettings;
  after: PlatformDisplaySettings;
}

/**
 * Persist the display timezone. Returns the before/after pair so the caller can
 * write ONE audit entry carrying both sides; an invalid zone is rejected with a
 * stable error code (mapped to a Persian message by the API layer).
 */
export function saveDisplaySettings(
  input: { displayTimezone: string },
  actorId: string
): SaveDisplaySettingsResult | { error: "INVALID_TIMEZONE" } {
  const tz = input.displayTimezone.trim();
  if (!isValidTimeZone(tz)) return { error: "INVALID_TIMEZONE" };

  const before = getDisplaySettings();
  const after: PlatformDisplaySettings = {
    displayTimezone: tz,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  };

  const rows = readTable<PlatformDisplaySettings & { id: string }>(TABLE);
  const idx = rows.findIndex((r) => r.id === ROW_ID);
  const next = { id: ROW_ID, ...after };
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeTable(TABLE, rows);

  return { before, after };
}
