"use client";

// ============================================================
// LEGALIR — caret anchor for live-formatted numeric inputs
// ============================================================
// Re-grouping a number on every keystroke moves the caret to the end
// unless we put it back. This hook remembers the *logical* cursor
// position (how many digits sat before the caret) at change time and
// restores it once the formatted value has been committed — so
// typing, backspace, delete and paste all feel native.
// ============================================================

import { useLayoutEffect, useRef } from "react";
import { caretAfterDigit, digitsBefore } from "./number-format";

export function useCaretAnchor() {
  const ref = useRef<HTMLInputElement | null>(null);
  const pending = useRef<number | null>(null);

  /** Call from the change handler, before the value is reformatted. */
  const remember = (raw: string, caret: number) => {
    pending.current = digitsBefore(raw, caret);
  };

  // Runs after every commit; a no-op unless `remember` was called.
  useLayoutEffect(() => {
    const el = ref.current;
    const target = pending.current;
    if (!el || target === null) return;
    pending.current = null;
    const pos = caretAfterDigit(el.value, target);
    el.setSelectionRange(pos, pos);
  });

  return { ref, remember };
}
