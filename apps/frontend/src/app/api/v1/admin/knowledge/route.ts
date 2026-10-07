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
import type { KnowledgeInventoryResponse } from "@legalir/types";
import { requirePermission } from "@/lib/rbac";
import { getKnowledgeInventory, filterKnowledgeInventory } from "@/lib/knowledge/inventory";

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "admin:knowledge:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("verificationStatus");
  const sourceType = url.searchParams.get("sourceType");
  const tier = url.searchParams.get("tier");

  // One shared builder (lib/knowledge/inventory) so this endpoint and the Excel
  // export can never disagree about what the knowledge base contains.
  const { items, byTier, byStatus } = getKnowledgeInventory();
  const filtered = filterKnowledgeInventory(items, {
    verificationStatus: status,
    sourceType,
    tier,
  });

  const response: KnowledgeInventoryResponse = {
    items: filtered,
    total: filtered.length,
    byTier,
    byStatus,
  };

  return NextResponse.json({ data: response });
}
