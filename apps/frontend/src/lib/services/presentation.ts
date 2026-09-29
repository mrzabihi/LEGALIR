// ============================================================
// LEGALIR — Service presentation (shared visual identity)
// ============================================================
// The six services appear on two surfaces — the /services
// «خدمات پرکاربرد» cards and the dashboard «دسترسی سریع» cards — and
// must read as the same product on both. This module is the one place
// that decides *which illustration* belongs to a service, so the two
// surfaces can never drift apart.
//
// It deliberately owns nothing else:
//   • titles, descriptions and hrefs come from the registries that
//     already own them (`lib/services/registry.ts`,
//     `lib/services/catalog.ts`) — never duplicated here
//   • the accent colour comes from the same registries (`accent`), so
//     there is no second, hand-tuned palette to keep in sync
//
// Only the illustration mapping is new, and it is keyed by the service
// id so a caller can pass whichever id form it already holds.
// ============================================================

import type { ServiceArtKey } from "@/components/services/service-art";

/**
 * Service id → illustration key. Accepts the registry ids
 * (`legal_calculation`), the quick-access launcher id (`calculators`)
 * and the catalog banner ids (`banner-…`, normalised below).
 *
 * `legal_calculation` and `calculators` share one illustration: the
 * calculator launcher and the calculation service are the same idea.
 */
const ART_BY_SERVICE: Record<string, ServiceArtKey> = {
  legal_calculation: "calculator",
  calculators: "calculator",
  document_analysis: "document_analysis",
  legal_notice: "legal_notice",
  contract_drafting: "contract_drafting",
  contract_review: "contract_review",
  legal_consultation: "legal_consultation",
};

/**
 * Resolves the illustration for a service id. Returns `undefined` for an
 * unknown id so a caller can fall back to its own icon rather than
 * render a wrong picture.
 */
export function serviceArtKey(id: string): ServiceArtKey | undefined {
  // Banner ids are hyphenated (`banner-document-analysis`); registry ids
  // are underscored (`document_analysis`). Normalise both to the
  // underscored form the map is keyed by.
  const normalised = id.replace(/^banner-/, "").replace(/-/g, "_");
  return ART_BY_SERVICE[normalised];
}

export type { ServiceArtKey };
