// ============================================================
// LEGALIR — Admin · discovery intake statistics
// ============================================================
// Pure aggregation over the `discovery` records the path-discovery flow
// persisted on legal requests. It is deliberately free of I/O so the numbers
// an operator reads on /admin/discovery are unit-testable and can never drift
// from the rows they were derived from.
//
// The stored record separates what the USER stated from what the SYSTEM
// inferred, and these statistics preserve that split: `explicitIntent` counts
// the users who arrived already knowing what they wanted, while `byIntent`
// counts the engine's ranking and the user's actual choice *separately* — a
// recommendation is never reported as a selection, and a `rules` degradation
// is never reported as a model answer.
// ============================================================

import type { DiscoveryIntent, LegalRequestDiscovery } from "@legalir/types";
import { DISCOVERY_INTENTS } from "@/lib/intake/discovery";

/** The smallest shape this module needs from a persisted request row. */
export interface DiscoveryStatsRow {
  state?: string;
  discovery?: LegalRequestDiscovery;
}

export interface DiscoveryIntentStat {
  intent: DiscoveryIntent;
  /** How often the engine ranked this path anywhere in its list. */
  recommended: number;
  /** How often the engine ranked it first («پیشنهاد اصلی»). */
  primary: number;
  /** How often the user actually chose it. */
  chosen: number;
}

export interface DiscoveryCountStat {
  key: string;
  count: number;
}

export interface DiscoveryStats {
  /** Requests that went through the discovery flow (carry a `discovery` record). */
  total: number;
  /** Provenance split — how the structured analysis was produced. */
  bySource: { ai: number; rules: number };
  /** Mean confidence (0–100) over the analyses that estimated one, or null. */
  avgConfidence: number | null;
  /** Requests where the engine flagged a likely need for a human lawyer. */
  needsLawyer: number;
  /** Requests that carried an attached document. */
  withDocument: number;
  /** Requests where the user arrived with an explicit help-type pick. */
  explicitIntent: number;
  /** Per-intent ranking + selection counts, in the engine's canonical order. */
  byIntent: DiscoveryIntentStat[];
  /** Inferred legal-area distribution (the engine's guess, not the user's pick). */
  byCategory: DiscoveryCountStat[];
  /** Workflow-state distribution of the discovery requests. */
  byState: DiscoveryCountStat[];
}

/** True when the request carries a usable discovery record. */
export function hasDiscovery(row: DiscoveryStatsRow): boolean {
  return Boolean(row.discovery && row.discovery.paths.length > 0);
}

/**
 * Aggregate the discovery records across a set of request rows.
 *
 * Rows without a record are ignored entirely (they never went through the
 * flow), so the denominators here always describe the discovery cohort — an
 * operator is never shown "0 confidence" for requests that simply have no
 * analysis.
 */
export function buildDiscoveryStats(rows: DiscoveryStatsRow[]): DiscoveryStats {
  const records = rows.map((r) => r.discovery).filter((d): d is LegalRequestDiscovery => Boolean(d));

  const byIntent: DiscoveryIntentStat[] = DISCOVERY_INTENTS.map((intent) => ({
    intent: intent as DiscoveryIntent,
    recommended: 0,
    primary: 0,
    chosen: 0,
  }));
  const intentIndex = new Map(byIntent.map((s) => [s.intent, s]));

  const categoryCounts = new Map<string, number>();
  const stateCounts = new Map<string, number>();

  let ai = 0;
  let rules = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  let needsLawyer = 0;
  let withDocument = 0;
  let explicitIntent = 0;

  for (const record of records) {
    if (record.source === "ai") ai += 1;
    else rules += 1;

    if (typeof record.confidence === "number" && Number.isFinite(record.confidence)) {
      confidenceSum += record.confidence;
      confidenceCount += 1;
    }
    if (record.needsLawyer) needsLawyer += 1;
    if (record.hasDocument) withDocument += 1;
    if (record.explicitIntent) explicitIntent += 1;

    // Ranked paths: count every appearance, and the top pick separately.
    record.paths.forEach((path, index) => {
      const stat = intentIndex.get(path.intent);
      if (!stat) return;
      stat.recommended += 1;
      if (path.primary || index === 0) stat.primary += 1;
      if (path.selected) stat.chosen += 1;
    });

    // Only the inferred area — the explicit pick lives on `explicitCategory`,
    // and conflating the two would report a user's choice as an inference.
    if (record.inferredCategory) {
      categoryCounts.set(record.inferredCategory, (categoryCounts.get(record.inferredCategory) ?? 0) + 1);
    }
  }

  // The state distribution is derived from the REQUEST rows, filtered to the
  // ones that carry a record, so it lines up with `total`.
  for (const row of rows) {
    if (!hasDiscovery(row)) continue;
    const key = row.state ?? "UNKNOWN";
    stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
  }

  return {
    total: records.length,
    bySource: { ai, rules },
    avgConfidence: confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : null,
    needsLawyer,
    withDocument,
    explicitIntent,
    byIntent,
    byCategory: toSortedStats(categoryCounts),
    byState: toSortedStats(stateCounts),
  };
}

/** Map → a count-descending list (ties broken by key) so tables read stably. */
function toSortedStats(counts: Map<string, number>): DiscoveryCountStat[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
