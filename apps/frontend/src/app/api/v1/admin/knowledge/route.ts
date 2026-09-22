// ============================================================
// LEGALIR — GET /api/v1/admin/knowledge
// ============================================================
// The knowledge-base inventory for staff. Lists every legal source with
// its authority tier, provenance and verification status so unverified
// or low-authority content can be found and fixed.
// Staff-only (`admin:knowledge:read`).
//
// This is read-only: the knowledge base is seeded from the official law
// catalog and the ingested corpus, so there is no free-form write path.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type {
  KnowledgeInventoryItem,
  KnowledgeInventoryResponse,
  SourceStatus,
} from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { readLegalLibrary } from "@/lib/legal-library-db";
import { readCorpus } from "@/lib/legal-corpus";
import { tierForSource, tierLabelFa } from "@/lib/knowledge/authority";

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:knowledge:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("verificationStatus");
  const sourceType = url.searchParams.get("sourceType");
  const tier = url.searchParams.get("tier");

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

  const filtered = items.filter(
    (i) =>
      (!status || i.verificationStatus === status) &&
      (!sourceType || i.sourceType === sourceType) &&
      (!tier || i.tier === tier)
  );

  const byTier: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    byTier[item.tier] = (byTier[item.tier] ?? 0) + 1;
    byStatus[item.verificationStatus] =
      (byStatus[item.verificationStatus] ?? 0) + 1;
  }

  const response: KnowledgeInventoryResponse = {
    items: filtered,
    total: filtered.length,
    byTier,
    byStatus,
  };

  return NextResponse.json({ data: response });
}
