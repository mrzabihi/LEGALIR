// ============================================================
// LEGALIR — Checkout pricing configuration (server-authoritative)
// ============================================================
// ONE place holds the pricing knobs a quote depends on. Nothing in the client
// may hard-code any of these; the quote the client renders is computed on the
// server from this config so the two can never disagree.
//
// ⚠ AMBIGUOUS ITEM — ORDER TAX / VAT
// ---------------------------------------------------------------------------
// The project has NO tax or VAT rule for subscription orders. There is no tax
// field on `subscription_plans`, no VAT entry in the energy/service-cost model,
// and no spec value anywhere to read. Per the instruction "do not guess any
// ambiguous financial rule", the rate is set to 0 and every surface labels the
// tax line «بدون مالیات» rather than inventing a number. If a real rate is
// supplied later, change ONLY `ORDER_TAX_RATE_PERCENT` here — the quote math,
// the order snapshot and the admin breakdown all read it from this file.
// ============================================================

/**
 * Order tax/VAT rate as a whole percentage applied to the post-discount
 * subtotal. 0 = no tax (the current, unambiguous-safe default).
 */
export const ORDER_TAX_RATE_PERCENT = 0;

/** The Persian label shown when the tax rate is zero (honest, not a number). */
export const TAX_ZERO_LABEL_FA = "بدون مالیات";

/** The single currency every subscription order is denominated in (Toman). */
export const ORDER_CURRENCY = "IRT";

/**
 * The order of operations a quote applies, documented once so the server, the
 * receipt and the admin report never reorder it differently:
 *
 *   1. basePrice  = catalog salePrice            (never list price)
 *   2. discount   = clamped coupon effect on base (percent capped, ≤ base)
 *   3. subtotal   = basePrice − discount          (never negative)
 *   4. tax        = round(subtotal × rate / 100)  (rate 0 by default)
 *   5. other      = 0 (no other costs exist in the model yet)
 *   6. final      = subtotal + tax + other        (the single deciding amount)
 */
export const PRICING_ORDER_OF_OPERATIONS = "discount-then-tax" as const;
