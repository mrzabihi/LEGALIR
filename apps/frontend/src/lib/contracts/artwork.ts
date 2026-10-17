// ============================================================
// LEGALIR — Contract artwork (single source of truth)
// ============================================================
// The template card leads with a photograph: a brand-green blueprint
// illustration that names the contract type before a single word is read
// (an apartment block + key for rent, a sedan + deed for a car sale, …).
//
// This module is the ONE place a contract type is mapped to its image.
// The card reads `contractArtwork(type)` and never branches on the type
// itself, so wiring a new illustration is a one-line change here — the
// same extension point the registry already uses for everything else.
//
// The files live under `public/assets/contracts/` (root-relative, served
// by Next, copied into the standalone Docker image — see docs/ASSETS.md)
// and are the 16:9 center-cropped, optimized derivatives of the supplied
// masters. Keeping the mapping keyed by `ContractTypeId` (not order or
// title) means the registry's display order can move without ever
// detaching an image from its contract.
//
// A type with NO artwork is not an error: the card falls back to the
// hand-built SVG scene in `./visuals` (`employment` is the current
// example), so a ninth contract type added to the registry still renders
// a coherent card without a photograph.
// ============================================================

/** Contract type → its `public/`-rooted artwork path. */
export const CONTRACT_ARTWORK: Record<string, string> = {
  property_rent: "/assets/contracts/01-residential-lease.jpg",
  property_sale: "/assets/contracts/05-property-sale.jpg",
  vehicle_sale: "/assets/contracts/04-car-sale.jpg",
  debt: "/assets/contracts/03-loan-agreement.jpg",
  freelance: "/assets/contracts/02-freelance-contract.jpg",
  nda: "/assets/contracts/06-nda.jpg",
  saas: "/assets/contracts/07-saas-agreement.jpg",
  startup: "/assets/contracts/08-startup-partnership.jpg",
  // Commercial, cloud and employment contracts — drawn from the second
  // artwork set (blueprint scenes on the brand-green field).
  commercial_rent: "/assets/contracts/09-commercial-lease.jpg",
  commercial_sale: "/assets/contracts/10-commercial-sale.jpg",
  cloud_iaas: "/assets/contracts/11-cloud-iaas.jpg",
  cloud_paas: "/assets/contracts/12-cloud-paas.jpg",
  employment: "/assets/contracts/13-employment.jpg",
};

/**
 * Contract SERVICE id → artwork. The `/contracts` «به‌زودی» catalog is a
 * different catalogue (28 services, keyed by service id), so it cannot
 * share the registry map above. Only the services that ship with art are
 * listed; the rest keep the icon-only card.
 */
export const CONTRACT_SERVICE_ARTWORK: Record<string, string> = {
  "commercial-lease-contract": "/assets/contracts/09-commercial-lease.jpg",
  "pre-sale-contract": "/assets/contracts/14-presale.jpg",
  "contracting-agreement": "/assets/contracts/16-contracting.jpg",
  "remote-work-contract": "/assets/contracts/15-remote-work.jpg",
  "internship-contract": "/assets/contracts/17-internship.jpg",
  "employment-contract": "/assets/contracts/13-employment.jpg",
};

/** The artwork path for a contract type, or null when it has none. */
export function contractArtwork(type: string): string | null {
  return CONTRACT_ARTWORK[type] ?? null;
}

/** True when a photograph exists for this contract type. */
export function hasContractArtwork(type: string): boolean {
  return type in CONTRACT_ARTWORK;
}

/** The artwork path for a catalog SERVICE id, or null when it has none. */
export function contractServiceArtwork(serviceId: string): string | null {
  return CONTRACT_SERVICE_ARTWORK[serviceId] ?? null;
}
