// ============================================================
// LEGALIR — Admin mobile masking (single source of truth)
// ============================================================
// The ONE place the admin panel decides how much of a user/lawyer mobile to
// reveal. It exists because the same value is written in several shapes
// (`+989…`, `0098…`, `09…`, `9…`, Persian/Arabic digits, spaced/dashed) and a
// naive `slice()` corrupts some of them and hides the country code of others.
//
// Rule (privacy-by-default, not a security boundary):
//   • hide EXACTLY the four middle digits, each as one `*`;
//   • keep the leading international/trunk prefix (`+98`, `0098`, `0`) intact
//     so it is never mistaken for part of the hidden middle;
//   • keep a balanced head/tail — for the canonical `+989122842174` that is
//     `+9891****2174`;
//   • a value too short to hide four middle digits is protected by masking all
//     but its last two digits (never sliced into nonsense).
//
// Masking is DISPLAY-only: the stored/returned value is never rewritten here,
// and every admin endpoint authorizes the caller on the server independently.
// ============================================================

import { toWesternDigits } from "@legalir/validation";

/** The fixed number of middle digits hidden, and the number of `*` shown. */
const MASK_LEN = 4;

/**
 * Mask a mobile for the admin panel, hiding exactly four real middle digits.
 *
 * @example
 *   maskMobileMiddle("+989122842174")  // "+9891****2174"
 *   maskMobileMiddle("09122842174")    // "0912****174"
 *   maskMobileMiddle("9122842174")     // "912****174"
 *   maskMobileMiddle("00989122842174") // "009891****2174"
 *   maskMobileMiddle("۰۹۱۲۲۸۴۲۱۷۴")    // "0912****174"
 *   maskMobileMiddle("0912 284 2174")  // "0912****174"
 *
 * @param raw any stored/typed mobile shape, or an empty value
 * @returns the masked display string, or `"—"` when there is nothing to mask
 */
export function maskMobileMiddle(raw: string | null | undefined): string {
  if (raw == null) return "—";
  const western = toWesternDigits(String(raw)).trim();
  if (!western) return "—";

  // Preserve a leading international (`+` / `00`) prefix verbatim so it is
  // never hidden as if it were part of the middle.
  let prefix = "";
  let body = western;
  if (body.startsWith("+")) {
    prefix = "+";
    body = body.slice(1);
  } else if (body.startsWith("00")) {
    prefix = "00";
    body = body.slice(2);
  }

  const digits = body.replace(/\D/g, "");
  if (!digits) return "—";

  // A value too short to hide four middle digits while keeping a readable
  // prefix AND suffix: protect all but the last two digits (or all when there
  // are only one or two). Never leave a short value in the clear.
  if (digits.length < MASK_LEN * 2) {
    if (digits.length <= 2) return `${prefix}${"*".repeat(MASK_LEN)}`;
    return `${prefix}${"*".repeat(digits.length - 2)}${digits.slice(-2)}`;
  }

  // Balanced head/tail around a fixed four-digit hole.
  const visible = digits.length - MASK_LEN;
  const head = Math.ceil(visible / 2);
  const tail = visible - head;
  return `${prefix}${digits.slice(0, head)}${"*".repeat(MASK_LEN)}${digits.slice(digits.length - tail)}`;
}
