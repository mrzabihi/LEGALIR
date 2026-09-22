// ============================================================
// LEGALIR — Legal Knowledge React Query Hooks (Phase 6)
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { fetchKnowledgeInventory } from "@/lib/api/v1";

/**
 * The admin knowledge inventory — every legal source with its authority
 * tier, provenance and verification status. Staff-only.
 */
export function useKnowledgeInventory(params?: {
  verificationStatus?: string;
  sourceType?: string;
  tier?: string;
}) {
  return useQuery({
    queryKey: [
      "v1",
      "admin",
      "knowledge",
      params?.verificationStatus ?? null,
      params?.sourceType ?? null,
      params?.tier ?? null,
    ],
    queryFn: () => fetchKnowledgeInventory(params),
    staleTime: 60_000,
    retry: 1,
  });
}
