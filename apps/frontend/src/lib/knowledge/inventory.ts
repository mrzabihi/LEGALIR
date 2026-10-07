// ============================================================
// LEGALIR — Legal knowledge inventory (server-only, single source)
// ============================================================
// The ONE place the knowledge-base inventory is assembled: every legal source
// the AI can cite, projected into a `KnowledgeInventoryItem` with its authority
// tier, provenance and verification status.
//
// Two callers read this and MUST NOT diverge (§7 + the "single source of truth"
// rule): the staff inventory endpoint (`GET /api/v1/admin/knowledge`) and the
// Excel export adapter (`case "knowledge"`). The endpoint filters the shared
// list; the export serialises all of it. No second, parallel projection exists.
// ============================================================

import type {
  KnowledgeInventoryItem,
  KnowledgeInventoryResponse,
  SourceStatus,
} from "@legalir/types";
import { readLegalLibrary } from "@/lib/legal-library-db";
import { readCorpus } from "@/lib/legal-corpus";
import { tierForSource, tierLabelFa } from "@/lib/knowledge/authority";

export interface KnowledgeInventoryFilter {
  verificationStatus?: string | null;
  sourceType?: string | null;
  tier?: string | null;
}

/**
 * Build the complete knowledge inventory from the legal library and the
 * ingested corpus. No filtering — callers narrow the result themselves.
 */
export function buildKnowledgeInventory(): KnowledgeInventoryItem[] {
  const items: KnowledgeInventoryItem[] = [];

  // --- The Legal Library (curated sources) ---
  const library = readLegalLibrary();
  const details = library.details ?? {};
  for (const item of library.items) {
    const detail = details[item.id];
    const resolvedTier = tierForSource({
      sourceType: item.sourceType,
      title: item.title,
      authority: item.authority,
    });
    items.push({
      id: item.id,
      title: item.title,
      sourceType: item.sourceType === "REGULATION" ? "regulation" : "law",
      sourceTypeFa: item.sourceTypeFa,
      authority: item.authority,
      tier: resolvedTier,
      tierFa: tierLabelFa(resolvedTier),
      verificationStatus: item.verificationStatus,
      status: (detail?.status as SourceStatus) ?? "valid",
      locator: detail?.articleNumber ?? "",
      origin: "LIBRARY",
      textHash: null,
      popular: item.popular,
    });
  }

  // --- The ingested corpus (SHA-256 fingerprinted files) ---
  const corpus = readCorpus();
  for (const source of corpus.sources) {
    const resolvedTier = tierForSource({
      sourceType: source.sourceType,
      title: source.title,
      authority: source.authority,
    });
    items.push({
      id: source.lawId ?? source.id,
      title: source.title,
      sourceType: "law",
      sourceTypeFa: source.sourceTypeFa,
      authority: source.authority,
      tier: resolvedTier,
      tierFa: tierLabelFa(resolvedTier),
      verificationStatus: source.verificationStatus,
      status: (source.status as SourceStatus) ?? "valid",
      locator: source.articleSection,
      origin: "CORPUS",
      textHash: source.textHash,
      popular: false,
    });
  }

  return items;
}

/** The full inventory plus its derived tier/status counts. */
export function getKnowledgeInventory(): KnowledgeInventoryResponse {
  const items = buildKnowledgeInventory();

  const byTier: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    byTier[item.tier] = (byTier[item.tier] ?? 0) + 1;
    byStatus[item.verificationStatus] = (byStatus[item.verificationStatus] ?? 0) + 1;
  }

  return { items, total: items.length, byTier, byStatus };
}

/** Apply the staff-inventory filters to an inventory item list. */
export function filterKnowledgeInventory(
  items: KnowledgeInventoryItem[],
  filter: KnowledgeInventoryFilter
): KnowledgeInventoryItem[] {
  const { verificationStatus, sourceType, tier } = filter;
  return items.filter(
    (i) =>
      (!verificationStatus || i.verificationStatus === verificationStatus) &&
      (!sourceType || i.sourceType === sourceType) &&
      (!tier || i.tier === tier)
  );
}
