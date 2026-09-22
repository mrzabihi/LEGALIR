// ============================================================
// LEGALIR — Unified contract list model
// ============================================================
// The Contracts page shows contracts from TWO lifecycles in one list:
//   • the Contract Operating System (`PropertyContractListItem`)
//   • the legacy V1 workspace (`V1ContractListItem`)
//
// They have different fields, different state vocabularies and
// different progress semantics. Rather than teach every card about
// both, this module folds each into ONE `UnifiedContract` shape and
// owns the two list rules the page needs:
//
//   • draft priority — anything the user can still resume sorts above
//     finished work, then by most-recently-updated;
//   • smart grouping — the "همه" view is bucketed by work remaining.
//
// The status buckets themselves live in `status.ts`; this module only
// decides order and grouping.
// ============================================================

import type { PropertyContractListItem, V1ContractListItem } from "@legalir/types";
import { V1_CONTRACT_STATE_LABELS } from "@legalir/types";
import {
  CONTRACT_STATUS_ORDER,
  MY_CONTRACTS_GROUPS,
  isActionableStatus,
  statusGroupForPropertyState,
  statusGroupForV1State,
  type ContractStatusGroup,
} from "./status";

/** One contract, whichever lifecycle it came from. */
export interface UnifiedContract {
  id: string;
  /** Which lifecycle produced this row — decides the detail route. */
  source: "os" | "v1";
  type: string;
  typeFa: string;
  title: string;
  /**
   * The human-facing contract id shown on the card and copied by the
   * «کپی شناسه قرارداد» action. Contract-OS rows carry a real
   * `referenceCode`; legacy V1 rows have none, so their `id` stands in.
   */
  referenceCode: string;
  /** The shared status bucket. */
  status: ContractStatusGroup;
  /** The raw, lifecycle-specific state label shown on the badge. */
  stateFa: string;
  /** 0–100 completeness. V1 contracts have no progress, so 0. */
  progress: number;
  /** A short secondary line (location, party names, version). */
  subtitleFa: string;
  /** The step the user left off at, when the lifecycle tracks one. */
  currentStepTitleFa: string | null;
  /** ISO 8601. */
  updatedAt: string;
  /** ISO 8601. */
  createdAt: string;
  /** True when the contract can still be resumed/edited. */
  actionable: boolean;
  /** True when the contract may be deleted (drafts only). */
  deletable: boolean;
  /** The original row, for callers that need lifecycle-specific fields. */
  raw: PropertyContractListItem | V1ContractListItem;
}

/** Fold a Contract-OS list item into the unified shape. */
export function toUnifiedPropertyContract(item: PropertyContractListItem): UnifiedContract {
  const status = statusGroupForPropertyState(item.state);
  return {
    id: item.id,
    source: "os",
    type: item.type,
    typeFa: item.typeFa,
    title: item.title,
    referenceCode: item.referenceCode,
    status,
    stateFa: item.stateFa,
    progress: item.progress,
    subtitleFa: item.locationFa !== "بدون نشانی" ? item.locationFa : item.partySummaryFa,
    currentStepTitleFa: item.currentStepTitleFa,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    actionable: isActionableStatus(status),
    deletable: item.state === "DRAFT" || item.state === "CANCELLED",
    raw: item,
  };
}

/** Fold a legacy V1 list item into the unified shape. */
export function toUnifiedV1Contract(item: V1ContractListItem): UnifiedContract {
  const status = statusGroupForV1State(item.state);
  return {
    id: item.id,
    source: "v1",
    type: item.type,
    typeFa: item.typeFa,
    title: item.title,
    referenceCode: item.id,
    status,
    stateFa: V1_CONTRACT_STATE_LABELS[item.state] ?? "",
    progress: 0,
    subtitleFa:
      item.currentVersionNumber > 0 ? `نسخه ${item.currentVersionNumber}` : "بدون نسخه",
    currentStepTitleFa: null,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    actionable: isActionableStatus(status),
    deletable: false,
    raw: item,
  };
}

/** The detail route for a unified contract. */
export function contractHref(contract: UnifiedContract): string {
  return `/contracts/${contract.id}`;
}

/**
 * Sort by work remaining, then most-recently-updated. Drafts and
 * in-progress contracts surface first — the "resume where you left
 * off" requirement — and finished work sinks to the bottom.
 */
export function sortUnifiedContracts(contracts: UnifiedContract[]): UnifiedContract[] {
  return [...contracts].sort((a, b) => {
    const rankA = CONTRACT_STATUS_ORDER.indexOf(a.status);
    const rankB = CONTRACT_STATUS_ORDER.indexOf(b.status);
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/** A named group of contracts for the "همه" view. */
export interface UnifiedContractGroup {
  key: string;
  titleFa: string;
  contracts: UnifiedContract[];
}

/**
 * Bucket contracts into the four "همه" groups. Empty groups are
 * dropped so the page never renders a heading with nothing under it.
 */
export function groupUnifiedContracts(contracts: UnifiedContract[]): UnifiedContractGroup[] {
  return MY_CONTRACTS_GROUPS.map((group) => ({
    key: group.key,
    titleFa: group.titleFa,
    contracts: sortUnifiedContracts(
      contracts.filter((c) => group.statuses.includes(c.status))
    ),
  })).filter((group) => group.contracts.length > 0);
}

/** The drafts the user can pick up right now, newest first. */
export function resumableContracts(contracts: UnifiedContract[]): UnifiedContract[] {
  return sortUnifiedContracts(contracts.filter((c) => c.actionable));
}
