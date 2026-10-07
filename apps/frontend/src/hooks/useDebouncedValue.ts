// ============================================================
// LEGALIR — useDebouncedValue
// ============================================================
// Debounce a fast-changing value (typically a search box) so a downstream
// server query fires once the operator pauses, not on every keystroke. The
// list pages bind their inputs to a raw value and feed the DEBOUNCED value to
// the React Query hook, so typing stays instant while the network stays quiet.

import { useEffect, useState } from "react";

/**
 * Return `value`, but only after it has stopped changing for `delay` ms.
 * The first render returns `value` as-is so there is no empty first frame.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
