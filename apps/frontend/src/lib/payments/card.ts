// ============================================================
// LEGALIR — client-safe card helpers
// ============================================================
// The server validates every settlement card again in
// `lib/lawyer-portal/store.ts`; this copy exists so the lawyer form and the
// admin bank-replace form catch a typo before the round-trip. It carries no
// storage concern — the full PAN is never persisted anywhere.
// ============================================================

/** Normalise a typed card number to ASCII digits (Persian/Arabic digits included). */
export function digitsOnly(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, "");
}

/** The Luhn checksum. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
