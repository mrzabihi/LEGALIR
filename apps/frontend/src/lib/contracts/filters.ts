// ============================================================
// LEGALIR — Contract list filter model
// ============================================================
// The Contracts page filters on SEVERAL independent axes, and the old
// single status chip row conflated them. This module owns the whole
// filter vocabulary so the desktop bar, the mobile sheet and the URL
// can never disagree:
//
//   • tab        — the coarse lifecycle bucket (همه / نیازمند تکمیل /
//                  آماده / بایگانی). Exactly one, always present.
//   • draft      — the DRAFT axis, multi-select (شروع‌شده / در حال
//                  تکمیل / متن آماده).
//   • analysis   — the AI-review axis, multi-select (بررسی‌نشده / در
//                  حال بررسی / نتیجه آماده / نیازمند بررسی مجدد /
//                  خطا در بررسی).
//   • type       — the contract type id, multi-select.
//   • dateRange  — a coarse recency bucket on `updatedAt`.
//   • sort       — the ordering key.
//   • query      — the shared free-text search.
//
// COMBINATION RULE (spec §6): AND between groups, OR within a group.
// A contract must satisfy every active group; within a group it needs
// to match only one selected value. An empty group is inactive.
//
// The state is a plain, serialisable object so it can live in the URL
// query string — which is what makes browser Back/Forward work and a
// filtered view survive a refresh.
//
// HONESTY RULE: nothing here invents a status. A contract with no AI
// review is `not_reviewed`; the filter never implies a verdict that
// does not exist.
// ============================================================

import type { UnifiedContract } from "./unified";
import { faIncludes } from "./search";
import {
  CONTRACT_ANALYSIS_STATUS_LABELS,
  CONTRACT_ANALYSIS_STATUS_ORDER,
  CONTRACT_DRAFT_STATUS_LABELS,
  CONTRACT_DRAFT_STATUS_ORDER,
  matchesTab,
  type ContractAnalysisStatus,
  type ContractDraftStatus,
  type ContractTab,
} from "./status";

// ------------------------------------------------------------
// Sort
// ------------------------------------------------------------

export type ContractSortKey = "updated" | "created" | "title";

export const CONTRACT_SORT_LABELS: Record<ContractSortKey, string> = {
  updated: "آخرین ویرایش",
  created: "تاریخ ایجاد",
  title: "الفبا",
};

export const CONTRACT_SORT_ORDER: ContractSortKey[] = ["updated", "created", "title"];

// ------------------------------------------------------------
// Date range
// ------------------------------------------------------------

export type ContractDateRange = "any" | "7d" | "30d" | "90d";

export const CONTRACT_DATE_RANGE_LABELS: Record<ContractDateRange, string> = {
  any: "همه زمان‌ها",
  "7d": "۷ روز گذشته",
  "30d": "۳۰ روز گذشته",
  "90d": "۹۰ روز گذشته",
};

export const CONTRACT_DATE_RANGE_ORDER: ContractDateRange[] = ["any", "7d", "30d", "90d"];

/** How many days back each range reaches. `any` is unbounded. */
const RANGE_DAYS: Record<Exclude<ContractDateRange, "any">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

// ------------------------------------------------------------
// The filter state
// ------------------------------------------------------------

export interface ContractFilterState {
  /** The coarse lifecycle bucket. Exactly one. */
  tab: ContractTab;
  /** Free-text query, shared with the page header search. */
  query: string;
  /** DRAFT axis — OR within, AND against the other groups. */
  draft: ContractDraftStatus[];
  /** ANALYSIS axis — OR within, AND against the other groups. */
  analysis: ContractAnalysisStatus[];
  /** Contract type ids — OR within. */
  types: string[];
  /** Recency bucket on `updatedAt`. */
  dateRange: ContractDateRange;
  sort: ContractSortKey;
}

export const DEFAULT_CONTRACT_FILTERS: ContractFilterState = {
  tab: "all",
  query: "",
  draft: [],
  analysis: [],
  types: [],
  dateRange: "any",
  sort: "updated",
};

