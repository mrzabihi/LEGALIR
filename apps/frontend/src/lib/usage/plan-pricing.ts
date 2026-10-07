// ============================================================
// LEGALIR — Plan pricing (single shared formula)
// ============================================================
// ONE place computes a plan's discount so the admin form, the pricing page
// and the admin API can never disagree. Pure math only (no db, no React), so
// both a server route and a client component can import it.
//
//   listPrice  — the "original" / sticker price
//   salePrice  — the "final" price the user actually pays
//
// Discount is DERIVED from those two numbers rather than stored, so the
// stored salePrice is always the authoritative payable amount. The percent is
// whole-number, rounded, and 0 when there is no real discount.
// ============================================================

export type DiscountKind = "percent" | "fixed";

/**
 * The real discount a plan carries, as a whole percentage, computed from its
 * own list price and sale price. Returns 0 when there is no discount.
 */
export function computeDiscountPercent(listPrice: number, salePrice: number): number {
  if (!Number.isFinite(listPrice) || listPrice <= 0) return 0;
  if (!Number.isFinite(salePrice) || salePrice >= listPrice) return 0;
  return Math.round(((listPrice - salePrice) / listPrice) * 100);
}

/**
 * The final price after applying a discount to an original price. Used by the
 * admin form to preview the payable amount before save. `percent` is 0–100;
 * `fixed` is a Toman amount. Never returns a negative price.
 */
export function applyDiscount(
  original: number,
  kind: DiscountKind,
  value: number
): number {
  if (!Number.isFinite(original) || original < 0) return 0;
  if (!Number.isFinite(value) || value <= 0) return Math.round(original);
  if (kind === "percent") {
    const pct = Math.min(100, value);
    return Math.max(0, Math.round(original * (1 - pct / 100)));
  }
  return Math.max(0, Math.round(original - value));
}
