// ============================================================
// LEGALIR — Material Design V2 Motion Tokens
// ============================================================

export const duration = {
  /** 50ms — immediate feedback, ripple */
  short1: "50ms",
  /** 100ms — state changes, hover */
  short2: "100ms",
  /** 150ms — icon transitions */
  short3: "150ms",
  /** 200ms — component enter/exit */
  short4: "200ms",
  /** 250ms — standard transition */
  medium1: "250ms",
  /** 300ms — larger surface transitions */
  medium2: "300ms",
  /** 350ms — dialog enter/exit */
  medium3: "350ms",
  /** 400ms — splash timing */
  medium4: "400ms",
  /** 500ms — complex transitions */
  long1: "500ms",
  /** 700ms — page transitions */
  long2: "700ms",
} as const;

export const easing = {
  /** Standard easing for most UI transitions */
  standard: "cubic-bezier(0.4, 0.0, 0.2, 1)",
  /** Deceleration curve — objects entering the screen */
  decelerate: "cubic-bezier(0.0, 0.0, 0.2, 1)",
  /** Acceleration curve — objects leaving the screen */
  accelerate: "cubic-bezier(0.4, 0.0, 1, 1)",
  /** Sharp curve — may return to original position */
  sharp: "cubic-bezier(0.4, 0.0, 0.6, 1)",
} as const;

export const reducedMotion = {
  /** When prefers-reduced-motion, use this duration for all animations */
  duration: "0.01ms",
  /** CSS for reduced motion */
  css: `@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }`,
} as const;

export type Duration = keyof typeof duration;
export type Easing = keyof typeof easing;