// ------------------------------------------------------------
// URL serialisation
// ------------------------------------------------------------
// Short, stable keys so a filtered URL stays readable. Multi-value
// groups are comma-joined; an empty group is omitted entirely.

const PARAM = {
  tab: "tab",
  query: "q",
  draft: "draft",
  analysis: "analysis",
  types: "type",
  dateRange: "range",
  sort: "sort",
} as const;

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return [];
  const set = new Set(allowed as readonly string[]);
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => set.has(v));
}

/** Read a filter state out of a URLSearchParams (or a plain record). */
export function parseContractFilters(params: URLSearchParams): ContractFilterState {
  const tabRaw = params.get(PARAM.tab);
  const tab: ContractTab =
    tabRaw === "needs_work" || tabRaw === "ready" || tabRaw === "archived" ? tabRaw : "all";

  const rangeRaw = params.get(PARAM.dateRange);
  const dateRange: ContractDateRange =
    rangeRaw === "7d" || rangeRaw === "30d" || rangeRaw === "90d" ? rangeRaw : "any";

  const sortRaw = params.get(PARAM.sort);
  const sort: ContractSortKey =
    sortRaw === "created" || sortRaw === "title" ? sortRaw : "updated";

  return {
    tab,
    query: params.get(PARAM.query) ?? "",
    draft: parseList(params.get(PARAM.draft), CONTRACT_DRAFT_STATUS_ORDER),
    analysis: parseList(params.get(PARAM.analysis), CONTRACT_ANALYSIS_STATUS_ORDER),
    // Type ids are open-ended (a new type must not need a code change
    // here), so they are parsed as free strings rather than against a
    // fixed allow-list.
    types: (params.get(PARAM.types) ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    dateRange,
    sort,
  };
}

/**
 * Write a filter state into a URLSearchParams, omitting every default
 * so an unfiltered view produces a clean `/contracts` URL.
 */
export function serializeContractFilters(state: ContractFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== "all") params.set(PARAM.tab, state.tab);
  if (state.query.trim()) params.set(PARAM.query, state.query.trim());
  if (state.draft.length) params.set(PARAM.draft, state.draft.join(","));
  if (state.analysis.length) params.set(PARAM.analysis, state.analysis.join(","));
  if (state.types.length) params.set(PARAM.types, state.types.join(","));
  if (state.dateRange !== "any") params.set(PARAM.dateRange, state.dateRange);
  if (state.sort !== "updated") params.set(PARAM.sort, state.sort);
  return params;
}

// ------------------------------------------------------------
// Active-filter description (the removable chips)
// ------------------------------------------------------------

export interface ActiveFilterChip {
  /** Which group the chip belongs to — used to remove it. */
  group: "tab" | "query" | "draft" | "analysis" | "types" | "dateRange" | "sort";
  /** The value to remove (a single value within the group). */
  value: string;
  labelFa: string;
}

/**
 * Describe every active filter as a removable chip. The tab and the
 * sort are included so the user can see — and undo — the whole state
 * from one place, rather than wondering why the list looks short.
 */
export function activeFilterChips(state: ContractFilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.tab !== "all") {
    chips.push({ group: "tab", value: state.tab, labelFa: TAB_LABELS[state.tab] });
  }
  if (state.query.trim()) {
    chips.push({ group: "query", value: state.query, labelFa: `جستجو: ${state.query.trim()}` });
  }
  for (const d of state.draft) {
    chips.push({ group: "draft", value: d, labelFa: CONTRACT_DRAFT_STATUS_LABELS[d] });
  }
  for (const a of state.analysis) {
    chips.push({ group: "analysis", value: a, labelFa: CONTRACT_ANALYSIS_STATUS_LABELS[a] });
  }
  for (const t of state.types) {
    chips.push({ group: "types", value: t, labelFa: t });
  }
  if (state.dateRange !== "any") {
    chips.push({
      group: "dateRange",
      value: state.dateRange,
      labelFa: CONTRACT_DATE_RANGE_LABELS[state.dateRange],
    });
  }
  if (state.sort !== "updated") {
    chips.push({
      group: "sort",
      value: state.sort,
      labelFa: `مرتب‌سازی: ${CONTRACT_SORT_LABELS[state.sort]}`,
    });
  }

  return chips;
}

