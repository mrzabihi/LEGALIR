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
// A contract carries THREE independent axes (see `status.ts`):
//   • `status`         — the DRAFT axis (how far along the document is)
//   • `analysisStatus` — the AI-review axis (of a fixed version)
//   • `archived`       — the archive axis
// plus `exportedAt`, which is an EVENT, not a lifecycle.
//
// The status buckets themselves live in `status.ts`; this module only
// decides order and grouping.
// ============================================================

import type { PropertyContractListItem, V1ContractListItem } from "@legalir/types";
import { V1_CONTRACT_STATE_LABELS } from "@legalir/types";
import {
  CONTRACT_DRAFT_STATUS_ORDER,
  draftStatusForPropertyState,
  draftStatusForV1State,
  isActionableDraft,
  isArchivedV1State,
  type ContractAnalysisStatus,
  type ContractDraftStatus,
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
  /** The DRAFT axis — how far along the document itself is. */
  status: ContractDraftStatus;
  /** The AI-review axis — the verdict on a FIXED version. */
  analysisStatus: ContractAnalysisStatus;
  /** The archive axis. */
  archived: boolean;
  /** ISO timestamp of the last export, or null. An event, not a state. */
  exportedAt: string | null;
  /** ISO timestamp of the last completed AI review, or null. */
  lastAnalyzedAt: string | null;
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
  const status = draftStatusForPropertyState(item.state);
  return {
    id: item.id,
    source: "os",
    type: item.type,
    typeFa: item.typeFa,
    title: item.title,
    referenceCode: item.referenceCode,
    status,
    analysisStatus: item.analysisStatus,
    archived: item.archived,
    exportedAt: item.exportedAt,
    lastAnalyzedAt: item.lastAnalyzedAt,
    stateFa: item.stateFa,
    progress: item.progress,
    subtitleFa: item.locationFa !== "بدون نشانی" ? item.locationFa : item.partySummaryFa,
    currentStepTitleFa: item.currentStepTitleFa,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    actionable: isActionableDraft(status) && !item.archived,
    deletable: item.state === "DRAFT" || item.state === "CANCELLED",
    raw: item,
  };
}

/** Fold a legacy V1 list item into the unified shape. */
export function toUnifiedV1Contract(item: V1ContractListItem): UnifiedContract {
  const status = draftStatusForV1State(item.state);
  const archived = isArchivedV1State(item.state);
  return {
    id: item.id,
    source: "v1",
    type: item.type,
    typeFa: item.typeFa,
    title: item.title,
    referenceCode: item.id,
    status,
    // The legacy V1 workspace has no AI-review axis, so it is always
    // un-reviewed — never a fabricated verdict.
    analysisStatus: "not_reviewed",
    archived,
    exportedAt: null,
    lastAnalyzedAt: null,
    stateFa: V1_CONTRACT_STATE_LABELS[item.state] ?? "",
    progress: 0,
    subtitleFa:
      item.currentVersionNumber > 0 ? `نسخه ${item.currentVersionNumber}` : "بدون نسخه",
    currentStepTitleFa: null,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
    actionable: isActionableDraft(status) && !archived,
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
    const rankA = CONTRACT_DRAFT_STATUS_ORDER.indexOf(a.status);
    const rankB = CONTRACT_DRAFT_STATUS_ORDER.indexOf(b.status);
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
 * Bucket contracts into the "همه" groups. Empty groups are dropped so
 * the page never renders a heading with nothing under it.
 */
export function groupUnifiedContracts(contracts: UnifiedContract[]): UnifiedContractGroup[] {
  const groups: { key: string; titleFa: string; match: (c: UnifiedContract) => boolean }[] = [
    {
      key: "needs-work",
      titleFa: "نیازمند ادامه",
      match: (c) => !c.archived && isActionableDraft(c.status),
    },
    {
      key: "ready",
      titleFa: "قراردادهای آماده",
      match: (c) => !c.archived && c.status === "ready",
    },
    { key: "archived", titleFa: "بایگانی", match: (c) => c.archived },
  ];
  return groups
    .map((g) => ({
      key: g.key,
      titleFa: g.titleFa,
      contracts: sortUnifiedContracts(contracts.filter(g.match)),
    }))
    .filter((g) => g.contracts.length > 0);
}

/** The drafts the user can pick up right now, newest first. */
export function resumableContracts(contracts: UnifiedContract[]): UnifiedContract[] {
  return sortUnifiedContracts(contracts.filter((c) => c.actionable));
}