/** True when any filter beyond the defaults is active. */
export function hasActiveFilters(state: ContractFilterState): boolean {
  return activeFilterChips(state).length > 0;
}

/** Remove one chip's value from the state, returning a new state. */
export function removeFilterChip(
  state: ContractFilterState,
  chip: ActiveFilterChip
): ContractFilterState {
  switch (chip.group) {
    case "tab":
      return { ...state, tab: "all" };
    case "query":
      return { ...state, query: "" };
    case "draft":
      return { ...state, draft: state.draft.filter((d) => d !== chip.value) };
    case "analysis":
      return { ...state, analysis: state.analysis.filter((a) => a !== chip.value) };
    case "types":
      return { ...state, types: state.types.filter((t) => t !== chip.value) };
    case "dateRange":
      return { ...state, dateRange: "any" };
    case "sort":
      return { ...state, sort: "updated" };
  }
}

// ------------------------------------------------------------
// Tab labels (kept here so the chips and the tabs agree)
// ------------------------------------------------------------

export const TAB_LABELS: Record<ContractTab, string> = {
  all: "همه",
  needs_work: "نیازمند تکمیل",
  ready: "آماده",
  archived: "بایگانی",
};

// ------------------------------------------------------------
// Applying the filters
// ------------------------------------------------------------

/** True when `updatedAt` falls inside the range, relative to `now`. */
function withinRange(updatedAt: string, range: ContractDateRange, now: number): boolean {
  if (range === "any") return true;
  const days = RANGE_DAYS[range];
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && t >= cutoff;
}

/**
 * Apply the whole filter state to a contract list.
 *
 * AND between groups, OR within a group. The tab is applied first
 * (it is the coarse bucket), then each finer group narrows further.
 * `now` is injectable so the date-range rule is testable without
 * freezing the clock.
 */
export function applyContractFilters(
  contracts: UnifiedContract[],
  state: ContractFilterState,
  now: number = Date.now()
): UnifiedContract[] {
  const q = state.query.trim();

  return contracts.filter((c) => {
    // Tab — the coarse lifecycle bucket.
    if (!matchesTab(state.tab, c.status, c.archived)) return false;

    // Draft axis — OR within.
    if (state.draft.length && !state.draft.includes(c.status)) return false;

    // Analysis axis — OR within.
    if (state.analysis.length && !state.analysis.includes(c.analysisStatus)) return false;

    // Type — OR within.
    if (state.types.length && !state.types.includes(c.type)) return false;

    // Recency — a single bucket.
    if (!withinRange(c.updatedAt, state.dateRange, now)) return false;

    // Free text — title, type label and the secondary line.
    if (q && !(faIncludes(c.title, q) || faIncludes(c.typeFa, q) || faIncludes(c.subtitleFa, q))) {
      return false;
    }

    return true;
  });
}

/** Order a filtered list by the chosen sort key. */
export function sortContractList(
  contracts: UnifiedContract[],
  sort: ContractSortKey
): UnifiedContract[] {
  const list = [...contracts];
  switch (sort) {
    case "created":
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "fa"));
    case "updated":
    default:
      return list.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }
}

/** The distinct contract types present in a list, for the type filter. */
export function contractTypeOptions(
  contracts: UnifiedContract[]
): { value: string; labelFa: string }[] {
  const seen = new Map<string, string>();
  for (const c of contracts) {
    if (!seen.has(c.type)) seen.set(c.type, c.typeFa);
  }
  return [...seen.entries()].map(([value, labelFa]) => ({ value, labelFa }));
}
